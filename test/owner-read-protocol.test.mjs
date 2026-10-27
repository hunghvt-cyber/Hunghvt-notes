import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {backend} from './helpers/collection.mjs';
import {patientRetry} from '../public/sync.js';
import {NoteStore} from '../lib/store.mjs';

test('WebDAV phase metrics contain only allowlisted measurements',async t=>{
 const b=backend(),input={user:'fixture-user',password:'fixture-secret',namespace:'Homepage-Notes-Vercel-Probe-123-'+randomUUID()},store=new NoteStore(input,{makeDav:b.makeDav,wire:async(url,options,ctx)=>({...await b.wire(url,options,ctx),timing:{dnsMs:10,tcpMs:25,tlsMs:45,ttfbMs:80,bodyMs:12,reusedSocket:false}})});
 t.after(()=>store.agent.destroy());await store.init();await store.capture();const lock=store.transportCalls.find(x=>x.method==='LOCK');
 assert.deepEqual({dns:lock.dnsMs,tcp:lock.tcpMs,tls:lock.tlsMs,headers:lock.headersWaitMs,body:lock.bodyMs,reused:lock.reusedSocket},{dns:10,tcp:15,tls:20,headers:35,body:12,reused:false});
 assert.equal(JSON.stringify(store.transportCalls).includes(input.password),false);assert.equal(JSON.stringify(store.transportCalls).includes(input.namespace),false);assert.equal(JSON.stringify(store.transportCalls).includes('app.koofr.net'),false);
});

async function fixture(t){
 const b=backend(),input={user:'fake',password:'fake',namespace:'Homepage-Notes-Vercel-Probe-123-'+randomUUID()},reader=b.makeStore(input),owner=b.makeStore(input),shareWriter=b.makeStore(input),id=randomUUID();
 t.after(()=>{reader.agent.destroy();owner.agent.destroy();shareWriter.agent.destroy();});await owner.init();const saved=await owner.save(id,{title:'Synthetic',text:'before',checklist:[]},null,randomUUID()),link=await owner.share('note',id,'edit');return {b,reader,owner,shareWriter,id,saved,link};
}
function gate(){let release;const promise=new Promise(r=>release=r);return {promise,release};}

test('owner open variants return the same verified revision with 7 versus 4 fixture calls',async t=>{
 const {reader,id}=await fixture(t);let start=reader.transportCalls.length;const seven=await reader.get(id),sevenCalls=reader.transportCalls.length-start;start=reader.transportCalls.length;
 const four=await reader.getOwnerSingleLease(id),fourCalls=reader.transportCalls.length-start;
 assert.equal(seven.text,four.text);assert.equal(seven.revision,four.revision);assert.equal(sevenCalls,7);assert.equal(fourCalls,4);
});

for(const writerKind of ['owner','share'])test('current 7-call owner read permits concurrent '+writerKind+' save and returns its committed revision',async t=>{
 const {reader,owner,shareWriter,id,saved,link}=await fixture(t),writer=writerKind==='owner'?owner:shareWriter,actor=writerKind==='owner'?undefined:{token:link.token},options=writerKind==='owner'?{}:{shareScope:'note'},entered=gate(),resume=gate(),original=reader.readRecord.bind(reader);let paused=false;
 reader.readRecord=async e=>{if(!paused){paused=true;entered.release();await resume.promise;}return original(e);};const opening=reader.get(id);await entered.promise;
 const updated=await writer.save(id,{text:'after'},saved.revision,randomUUID(),actor,options);resume.release();const opened=await opening;
 assert.equal(opened.text,'after');assert.equal(opened.revision,updated.revision);assert.equal(reader.metrics.filter(m=>m.operation==='read-validate').length,2);
});

for(const writerKind of ['owner','share'])test('4-call owner lease returns 423 to concurrent '+writerKind+' writer; same frozen save retries after unlock',async t=>{
 const {reader,owner,shareWriter,id,saved,link}=await fixture(t),writer=writerKind==='owner'?owner:shareWriter,actor=writerKind==='owner'?undefined:{token:link.token},options=writerKind==='owner'?{}:{shareScope:'note'},entered=gate(),unlockRead=gate(),waitingRetry=gate(),resumeRetry=gate(),original=reader.readRecord.bind(reader);let paused=false;
 reader.readRecord=async e=>{if(!paused){paused=true;entered.release();await unlockRead.promise;}return original(e);};const opening=reader.getOwnerSingleLease(id);await entered.promise;
 let logicalMs=0;const opId=randomUUID(),attempts=[],started=performance.now();const saving=patientRetry(async()=>{
  try{const result=await writer.save(id,{text:'after'},saved.revision,opId,actor,options);attempts.push({ok:true,opId});return result;}
  catch(e){attempts.push({status:e.status,opId});throw e;}
 },{now:()=>logicalMs,random:()=>0,wait:async ms=>{logicalMs+=ms;waitingRetry.release();await resumeRetry.promise;}});
 await waitingRetry.promise;assert.deepEqual(attempts,[{status:423,opId}]);unlockRead.release();const opened=await opening;resumeRetry.release();const savedAfter=await saving;const totalWithRetry=performance.now()-started+logicalMs;
 assert.equal(opened.revision,saved.revision);assert.deepEqual(attempts,[{status:423,opId},{ok:true,opId}]);assert.equal(logicalMs,1000);assert.equal(savedAfter.revision,opened.revision.replace(/:\d+$/,':'+(Number(opened.revision.split(':').at(-1))+1)));assert.ok(totalWithRetry>=1000);
});
