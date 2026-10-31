import test from 'node:test';
import assert from 'node:assert/strict';
import {reusableNote,cachedNoteSize,NoteCache,MAX_CACHED_NOTE_BYTES,MAX_CACHED_CONTENT_BYTES,MAX_CACHED_NOTES,MAX_CACHED_LIST_BYTES,MAX_CACHED_LIST_NOTES} from '../public/cache.js';
test('cached content must match both ID and revision; absent, moved or newer rows invalidate it',()=>{
 const note={id:'one',revision:'r1',text:'private'};
 assert.equal(reusableNote(note,{id:'one',revision:'r1'}),true);
 for(const row of [undefined,{id:'two',revision:'r1'},{id:'one',revision:'r2'}])assert.equal(reusableNote(note,row),false);
});
test('unauthenticated cache access does not open IndexedDB',async()=>{
 const cache=new NoteCache();cache.tx=()=>{throw Error('must not open storage');};
 assert.equal(await cache.get(null),null);await cache.put(null,{text:'never written'});await cache.delete(null);
});
test('private acknowledged cache has explicit storage bounds',()=>{
 assert.equal(MAX_CACHED_NOTE_BYTES,256*1024);assert.equal(MAX_CACHED_CONTENT_BYTES,1024*1024);assert.equal(MAX_CACHED_NOTES,12);assert.equal(MAX_CACHED_LIST_BYTES,512*1024);assert.equal(MAX_CACHED_LIST_NOTES,1000);
});
test('content cache sizing includes text, checklist, and all retained history',()=>{
 const base={id:'synthetic',revision:'r1',title:'small',text:'x',checklist:[{id:'c1',text:'y'.repeat(5000),checked:true}],history:[]};
 const small={...base,checklist:[]};assert.ok(cachedNoteSize(small)<MAX_CACHED_NOTE_BYTES);
 const largeCurrent={...base,text:'x'.repeat(MAX_CACHED_NOTE_BYTES)};assert.ok(cachedNoteSize(largeCurrent)>MAX_CACHED_NOTE_BYTES);
 const largeHistory={...base,history:[{title:'old',text:'h'.repeat(MAX_CACHED_NOTE_BYTES),checklist:[]}]};assert.ok(cachedNoteSize(largeHistory)>MAX_CACHED_NOTE_BYTES);
 const largeChecklist={...base,text:'',checklist:[{id:'c1',text:'c'.repeat(MAX_CACHED_NOTE_BYTES),checked:false}]};assert.ok(cachedNoteSize(largeChecklist)>MAX_CACHED_NOTE_BYTES);
});
test('reopen stays reusable after a list refresh only when server revision still matches',()=>{
 const cached={id:'synthetic',revision:'epoch:4',title:'Fixture',text:'small',checklist:[],history:[]};
 const persisted={note:cached,usedAt:1};assert.equal(reusableNote(persisted.note,{id:'synthetic',revision:'epoch:4'}),true);
 const afterRefresh={id:'synthetic',revision:'epoch:4'};assert.equal(reusableNote(persisted.note,afterRefresh),true);
 assert.equal(reusableNote(persisted.note,{id:'synthetic',revision:'epoch:5'}),false);
 assert.equal(reusableNote(persisted.note,undefined),false);
});
