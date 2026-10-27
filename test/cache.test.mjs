import test from 'node:test';
import assert from 'node:assert/strict';
import {reusableNote,NoteCache} from '../public/cache.js';
test('cached content must match both ID and revision; absent, moved or newer rows invalidate it',()=>{
 const note={id:'one',revision:'r1',text:'private'};
 assert.equal(reusableNote(note,{id:'one',revision:'r1'}),true);
 for(const row of [undefined,{id:'two',revision:'r1'},{id:'one',revision:'r2'}])assert.equal(reusableNote(note,row),false);
});
test('unauthenticated cache access does not open IndexedDB',async()=>{
 const cache=new NoteCache();cache.tx=()=>{throw Error('must not open storage');};
 assert.equal(await cache.get(null),null);await cache.put(null,{text:'never written'});
});
