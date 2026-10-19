import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {backend} from './helpers/collection.mjs';

const gate=()=>{let release;const promise=new Promise(r=>{release=r;});return {promise,release};};
async function fixture(t){
 const b=backend(),input={user:'fake',password:'fake',namespace:'Homepage-Notes-Vercel-Probe-123-'+randomUUID()},reader=b.makeStore(input),writer=b.makeStore(input);
 t.after(()=>{reader.agent.destroy();writer.agent.destroy();});await writer.init();
 const id=randomUUID();await writer.save(id,{title:'Synthetic',text:'old',folder:'Shared'},null,randomUUID());
 const head=await writer.get(id),link=await writer.share('folder','Shared','edit');return {b,reader,writer,id,head,link};
}
function pauseContent(reader){
 const entered=gate(),resume=gate(),original=reader.readRecord.bind(reader);let count=0;
 reader.readRecord=async e=>{if(count++===0){entered.release();await resume.promise;}return original(e);};
 return {entered:entered.promise,resume:resume.release};
}

test('slow content read holds no root lease; another instance saves and reader returns coherent new revision',async t=>{
 const {b,reader,writer,id,head,link}=await fixture(t),pause=pauseContent(reader);
 const pending=reader.readShared('folder',id,{token:link.token});await pause.entered;
 assert.equal(b.locks.size,0,'content transfer is outside collection lease');
 const saved=await writer.save(id,{text:'new'},head.revision,randomUUID());pause.resume();
 const result=await pending;assert.equal(result.note.text,'new');assert.equal(result.note.revision,saved.revision);
 assert.equal(reader.metrics.filter(m=>m.operation==='read-validate').length,2);
});

test('revocation committed during content transfer denies response and unchanged-revision request',async t=>{
 const {reader,writer,id,head,link}=await fixture(t),pause=pauseContent(reader);
 const pending=reader.readShared('folder',id,{token:link.token});await pause.entered;
 await writer.revoke(link.id);pause.resume();await assert.rejects(pending,e=>e.status===403);
 await assert.rejects(reader.get(id,{token:link.token},head.revision),e=>e.status===403);
});

test('moving a note out of a shared folder during transfer denies content',async t=>{
 const {reader,writer,id,head,link}=await fixture(t),pause=pauseContent(reader);
 const pending=reader.readShared('folder',id,{token:link.token});await pause.entered;
 await writer.moveNotes([{id,revision:head.revision}],'',randomUUID());pause.resume();
 await assert.rejects(pending,e=>e.status===404);
});

test('deletion during owner content transfer never returns the deleted snapshot',async t=>{
 const {reader,writer,id,head}=await fixture(t),pause=pauseContent(reader);
 const pending=reader.get(id);await pause.entered;await writer.remove(id,head.revision);pause.resume();
 await assert.rejects(pending,e=>e.status===404);
});

test('read during unpublished save returns BUSY, then sees only verified committed head',async t=>{
 const {reader,writer,id,head}=await fixture(t),entered=gate(),resume=gate();
 writer.beforePublish=async()=>{entered.release();await resume.promise;};
 const saving=writer.save(id,{text:'committed'},head.revision,randomUUID());await entered.promise;
 await assert.rejects(reader.get(id),e=>e.status===423);resume.release();const saved=await saving;
 const result=await reader.get(id);assert.equal(result.text,'committed');assert.equal(result.revision,saved.revision);
});

test('continuous edits bound read retries and never return mixed content/revision',async t=>{
 const {reader,writer,id}=await fixture(t),original=reader.readRecord.bind(reader);let edits=0;
 reader.readRecord=async e=>{const value=await original(e),head=await writer.get(id);await writer.save(id,{text:'edit '+(++edits)},head.revision,randomUUID());return value;};
 await assert.rejects(reader.get(id),e=>e.status===423);assert.equal(edits,2);
});

test('tampered immutable content is rejected outside the lease without leaking a lock',async t=>{
 const {b,reader,id}=await fixture(t),original=reader.readRecord.bind(reader);
 reader.readRecord=async e=>{const path=[...b.files.keys()].find(p=>p.endsWith('/'+e.head));b.files.set(path,'corrupt fixture');return original(e);};
 await assert.rejects(reader.get(id),e=>e.status===503);assert.equal(b.locks.size,0);
});


test('catalog epoch replacement with identical head/version forces a fresh snapshot',async t=>{
 const {reader,writer,id}=await fixture(t),pause=pauseContent(reader);
 const pending=reader.get(id);await pause.entered;const epoch=randomUUID();
 await writer.locked('synthetic-epoch-change',async cat=>{cat.epoch=epoch;});pause.resume();
 const result=await pending;assert.equal(result.revision,epoch+':1');assert.equal(result.text,'old');
 assert.equal(reader.metrics.filter(m=>m.operation==='read-validate').length,2);
});

test('permission returned after content transfer comes from current authorization',async t=>{
 const {reader,writer,id,link}=await fixture(t),pause=pauseContent(reader);
 const pending=reader.readShared('folder',id,{token:link.token});await pause.entered;
 await writer.locked('synthetic-permission-change',async cat=>{cat.shares[link.id].permission='view';});pause.resume();
 assert.equal((await pending).permission,'view');
});
