// In-memory comparison only. Fixed per-call delays are a fixture knob, not Koofr timing.
import {randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {backend} from '../test/helpers/collection.mjs';
import {patientRetry} from '../public/sync.js';

const requestDelayMs=Number(process.env.NOTES_FIXTURE_REQUEST_DELAY_MS??5),samples=Number(process.env.NOTES_FIXTURE_SAMPLES??20);
if(!Number.isFinite(requestDelayMs)||requestDelayMs<0||requestDelayMs>100||!Number.isInteger(samples)||samples<1||samples>100)throw Error('FIXTURE_ARGUMENTS_INVALID');
const percentile=(values,q)=>{const sorted=[...values].sort((a,b)=>a-b);return Math.round((sorted[Math.max(0,Math.ceil(q*sorted.length)-1)]??0)*10)/10;};
const stats=values=>({n:values.length,p50Ms:percentile(values,.5),p95Ms:percentile(values,.95)});
const makeFixture=async()=>{
 const b=backend({requestDelayMs}),input={user:'fixture-user',password:'fixture-secret',namespace:'Homepage-Notes-Vercel-Probe-123-'+randomUUID()},owner=b.makeStore(input),id=randomUUID();
 await owner.init();const saved=await owner.save(id,{title:'Synthetic timing',text:'Fixture body',checklist:[]},null,randomUUID()),link=await owner.share('note',id,'edit');owner.agent.destroy();
 return {b,input,id,saved,link};
};
const solo=await makeFixture(),openSamples={'two-snapshot':[],'single-lease':[]},openCalls={'two-snapshot':[],'single-lease':[]};
for(let i=0;i<samples;i++)for(const variant of ['two-snapshot','single-lease']){
 const reader=solo.b.makeStore(solo.input),start=performance.now();try{
  const value=variant==='two-snapshot'?await reader.get(solo.id):await reader.getOwnerSingleLease(solo.id);
  if(value.revision!==solo.saved.revision)throw Error('FIXTURE_REVISION_MISMATCH');openSamples[variant].push(performance.now()-start);openCalls[variant].push(reader.transportCalls.length);
 }finally{reader.agent.destroy();}
}
const saveSamples=[];let saveRevision=solo.saved.revision;
for(let i=0;i<samples;i++){
 const writer=solo.b.makeStore(solo.input),start=performance.now();try{const r=await writer.save(solo.id,{text:'Fixture save '+i},saveRevision,randomUUID());saveRevision=r.revision;saveSamples.push(performance.now()-start);}finally{writer.agent.destroy();}
}
const contention=[];
for(const variant of ['two-snapshot','single-lease'])for(const writerKind of ['owner','share']){
 const f=await makeFixture(),reader=f.b.makeStore(f.input),entered=(()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve};})(),release=(()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve};})(),original=reader.readRecord.bind(reader);let paused=false;
 reader.readRecord=async e=>{if(!paused){paused=true;entered.resolve();await release.promise;}return original(e);};const openStart=performance.now(),opening=variant==='two-snapshot'?reader.get(f.id):reader.getOwnerSingleLease(f.id);await entered.promise;
 const target=writerKind==='owner'?f.b.makeStore(f.input):f.b.makeStore(f.input),actor=writerKind==='owner'?undefined:{token:f.link.token},options=writerKind==='owner'?{}:{shareScope:'note'},opId=randomUUID(),attemptStatuses=[];let virtualWaitMs=0;const retryWait=(()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve};})();
 const releaseSaveRetry=(()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve};})();const saveStart=performance.now(),saving=patientRetry(async()=>{
  try{const result=await target.save(f.id,{text:'Concurrent fixture edit'},f.saved.revision,opId,actor,options);attemptStatuses.push(result.revision?'success':'invalid');return result;}
  catch(e){attemptStatuses.push(e.status??'network');throw e;}
 },{now:()=>virtualWaitMs,random:()=>0,wait:async ms=>{virtualWaitMs+=ms;retryWait.resolve();await releaseSaveRetry.promise;}});
 const saveFinished=(()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve};})();saving.then(()=>saveFinished.resolve(),()=>saveFinished.resolve());const race=await Promise.race([retryWait.promise.then(()=> 'retry-wait'),saveFinished.promise.then(()=> 'save-finished')]);
 // Current mode should let this writer commit during the unlocked GET; single lease should see 423.
 const openWasBlocked=race==='retry-wait'&&attemptStatuses[0]===423;release.resolve();const opened=await opening;if(race==='retry-wait')releaseSaveRetry.resolve();const saved=await saving;
 const openMs=performance.now()-openStart,saveWallMs=performance.now()-saveStart;contention.push({variant,writer:writerKind,openSuccess:!!opened?.revision,openMs:Math.round(openMs*10)/10,openWebdavCalls:reader.transportCalls.length,saveSuccess:!!saved?.revision,saveAttempts:attemptStatuses.length,save423:attemptStatuses.filter(x=>x===423).length,save423Rate:attemptStatuses.filter(x=>x===423).length/attemptStatuses.length,saveRetryCount:attemptStatuses.length-1,saveBackoffMs:virtualWaitMs,saveTotalIncludingRetryMs:Math.round((saveWallMs+virtualWaitMs)*10)/10,writerWasBlockedByRead:openWasBlocked});
 for(const s of [reader,target])s.agent.destroy();
}
console.log(JSON.stringify({kind:'LOCAL_FAKE_WEBDAV_EXPERIMENT',requestDelayPerCallMs:requestDelayMs,warning:'Synthetic timings include a fixed in-memory fixture delay and virtual retry wait; they are not Koofr, Vercel, Homepage auth, device or production measurements.',soloOpen:{twoSnapshot:{...stats(openSamples['two-snapshot']),callsPerOpen:[...new Set(openCalls['two-snapshot'])]},singleLease:{...stats(openSamples['single-lease']),callsPerOpen:[...new Set(openCalls['single-lease'])]}},uncontendedSave:{...stats(saveSamples),callsPerSave:9},contention},null,2));
