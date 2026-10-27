/*
 * Native Firestore repository. Production selection remains explicitly gated.
 * Firestore is injected so local tests can exercise transaction decisions
 * without pretending that a mock proves Cloud Firestore behavior.
 */
import {createHash, randomBytes, timingSafeEqual} from 'node:crypto';
import {folders as defaultFolders,newCapability,noteId as slotId,noteInput,parseNote,StoreError,validNoteId} from './store.mjs';

const fail=(condition,status,code)=>{if(!condition)throw new StoreError(status,code);};
const digest=value=>createHash('sha256').update(value).digest('hex');
const json=value=>JSON.stringify(value);
const clone=value=>JSON.parse(JSON.stringify(value));
const folderName=value=>{fail(typeof value==='string'&&value.trim()&&value.length<=80,400,'INVALID_FOLDER');return value.trim();};
const versionId=revision=>String(revision).padStart(12,'0');
const MAX_DOC_BYTES=1024*1024;
const CHUNK_BYTES=700*1024;
const CHUNK_THRESHOLD=750*1024;

function shareToken(raw){
 fail(typeof raw==='string'&&/^[a-f0-9]{32}\.[a-f0-9]{64}$/.test(raw),403,'CAPABILITY_DENIED');
 const [id,secret]=raw.split('.');return {id,tokenHash:digest(secret)};
}
function checkShare(doc,token,write=false){
 const supplied=shareToken(token);
 fail(doc?.active===true&&/^[a-f0-9]{64}$/.test(doc.tokenHash??'')&&timingSafeEqual(Buffer.from(doc.tokenHash,'hex'),Buffer.from(supplied.tokenHash,'hex')),403,'CAPABILITY_DENIED');
 fail(!write||doc.permission==='edit',403,'READ_ONLY_SHARE');
 return {id:supplied.id,...doc};
}
function decodeVersion(snapshot){
 fail(snapshot?.exists,503,'VERSION_MISSING');
 const row=snapshot.data();
 if(row.chunkCount===0){
  const payload=Buffer.from(row.payload??'','base64');
  fail(digest(payload)===row.payloadHash,503,'VERSION_HASH_MISMATCH');
  return JSON.parse(payload.toString('utf8'));
 }
 return null;
}
async function readVersion(tx,ref,snapshot){
 const row=snapshot.data();
 fail(Number.isInteger(row.chunkCount)&&row.chunkCount>=0&&row.chunkCount<=3,503,'INVALID_VERSION_MANIFEST');
 if(row.chunkCount===0)return decodeVersion(snapshot);
 const refs=Array.from({length:row.chunkCount},(_,i)=>ref.collection('chunks').doc(String(i).padStart(4,'0')));
 const chunks=await Promise.all(refs.map(x=>tx.get(x)));
 fail(chunks.every(x=>x.exists),503,'VERSION_CHUNK_MISSING');
 const payload=Buffer.concat(chunks.map(x=>x.data().payload));
 fail(digest(payload)===row.payloadHash,503,'VERSION_HASH_MISMATCH');
 return JSON.parse(payload.toString('utf8'));
}
function encodeVersion(value){
 const bytes=Buffer.from(json(value));
 fail(bytes.length<=1000000,413,'NOTE_TOO_LARGE');
 if(bytes.length<=CHUNK_THRESHOLD){
  const payload=bytes.toString('base64');
  fail(Buffer.byteLength(payload)+512<MAX_DOC_BYTES,413,'VERSION_DOC_TOO_LARGE');
  return {manifest:{chunkCount:0,payload,payloadHash:digest(bytes),byteLength:bytes.length},chunks:[]};
 }
 const chunks=[];
 for(let offset=0;offset<bytes.length;offset+=CHUNK_BYTES)chunks.push(bytes.subarray(offset,offset+CHUNK_BYTES));
 return {manifest:{chunkCount:chunks.length,payloadHash:digest(bytes),byteLength:bytes.length},chunks};
}

export class FirestoreNativeRepository{
 constructor(db,{now=()=>new Date().toISOString(),maxAttempts=5,onTransactionAttempt=()=>{},vaultId='default'}={}){
  fail(db&&typeof db.collection==='function'&&/^[a-z][a-z0-9-]{2,60}$/.test(vaultId),400,'FIRESTORE_CONFIG_INVALID');
  this.db=db;this.now=now;this.maxAttempts=maxAttempts;this.onTransactionAttempt=onTransactionAttempt;this.vaultId=vaultId;
  this.root=db.collection('notesVaults').doc(vaultId);
 }
 collection(name){return this.root.collection(name);}
 vault(){return this.root;}
 note(id){fail(validNoteId(id),400,'INVALID_NOTE_ID');return this.collection('notes').doc(id);}
 share(id){fail(/^[a-f0-9]{32}$/.test(id),400,'INVALID_SHARE_ID');return this.collection('shares').doc(id);}
 accessGuard(scope,target){return this.collection('accessGuards').doc(`${scope}_${digest(target).slice(0,40)}`);}
 folder(name){return this.collection('folders').doc(digest(name).slice(0,40));}
 async initialize({epoch=randomBytes(16).toString('hex'),folders:initialFolders=defaultFolders}={}){
  fail(/^[a-f0-9-]{16,64}$/.test(epoch)&&Array.isArray(initialFolders),400,'INVALID_VAULT_INIT');
  return this.db.runTransaction(async tx=>{
   const old=await tx.get(this.root);fail(!old.exists,409,'VAULT_ALREADY_INITIALIZED');
   tx.create(this.root,{schema:1,epoch,restoring:false,createdAt:this.now(),orderRevision:0});
   for(const name of initialFolders){const clean=folderName(name);tx.create(this.folder(clean),{name:clean,state:'active',generation:1,createdAt:this.now()});}
   tx.create(this.collection('orders').doc('owner'),{ids:[],revision:0});
   return {initialized:true,vaultId:this.vaultId,epoch};
  },{maxAttempts:this.maxAttempts});
 }
 async read(id,{capabilityToken=null,knownRevision=null}={}){
  const ref=this.note(id);
  return this.db.runTransaction(async tx=>{
   this.onTransactionAttempt('read');
   const vaultShot=await tx.get(this.root),vault=vaultShot.exists?vaultShot.data():null;
   fail(vault&&!vault.restoring,503,vault?'RESTORE_INCOMPLETE':'VAULT_NOT_INITIALIZED');
   const metaRef=ref,metaShot=await tx.get(metaRef),meta=metaShot.exists?metaShot.data():null;
   const shareInfo=capabilityToken?shareToken(capabilityToken):null;
   const shareShot=shareInfo?await tx.get(this.share(shareInfo.id)):null;
   const share=shareShot?checkShare(shareShot.data(),capabilityToken):null;
   fail(meta?.state==='active',404,'NOTE_NOT_FOUND');
   if(share){
    if(share.scope==='note')fail(share.targetAclEpoch===(meta.aclEpoch??1),403,'CAPABILITY_DENIED');
    if(share.scope==='folder'){
     const folderShot=await tx.get(this.folder(share.target));
     fail(folderShot.exists&&folderShot.data().state==='active',403,'CAPABILITY_DENIED');
    }
    fail(share.scope==='note'?share.target===id:share.scope==='folder'&&share.target===meta.folderId,404,'NOTE_OUTSIDE_SHARE');
   }
   const revision=`${vault.epoch}:${meta.version}`;
   if(knownRevision===revision)return {notModified:true,revision};
   const versionQuery=ref.collection('versions').orderBy('revision','desc').limit(6);
   const versionRows=await tx.get(versionQuery);
   const currentShot=versionRows.docs.find(row=>row.data().revision===meta.currentRevision);
   fail(currentShot,503,'VERSION_MISSING');
   const versionRef=ref.collection('versions').doc(versionId(meta.currentRevision));
   const value=await readVersion(tx,versionRef,currentShot);
   fail(value.id===id,503,'NOTE_REVISION_MISMATCH');
   const previousRows=versionRows.docs.filter(row=>row.data().revision<meta.currentRevision).slice(0,5);
   const previousValues=await Promise.all(previousRows.map(row=>readVersion(tx,ref.collection('versions').doc(versionId(row.data().revision)),row)));
   const history=previousValues.map(old=>({title:old.title,text:old.text,checklist:old.checklist,folder:old.folder??'',updatedAt:old.updatedAt}));
   const note={...value,folder:meta.folderId??'',revision,history};
   return share?{note,permission:share.permission}:note;
  },{maxAttempts:this.maxAttempts});
 }
 async list(actor={owner:true}){
  return this.db.runTransaction(async tx=>{
   this.onTransactionAttempt('list');
   const [vaultShot,rows]=await Promise.all([tx.get(this.root),tx.get(this.collection('notes').where('state','==','active'))]);
   const vault=vaultShot.exists?vaultShot.data():null;fail(vault&&!vault.restoring,503,vault?'RESTORE_INCOMPLETE':'VAULT_NOT_INITIALIZED');
   let share=null;
   if(!actor?.owner){const info=shareToken(actor?.token),shot=await tx.get(this.share(info.id));share=checkShare(shot.data(),actor.token);}
   if(share?.scope==='note'){
    const row=rows.docs.find(x=>x.id===share.target);fail(row,404,'NOTE_NOT_FOUND');
    fail(share.targetAclEpoch===(row.data().aclEpoch??1),403,'CAPABILITY_DENIED');
    return [this.summaryRow(row.data(),vault)];
   }
   if(share?.scope==='folder'){
    const folderShot=await tx.get(this.folder(share.target));fail(folderShot.exists&&folderShot.data().state==='active',403,'CAPABILITY_DENIED');
   }
   return rows.docs.map(x=>x.data()).filter(x=>!share||x.folderId===share.target).map(x=>this.summaryRow(x,vault));
  },{maxAttempts:this.maxAttempts});
 }
 summaryRow(meta,vault){return {id:meta.id,folder:meta.folderId??'',...(meta.summary??{}),revision:`${vault.epoch}:${meta.version??0}`};}
 async listWithFolders(actor={owner:true}){
  fail(actor?.owner,403,'OWNER_REQUIRED');
  return this.db.runTransaction(async tx=>{
   this.onTransactionAttempt('list-with-folders');
   const [vaultShot,notes,folders,shares,order]=await Promise.all([
    tx.get(this.root),tx.get(this.collection('notes').where('state','==','active')),
    tx.get(this.collection('folders').where('state','==','active')),
    tx.get(this.collection('shares')),tx.get(this.collection('orders').doc('owner'))
   ]);
   const vault=vaultShot.exists?vaultShot.data():null;fail(vault&&!vault.restoring,503,vault?'RESTORE_INCOMPLETE':'VAULT_NOT_INITIALIZED');
   const activeFolders=new Set(folders.docs.map(x=>x.data().name));
   const activeNotes=notes.docs.map(x=>x.data());
   const sharedFolders=[...new Set(shares.docs.map(x=>x.data()).filter(x=>x.active&&x.scope==='folder'&&activeFolders.has(x.target)).map(x=>x.target))];
   const orderRow=order.exists?order.data():{ids:[],revision:0};
   return {notes:activeNotes.map(x=>this.summaryRow(x,vault)),folders:[...activeFolders].sort((a,b)=>a.localeCompare(b,'vi')),sharedFolders,order:orderRow.ids??[],orderRevision:`${vault.epoch}:${orderRow.revision??0}`};
  },{maxAttempts:this.maxAttempts});
 }
 async readShared(scope,id=null,actor,{accessOnly=false}={}){
  if(accessOnly){
   const token=actor?.token,info=shareToken(token);
   return this.db.runTransaction(async tx=>{
    const [vaultShot,shareShot]=await Promise.all([tx.get(this.root),tx.get(this.share(info.id))]);
    const vault=vaultShot.exists?vaultShot.data():null;fail(vault&&!vault.restoring,503,vault?'RESTORE_INCOMPLETE':'VAULT_NOT_INITIALIZED');
    const share=checkShare(shareShot.data(),token);fail(share.scope===scope,403,'WRONG_SHARE_SCOPE');
    if(scope==='note'){
     const meta=await tx.get(this.note(share.target));fail(meta.exists&&meta.data().state==='active',404,'NOTE_NOT_FOUND');
     fail(share.targetAclEpoch===(meta.data().aclEpoch??1),403,'CAPABILITY_DENIED');
    }else{
     const folder=await tx.get(this.folder(share.target));fail(folder.exists&&folder.data().state==='active',404,'FOLDER_NOT_FOUND');
    }
    return {permission:share.permission};
   },{maxAttempts:this.maxAttempts});
  }
  const info=shareToken(actor?.token),shareSnap=await this.share(info.id).get(),share=checkShare(shareSnap.data(),actor.token);
  fail(share.scope===scope,403,'WRONG_SHARE_SCOPE');
  if(scope==='note'){
   const result=await this.read(id??share.target,{capabilityToken:actor.token});
   return {note:result.note??result,permission:share.permission};
  }
  const rows=await this.list({token:actor.token});
  return {folder:share.target,permission:share.permission,notes:rows,previewOnly:true};
 }
 async save(id,patch,expectedRevision,opId,{capabilityToken=null,includeNote=false,inboxFolder=null}={}){
  fail(validNoteId(id)&&validNoteId(opId),400,'INVALID_OPERATION');
  fail(patch&&typeof patch==='object'&&!Array.isArray(patch),400,'INVALID_NOTE');
  const ref=this.note(id),opRef=ref.collection('operations').doc(opId),globalOpRef=this.collection('operationReceipts').doc(opId),shareInfo=capabilityToken?shareToken(capabilityToken):null;
  const requestHash=digest(json({id,patch,expectedRevision,actor:shareInfo?.id??'owner',inboxFolder}));
  const legacyRequestHash=digest(json({slot:id,patch,expected:expectedRevision,actor:shareInfo?.id??'owner'}));
  const saved=await this.db.runTransaction(async tx=>{
   this.onTransactionAttempt('save');
   const [vaultShot,metaShot,opShot,globalOpShot]=await Promise.all([tx.get(this.root),tx.get(ref),tx.get(opRef),tx.get(globalOpRef)]);
   const vault=vaultShot.exists?vaultShot.data():null;fail(vault&&!vault.restoring,503,vault?'RESTORE_INCOMPLETE':'VAULT_NOT_INITIALIZED');
   const meta=metaShot.exists?metaShot.data():null;
   const shareShot=shareInfo?await tx.get(this.share(shareInfo.id)):null;
   const share=shareShot?checkShare(shareShot.data(),capabilityToken,true):null;
   if(share?.scope==='note'&&meta)fail(share.targetAclEpoch===(meta.aclEpoch??1),403,'CAPABILITY_DENIED');
   if(share?.scope==='folder'){
    const folderShot=await tx.get(this.folder(share.target));
    fail(folderShot.exists&&folderShot.data().state==='active',403,'CAPABILITY_DENIED');
   }
   if(opShot.exists||globalOpShot.exists){
    const receipt=(globalOpShot.exists?globalOpShot:opShot).data();fail(receipt.requestHash===requestHash||receipt.requestHash===legacyRequestHash,409,'OP_ID_REUSE');
    if(share)fail(share.active===true,403,'CAPABILITY_DENIED');
    return {...(receipt.result??{id,revision:receipt.revision}),replay:true};
   }
   if(share){
    fail(share.scope==='note'?share.target===id:share.scope==='folder'&&(!meta||share.target===meta.folderId),404,'NOTE_OUTSIDE_SHARE');
    fail(meta||share.scope==='folder',403,'NOTE_SHARE_CANNOT_CREATE');
   }
   if(inboxFolder){
    fail(!share&&patch.folder===inboxFolder&&(!meta||meta.folderId===inboxFolder||(meta.state==='trash'&&meta.trashFolder===inboxFolder)),403,'INBOX_SCOPE_DENIED');
    const [noteGuard,folderGuard]=await Promise.all([tx.get(this.accessGuard('note',id)),tx.get(this.accessGuard('folder',inboxFolder))]);
    fail((noteGuard.data()?.activeCount??0)===0&&(folderGuard.data()?.activeCount??0)===0,403,'INBOX_SHARED_TARGET');
   }
   fail(!meta||meta.state==='active'||(inboxFolder&&meta.state==='trash'),409,'NOTE_DELETED');
   const currentRevision=meta?.currentRevision??0;
   fail(meta?expectedRevision===meta.revision:expectedRevision===null,409,'REVISION_CONFLICT');
   let current={id,title:'',text:'',checklist:[],pinned:false,history:[]};
   if(meta){
    const oldRef=ref.collection('versions').doc(versionId(currentRevision));
    current=await readVersion(tx,oldRef,await tx.get(oldRef));
   }
   const folderId=share?(meta?.folderId??share.target):(patch.folder??current.folder??'');
   if(share)fail(patch.folder===undefined||patch.folder===folderId,403,'SHARE_CANNOT_MOVE');
   const incoming=noteInput({...current,...patch,folder:folderId,pinned:share?(current.pinned??false):(patch.pinned??current.pinned??false),checklist:patch.checklist??current.checklist??[]});
   if(folderId){
    const folderRef=this.folder(folderId),folderShot=await tx.get(folderRef);
    if(!folderShot.exists&&!share)tx.create(folderRef,{name:folderId,state:'active',generation:1,createdAt:updatedAt});
    else fail(folderShot.exists&&folderShot.data().state==='active',404,'FOLDER_NOT_FOUND');
   }
   const contentRevision=Number(meta?.currentRevision??0)+1,logicalVersion=Number(meta?.version??0)+1,updatedAt=this.now();
   const history=meta?[{title:current.title,text:current.text,checklist:current.checklist,folder:meta.folderId??'',updatedAt:current.updatedAt},...(current.history??[])].slice(0,5):[];
   const value={id,...incoming,updatedAt,history};
   const encoded=encodeVersion(value),newVersionRef=ref.collection('versions').doc(versionId(contentRevision));
   encoded.manifest.revision=contentRevision;
   const revisionTag=`${vault.epoch}:${logicalVersion}`;
   const nextMeta={schema:1,id,state:'active',revision:revisionTag,version:logicalVersion,currentRevision:contentRevision,folderId,updatedAt,deletedAt:null,trashFolder:null,aclEpoch:meta?.aclEpoch??1,summary:{title:value.title,text:value.text.slice(0,100),pinned:value.pinned===true,updatedAt}};
   const result={id,revision:revisionTag};
   tx.set(newVersionRef,encoded.manifest);
   encoded.chunks.forEach((bytes,index)=>tx.create(newVersionRef.collection('chunks').doc(String(index).padStart(4,'0')),{payload:bytes}));
   tx.set(ref,nextMeta);
   tx.create(opRef,{requestHash,result,createdAt:updatedAt});tx.create(globalOpRef,{noteId:id,requestHash,result,createdAt:updatedAt});
   return includeNote?{...result,note:{...value,folder:folderId,revision:revisionTag}}:result;
  },{maxAttempts:this.maxAttempts});
  if(includeNote&&!saved.note){const note=await this.read(id,{capabilityToken});saved.note=capabilityToken?note.note:note;}
  return saved;
 }
 async createShare({scope,target,permission='view',token=randomBytes(32).toString('hex'),id=randomBytes(16).toString('hex'),tokenBox}){
  fail(['note','folder'].includes(scope)&&['view','edit'].includes(permission),400,'INVALID_SHARE');
  fail(/^[a-f0-9]{32}$/.test(id),400,'INVALID_SHARE_ID');
  const secret=token;
  const doc={scope,target,permission,tokenHash:digest(secret),active:true,createdAt:this.now(),epoch:1,...(tokenBox?{tokenBox}:{})};
  const targetRef=scope==='note'?this.note(target):this.folder(target),guardRef=this.accessGuard(scope,target);
  await this.db.runTransaction(async tx=>{
   this.onTransactionAttempt('createShare');
   const [vaultShot,targetShot,guardShot]=await Promise.all([tx.get(this.root),tx.get(targetRef),tx.get(guardRef)]);
   const vault=vaultShot.exists?vaultShot.data():null;fail(vault&&!vault.restoring,503,vault?'RESTORE_INCOMPLETE':'VAULT_NOT_INITIALIZED');
   fail(targetShot.exists&&targetShot.data().state==='active',404,'SHARE_TARGET_MISSING');
   const guard=guardShot.exists?guardShot.data():{activeCount:0};
   const targetAclEpoch=scope==='note'?(targetShot.data().aclEpoch??1):undefined;
   tx.create(this.share(id),{...doc,...(targetAclEpoch===undefined?{}:{targetAclEpoch})});tx.set(guardRef,{activeCount:guard.activeCount+1,updatedAt:this.now()});
  },{maxAttempts:this.maxAttempts});
  return {id,token:id+'.'+secret};
 }
 async revokeShare(id){
  const ref=this.share(id);
  return this.db.runTransaction(async tx=>{
   this.onTransactionAttempt('revokeShare');
   const shot=await tx.get(ref);fail(shot.exists,404,'SHARE_NOT_FOUND');
   const row=shot.data(),guardRef=this.accessGuard(row.scope,row.target),guardShot=await tx.get(guardRef);
   let counted=row.active;
   if(row.active&&row.scope==='note'){
    const target=await tx.get(this.note(row.target));counted=target.exists&&row.targetAclEpoch===(target.data().aclEpoch??1);
   }
   if(row.active){tx.update(ref,{active:false,revokedAt:this.now(),epoch:(row.epoch??0)+1});if(counted)tx.set(guardRef,{activeCount:Math.max(0,(guardShot.data()?.activeCount??0)-1),updatedAt:this.now()});}
   return {revoked:true};
  },{maxAttempts:this.maxAttempts});
 }
 async remove(id,expectedRevision,actor={owner:true}){
  fail(actor?.owner,403,'OWNER_REQUIRED');const ref=this.note(id);
  return this.db.runTransaction(async tx=>{
   const [vaultShot,noteShot]=await Promise.all([tx.get(this.root),tx.get(ref)]),vault=vaultShot.data(),meta=noteShot.data();
   fail(vault&&!vault.restoring,503,vault?'RESTORE_INCOMPLETE':'VAULT_NOT_INITIALIZED');fail(meta,404,'NOTE_NOT_FOUND');
   if(meta.state==='trash')return {deleted:true,replay:true};
   fail(meta.state==='active',409,meta.state==='purged'?'NOTE_PURGED':'PURGE_IN_PROGRESS');
   fail(expectedRevision===meta.revision,409,'REVISION_CONFLICT');
   const version=(meta.version??0)+1;
   tx.update(ref,{state:'trash',trashFolder:meta.folderId??'',deletedAt:this.now(),version,revision:`${vault.epoch}:${version}`});
   return {deleted:true};
  },{maxAttempts:this.maxAttempts});
 }
 async trash(id=null,actor={owner:true},query=''){
  fail(actor?.owner,403,'OWNER_REQUIRED');fail(typeof query==='string'&&query.length<=200,400,'INVALID_SEARCH');
  const vault=(await this.root.get()).data();fail(vault&&!vault.restoring,503,vault?'RESTORE_INCOMPLETE':'VAULT_NOT_INITIALIZED');
  if(id){const meta=(await this.note(id).get()).data();fail(meta?.state==='trash',404,'NOTE_NOT_IN_TRASH');const note=await this.readVersionOutside(this.note(id),meta.currentRevision);return {...note,folder:meta.trashFolder??meta.folderId??'',revision:meta.revision};}
  const rows=await this.collection('notes').where('state','==','trash').get(),needle=query.toLocaleLowerCase('vi'),out=[];
  for(const snapshot of rows.docs){
   const meta=snapshot.data();let summary=meta.summary??{},match=!needle||[summary.title,summary.text,meta.trashFolder,meta.folderId].some(x=>String(x??'').toLocaleLowerCase('vi').includes(needle));
   if(needle&&!match){const note=await this.readVersionOutside(snapshot.ref,meta.currentRevision);match=[note.text,...(note.checklist??[]).map(x=>x.text)].some(x=>x.toLocaleLowerCase('vi').includes(needle));}
   if(match)out.push({id:meta.id,folder:meta.trashFolder??meta.folderId??'',...summary,revision:meta.revision,...(meta.purgeOp?{purging:true,purgeOp:meta.purgeOp}:{})});
  }
  return {notes:out};
 }
 async readVersionOutside(ref,revision){
  const snap=await ref.collection('versions').doc(versionId(revision)).get();fail(snap.exists,503,'VERSION_MISSING');
  const row=snap.data();let value;
  if(row.chunkCount===0)value=decodeVersion(snap);
  else{const chunks=await Promise.all(Array.from({length:row.chunkCount},(_,i)=>ref.collection('versions').doc(versionId(revision)).collection('chunks').doc(String(i).padStart(4,'0')).get()));fail(chunks.every(x=>x.exists),503,'VERSION_CHUNK_MISSING');const payload=Buffer.concat(chunks.map(x=>x.data().payload));fail(digest(payload)===row.payloadHash,503,'VERSION_HASH_MISMATCH');value=JSON.parse(payload.toString('utf8'));}
  return value;
 }
 async restoreNote(id,expectedRevision,actor={owner:true}){
  fail(actor?.owner,403,'OWNER_REQUIRED');const ref=this.note(id);
  return this.db.runTransaction(async tx=>{
   const [vaultShot,noteShot]=await Promise.all([tx.get(this.root),tx.get(ref)]),vault=vaultShot.data(),meta=noteShot.data();
   fail(vault&&!vault.restoring,503,vault?'RESTORE_INCOMPLETE':'VAULT_NOT_INITIALIZED');fail(meta,404,'NOTE_NOT_FOUND');
   if(meta.state==='active'){fail(expectedRevision===`${vault.epoch}:${meta.version-1}`,409,'REVISION_CONFLICT');return {restored:true,replay:true};}
   fail(meta.state==='trash',409,meta.state==='purged'?'NOTE_PURGED':'PURGE_IN_PROGRESS');fail(expectedRevision===meta.revision,409,'REVISION_CONFLICT');
   const original=meta.trashFolder??meta.folderId??'',folderRef=original?this.folder(original):null,folderShot=folderRef?await tx.get(folderRef):null;
   const guardRef=this.accessGuard('note',id),guardShot=await tx.get(guardRef),version=(meta.version??0)+1,folder=folderShot?.exists&&folderShot.data().state==='active'?original:'';
   tx.update(ref,{state:'active',folderId:folder,trashFolder:null,deletedAt:null,version,revision:`${vault.epoch}:${version}`,aclEpoch:(meta.aclEpoch??1)+1});
   tx.set(guardRef,{activeCount:0,updatedAt:this.now(),aclEpoch:(meta.aclEpoch??1)+1});
   void guardShot;
   return {restored:true,revision:`${vault.epoch}:${version}`};
  },{maxAttempts:this.maxAttempts});
 }
 async purgeNote(id,expectedRevision,opId,actor={owner:true}){
  fail(actor?.owner,403,'OWNER_REQUIRED');fail(validNoteId(opId),400,'INVALID_PURGE');const ref=this.note(id);
  const marked=await this.db.runTransaction(async tx=>{
   const [vaultShot,noteShot,orderShot]=await Promise.all([tx.get(this.root),tx.get(ref),tx.get(this.collection('orders').doc('owner'))]),vault=vaultShot.data(),meta=noteShot.data();
   fail(vault&&!vault.restoring,503,vault?'RESTORE_INCOMPLETE':'VAULT_NOT_INITIALIZED');fail(meta,404,'NOTE_NOT_FOUND');
   if(meta.state==='purged'){fail(meta.purgeOp===opId&&meta.purgeRevision===expectedRevision,409,'PURGE_OPERATION_CHANGED');return {done:true,replay:true};}
   if(meta.state==='purging')fail(meta.purgeOp===opId&&meta.purgeRevision===expectedRevision,409,'PURGE_IN_PROGRESS');
   else{fail(meta.state==='trash',409,'NOTE_NOT_IN_TRASH');fail(meta.revision===expectedRevision,409,'REVISION_CONFLICT');
    tx.update(ref,{state:'purging',purgeOp:opId,purgeRevision:expectedRevision,aclEpoch:(meta.aclEpoch??1)+1});
    tx.set(this.accessGuard('note',id),{activeCount:0,updatedAt:this.now(),aclEpoch:(meta.aclEpoch??1)+1});}
   const order=orderShot.data();if(order?.ids?.includes(id))tx.set(this.collection('orders').doc('owner'),{ids:order.ids.filter(x=>x!==id),revision:(order.revision??0)+1,updatedAt:this.now()});
   return {done:false};
  },{maxAttempts:this.maxAttempts});
  if(marked.done)return {purged:true,replay:true};
  // The per-note state fences all writers before recursive deletion. Retrying the same
  // operation resumes safely; other note documents remain independent.
  const subcollections=await ref.listCollections();
  for(const collection of subcollections){
   const docs=await collection.get();
   for(const doc of docs.docs)await this.db.recursiveDelete(doc.ref);
  }
  const shares=await this.collection('shares').where('scope','==','note').get();
  for(const share of shares.docs)if(share.data().target===id)await share.ref.delete();
  await this.db.runTransaction(async tx=>{
   const shot=await tx.get(ref),meta=shot.data();fail(meta?.state==='purging'&&meta.purgeOp===opId&&meta.purgeRevision===expectedRevision,409,'PURGE_OPERATION_CHANGED');
   tx.update(ref,{state:'purged',purgedAt:this.now()});
  },{maxAttempts:this.maxAttempts});
  return {purged:true};
 }
 async createFolder(name,actor={owner:true}){
  fail(actor?.owner,403,'OWNER_REQUIRED');const clean=folderName(name),ref=this.folder(clean);
  return this.db.runTransaction(async tx=>{const [vault,old]=await Promise.all([tx.get(this.root),tx.get(ref)]);fail(vault.exists&&!vault.data().restoring,503,vault.exists?'RESTORE_INCOMPLETE':'VAULT_NOT_INITIALIZED');if(old.exists&&old.data().state==='active')return {folder:clean,replay:true};tx.set(ref,{name:clean,state:'active',generation:(old.data()?.generation??0)+1,createdAt:this.now()});return {folder:clean};},{maxAttempts:this.maxAttempts});
 }
 async deleteFolder(name,deleteNotes=false,actor={owner:true}){
  fail(actor?.owner,403,'OWNER_REQUIRED');const clean=folderName(name);fail(typeof deleteNotes==='boolean',400,'INVALID_FOLDER_DELETE_MODE');
  const folderRef=this.folder(clean),requestHash=digest(json({folder:clean,deleteNotes}));let jobRef,alreadyDone;
  await this.db.runTransaction(async tx=>{
   const [vaultShot,folderShot,running,shares]=await Promise.all([tx.get(this.root),tx.get(folderRef),tx.get(this.collection('folderOperations').where('folder','==',clean).where('state','==','running')),tx.get(this.collection('shares').where('scope','==','folder'))]);
   const vault=vaultShot.data();fail(vault&&!vault.restoring,503,vault?'RESTORE_INCOMPLETE':'VAULT_NOT_INITIALIZED');
   fail(folderShot.exists,404,'FOLDER_NOT_FOUND');const folder=folderShot.data(),generation=folder.generation??1;
   jobRef=this.collection('folderOperations').doc(digest(`${clean}\0${generation}\0${deleteNotes}`));const finished=await tx.get(jobRef);
   if(folder.state==='deleted'&&finished.exists&&finished.data().state==='complete'&&finished.data().requestHash===requestHash){alreadyDone={affected:finished.data().affected};return;}
   if(running.docs.length){const job=running.docs[0];fail(job.data().requestHash===requestHash&&job.data().generation===generation,409,'FOLDER_BUSY');jobRef=job.ref;return;}
   fail(folder.state==='active',409,'FOLDER_BUSY');
   fail(!shares.docs.some(x=>x.data().active&&x.data().target===clean),409,'FOLDER_STILL_SHARED');
   tx.update(folderRef,{state:'deleting',deleteMode:deleteNotes?'trash':'unfiled',deleteStartedAt:this.now()});tx.create(jobRef,{requestHash,folder:clean,generation,deleteNotes,affected:0,state:'running',createdAt:this.now()});
  },{maxAttempts:this.maxAttempts});
  if(alreadyDone)return {deleted:true,notesAffected:alreadyDone.affected,replay:true};
  while(true){
   const page=await this.db.runTransaction(async tx=>{
    const [vaultShot,folderShot,jobShot,notes]=await Promise.all([tx.get(this.root),tx.get(folderRef),tx.get(jobRef),tx.get(this.collection('notes').where('folderId','==',clean).where('state','==','active').limit(200))]);
    const vault=vaultShot.data(),job=jobShot.data();fail(vault&&!vault.restoring,503,vault?'RESTORE_INCOMPLETE':'VAULT_NOT_INITIALIZED');
    if(job?.state==='complete'&&job.requestHash===requestHash&&folderShot.data()?.state==='deleted')return {done:true,affected:job.affected,replay:true};
    fail(folderShot.exists&&folderShot.data().state==='deleting'&&job?.state==='running'&&job.requestHash===requestHash,409,'FOLDER_DELETE_STATE_CHANGED');
    if(!notes.docs.length){tx.update(folderRef,{state:'deleted',deletedAt:this.now()});tx.update(jobRef,{state:'complete',completedAt:this.now()});return {done:true,affected:job.affected};}
    for(const shot of notes.docs){const meta=shot.data(),next=(meta.version??0)+1;tx.update(shot.ref,{folderId:deleteNotes?clean:'',...(deleteNotes?{state:'trash',trashFolder:clean,deletedAt:this.now()}:{}) ,version:next,revision:`${vault.epoch}:${next}`});}
    tx.update(jobRef,{affected:(job.affected??0)+notes.docs.length});return {done:false};
   },{maxAttempts:this.maxAttempts});
   if(page.done)return {deleted:true,notesAffected:page.affected,...(page.replay?{replay:true}:{})};
  }
 }
 async folderNames(actor={owner:true}){
  fail(actor?.owner,403,'OWNER_REQUIRED');const rows=await this.collection('folders').where('state','==','active').get();return rows.docs.map(x=>x.data().name).sort((a,b)=>a.localeCompare(b,'vi'));
 }
 async moveNotes(items,destination,opId,actor={owner:true}){
  fail(actor?.owner,403,'OWNER_REQUIRED');fail(Array.isArray(items)&&items.length>0&&items.length<=500&&items.every(x=>validNoteId(x.id)&&typeof x.revision==='string')&&new Set(items.map(x=>x.id)).size===items.length&&validNoteId(opId),400,'INVALID_MOVE');
  fail(typeof destination==='string'&&destination.length<=80,400,'INVALID_FOLDER');destination=destination.trim();const requestHash=digest(json({kind:'move',items,destination})),receiptRef=this.collection('operationReceipts').doc(opId);
  return this.db.runTransaction(async tx=>{
   const vaultShot=await tx.get(this.root),receipt=await tx.get(receiptRef),vault=vaultShot.data();fail(vault&&!vault.restoring,503,vault?'RESTORE_INCOMPLETE':'VAULT_NOT_INITIALIZED');
   if(receipt.exists){const old=receipt.data();fail(old.requestHash===requestHash,409,'OP_ID_REUSE');return {...old.result,replay:true};}
   let folderRef=null,folderShot=null;if(destination){folderRef=this.folder(destination);folderShot=await tx.get(folderRef);if(!folderShot.exists)tx.create(folderRef,{name:destination,state:'active',generation:1,createdAt:this.now()});else fail(folderShot.data().state==='active',409,'FOLDER_BUSY');}
   const rows=await Promise.all(items.map(x=>tx.get(this.note(x.id))));
   for(let i=0;i<items.length;i++){const meta=rows[i].data();fail(meta?.state==='active',404,'NOTE_NOT_FOUND');fail(items[i].revision===meta.revision,409,'REVISION_CONFLICT');fail(!meta.purgeOp,409,'PURGE_IN_PROGRESS');}
   for(let i=0;i<items.length;i++){const meta=rows[i].data();if(meta.folderId===destination)continue;const version=(meta.version??0)+1;tx.update(rows[i].ref,{folderId:destination,version,revision:`${vault.epoch}:${version}`});}
   const result={moved:items.length};tx.create(receiptRef,{kind:'move',requestHash,result,createdAt:this.now()});return result;
  },{maxAttempts:this.maxAttempts});
 }
 async reorderNotes(ids,expectedRevision,opId,actor={owner:true}){
  fail(actor?.owner,403,'OWNER_REQUIRED');fail(Array.isArray(ids)&&ids.length<=500&&ids.every(validNoteId)&&new Set(ids).size===ids.length&&validNoteId(opId),400,'INVALID_ORDER');
  const requestHash=digest(json({kind:'order',ids,expectedRevision})),orderRef=this.collection('orders').doc('owner'),receiptRef=this.collection('operationReceipts').doc(opId);
  return this.db.runTransaction(async tx=>{
   const [vaultShot,orderShot,receipt,rows]=await Promise.all([tx.get(this.root),tx.get(orderRef),tx.get(receiptRef),tx.get(this.collection('notes').where('state','==','active'))]);
   const vault=vaultShot.data();fail(vault&&!vault.restoring,503,vault?'RESTORE_INCOMPLETE':'VAULT_NOT_INITIALIZED');
   if(receipt.exists){const old=receipt.data();fail(old.requestHash===requestHash,409,'OP_ID_REUSE');return {...old.result,replay:true};}
   const order=orderShot.exists?orderShot.data():{ids:[],revision:0};fail(expectedRevision===`${vault.epoch}:${order.revision??0}`,409,'ORDER_CONFLICT');
   const active=rows.docs.map(x=>x.id).sort(),supplied=[...ids].sort();fail(active.length===supplied.length&&active.every((x,i)=>x===supplied[i]),409,'ORDER_MEMBERSHIP_CHANGED');
   const revision=(order.revision??0)+1,result={orderRevision:`${vault.epoch}:${revision}`};
   tx.set(orderRef,{ids,revision,updatedAt:this.now()});tx.create(receiptRef,{kind:'order',requestHash,result,createdAt:this.now()});return result;
  },{maxAttempts:this.maxAttempts});
 }
 async links(scope,target,actor={owner:true}){
  fail(actor?.owner,403,'OWNER_REQUIRED');fail(['note','folder'].includes(scope),400,'INVALID_SHARE');
  const [shares,targetShot]=await Promise.all([this.collection('shares').where('scope','==',scope).get(),scope==='note'?this.note(target).get():this.folder(target).get()]);
  const targetMeta=targetShot?.data(),aclEpoch=scope==='note'?(targetMeta?.aclEpoch??1):undefined;
  return shares.docs.filter(x=>x.data().target===target).map(x=>{const row=x.data(),revoked=!row.active||(scope==='note'&&row.targetAclEpoch!==aclEpoch);return {id:x.id,revoked,permission:row.permission,...(!revoked&&row.tokenBox?{tokenBox:row.tokenBox}:{})};});
 }
 async linkInfo(actor){
  const info=shareToken(actor?.token),snap=await this.share(info.id).get(),share=checkShare(snap.data(),actor.token);
  if(share.scope==='note'){const meta=(await this.note(share.target).get()).data();fail(meta?.state==='active'&&share.targetAclEpoch===(meta.aclEpoch??1),403,'CAPABILITY_DENIED');}
  else{const folder=(await this.folder(share.target).get()).data();fail(folder?.state==='active',403,'CAPABILITY_DENIED');}
  return {scope:share.scope,target:share.target,permission:share.permission};
 }
 async loginAttempt(key,now=Date.now()){
  fail(/^[a-f0-9]{64}$/.test(key),400,'INVALID_LOGIN_BUCKET');const bucket=Math.floor(now/900000),globalRef=this.collection('loginBuckets').doc(`global-${bucket}`),clientRef=this.collection('loginBuckets').doc(`${bucket}-${key}`);
  return this.db.runTransaction(async tx=>{
   const [globalShot,clientShot]=await Promise.all([tx.get(globalRef),tx.get(clientRef)]),global=globalShot.data()?.count??0,client=clientShot.data()?.count??0;
   fail(global<30&&client<5,429,'LOGIN_RATE_LIMITED');tx.set(globalRef,{bucket,count:global+1});tx.set(clientRef,{bucket,count:client+1});return {allowed:true};
  },{maxAttempts:this.maxAttempts});
 }
 async captureSnapshot({allowRestoring=false}={}){
  const captured=await this.db.runTransaction(async tx=>{
   this.onTransactionAttempt('backup-capture');
   const [vault,notes,folders,shares,order,receipts]=await Promise.all([
    tx.get(this.root),tx.get(this.collection('notes')),tx.get(this.collection('folders')),
    tx.get(this.collection('shares')),tx.get(this.collection('orders').doc('owner')),
   tx.get(this.collection('operationReceipts'))
   ]);
   fail(vault.exists&&(allowRestoring||!vault.data().restoring),503,vault.exists?'RESTORE_INCOMPLETE':'VAULT_NOT_INITIALIZED');
   const perNoteOperations=await Promise.all(notes.docs.map(x=>tx.get(x.ref.collection('operations'))));
   const allReceipts=new Map(receipts.docs.map(x=>[x.id,{opId:x.id,...x.data()}]));
   for(let i=0;i<notes.docs.length;i++)for(const receipt of perNoteOperations[i].docs)if(!allReceipts.has(receipt.id))allReceipts.set(receipt.id,{opId:receipt.id,noteId:notes.docs[i].id,...receipt.data()});
   return {vault:vault.data(),notes:notes.docs.map(x=>x.data()),folders:folders.docs.map(x=>x.data()),shares:shares.docs.map(x=>({id:x.id,...x.data()})),order:order.exists?order.data():{ids:[],revision:0},receipts:[...allReceipts.values()]};
  },{maxAttempts:this.maxAttempts});
  const {vault,notes,folders,shares,order,receipts}=captured;fail(folders.every(x=>x.state==='active'),503,'FOLDER_DELETE_IN_PROGRESS');
  const catalog={schema:1,epoch:vault.epoch,version:0,restoring:false,folders:{},entries:{},shares:{},receipts:[],noteOrder:order.ids??[],orderVersion:order.revision??0,erased:{}};
  for(const folder of folders)if(folder.state==='active')Object.defineProperty(catalog.folders,folder.name,{value:true,enumerable:true,writable:true,configurable:true});
  for(const meta of notes){
   if(meta.state==='purged'){catalog.erased[meta.id]={op:meta.purgeOp,revision:meta.purgeRevision};continue;}
   const value=await this.readVersionOutside(this.note(meta.id),meta.currentRevision),head=meta.sourceHead??`note-${meta.id}-${meta.headId??meta.id}.json`,opId=meta.headId??meta.id,requestHash=meta.headRequestHash??'0'.repeat(64);
   const valueHash=digest(json(value)),record=JSON.stringify({schema:2,opId,requestHash,value,valueHash});
   const entry={id:meta.id,...(Number.isInteger(meta.slot)?{slot:meta.slot}:{}),head,headHash:digest(record),folder:meta.folderId??'',version:meta.version??1,deleted:meta.state==='trash'||meta.state==='purging',summary:meta.summary??{title:value.title,text:value.text.slice(0,100),pinned:value.pinned===true,updatedAt:value.updatedAt}};
   if(meta.trashFolder)entry.trashFolder=meta.trashFolder;if(meta.state==='purging')entry.purge={op:meta.purgeOp,files:[]};
   catalog.entries[meta.id]=entry;
   captured.records??={};captured.records[head]=record;
  }
  for(const row of shares){const share=row;let revoked=!share.active;
   if(share.scope==='note'){const target=notes.find(x=>x.id===share.target);revoked||=!target||share.targetAclEpoch!==(target.aclEpoch??1);}
   catalog.shares[share.id]={scope:share.scope,target:share.target,permission:share.permission,tokenHash:share.tokenHash,revoked,epoch:share.epoch??1,...(share.tokenBox&&!revoked?{tokenBox:share.tokenBox}:{})};
  }
  catalog.receipts=receipts.map(({opId,...row})=>({opId,...row})).filter(x=>validNoteId(x.opId));
  return {catalog,records:captured.records??{}};
 }
 async capture(){return (await this.captureSnapshot()).catalog;}
 async verifyAll(){return this.captureSnapshot();}
 async exportLegacySnapshot(){
  const {encodeSnapshot,decodeSnapshot}=await import('./store-backup.mjs');
  const {catalog,records}=await this.captureSnapshot(),encoded=encodeSnapshot(catalog,records);
  fail(Buffer.byteLength(encoded)<=2_000_000,413,'SNAPSHOT_TOO_LARGE');decodeSnapshot(encoded);return JSON.parse(encoded);
 }
 async importLegacySnapshot(snapshot,{batchSize=200}={}){
  const {decodeSnapshot}=await import('./store-backup.mjs');
  fail(Number.isInteger(batchSize)&&batchSize>=1&&batchSize<=350,400,'RESTORE_BATCH_INVALID');
  const decoded=decodeSnapshot(JSON.stringify(snapshot)),catalog=decoded.catalog,records=decoded.records,snapshotHash=digest(json(snapshot));
  const old=await this.root.get();
  if(old.exists){const row=old.data();fail(row.restoring&&row.restoreSnapshotHash===snapshotHash,409,'VAULT_ALREADY_INITIALIZED');}
  else await this.db.runTransaction(async tx=>tx.create(this.root,{schema:1,epoch:catalog.epoch,restoring:true,restoreSnapshotHash:snapshotHash,expectedCount:Object.keys(catalog.entries).length,createdAt:this.now()}),{maxAttempts:this.maxAttempts});
  const current=(await this.root.get()).data();fail(current?.restoring&&current.restoreSnapshotHash===snapshotHash,409,'RESTORE_INCOMPLETE');
  const writes=[];
  for(const [name,active] of Object.entries(catalog.folders))if(active)writes.push([this.folder(name),{name,state:'active',generation:1,createdAt:this.now()}]);
  for(const entry of Object.values(catalog.entries)){
   fail(!entry.purge,409,'PURGE_IN_PROGRESS');const parsed=parseNote(records[entry.head]),value=parsed.value,id=entry.id;
   fail(validNoteId(id)&&value.id===id,400,'SNAPSHOT_ID_MISMATCH');
   const ref=this.note(id),history=(value.history??[]).slice(0,5).reverse(),contentRevision=history.length+1;
   for(let i=0;i<history.length;i++){
    const prior=history[i],revision=i+1,priorValue={id,title:prior.title,text:prior.text,checklist:prior.checklist??[],pinned:false,folder:prior.folder??'',updatedAt:prior.updatedAt??this.now(),history:[]},encodedPrior=encodeVersion(priorValue);
    encodedPrior.manifest.revision=revision;const versionRef=ref.collection('versions').doc(versionId(revision));writes.push([versionRef,encodedPrior.manifest]);
    encodedPrior.chunks.forEach((payload,index)=>writes.push([versionRef.collection('chunks').doc(String(index).padStart(4,'0')),{payload}]));
   }
   const encoded=encodeVersion(value);encoded.manifest.revision=contentRevision;
   const meta={schema:1,id,state:entry.deleted?'trash':'active',revision:`${catalog.epoch}:${entry.version}`,version:entry.version,currentRevision:contentRevision,folderId:entry.folder??'',updatedAt:value.updatedAt??this.now(),deletedAt:entry.deleted?this.now():null,trashFolder:entry.trashFolder??(entry.deleted?entry.folder??'':null),aclEpoch:1,summary:entry.summary??{title:value.title,text:value.text.slice(0,100),pinned:value.pinned===true,updatedAt:value.updatedAt}};
   writes.push([ref,meta],[ref.collection('versions').doc(versionId(contentRevision)),encoded.manifest]);
   encoded.chunks.forEach((payload,index)=>writes.push([ref.collection('versions').doc(versionId(contentRevision)).collection('chunks').doc(String(index).padStart(4,'0')),{payload}]));
  }
  for(const [id,erased] of Object.entries(catalog.erased??{}))if(!catalog.entries[id])writes.push([this.note(id),{schema:1,id,state:'purged',purgeOp:erased.op,purgeRevision:erased.revision,revision:`${catalog.epoch}:0`,version:0,currentRevision:0,folderId:'',aclEpoch:2}]);
  const activeCounts=new Map();
  for(const [id,share] of Object.entries(catalog.shares)){
   const target=share.target,active=!share.revoked;
   writes.push([this.share(id),{scope:share.scope,target,permission:share.permission,tokenHash:share.tokenHash,...(share.tokenBox?{tokenBox:share.tokenBox}:{}),active,createdAt:this.now(),epoch:share.epoch??1,...(share.scope==='note'?{targetAclEpoch:1}:{})}]);
   if(active)activeCounts.set(`${share.scope}\0${target}`,(activeCounts.get(`${share.scope}\0${target}`)??0)+1);
  }
  for(const [key,activeCount] of activeCounts){const [scope,target]=key.split('\0');writes.push([this.accessGuard(scope,target),{activeCount,updatedAt:this.now(),...(scope==='note'?{aclEpoch:1}:{})}]);}
  writes.push([this.collection('orders').doc('owner'),{ids:catalog.noteOrder??[],revision:catalog.orderVersion??0,updatedAt:this.now()}]);
  for(const receipt of catalog.receipts??[]){const {opId,...row}=receipt;writes.push([this.collection('operationReceipts').doc(opId),{...row,createdAt:this.now()}]);}
  for(let offset=0;offset<writes.length;offset+=batchSize){const batch=this.db.batch();for(const [ref,data] of writes.slice(offset,offset+batchSize))batch.set(ref,data);await batch.commit();}
  const verification=await this.captureSnapshot({allowRestoring:true}),{encodeSnapshot}=await import('./store-backup.mjs'),{compareSnapshots}=await import('./firestore-migration.mjs');
  const verified=JSON.parse(encodeSnapshot(verification.catalog,verification.records)),comparison=compareSnapshots(snapshot,verified);
  fail(comparison.match,503,'RESTORE_VERIFY_MISMATCH');
  await this.db.runTransaction(async tx=>{const root=await tx.get(this.root),row=root.data();fail(row?.restoring&&row.restoreSnapshotHash===snapshotHash,409,'RESTORE_SOURCE_CHANGED');tx.update(this.root,{restoring:false,restoredAt:this.now()});},{maxAttempts:this.maxAttempts});
  return {restored:Object.keys(catalog.entries).length,folders:Object.keys(catalog.folders).length,snapshotHash};
 }
 async inboxStatus(id,folderId){
  const note=await this.read(id);fail(note.folder===folderId,403,'INBOX_SCOPE_DENIED');
  return {id,revision:note.revision,textHash:digest(note.text)};
 }
}

export const firestoreNativeLimits=Object.freeze({maxDocumentBytes:MAX_DOC_BYTES,chunkThresholdBytes:CHUNK_THRESHOLD,chunkBytes:CHUNK_BYTES});

/* Drop-in store contract used by the existing API routes. UI/session/draft code
 * remains independent of the storage implementation. */
export class FirestoreNativeStore{
 constructor({namespace='default',vaultId=namespace},{db,now=()=>new Date().toISOString(),maxAttempts=5,ownsDb=true}={}){
  fail(db&&typeof db.collection==='function',503,'FIRESTORE_CLIENT_UNAVAILABLE');this.vaultId=vaultId;this.input={namespace};this.repo=new FirestoreNativeRepository(db,{now,maxAttempts,vaultId});this.metrics=[];this.closed=false;this.ownsDb=ownsDb;
 }
 async init(options){return this.repo.initialize(options);}
 async get(id,actor={owner:true},knownRevision=null){return this.repo.read(id,{capabilityToken:actor?.owner?null:actor?.token,knownRevision});}
 async getOwnerSingleLease(id,actor={owner:true},knownRevision=null){fail(actor?.owner,403,'OWNER_REQUIRED');return this.get(id,actor,knownRevision);}
 async readShared(scope,id,actor,options){return this.repo.readShared(scope,id,actor,options);}
 async list(actor={owner:true}){return this.repo.list(actor);}
 async listWithFolders(actor={owner:true}){return this.repo.listWithFolders(actor);}
 async save(slot,patch,expected,opId,actor={owner:true},{includeNote=false,shareScope,inboxScope}={}){
  const id=typeof slot==='number'?slotId(slot):slot;fail(validNoteId(id),400,'INVALID_OPERATION');
  if(shareScope)fail(!actor?.owner,403,'WRONG_SHARE_SCOPE');
  const result=await this.repo.save(id,patch,expected,opId,{capabilityToken:actor?.owner?null:actor?.token,includeNote,inboxFolder:inboxScope?.folder});
  return result;
 }
 async remove(id,expected,actor={owner:true}){return this.repo.remove(id,expected,actor);}
 async moveNotes(items,destination,opId,actor={owner:true}){return this.repo.moveNotes(items,destination,opId,actor);}
 async reorderNotes(ids,expected,opId,actor={owner:true}){return this.repo.reorderNotes(ids,expected,opId,actor);}
 async trash(id=null,actor={owner:true},query=''){return this.repo.trash(id,actor,query);}
 async purgeNote(id,expected,opId,actor={owner:true}){return this.repo.purgeNote(id,expected,opId,actor);}
 async restoreNote(id,expected,actor={owner:true}){return this.repo.restoreNote(id,expected,actor);}
 async createFolder(name,actor={owner:true}){return this.repo.createFolder(name,actor);}
 async deleteFolder(name,deleteNotes=false,actor={owner:true}){return this.repo.deleteFolder(name,deleteNotes,actor);}
 async folderNames(actor={owner:true}){return this.repo.folderNames(actor);}
 async share(scope,target,permission='edit',actor={owner:true},{protectToken}={}){
  fail(actor?.owner,403,'OWNER_REQUIRED');const c=newCapability();const tokenBox=protectToken?.(c.token);
  return this.repo.createShare({scope,target,permission,token:c.token.split('.')[1],id:c.id,tokenBox});
 }
 async revoke(id,actor={owner:true}){fail(actor?.owner,403,'OWNER_REQUIRED');return this.repo.revokeShare(id);}
 async links(scope,target,actor={owner:true}){return this.repo.links(scope,target,actor);}
 async linkInfo(actor){return this.repo.linkInfo(actor);}
 async loginAttempt(key,now=Date.now()){return this.repo.loginAttempt(key,now);}
 async capture(){return this.repo.capture();}
 async verifyAll(){return this.repo.verifyAll();}
 async exportLegacySnapshot(){return this.repo.exportLegacySnapshot();}
 async importLegacySnapshot(snapshot,options){return this.repo.importLegacySnapshot(snapshot,options);}
 async close(){if(this.closed)return;this.closed=true;if(this.ownsDb&&typeof this.repo.db.terminate==='function')await this.repo.db.terminate();}
}
