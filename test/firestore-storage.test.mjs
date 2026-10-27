import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createFirestoreNoteStore} from '../lib/firestore-storage.mjs';
import {FakeFirestore} from './helpers/fake-firestore.mjs';
import {exportStore,initRestore,loadSnapshot,restoreBatch} from '../lib/store-backup.mjs';

function fixture(){let now=1_800_000_000_000;const db=new FakeFirestore(),namespace='Homepage-Notes-Vercel-Probe-123-'+randomUUID(),store=createFirestoreNoteStore({user:'fake',password:'must-not-be-used',namespace},{db,now:()=>now});store.agent.destroy();return {db,namespace,store,advance:ms=>now+=ms};}

test('Firestore adapter preserves note CAS, idempotency, share ACL and hashed immutable reads',async()=>{
 const {store}=fixture();await store.init();assert.equal((await store.dav().call('unguarded-reseed','PUT','{}')).status,412);const id=randomUUID(),op=randomUUID();const first=await store.save(id,{title:'Firestore fixture',text:'Đắk Lắk — 😀',checklist:[]},null,op);const replay=await store.save(id,{title:'Firestore fixture',text:'Đắk Lắk — 😀',checklist:[]},null,op);assert.equal(replay.replay,true);assert.equal(replay.revision,first.revision);assert.equal((await store.get(id)).text,'Đắk Lắk — 😀');
 await assert.rejects(store.save(id,{text:'stale'},null,randomUUID()),e=>e.status===409);
 const link=await store.share('note',id,'edit');assert.equal((await store.readShared('note',null,{token:link.token})).note.text,'Đắk Lắk — 😀');await store.revoke(link.id);await assert.rejects(store.readShared('note',null,{token:link.token}),e=>e.status===403);
 const corrupt=[...store.dav('catalog.json').objects.db.docs.entries()].find(([path])=>path.includes('/objects/note-')&&path.endsWith('/chunks/000'));assert.ok(corrupt);corrupt[1].bytes[0]^=1;await assert.rejects(store.get(id),e=>e.status===503);store.agent.destroy();
});

test('Firestore adapter chunks multi-revision note records below document size limits and verifies full hash',async()=>{
 const {db,namespace,store}=fixture();await store.init();const id=randomUUID(),text='x'.repeat(999_900);const first=await store.save(id,{title:'Large',text,checklist:[]},null,randomUUID());const next=await store.save(id,{text},first.revision,randomUUID());const value=await store.get(id);assert.equal(value.text.length,999_900);assert.equal(value.revision,next.revision);
 const prefix='notesStores/'+[...db.docs.keys()].find(k=>k.startsWith('notesStores/'))?.split('/')[1]+'/objects/note-'+id+'-';const files=[...db.docs].filter(([p])=>p.startsWith(prefix));assert.ok(files.some(([p])=>p.endsWith('/chunks/001')));assert.ok(files.every(([,v])=>v.bytes?Buffer.byteLength(v.bytes)<=700*1024:Buffer.byteLength(JSON.stringify(v))<1_048_576));assert.equal(namespace,store.input.namespace);store.agent.destroy();
});

test('Firestore lease transactions fence expired owners and stale unlock cannot release a new owner',async()=>{
 const {store,advance}=fixture();await store.init();const first=await store.dav().call('first-lock','LOCK','',{Timeout:'Second-5'});assert.equal(first.status,200);advance(5001);const second=await store.dav().call('second-lock','LOCK','',{Timeout:'Second-5'});assert.equal(second.status,200);const staleUnlock=await store.dav().call('stale-unlock','UNLOCK',undefined,{'Lock-Token':first.token});assert.equal(staleUnlock.status,409);const staleWrite=await store.dav('catalog.json').call('stale-write','PUT','{}',{If:'('+first.token+')'});assert.equal(staleWrite.status,412);const currentUnlock=await store.dav().call('current-unlock','UNLOCK',undefined,{'Lock-Token':second.token});assert.equal(currentUnlock.status,204);store.agent.destroy();
});

test('concurrent Firestore root lock claims admit one owner and return BUSY to the other',async()=>{
 const {db,namespace,store}=fixture();await store.init();const second=createFirestoreNoteStore({user:'fake',password:'unused',namespace},{db});const results=await Promise.all([store.dav().call('lock-a','LOCK','',{Timeout:'Second-60'}),second.dav().call('lock-b','LOCK','',{Timeout:'Second-60'})]);assert.deepEqual(results.map(x=>x.status).sort(),[200,423]);const winner=results.find(x=>x.status===200);assert.equal((await store.dav().call('unlock','UNLOCK',undefined,{'Lock-Token':winner.token})).status,204);store.agent.destroy();second.agent.destroy();
});

test('Firestore adapter preserves trash restore and verified permanent purge semantics',async()=>{
 const {store}=fixture();await store.init();const id=randomUUID(),first=await store.save(id,{title:'Trash lifecycle',text:'v1',checklist:[]},null,randomUUID());const second=await store.save(id,{text:'v2'},first.revision,randomUUID());
 const removed=await store.remove(id,second.revision);assert.equal((await store.trash(id)).text,'v2');const restored=await store.restoreNote(id,(await store.trash(id)).revision);assert.equal(restored.restored,true);assert.equal((await store.get(id)).text,'v2');
 await store.remove(id,restored.revision);const trash=await store.trash(id),purged=await store.purgeNote(id,trash.revision,randomUUID());assert.equal(purged.purged,true);assert.equal((await store.trash()).notes.length,0);await assert.rejects(store.get(id),e=>e.status===404);assert.equal(removed.deleted,true);store.agent.destroy();
});

test('Firestore adapter exports and restores a hash-verified snapshot into an isolated namespace',async()=>{
 const {db,store}=fixture();await store.init();const id=randomUUID();await store.save(id,{title:'Backup fixture',text:'backup payload',checklist:[]},null,randomUUID());const exported=await exportStore(store),loaded=await loadSnapshot(store);assert.equal(exported.count,1);assert.equal(Object.keys(loaded.records).length,1);
 const target=createFirestoreNoteStore({user:'fake',password:'unused',namespace:'Homepage-Notes-Vercel-Probe-123-'+randomUUID()},{db});await initRestore(target,store);const completed=await restoreBatch(target,store,0);assert.equal(completed.restoring,false);assert.equal((await target.get(id)).text,'backup payload');store.agent.destroy();target.agent.destroy();
});

test('explicit migration rollback mode rebases CAS receipts and retains live share permission',async()=>{
 const {db,store,namespace}=fixture();await store.init();const id=randomUUID(),op=randomUUID(),patch={title:'rollback fixture',text:'synthetic rollback content',checklist:[]};
 const saved=await store.save(id,patch,null,op),link=await store.share('note',id,'view');await exportStore(store);
 const target=createFirestoreNoteStore({user:'fake',password:'unused',namespace:'Homepage-Notes-Rollback-'+randomUUID()},{db});
 await initRestore(target,store,{preservePermissions:true,preserveIdempotency:true});let batch=0,result;do{result=await restoreBatch(target,store,batch++);}while(result.restoring);
 const replay=await target.save(id,patch,null,op),current=await target.get(id);assert.equal(replay.replay,true);assert.equal(replay.revision,current.revision);assert.notEqual(current.revision,saved.revision);
 assert.equal((await target.readShared('note',null,{token:link.token})).note.text,patch.text);
 store.agent.destroy();target.agent.destroy();
});

test('Firestore adapter namespaces are isolated and inventory lists only safe top-level immutable files',async()=>{
 const {db,namespace,store}=fixture();await store.init();const id=randomUUID();await store.save(id,{title:'Purge fixture',text:'synthetic',checklist:[]},null,randomUUID());const listing=await store.dav().call('inventory','PROPFIND','',{},true);assert.equal(listing.status,207);assert.match(listing.text,new RegExp('note-'+id));assert.doesNotMatch(listing.text,/must-not-be-used/);assert.equal((await db.collection('notesStores').doc('unrelated').get()).exists,false);store.agent.destroy();
});
