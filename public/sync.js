export const clone=v=>JSON.parse(JSON.stringify(v));
export class DraftVault{
 constructor(){this.db=null;}
 async open(){if(this.db)return this;this.db=await new Promise((resolve,reject)=>{const r=indexedDB.open('hunghvt-notes-drafts-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('drafts',{keyPath:'key'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('DRAFT_STORAGE_BLOCKED'));});return this;}
 async tx(mode,fn){await this.open();return new Promise((resolve,reject)=>{const t=this.db.transaction('drafts',mode),r=fn(t.objectStore('drafts'));t.oncomplete=()=>resolve(r?.result);t.onabort=()=>reject(t.error??Error('DRAFT_STORAGE_FAILED'));t.onerror=()=>reject(t.error??Error('DRAFT_STORAGE_FAILED'));});}
 put(d){return this.tx('readwrite',s=>s.put(clone(d)));}
 remove(key){return this.tx('readwrite',s=>s.delete(key));}
 async list(scope){return (await this.tx('readonly',s=>s.getAll())).filter(d=>d.scope===scope).sort((a,b)=>b.updatedAt-a.updatedAt);}
}
export class SyncDraft{
 constructor({note,scope,vault,send,onChange=()=>{},uuid=()=>crypto.randomUUID(),restored}){
  this.uuid=uuid;this.scope=scope;this.vault=vault;this.send=send;this.onChange=onChange;
  this.key=uuid();this.note=clone(restored?.note??note);this.baseRevision=restored?.baseRevision??note.revision??null;
  this.version=restored?.version??0;this.pending=clone(restored?.pending??null);this.dirty=!!restored;this.status=restored?'draft':'clean';this.error=null;this.persisted=false;
  this.writes=Promise.resolve();this.running=null;this.disposed=false;
 }
 record(){return {key:this.key,scope:this.scope,note:clone(this.note),baseRevision:this.baseRevision,version:this.version,pending:clone(this.pending),updatedAt:Date.now()};}
 emit(){this.onChange(this);}
 async persist(){const record=this.record();const task=this.writes.catch(()=>{}).then(()=>this.vault.put(record));this.writes=task;try{await task;this.persisted=true;}catch(e){this.persisted=false;this.status='local-error';this.error=e;this.emit();throw e;}this.emit();}
 edit(patch){Object.assign(this.note,clone(patch));this.version++;this.dirty=true;if(this.status!=='conflict')this.status='draft';this.error=null;this.persisted=false;const saved=this.persist();this.emit();return saved;}
 async flush(){
  if(this.disposed||!this.dirty)return;
  if(this.status==='conflict')throw Error('CONFLICT_REQUIRES_REVIEW');
  if(this.running)return this.running;
  const task=this.saveOne();this.running=task;try{return await task;}finally{this.running=null;}
 }
 async saveOne(){
  if(!this.note.title?.trim()){this.status='draft';this.emit();return;}
  // The exact operation and base survive uncertain responses and page reloads.
  if(!this.pending)this.pending={clientOpId:this.uuid(),version:this.version,payload:{action:'save',id:this.note.id,revision:this.baseRevision,title:this.note.title,text:this.note.text,checklist:clone(this.note.checklist??[]),...(this.note.folder!==undefined?{folder:this.note.folder}:{}),...(this.note.pinned!==undefined?{pinned:this.note.pinned}:{})}};
  await this.persist();const pending=clone(this.pending);this.status='saving';this.emit();
  try{
   const result=await this.send({...pending.payload,clientOpId:pending.clientOpId});
   if(result.clientOpId!==pending.clientOpId||!result.acknowledgedRevision)throw Error('ACK_UNVERIFIED');
   if(result.revision!==result.acknowledgedRevision){this.status='conflict';this.error=Object.assign(Error('HEAD_CHANGED_AFTER_ACK'),{status:409});await this.persist();this.emit();return;}
   this.baseRevision=result.acknowledgedRevision;this.note.revision=this.baseRevision;this.pending=null;
   await this.writes;
   if(this.version===pending.version){
    this.note=clone(result);this.dirty=false;this.status='saved';this.persisted=true;
    // Enqueue deletion before subsequent input writes, then recheck the version.
    const remove=this.writes.then(()=>this.vault.remove(this.key));this.writes=remove;await remove;
    if(this.version!==pending.version){this.dirty=true;this.status='draft';await this.persist();}
   }
   else{this.status='draft';await this.persist();}
   this.error=null;this.emit();return result;
  }catch(e){
   this.error=e;this.status=e.status===409?'conflict':e.status===401?'login-required':'error';
   // Never allocate a replacement operation after a timeout. Keep its frozen payload.
   await this.persist().catch(()=>{});this.emit();throw e;
  }
 }
 dispose(){this.disposed=true;}
}
export function apiClient({route,token,fetcher=fetch,timeout=30000,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),random=Math.random}={}){
 return async(path,{method='GET',data,query='',long=false}={})=>{
  let response;for(let attempt=0;;attempt++){response=await fetcher('/api/app?route='+encodeURIComponent(route??path)+query,{method,credentials:'same-origin',headers:{...(method!=='GET'?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},...(data!==undefined?{body:JSON.stringify(data)}:{}),cache:'no-store',signal:AbortSignal.timeout(long?120000:timeout)});if(method!=='GET'||response.status!==423||attempt>=3)break;await response.body?.cancel();await wait(1000+Math.floor(random()*500)+attempt*500);}
  let body;try{body=await response.json();}catch{throw Object.assign(Error('INVALID_RESPONSE'),{status:response.status});}
  if(!response.ok)throw Object.assign(Error(body.code??'REQUEST_FAILED'),{status:response.status,reference:body.reference});return body;
 };
}
