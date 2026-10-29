import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {SyncDraft,clone} from '../public/sync.js';
const wait=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const note=()=>({id:randomUUID(),title:'Tiếng Việt 😀',text:'A',checklist:[],folder:'',pinned:false});
function setup(send,overrides={}){const files=new Map();const vault={async put(v){files.set(v.key,clone(v));},async remove(k){files.delete(k);}};const d=new SyncDraft({note:note(),scope:'owner',vault,send,uuid:randomUUID,...overrides});return {d,vault,files};}
const ack=(p,revision='epoch:1')=>({...p,revision,acknowledgedRevision:revision});
test('typing during a pending save keeps new text and rebases only after the exact ack',async()=>{
 const gate=wait(),began=wait(),calls=[];const {d,files}=setup(async p=>{calls.push(clone(p));began.resolve();if(calls.length===1)await gate.promise;return ack(p,'epoch:'+calls.length);});
 await d.edit({text:'sent A'});const writing=d.flush();await began.promise;await d.edit({text:'B typed while waiting'});gate.resolve();await writing;
 assert.equal(d.note.text,'B typed while waiting');assert.equal(d.dirty,true);assert.equal(d.baseRevision,'epoch:1');assert.equal(files.get(d.key).note.text,d.note.text);
 await d.flush();assert.equal(calls[1].revision,'epoch:1');assert.equal(calls[1].text,'B typed while waiting');assert.equal(d.dirty,false);assert.equal(files.has(d.key),false);
});
test('uncertain response survives reload and replays the exact frozen operation',async()=>{
 const seen=new Map(),calls=[];let first=true;const send=async p=>{calls.push(clone(p));seen.set(p.clientOpId,ack(p));if(first){first=false;throw Error('NETWORK');}return seen.get(p.clientOpId);};
 const {d,vault,files}=setup(send);await d.edit({text:'lưu rồi mất response'});await assert.rejects(d.flush());const stored=files.get(d.key);
 const restored=new SyncDraft({note:stored.note,restored:stored,scope:'owner',vault,send,uuid:randomUUID});await restored.flush();
 assert.deepEqual(calls[1],calls[0]);assert.equal(seen.size,1);assert.equal(restored.dirty,false);
});
test('edits made after an unknown commit do not mutate its retry payload',async()=>{
 let lost=true;const calls=[];const {d}=setup(async p=>{calls.push(clone(p));if(lost){lost=false;throw Error('UNKNOWN');}return ack(p,calls.length<3?'epoch:1':'epoch:2');});
 await d.edit({text:'first'});await assert.rejects(d.flush());await d.edit({text:'second'});await d.flush();assert.equal(calls[1].text,'first');assert.equal(d.note.text,'second');assert.equal(d.dirty,true);await d.flush();assert.equal(calls[2].text,'second');assert.equal(calls[2].revision,'epoch:1');
});
test('409 preserves local draft and cannot be retried as an unconditional overwrite',async()=>{
 const {d,files}=setup(async()=>{throw Object.assign(Error('REVISION_CONFLICT'),{status:409});});await d.edit({text:'local conflict'});await assert.rejects(d.flush());assert.equal(d.status,'conflict');assert.equal(files.get(d.key).note.text,'local conflict');await assert.rejects(d.flush(),/CONFLICT_REQUIRES_REVIEW/);
});
test('a replay ack older than live HEAD requires review instead of claiming latest saved',async()=>{
 const {d,files}=setup(async p=>({...ack(p,'epoch:2'),acknowledgedRevision:'epoch:1'}));await d.edit({text:'mine'});await d.flush();assert.equal(d.status,'conflict');assert.equal(d.dirty,true);assert.ok(files.get(d.key).pending);
});
test('draft storage failure blocks dispatch and never reports locally saved',async()=>{
 let calls=0;const {d}=setup(async p=>{calls++;return ack(p);},{vault:{put:async()=>{throw Error('QUOTA');},remove:async()=>{}}});await assert.rejects(d.edit({text:'precious'}));await assert.rejects(d.flush());assert.equal(d.status,'local-error');assert.equal(d.persisted,false);assert.equal(calls,0);
});
test('typing while the old acknowledged draft is being removed survives cleanup',async()=>{
 const gate=wait(),began=wait(),files=new Map();const vault={async put(v){files.set(v.key,clone(v));},async remove(k){began.resolve();await gate.promise;files.delete(k);}};const {d}=setup(async p=>ack(p),{vault});
 await d.edit({text:'A'});const saving=d.flush();await began.promise;const editing=d.edit({text:'B'});gate.resolve();await Promise.all([saving,editing]);assert.equal(d.note.text,'B');assert.equal(d.dirty,true);assert.equal(files.get(d.key).note.text,'B');
});
test('rapid large-text edits coalesce in-flight draft snapshots and persist the latest exact value',async()=>{
 const began=wait(),gate=wait(),snapshots=[];let puts=0;const vault={async put(value){const snapshot=clone(value);puts++;if(puts===1){began.resolve();await gate.promise;}snapshots.push(snapshot);},async remove(){}};const {d}=setup(async p=>ack(p),{vault});
 const firstText='a'.repeat(500_000),latestText='latest '.repeat(60_000);const first=d.edit({text:firstText});await began.promise;const middle=d.edit({text:'middle '.repeat(60_000)}),latest=d.edit({text:latestText});assert.equal(puts,1);gate.resolve();await Promise.all([first,middle,latest]);assert.equal(puts,2);assert.equal(snapshots[0].note.text,firstText);assert.equal(snapshots[1].note.text,latestText);assert.equal(d.persisted,true);assert.equal(d.dirty,true);
});

test('only safe GET requests retry BUSY with a bounded jittered delay',async()=>{
 const {apiClient}=await import('../public/sync.js');let calls=0;const waits=[];
 const client=apiClient({fetcher:async()=>{calls++;return Response.json(calls<3?{code:'BUSY'}:{notes:[]},{status:calls<3?423:200});},wait:async ms=>waits.push(ms),random:()=>0});
 assert.deepEqual(await client('notes'),{notes:[]});assert.equal(calls,3);assert.deepEqual(waits,[1000,1500]);
 calls=0;await assert.rejects(client('notes-save',{method:'POST',data:{action:'save'}}),e=>e.status===423);assert.equal(calls,1);
 const capped=apiClient({fetcher:async()=>{calls++;return Response.json({code:'BUSY'},{status:423});},wait:async()=>{}});calls=0;await assert.rejects(capped('notes'),e=>e.status===423);assert.equal(calls,4);
});
