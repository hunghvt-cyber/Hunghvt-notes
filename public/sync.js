export const clone=v=>JSON.parse(JSON.stringify(v));
export class DraftVault{
 constructor(){this.db=null;}
 async open(){if(this.db)return this;this.db=await new Promise((resolve,reject)=>{const r=indexedDB.open('hunghvt-notes-drafts-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('drafts',{keyPath:'key'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('DRAFT_STORAGE_BLOCKED'));});return this;}
 async tx(mode,fn){await this.open();return new Promise((resolve,reject)=>{const t=this.db.transaction('drafts',mode),r=fn(t.objectStore('drafts'));t.oncomplete=()=>resolve(r?.result);t.onabort=()=>reject(t.error??Error('DRAFT_STORAGE_FAILED'));t.onerror=()=>reject(t.error??Error('DRAFT_STORAGE_FAILED'));});}
 put(d){return this.tx('readwrite',s=>s.put(d));}
 remove(key){return this.tx('readwrite',s=>s.delete(key));}
 async list(scope){return (await this.tx('readonly',s=>s.getAll())).filter(d=>d.scope===scope).sort((a,b)=>b.updatedAt-a.updatedAt);}
}
export class SyncDraft{
 constructor({note,scope,vault,send,onChange=()=>{},uuid=()=>crypto.randomUUID(),restored}){
  this.uuid=uuid;this.scope=scope;this.vault=vault;this.send=send;this.onChange=onChange;
  this.key=uuid();this.note=clone(restored?.note??note);this.baseRevision=restored?.baseRevision??note.revision??null;
  this.version=restored?.version??0;this.pending=clone(restored?.pending??null);this.dirty=!!restored;this.status=restored?'draft':'clean';this.error=null;this.persisted=false;
  this.writes=Promise.resolve();this.writeInFlight=null;this.writeAgain=false;this.running=null;this.disposed=false;
 }
 record(){return {key:this.key,scope:this.scope,note:this.note,baseRevision:this.baseRevision,version:this.version,pending:this.pending,updatedAt:Date.now()};}
 emit(){this.onChange(this);}
 persist(){
  if(this.writeInFlight){this.writeAgain=true;return this.writeInFlight;}
  const task=(async()=>{try{
   do{this.writeAgain=false;const version=this.version;await this.vault.put(this.record());if(this.version!==version)this.writeAgain=true;}while(this.writeAgain);
   this.persisted=true;this.emit();
  }catch(e){this.writeAgain=false;this.persisted=false;this.status='local-error';this.error=e;this.emit();throw e;}})();
  const completed=task.finally(()=>{if(this.writeInFlight===completed)this.writeInFlight=null;});this.writeInFlight=completed;this.writes=completed;return completed;
 }
 edit(patch){const snapshot={};for(const [key,value] of Object.entries(patch))snapshot[key]=value&&typeof value==='object'?clone(value):value;Object.assign(this.note,snapshot);this.version++;this.dirty=true;if(this.status!=='conflict')this.status='draft';this.error=null;this.persisted=false;const saved=this.persist();this.emit();return saved;}
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
// A delivery window, not a durable background job. Closing/suspending the page
// leaves SyncDraft's persisted operation available for an exact retry later.
export async function patientRetry(run,{wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),now=Date.now,random=Math.random,onWait=()=>{},canContinue=()=>true,budgetMs=120000,maxAttempts=32}={}){
 const started=now();let last;
 for(let attempt=0;attempt<maxAttempts;attempt++){
  if(!canContinue())throw Object.assign(Error('RETRY_CANCELLED'),{cancelled:true});
  if(attempt&&now()-started>=budgetMs)throw last;
  try{return await run();}catch(e){
   last=e;const transient=!e.status||[408,423,500,502,503,504].includes(e.status)||['ACK_UNVERIFIED','INVALID_RESPONSE'].includes(e.message);
   if(!transient||!canContinue()||attempt+1>=maxAttempts)throw e;
   const remaining=budgetMs-(now()-started),cap=Math.min(10000,1500*2**Math.min(attempt+1,3));
   const delay=1000+Math.floor(random()*(cap-1000));if(delay>=remaining)throw e;
   onWait({attempt:attempt+1,delay,error:e});await wait(delay);
  }
 }
 throw last;
}
// One browser tab shares one HTTP lane. A running request completes normally;
// queued saves go ahead of reads, and optional background work is last.
export class RequestLane{
 constructor(){this.active=false;this.queue=[];this.sequence=0;}
 run(fn,{priority=1,valid=()=>true}={}){return new Promise((resolve,reject)=>{this.queue.push({fn,priority,valid,resolve,reject,sequence:this.sequence++});this.drain();});}
 async drain(){
  if(this.active||!this.queue.length)return;
  this.queue.sort((a,b)=>b.priority-a.priority||a.sequence-b.sequence);const task=this.queue.shift();this.active=true;
  try{if(!task.valid())throw Object.assign(Error('BACKGROUND_DEFERRED'),{cancelled:true});task.resolve(await task.fn());}
  catch(e){task.reject(e);}finally{this.active=false;this.drain();}
 }
}
export function apiClient({route,token,fetcher=fetch,timeout=30000,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),random=Math.random,getRetries=3}={}){
 return async(path,{method='GET',data,query='',long=false}={})=>{
  let response;for(let attempt=0;;attempt++){response=await fetcher('/api/app?route='+encodeURIComponent(route??path)+query,{method,credentials:'same-origin',headers:{...(method!=='GET'?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},...(data!==undefined?{body:JSON.stringify(data)}:{}),cache:'no-store',signal:AbortSignal.timeout(long?120000:timeout)});if(method!=='GET'||response.status!==423||attempt>=getRetries)break;await response.body?.cancel();await wait(1000+Math.floor(random()*500)+attempt*500);}
  let body;try{body=await response.json();}catch{throw Object.assign(Error('INVALID_RESPONSE'),{status:response.status});}
  if(!response.ok)throw Object.assign(Error(body.code??'REQUEST_FAILED'),{status:response.status,reference:body.reference});return body;
 };
}
