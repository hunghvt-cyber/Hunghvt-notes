// Experimental Firestore transport for the existing NotesStore protocol.
// It is intentionally dependency-injected: production auth/project wiring is a
// separate reviewed step, and tests can use the Firestore emulator or a fake.
import {createHash,randomUUID} from 'node:crypto';
import {NoteStore} from './store.mjs';

const ORIGIN='https://app.koofr.net';
const MAX_FILE_BYTES=3_100_000;
const CHUNK_BYTES=700*1024; // leave room below Firestore's 1 MiB document limit
const MUTABLE_FILES=new Set(['catalog.json','restore-control.json']);
const safeFile=f=>{
 if(typeof f!=='string')return false;
 if(['note.json','backup.json','recovered.json','catalog.json','store-backup.json','restore-control.json'].includes(f))return true;
 const slot=/^note-(\d{3})-[a-f0-9-]{36}\.json$/.exec(f);if(slot)return Number(slot[1])<=127;
 return /^note-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.json$/.test(f);
};
const sha=s=>createHash('sha256').update(s).digest('hex');
const snapData=s=>s?.exists?s.data():undefined;
const binary=b=>Buffer.isBuffer(b)?b:Buffer.from(typeof b?.toBuffer==='function'?b.toBuffer():b??[]);
const xml=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const leaseToken=value=>{const m=/^\((<[^<>\r\n]{1,300}>)\)$/.exec(value??'');return m?.[1];};

export function createFirestoreDav({db,namespace,file='catalog.json',now=()=>Date.now(),onCall=()=>{}}={}){
 if(!db||typeof db.collection!=='function'||typeof namespace!=='string'||!namespace)throw Error('FIRESTORE_CONFIG_INVALID');
 if(!safeFile(file))throw Error('PATH_FORBIDDEN');
 const storeId=sha(namespace),root=db.collection('notesStores').doc(storeId),objects=root.collection('objects'),lockRef=root.collection('control').doc('root-lock');
 const fileRef=name=>objects.doc(name),chunkRef=(name,index)=>fileRef(name).collection('chunks').doc(String(index).padStart(3,'0'));
 const calls=[];let createdRootHere=false;
 async function readFile(name){
  const snapshot=await db.runTransaction(async tx=>{
   const manifest=snapData(await tx.get(fileRef(name)));if(!manifest)return {missing:true};
   if(manifest.schema!==1||!Number.isInteger(manifest.chunks)||manifest.chunks<1||manifest.chunks>8||!Number.isSafeInteger(manifest.sizeBytes)||manifest.sizeBytes<0||manifest.sizeBytes>MAX_FILE_BYTES||typeof manifest.sha256!=='string')return {invalid:true};
   const parts=await Promise.all(Array.from({length:manifest.chunks},(_,i)=>tx.get(chunkRef(name,i))));return {manifest,parts};
  });
  if(snapshot.missing)return {status:404,text:''};if(snapshot.invalid)return {status:503,text:''};
  const body=Buffer.concat(snapshot.parts.map(s=>binary(snapData(s)?.bytes)));if(body.length!==snapshot.manifest.sizeBytes||sha(body)!==snapshot.manifest.sha256)return {status:503,text:''};
  return {status:200,text:body.toString('utf8')};
 }
 async function listFiles(){const s=await objects.get();return s.docs.map(d=>d.id).filter(safeFile);}
 async function call(label,method,body,headers={},folder=false){
  const started=performance.now(),row={label,method};let result;
  try{
   if(folder&&method==='MKCOL'){
    result=await db.runTransaction(async tx=>{const existing=await tx.get(root);if(existing.exists)return {status:405};tx.create(root,{schema:1,namespaceHash:storeId,createdAtMs:now()});return {status:201};});if(result.status===201)createdRootHere=true;
   }else if(method==='LOCK'){
    const requested=Number(/Second-(\d+)/.exec(headers.Timeout??'')?.[1]??60),ttl=Math.max(5,Math.min(120,requested)),token='<'+randomUUID()+'>';
    result=await db.runTransaction(async tx=>{const base=await tx.get(root);if(!base.exists)return {status:404};const old=await tx.get(lockRef),active=snapData(old);if(active&&active.expiresAtMs>now())return {status:423};tx.set(lockRef,{token,expiresAtMs:now()+ttl*1000});return {status:200,token,timeout:'Second-'+ttl};});
   }else if(method==='UNLOCK'){
    const token=headers['Lock-Token'];result=await db.runTransaction(async tx=>{const old=await tx.get(lockRef),active=snapData(old);if(!active||active.token!==token||active.expiresAtMs<=now())return {status:409};tx.delete(lockRef);return {status:204};});
   }else if(method==='GET') result=await readFile(file);
   else if(method==='PUT'){
    if(typeof body!=='string'||Buffer.byteLength(body)>MAX_FILE_BYTES)return {status:413,text:''};
    const bytes=Buffer.from(body,'utf8'),parts=[];for(let p=0;p<bytes.length;p+=CHUNK_BYTES)parts.push(bytes.subarray(p,p+CHUNK_BYTES));if(!parts.length)parts.push(Buffer.alloc(0));
    result=await db.runTransaction(async tx=>{
     const base=await tx.get(root);if(!base.exists)return {status:404};const token=leaseToken(headers.If);let lease;
     if(token){lease=snapData(await tx.get(lockRef));if(!lease||lease.token!==token||lease.expiresAtMs<=now())return {status:412};}
     else if(file!=='catalog.json'||!createdRootHere)return {status:412};
     else{lease=snapData(await tx.get(lockRef));if(lease&&lease.expiresAtMs>now())return {status:412};}
     const ref=fileRef(file),old=snapData(await tx.get(ref));if(old&&!MUTABLE_FILES.has(file))return {status:412};
     const oldCount=old?.chunks??0;if(!Number.isInteger(oldCount)||oldCount<0||oldCount>8)return {status:503};
     const oldChunks=await Promise.all(Array.from({length:oldCount},(_,i)=>tx.get(chunkRef(file,i))));
     const manifest={schema:1,chunks:parts.length,sizeBytes:bytes.length,sha256:sha(bytes)};
     for(let i=0;i<parts.length;i++)tx.set(chunkRef(file,i),{bytes:parts[i]});
     for(let i=parts.length;i<oldCount;i++)tx.delete(chunkRef(file,i));
     tx.set(ref,manifest);return {status:200};
    });if(result.status===200&&file==='catalog.json'&&!leaseToken(headers.If))createdRootHere=false;
   }else if(method==='DELETE'){
    const token=leaseToken(headers.If);result=await db.runTransaction(async tx=>{
     const [base,lease,manifestSnap]=await Promise.all([tx.get(root),tx.get(lockRef),tx.get(fileRef(file))]),leaseData=snapData(lease),manifest=snapData(manifestSnap);
     if(!base.exists)return {status:404};if(!token||!leaseData||leaseData.token!==token||leaseData.expiresAtMs<=now())return {status:412};if(!manifest)return {status:404};
     if(!Number.isInteger(manifest.chunks)||manifest.chunks<0||manifest.chunks>8)return {status:503};const chunks=await Promise.all(Array.from({length:manifest.chunks},(_,i)=>tx.get(chunkRef(file,i))));
     for(let i=0;i<chunks.length;i++)tx.delete(chunkRef(file,i));tx.delete(fileRef(file));return {status:204};
    });
   }else if(method==='PROPFIND'){
    const files=await listFiles(),base='/dav/Koofr/'+encodeURIComponent(namespace)+'/';result={status:207,text:'<?xml version="1.0"?><d:multistatus xmlns:d="DAV:">'+files.map(name=>'<d:response><d:href>'+xml(base+encodeURIComponent(name))+'</d:href><d:propstat><d:prop><d:resourcetype/></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>').join('')+'</d:multistatus>'};
   }else result={status:405,text:''};
   row.status=result.status;return result;
  }catch{
   row.error='FIRESTORE_UNAVAILABLE';throw Error('FIRESTORE_UNAVAILABLE');
  }finally{
   row.ms=performance.now()-started;calls.push(row);try{onCall(row);}catch{}
  }
 }
 return {call,calls,root,objects,lockRef};
}

export function createFirestoreNoteStore(input,{db,now=()=>Date.now(),lease=60}={}){
 return new NoteStore({...input,transport:'pooled'},{lease,now:()=>new Date(now()).toISOString(),makeDav:(cfg,options)=>createFirestoreDav({db,namespace:cfg.namespace,file:options.file,now,onCall:options.onCall})});
}
