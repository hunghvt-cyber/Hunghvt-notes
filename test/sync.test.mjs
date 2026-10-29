import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {SyncDraft,clone} from '../public/sync.js';
const wait=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const note=()=>({id:randomUUID(),title:'Tiếng Việt 😀',text:'A',checklist:[],folder:'',pinned:false});
function setup(send,overrides={}){const d=new SyncDraft({note:note(),send,uuid:randomUUID,...overrides});return {d};}
const ack=(p,revision='epoch:1')=>({...p,revision,acknowledgedRevision:revision});
test('typing during a pending save stays in memory and the next save rebases after ACK',async()=>{
 const gate=wait(),began=wait(),calls=[];const {d}=setup(async p=>{calls.push(clone(p));began.resolve();if(calls.length===1)await gate.promise;return ack(p,'epoch:'+calls.length);});
 d.edit({text:'sent A'});const writing=d.flush();await began.promise;d.edit({text:'B typed while waiting'});gate.resolve();await writing;
 assert.equal(d.note.text,'B typed while waiting');assert.equal(d.dirty,true);assert.equal(d.baseRevision,'epoch:1');assert.equal(d.status,'draft');
 await d.flush();assert.equal(calls[1].revision,'epoch:1');assert.equal(calls[1].text,'B typed while waiting');assert.equal(d.dirty,false);assert.equal(d.status,'saved');
});
test('uncertain response retries the exact frozen operation in the open session',async()=>{
 const seen=new Map(),calls=[];let first=true;const send=async p=>{calls.push(clone(p));seen.set(p.clientOpId,ack(p));if(first){first=false;throw Error('NETWORK');}return seen.get(p.clientOpId);};
 const {d}=setup(send);d.edit({text:'lưu rồi mất response'});await assert.rejects(d.flush());const pendingId=d.pending.clientOpId;
 await d.flush();assert.deepEqual(calls[1],calls[0]);assert.equal(seen.size,1);assert.equal(d.dirty,false);assert.equal(d.pending,null);assert.equal(pendingId,calls[0].clientOpId);
});
test('edits made after an unknown commit do not mutate its retry payload',async()=>{
 let lost=true;const calls=[];const {d}=setup(async p=>{calls.push(clone(p));if(lost){lost=false;throw Error('UNKNOWN');}return ack(p,calls.length<3?'epoch:1':'epoch:2');});
 d.edit({text:'first'});await assert.rejects(d.flush());d.edit({text:'second'});await d.flush();assert.equal(calls[1].text,'first');assert.equal(d.note.text,'second');assert.equal(d.dirty,true);await d.flush();assert.equal(calls[2].text,'second');assert.equal(calls[2].revision,'epoch:1');
});
test('409 preserves the in-memory edit and cannot retry as an unconditional overwrite',async()=>{
 const {d}=setup(async()=>{throw Object.assign(Error('REVISION_CONFLICT'),{status:409});});d.edit({text:'local conflict'});await assert.rejects(d.flush());assert.equal(d.status,'conflict');assert.equal(d.note.text,'local conflict');await assert.rejects(d.flush(),/CONFLICT_REQUIRES_REVIEW/);
});
test('a replay ack older than live HEAD requires review instead of claiming latest saved',async()=>{
 const {d}=setup(async p=>({...ack(p,'epoch:2'),acknowledgedRevision:'epoch:1'}));d.edit({text:'mine'});await d.flush();assert.equal(d.status,'conflict');assert.equal(d.dirty,true);assert.equal(d.note.text,'mine');
});
test('rapid large-text edits retain the latest exact value in memory without persistence',async()=>{
 const {d}=setup(async p=>ack(p));const firstText='a'.repeat(500_000),latestText='latest '.repeat(60_000);
 d.edit({text:firstText});d.edit({text:'middle '.repeat(60_000)});d.edit({text:latestText});assert.equal(d.note.text,latestText);assert.equal(d.dirty,true);assert.equal(d.status,'draft');
 await d.flush();assert.equal(d.note.text,latestText);assert.equal(d.dirty,false);assert.equal(d.status,'saved');
});

test('only safe GET requests retry BUSY with a bounded jittered delay',async()=>{
 const {apiClient}=await import('../public/sync.js');let calls=0;const waits=[];
 const client=apiClient({fetcher:async()=>{calls++;return Response.json(calls<3?{code:'BUSY'}:{notes:[]},{status:calls<3?423:200});},wait:async ms=>waits.push(ms),random:()=>0});
 assert.deepEqual(await client('notes'),{notes:[]});assert.equal(calls,3);assert.deepEqual(waits,[1000,1500]);
 calls=0;await assert.rejects(client('notes-save',{method:'POST',data:{action:'save'}}),e=>e.status===423);assert.equal(calls,1);
 const capped=apiClient({fetcher:async()=>{calls++;return Response.json({code:'BUSY'},{status:423});},wait:async()=>{}});calls=0;await assert.rejects(capped('notes'),e=>e.status===423);assert.equal(calls,4);
});
