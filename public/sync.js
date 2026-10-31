export const clone=v=>JSON.parse(JSON.stringify(v));
export class SyncDraft{
 constructor({note,send,onChange=()=>{},onMeasure=null,clock=null,uuid=()=>crypto.randomUUID()}){
  this.uuid=uuid;this.send=send;this.onChange=onChange;this.onMeasure=onMeasure;this.clock=clock;
  this.note=clone(note);this.baseRevision=note.revision??null;
  this.version=0;this.pending=null;this.dirty=false;this.status='clean';this.error=null;
  this.running=null;this.disposed=false;
 }
 emit(){this.onChange(this);}
 edit(patch){const snapshot={};for(const [key,value] of Object.entries(patch))snapshot[key]=value&&typeof value==='object'?clone(value):value;Object.assign(this.note,snapshot);this.version++;this.dirty=true;if(this.status!=='conflict')this.status='draft';this.error=null;this.emit();}
 async flush(){
  if(this.disposed||!this.dirty)return;
  if(this.status==='conflict')throw Error('CONFLICT_REQUIRES_REVIEW');
  if(this.running)return this.running;
  const task=this.saveOne();this.running=task;try{return await task;}finally{this.running=null;}
 }
 async saveOne(){
  if(!this.note.title?.trim()){this.status='draft';this.emit();return;}
  const clock=this.onMeasure&&this.clock?this.clock:null,guardStarted=clock?clock():0;
  // The frozen operation is kept in this page's memory for exact retries.
  if(!this.pending)this.pending={clientOpId:this.uuid(),version:this.version,payload:{action:'save',id:this.note.id,revision:this.baseRevision,title:this.note.title,text:this.note.text,checklist:clone(this.note.checklist??[]),...(this.note.folder!==undefined?{folder:this.note.folder}:{}),...(this.note.pinned!==undefined?{pinned:this.note.pinned}:{})}};
  const pending=clone(this.pending);this.status='saving';this.emit();
  try{
   if(clock)this.onMeasure('save_guard_ms',clock()-guardStarted);
   const ackStarted=clock?clock():0;
   const result=await this.send({...pending.payload,clientOpId:pending.clientOpId});
   if(result.clientOpId!==pending.clientOpId||!result.acknowledgedRevision)throw Error('ACK_UNVERIFIED');
   if(result.revision!==result.acknowledgedRevision){this.status='conflict';this.error=Object.assign(Error('HEAD_CHANGED_AFTER_ACK'),{status:409});this.emit();return;}
   if(clock)this.onMeasure('server_ack_ms',clock()-ackStarted,{version:pending.version});
   this.baseRevision=result.acknowledgedRevision;this.note.revision=this.baseRevision;this.pending=null;
   if(this.version===pending.version){
    this.note=clone(result);this.dirty=false;this.status='saved';
   }
   else{this.status='draft';}
   this.error=null;this.emit();return result;
  }catch(e){
   this.error=e;this.status=e.status===409?'conflict':e.status===401?'login-required':'error';
   // Never allocate a replacement operation after a timeout. Keep its frozen payload.
   this.emit();throw e;
  }
 }
 dispose(){this.disposed=true;}
}
// A delivery window, not a durable background job. Pending operation data lives
// only in the open page and is lost when that page is closed or reloaded.
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
function requestSignal(external,timeout){
 const controller=new AbortController(),abort=()=>controller.abort(external?.reason),timer=setTimeout(()=>controller.abort(new DOMException('Request timed out','TimeoutError')),timeout);
 if(external?.aborted)abort();else external?.addEventListener('abort',abort,{once:true});
 return {signal:controller.signal,dispose(){clearTimeout(timer);external?.removeEventListener('abort',abort);}};
}
export function apiClient({route,token,fetcher=fetch,timeout=30000,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),random=Math.random,getRetries=3,onTiming=null}={}){
 return async(path,params={})=>{
  const {method='GET',data,query='',long=false,signal,diagnosticTrace}=params;
  const combined=requestSignal(signal,long?120000:timeout);
  try{
    let response;for(let attempt=0;;attempt++){const networkStarted=onTiming&&diagnosticTrace?performance.now():0;if(onTiming&&diagnosticTrace)onTiming(diagnosticTrace,'request');try{response=await fetcher('/api/app?route='+encodeURIComponent(route??path)+query+(diagnosticTrace?'&diag=1':''),{method,credentials:'same-origin',headers:{...(method!=='GET'?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},...(data!==undefined?{body:JSON.stringify(data)}:{}),cache:'no-store',signal:combined.signal});if(onTiming&&diagnosticTrace){onTiming(diagnosticTrace,'network_ms',performance.now()-networkStarted);const timing=response.headers?.get?.('Server-Timing')??'';for(const part of timing.split(',')){const match=/^(server_pre_response|server_auth|server_store_init|server_store_operation);dur=([0-9]+(?:\.[0-9]+)?)$/.exec(part.trim());if(match)onTiming(diagnosticTrace,match[1]+'_ms',Number(match[2]));}}}
    catch(error){if(onTiming&&diagnosticTrace){onTiming(diagnosticTrace,'network_ms',performance.now()-networkStarted);onTiming(diagnosticTrace,'error',error?.status);}throw error;}
    if(method!=='GET'||response.status!==423||attempt>=getRetries)break;await response.body?.cancel();await wait(1000+Math.floor(random()*500)+attempt*500);}
   const bodyStarted=onTiming&&diagnosticTrace?performance.now():0;let body;try{body=await response.json();if(onTiming&&diagnosticTrace)onTiming(diagnosticTrace,'response_body_ms',performance.now()-bodyStarted);}catch{if(onTiming&&diagnosticTrace){onTiming(diagnosticTrace,'response_body_ms',performance.now()-bodyStarted);onTiming(diagnosticTrace,'error',response.status);}throw Object.assign(Error('INVALID_RESPONSE'),{status:response.status});}
   if(!response.ok&&onTiming&&diagnosticTrace)onTiming(diagnosticTrace,'error',response.status);
   if(!response.ok)throw Object.assign(Error(body.code??'REQUEST_FAILED'),{status:response.status,reference:body.reference});return body;
  }finally{combined.dispose();}
 };
}
