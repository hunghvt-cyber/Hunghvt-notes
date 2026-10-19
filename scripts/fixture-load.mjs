// In-process HTTP adapter + deterministic fake WebDAV. No secrets or real network.
import {randomUUID} from 'node:crypto';
import {backend} from '../test/helpers/collection.mjs';
import {createPreviewHandler} from '../lib/preview-api.mjs';
const results=[];
for(const [users,editors] of [[50,0],[50,5],[60,10],[100,0],[100,10]]){
 const b=backend(),namespace='Homepage-Notes-Vercel-Probe-123-'+randomUUID(),input={user:'fake',password:'fake',namespace},store=b.makeStore(input);await store.init();const ids=[];
 for(let i=0;i<10;i++){const id=randomUUID();ids.push(id);await store.save(id,{title:'Fixture '+i,text:'synthetic',folder:'Shared'},null,randomUUID());}
 const link=await store.share('folder','Shared','edit');const handler=createPreviewHandler({config:()=>({...input,origin:'https://fixture.test',sessionPassword:randomUUID()+randomUUID(),portalPassword:'fixture-only'}),makeStore:b.makeStore,observe:()=>{}});
 const heads=[];for(const id of ids)heads.push(await store.get(id));const baseline=b.requests.length,times=[],successfulTimes=[],statuses={};
 await Promise.all(Array.from({length:users},async(_,i)=>{const start=performance.now(),edit=i<editors;const n=edit?heads[i%10]:null;
 const r=await handler(new Request('https://fixture.test/api/app?route=shared-folder',{method:edit?'POST':'GET',headers:{Authorization:'Bearer '+link.token,...(edit?{Origin:'https://fixture.test','Content-Type':'application/json'}:{})},...(edit?{body:JSON.stringify({action:'save',id:n.id,revision:n.revision,clientOpId:randomUUID(),title:n.title,text:'edit '+i})}:{})}));await r.json();const ms=performance.now()-start;times.push(ms);if(r.ok)successfulTimes.push(ms);statuses[r.status]=(statuses[r.status]??0)+1;}));
 times.sort((a,b)=>a-b);successfulTimes.sort((a,b)=>a-b);const requests=b.requests.slice(baseline);results.push({users,editors,allResponsesP50Ms:times[Math.ceil(users*.5)-1],allResponsesP95Ms:times[Math.ceil(users*.95)-1],successful:{n:successfulTimes.length,p50Ms:successfulTimes[Math.ceil(successfulTimes.length*.5)-1]??null,p95Ms:successfulTimes[Math.ceil(successfulTimes.length*.95)-1]??null},statuses,webdavRequests:requests.length,lockAttempts:requests.filter(r=>r.method==='LOCK').length});store.agent.destroy();
}
console.log(JSON.stringify({kind:'IN_PROCESS_SIMULATED_WEBDAV_NOT_KOOFR_CAPACITY',results},null,2));
