// Virtual-time HTTP/client + fake WebDAV only. Never connects to Koofr/Vercel.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {backend} from '../test/helpers/collection.mjs';
import {createPreviewHandler} from '../lib/preview-api.mjs';
import {apiClient,patientRetry,SyncDraft,clone} from '../public/sync.js';

function clock(advance){
 let now=0,timers=[],order=0;
 const wait=ms=>new Promise(resolve=>timers.push({at:now+ms,resolve,order:order++}));
 return {get now(){return now;},wait,async run(work){
  let done=false,value,error;work.then(v=>{value=v;done=true;},e=>{error=e;done=true;});
  for(let ticks=0;!done;ticks++){
   assert.ok(ticks<100000,'virtual scheduler did not settle');
   // Drain complete HTTP/client promise chains before advancing virtual time.
   await new Promise(resolve=>setImmediate(resolve));if(done)break;
   assert.ok(timers.length,'work stalled without a virtual timer');
   timers.sort((a,b)=>a.at-b.at||a.order-b.order);const next=timers[0].at;
   await advance(next-now);now=next;const due=timers.filter(t=>t.at===next);timers=timers.filter(t=>t.at!==next);for(const t of due)t.resolve();
  }
  if(error)throw error;return value;
 }};
}
function random(seed){let s=seed>>>0;return ()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/2**32);}
const percentile=(xs,p)=>xs.length?[...xs].sort((a,b)=>a-b)[Math.ceil(xs.length*p)-1]:null;
const summarize=rows=>({operations:rows.length,outcomes:rows.reduce((a,r)=>(a[r.outcome]=(a[r.outcome]??0)+1,a),{}),attempts:rows.reduce((n,r)=>n+r.attempts,0),successfulLatencyVirtualMs:{p50:percentile(rows.filter(r=>r.outcome==='success').map(r=>r.ms),.5),p95:percentile(rows.filter(r=>r.outcome==='success').map(r=>r.ms),.95)},allOutcomesP95VirtualMs:percentile(rows.map(r=>r.ms),.95)});

export async function runScenario({rttMs=80,sameNote=false,rounds=1,seed=219,dropFirstAck=false,arrivalSpreadMs=0,patient=false}={}){
 const b=backend(),timer=clock(ms=>b.wait(ms)),stores=[],input={user:'fake',password:'fake',namespace:'Homepage-Notes-Vercel-Probe-123-'+randomUUID()},setup=b.makeStore(input);stores.push(setup);
 await setup.init();const heads=[];for(let i=0;i<10;i++){const id=randomUUID();await setup.save(id,{title:'Synthetic '+i,text:'initial',folder:'Shared'},null,randomUUID());heads.push(await setup.get(id));}
 const link=await setup.share('folder','Shared','edit'),statuses={},payloads=new Map(),commits=new Map(),rows=[],drafts=[],readers=[],acks=[],waits={GET:[],POST:[]};let attempts=0,dropped=0;
 const handler=createPreviewHandler({config:()=>({...input,origin:'https://fixture.test',sessionPassword:'s'.repeat(64),portalPassword:'synthetic'}),makeStore:cfg=>{
  const s=b.makeStore({...cfg,testWire:async(...args)=>{await timer.wait(rttMs);return b.wire(...args);}});stores.push(s);return s;
 },observe:()=>{}});
 function client(role,index){let count=0;const rng=random(seed+index*103+(role==='POST'?10000:0));
  const base=apiClient({getRetries:patient?0:3,route:'shared-folder',token:link.token,random:rng,wait:ms=>{waits.GET.push(ms);return timer.wait(ms);},fetcher:async(url,opts)=>{
   attempts++;count++;if(opts.body){const p=JSON.parse(opts.body),old=payloads.get(p.clientOpId);assert.ok(!old||old===opts.body,'retry changed frozen operation');payloads.set(p.clientOpId,opts.body);}
   const r=await handler(new Request('https://fixture.test'+url,{...opts,...(opts.method==='POST'?{headers:{...opts.headers,Origin:'https://fixture.test'}}:{})}));
   statuses[r.status]=(statuses[r.status]??0)+1;const body=await r.json();
   if(role==='POST'&&r.ok){const p=JSON.parse(opts.body),prior=commits.get(p.clientOpId);if(prior)assert.equal(body.acknowledgedRevision,prior.revision,'replay advanced revision');else commits.set(p.clientOpId,{id:body.id,revision:body.acknowledgedRevision,text:body.text});}
   if(dropFirstAck&&role==='POST'&&r.ok&&dropped===0){dropped++;throw Error('SYNTHETIC_LOST_ACK');}return Response.json(body,{status:r.status});
  }});const api=(path,opts={})=>patient&&(opts.method??'GET')==='GET'?patientRetry(()=>base(path,opts),{wait:ms=>{waits.GET.push(ms);return timer.wait(ms);},now:()=>timer.now,random:rng}):base(path,opts);return {api,get count(){return count;}};
 }
 const postRandom=Array.from({length:10},(_,i)=>random(seed+20000+i*103));
 for(let i=0;i<10;i++){
  const files=new Map(),c=client('POST',i),d=new SyncDraft({note:Object.fromEntries(Object.entries(heads[sameNote?0:i]).filter(([k])=>['id','title','text','checklist','revision','updatedAt'].includes(k))),scope:'synthetic',uuid:randomUUID,vault:{async put(x){files.set(x.key,clone(x));},async remove(k){files.delete(k);}},send:data=>c.api('',{method:'POST',data})});drafts.push({d,c,files,index:i});
 }
 for(let i=0;i<50;i++)readers.push({c:client('GET',i),index:i});
 const initialCatalogVersion=(await setup.readCatalog()).version,baseline=b.requests.length;
 async function editor({d,c,files,index},round){
  if(!d.dirty)await d.edit({text:'editor '+index+' round '+round});const start=timer.now,before=c.count;let outcome;
  for(let retry=0;;retry++){
   try{const result=patient?await patientRetry(()=>d.flush(),{wait:ms=>{waits.POST.push(ms);return timer.wait(ms);},now:()=>timer.now,random:postRandom[index]}):await d.flush();outcome=d.status==='conflict'?'conflict':'success';if(result&&outcome==='success')acks.push({id:result.id,revision:result.revision,text:result.text,replay:result.replay===true});break;}
   catch(e){if(patient||[400,401,403,404,409,413,429].includes(e.status)||retry>=3){outcome=e.status===409?'conflict':e.status===423?'busy':'error';break;}const ms=Math.min(30000,2000*2**(retry+1));waits.POST.push(ms);await timer.wait(ms);}
  }
  assert.ok(c.count-before<=(patient?32:4),'POST retry budget exceeded');if(d.dirty)assert.ok(files.get(d.key)?.pending||d.status==='conflict','unsaved operation not retained');
  rows.push({role:'edit',round,outcome,attempts:c.count-before,ms:timer.now-start});
 }
 async function reader({c,index},round){const start=timer.now,before=c.count;let outcome;
  try{const body=await c.api('',{query:index%2?'&id='+heads[index%10].id:''});if(index%2)assert.ok(body.revision&&typeof body.text==='string');else assert.equal(body.notes.length,10);outcome='success';}
  catch(e){outcome=e.status===423?'busy':e.status===409?'conflict':'error';}
  assert.ok(c.count-before<=(patient?32:4),'GET retry budget exceeded');rows.push({role:index%2?'open':'list',round,outcome,attempts:c.count-before,ms:timer.now-start});
 }
 try{
  await timer.run((async()=>{for(let round=0;round<rounds;round++){if(round)await timer.wait(1000);const arrival=random(seed+round*71);await Promise.all([...drafts.map(async d=>{if(arrivalSpreadMs)await timer.wait(Math.floor(arrival()*arrivalSpreadMs));return editor(d,round);}),...readers.map(async r=>{if(arrivalSpreadMs)await timer.wait(Math.floor(arrival()*arrivalSpreadMs));return reader(r,round);})]);}})());
  // Audit with the undelayed setup store after the workload stops.
  const requestEnd=b.requests.length,final=[];for(const n of heads)final.push(await setup.get(n.id));
  for(const n of final){const published=[...commits.values()].filter(a=>a.id===n.id),last=published.at(-1);assert.equal(Number(n.revision.split(':').at(-1)),1+published.length,'duplicate/missing committed revision');if(last){assert.equal(n.revision,last.revision);assert.equal(n.text,last.text);}else assert.equal(n.text,'initial');}
  assert.equal((await setup.readCatalog()).version,initialCatalogVersion+commits.size,'catalog advanced more than once per committed operation');
  if(dropFirstAck){assert.equal(dropped,1);assert.ok(acks.some(a=>a.replay),'lost acknowledgement not recovered by exact replay');}
  for(const {d,files} of drafts){if(d.dirty)assert.equal(files.get(d.key).note.text,d.note.text);else assert.equal(files.size,0);}
  assert.ok(rows.every(r=>r.outcome!=='error'),'unexpected logical operation failure');assert.equal(b.locks.size,0);assert.ok(Object.keys(statuses).every(s=>['200','409','423'].includes(s)),'unexpected HTTP error');const requests=b.requests.slice(baseline,requestEnd);
  return {kind:'VIRTUAL_TIME_FAKE_WEBDAV_NOT_LIVE_CAPACITY',rttMs,sameNote,rounds,seed,arrivalSpreadMs,patient,readers:50,editors:10,readerMix:'25 list + 25 content opens',virtualDurationMs:timer.now,roles:Object.fromEntries(['edit','list','open'].map(role=>[role,summarize(rows.filter(r=>r.role===role))])),perRound:Array.from({length:rounds},(_,round)=>({round,edit:summarize(rows.filter(r=>r.round===round&&r.role==='edit')),read:summarize(rows.filter(r=>r.round===round&&r.role!=='edit'))})),http:{attempts,statuses,lostAcknowledgements:dropped},webdav:{requests:requests.length,lockAttempts:requests.filter(r=>r.method==='LOCK').length},final:{savedDrafts:drafts.filter(x=>!x.d.dirty).length,retainedDrafts:drafts.filter(x=>x.d.dirty).length,conflicts:drafts.filter(x=>x.d.status==='conflict').length,acknowledgementsVerified:acks.length,uniqueCommittedOperations:commits.size,replayAcknowledgements:acks.filter(a=>a.replay).length,uniqueFrozenOperations:payloads.size},retryWaits:{GET:waits.GET.length,POST:waits.POST},safety:'exact retry payloads, final acknowledged heads and retained drafts verified'};
 }finally{for(const s of stores)s.agent.destroy();}
}
export async function runMatrix(){const results=[];for(const rttMs of [20,80,200])for(const sameNote of [false,true])results.push(await runScenario({rttMs,sameNote}));results.push(await runScenario({rttMs:80,rounds:3,dropFirstAck:true}));results.push(await runScenario({rttMs:80,rounds:3,arrivalSpreadMs:10000,dropFirstAck:true}));for(const seed of [220,221])results.push(await runScenario({rttMs:80,seed}));if(process.argv.includes('--patient')){for(const rttMs of [20,80,200])results.push(await runScenario({rttMs,patient:true}));results.push(await runScenario({rttMs:80,patient:true,sameNote:true}));results.push(await runScenario({rttMs:80,patient:true,rounds:3,arrivalSpreadMs:10000,dropFirstAck:true}));for(const seed of [220,221])results.push(await runScenario({rttMs:80,patient:true,seed}));}return {kind:'SIMULATED_RETRY_LOAD_NOT_KOOFR_OR_VERCEL_BENCHMARK',policy:{GET:'actual apiClient: initial + 3 retries with seeded jitter',POST:'actual SyncDraft; app.js wrapper: initial + 3 exact retries after 4/8/16 seconds; terminal errors stop',patient:'--patient adds actual patientRetry to GET and SyncDraft delivery: up to 32 attempts within a 120s retry window with seeded jitter',clock:'virtual, fixed per-WebDAV-call delay; no real RTT/throughput/CPU/bandwidth/browser rendering model',sessions:'pre-opened editor sessions; 50 reader/10 editor tasks per round; synchronized or seeded 10s arrival spread; rounds are barrier-separated waves; later waves manually retry retained drafts with a fresh retry budget, not automatic continuous arrivals',vault:'in-memory DraftVault substitute; IndexedDB/browser behavior covered separately by browser CI'},results};}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(await runMatrix(),null,2));
