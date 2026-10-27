/*
 * Experimental native Firestore repository. Not wired into api/app.js.
 * Firestore is injected so local tests can exercise transaction decisions
 * without pretending that a mock proves Cloud Firestore behavior.
 */
import {createHash, randomBytes, timingSafeEqual} from 'node:crypto';
import {noteInput, StoreError, validNoteId} from './store.mjs';

const fail=(condition,status,code)=>{if(!condition)throw new StoreError(status,code);};
const digest=value=>createHash('sha256').update(value).digest('hex');
const json=value=>JSON.stringify(value);
const clone=value=>JSON.parse(JSON.stringify(value));
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
 fail(doc?.active===true&&doc.tokenHash&&timingSafeEqual(Buffer.from(doc.tokenHash,'hex'),Buffer.from(supplied.tokenHash,'hex')),403,'CAPABILITY_DENIED');
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
 constructor(db,{now=()=>new Date().toISOString(),maxAttempts=5,onTransactionAttempt=()=>{}}={}){
  this.db=db;this.now=now;this.maxAttempts=maxAttempts;this.onTransactionAttempt=onTransactionAttempt;
 }
 note(id){fail(validNoteId(id),400,'INVALID_NOTE_ID');return this.db.collection('notes').doc(id);}
 share(id){fail(/^[a-f0-9]{32}$/.test(id),400,'INVALID_SHARE_ID');return this.db.collection('shares').doc(id);}
 accessGuard(scope,target){return this.db.collection('accessGuards').doc(`${scope}_${digest(target).slice(0,40)}`);}
 async read(id,{capabilityToken=null,knownRevision=null}={}){
  const ref=this.note(id);
  return this.db.runTransaction(async tx=>{
   this.onTransactionAttempt('read');
   const metaRef=ref,metaShot=await tx.get(metaRef),meta=metaShot.exists?metaShot.data():null;
   const shareInfo=capabilityToken?shareToken(capabilityToken):null;
   const shareShot=shareInfo?await tx.get(this.share(shareInfo.id)):null;
   const share=shareShot?checkShare(shareShot.data(),capabilityToken):null;
   fail(meta?.state==='active',404,'NOTE_NOT_FOUND');
   if(share){
    fail(share.scope==='note'?share.target===id:share.scope==='folder'&&share.target===meta.folderId,404,'NOTE_OUTSIDE_SHARE');
   }
   const revision=meta.revision;
   if(knownRevision===revision)return {notModified:true,revision};
   const versionQuery=ref.collection('versions').orderBy('revision','desc').limit(6);
   const versionRows=await tx.get(versionQuery);
   const currentShot=versionRows.docs.find(row=>row.data().revision===meta.currentRevision);
   fail(currentShot,503,'VERSION_MISSING');
   const versionRef=ref.collection('versions').doc(versionId(meta.currentRevision));
   const value=await readVersion(tx,versionRef,currentShot);
   fail(value.id===id&&value.revision===meta.currentRevision,503,'NOTE_REVISION_MISMATCH');
   const previousRows=versionRows.docs.filter(row=>row.data().revision<meta.currentRevision).slice(0,5);
   const previousValues=await Promise.all(previousRows.map(row=>readVersion(tx,ref.collection('versions').doc(versionId(row.data().revision)),row)));
   const history=previousValues.map(old=>({title:old.title,text:old.text,checklist:old.checklist,folder:old.folder??'',updatedAt:old.updatedAt}));
   const note={...value,folder:meta.folderId??'',revision,history};
   return share?{note,permission:share.permission}:note;
  },{maxAttempts:this.maxAttempts});
 }
 async save(id,patch,expectedRevision,opId,{capabilityToken=null,includeNote=false,inboxFolder=null}={}){
  fail(validNoteId(id)&&validNoteId(opId),400,'INVALID_OPERATION');
  fail(patch&&typeof patch==='object'&&!Array.isArray(patch),400,'INVALID_NOTE');
  const ref=this.note(id),opRef=ref.collection('operations').doc(opId),shareInfo=capabilityToken?shareToken(capabilityToken):null;
  const requestHash=digest(json({id,patch,expectedRevision,actor:shareInfo?.id??'owner',inboxFolder}));
  const saved=await this.db.runTransaction(async tx=>{
   this.onTransactionAttempt('save');
   const [metaShot,opShot]=await Promise.all([tx.get(ref),tx.get(opRef)]);
   const meta=metaShot.exists?metaShot.data():null;
   const shareShot=shareInfo?await tx.get(this.share(shareInfo.id)):null;
   const share=shareShot?checkShare(shareShot.data(),capabilityToken,true):null;
   if(opShot.exists){
    const receipt=opShot.data();fail(receipt.requestHash===requestHash,409,'OP_ID_REUSE');
    if(share)fail(share.active===true,403,'CAPABILITY_DENIED');
    return {...receipt.result,replay:true};
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
   let current={id,title:'',text:'',checklist:[],pinned:false,folder:meta?.folderId??'',history:[]};
   if(meta){
    const oldRef=ref.collection('versions').doc(versionId(currentRevision));
    current=await readVersion(tx,oldRef,await tx.get(oldRef));
   }
   const folderId=share?(meta?.folderId??share.target):(patch.folder??current.folder??'');
   if(share)fail(patch.folder===undefined||patch.folder===folderId,403,'SHARE_CANNOT_MOVE');
   const incoming=noteInput({...current,...patch,folder:folderId,pinned:share?(current.pinned??false):(patch.pinned??current.pinned??false),checklist:patch.checklist??current.checklist??[]});
   const revision=Number(meta?.revision??0)+1,updatedAt=this.now();
   const value={id,...incoming,folder:folderId,updatedAt,revision};
   const encoded=encodeVersion(value),newVersionRef=ref.collection('versions').doc(versionId(revision));
   encoded.manifest.revision=revision;
   const nextMeta={schema:1,state:'active',revision:`${revision}`,currentRevision:revision,folderId,updatedAt,deletedAt:null,trashFolder:null};
   const result={id,revision:String(revision)};
   tx.set(newVersionRef,encoded.manifest);
   encoded.chunks.forEach((bytes,index)=>tx.create(newVersionRef.collection('chunks').doc(String(index).padStart(4,'0')),{payload:bytes}));
   tx.set(ref,nextMeta);
   tx.create(opRef,{requestHash,result,createdAt:updatedAt});
   return result;
  },{maxAttempts:this.maxAttempts});
  if(includeNote&&!saved.note){const note=await this.read(id,{capabilityToken});saved.note=capabilityToken?note.note:note;}
  return saved;
 }
 async createShare({scope,target,permission='view',token=randomBytes(32).toString('hex'),id=randomBytes(16).toString('hex')}){
  fail(['note','folder'].includes(scope)&&['view','edit'].includes(permission),400,'INVALID_SHARE');
  fail(/^[a-f0-9]{32}$/.test(id),400,'INVALID_SHARE_ID');
  const secret=token;
  const doc={scope,target,permission,tokenHash:digest(secret),active:true,createdAt:this.now(),epoch:1};
  const targetRef=scope==='note'?this.note(target):null,guardRef=this.accessGuard(scope,target);
  await this.db.runTransaction(async tx=>{
   this.onTransactionAttempt('createShare');
   const [targetShot,guardShot]=await Promise.all([targetRef?tx.get(targetRef):Promise.resolve(null),tx.get(guardRef)]);
   if(targetRef)fail(targetShot.exists&&targetShot.data().state==='active',404,'SHARE_TARGET_MISSING');
   const guard=guardShot.exists?guardShot.data():{activeCount:0};
   tx.create(this.share(id),doc);tx.set(guardRef,{activeCount:guard.activeCount+1,updatedAt:this.now()});
  },{maxAttempts:this.maxAttempts});
  return {id,token:id+'.'+secret};
 }
 async revokeShare(id){
  const ref=this.share(id);
  return this.db.runTransaction(async tx=>{
   this.onTransactionAttempt('revokeShare');
   const shot=await tx.get(ref);fail(shot.exists,404,'SHARE_NOT_FOUND');
   const row=shot.data(),guardRef=this.accessGuard(row.scope,row.target),guardShot=await tx.get(guardRef);
   if(row.active){tx.update(ref,{active:false,revokedAt:this.now(),epoch:(row.epoch??0)+1});tx.set(guardRef,{activeCount:Math.max(0,(guardShot.data()?.activeCount??0)-1),updatedAt:this.now()});}
   return {revoked:true};
  },{maxAttempts:this.maxAttempts});
 }
 async inboxStatus(id,folderId){
  const note=await this.read(id);fail(note.folder===folderId,403,'INBOX_SCOPE_DENIED');
  return {id,revision:note.revision,textHash:digest(note.text)};
 }
}

export const firestoreNativeLimits=Object.freeze({maxDocumentBytes:MAX_DOC_BYTES,chunkThresholdBytes:CHUNK_THRESHOLD,chunkBytes:CHUNK_BYTES});
