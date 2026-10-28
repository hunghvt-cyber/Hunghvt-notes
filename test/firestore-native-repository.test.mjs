import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {FirestoreNativeRepository} from '../lib/firestore-native-repository.mjs';
import {compareSnapshots} from '../lib/firestore-migration.mjs';
import {encodeSnapshot} from '../lib/store-backup.mjs';

const copy=x=>x===undefined?undefined:structuredClone(x);
class DocRef{
 constructor(db,path){this.db=db;this.path=path;this.id=path.split('/').at(-1);}
 collection(name){return new CollectionRef(this.db,`${this.path}/${name}`);}
 async get(){return new Snapshot(this.path,this.db.rows.get(this.path),this.db);}
 async delete(){this.db.rows.delete(this.path);}
 async listCollections(){const prefix=this.path+'/',names=new Set();for(const key of this.db.rows.keys())if(key.startsWith(prefix)){const first=key.slice(prefix.length).split('/')[0];if(key.slice(prefix.length).includes('/'))names.add(first);}return [...names].map(name=>new CollectionRef(this.db,this.path+'/'+name));}
}
class CollectionRef{
 constructor(db,path,filters=[],sort=null,max=Infinity){this.db=db;this.path=path;this.filters=filters;this.sort=sort;this.max=max;}
 doc(id){return new DocRef(this.db,`${this.path}/${id}`);}
 where(field,op,value){assert.equal(op,'==');return new CollectionRef(this.db,this.path,[...this.filters,[field,value]],this.sort,this.max);}
 orderBy(field,direction='asc'){return new CollectionRef(this.db,this.path,this.filters,[field,direction],this.max);}
 limit(max){return new CollectionRef(this.db,this.path,this.filters,this.sort,max);}
 async get(){const rows=[];for(const [path,entry] of this.db.rows){if(!path.startsWith(this.path+'/')||path.slice(this.path.length+1).includes('/'))continue;if(this.filters.every(([key,value])=>entry.data[key]===value))rows.push(new Snapshot(path,entry,this.db));}if(this.sort){const [field,direction]=this.sort;rows.sort((a,b)=>String(a.data()[field]??'').localeCompare(String(b.data()[field]??''))*(direction==='desc'?-1:1));}rows.splice(this.max);return {docs:rows,empty:rows.length===0,size:rows.length};}
}
class Snapshot{
 constructor(path,row,db){this.id=path.split('/').at(-1);this.ref=new DocRef(db,path);this.exists=!!row;this.row=copy(row?.data);}
 data(){return copy(this.row);}
}
class FakeFirestore{
 constructor(){this.rows=new Map();this.collectionReads=0;this.attempts=0;this.transactionGetAllCalls=0;}
 collection(name){return new CollectionRef(this,name);}
 async runTransaction(fn,{maxAttempts=5}={}){
  for(let attempt=0;attempt<maxAttempts;attempt++){
   this.attempts++;
   const reads=new Map(),writes=[];
   const tx={
    get:async ref=>{
     await Promise.resolve();
     if(ref instanceof CollectionRef){
      const rows=[];
      for(const [path,entry] of this.rows){
       if(!path.startsWith(ref.path+'/')||path.slice(ref.path.length+1).includes('/'))continue;
       if(ref.filters.every(([key,value])=>entry.data[key]===value)){reads.set(path,entry.version);rows.push(new Snapshot(path,entry,this));}
      }
      if(ref.sort){const [field,direction]=ref.sort;rows.sort((a,b)=>(a.data()[field]-b.data()[field])*(direction==='desc'?-1:1));}
      rows.splice(ref.max);
      this.collectionReads++;
     return {docs:rows,empty:rows.length===0,size:rows.length};
     }
     const entry=this.rows.get(ref.path);reads.set(ref.path,entry?.version??0);return new Snapshot(ref.path,entry,this);
    },
    getAll:async(...refs)=>{this.transactionGetAllCalls++;return Promise.all(refs.map(ref=>tx.get(ref)));},
    set:(ref,data)=>writes.push({kind:'set',path:ref.path,data:copy(data)}),
    create:(ref,data)=>writes.push({kind:'create',path:ref.path,data:copy(data)}),
    update:(ref,data)=>writes.push({kind:'update',path:ref.path,data:copy(data)}),
    delete:ref=>writes.push({kind:'delete',path:ref.path})
   };
   const result=await fn(tx);
   const conflicted=[...reads].some(([path,version])=>(this.rows.get(path)?.version??0)!==version);
   if(conflicted)continue;
   for(const w of writes){
    const current=this.rows.get(w.path);
    if(w.kind==='create'&&current)throw Object.assign(new Error('already exists'),{code:6});
    if(w.kind==='update'&&!current)throw Object.assign(new Error('missing'),{code:5});
   }
   for(const w of writes){
    const current=this.rows.get(w.path);if(w.kind==='delete'){this.rows.delete(w.path);continue;}const data=w.kind==='update'?{...current.data,...w.data}:w.data;
    this.rows.set(w.path,{data:copy(data),version:(current?.version??0)+1});
   }
   return result;
  }
  throw Object.assign(new Error('too much contention'),{code:10});
 }
 batch(){const writes=[];return {set:(ref,data)=>writes.push([ref,data]),commit:async()=>{for(const [ref,data]of writes)this.rows.set(ref.path,{data:copy(data),version:(this.rows.get(ref.path)?.version??0)+1});}};}
 async recursiveDelete(ref){for(const key of [...this.rows.keys()])if(key===ref.path||key.startsWith(ref.path+'/'))this.rows.delete(key);}
}
const rid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const note=(text='hello')=>({title:'Test',text,checklist:[],pinned:false,folder:'Inbox'});
const setup=async db=>{const repo=new FirestoreNativeRepository(db,{vaultId:'test-vault'});await repo.initialize({epoch:'0000000000000001',folders:['Inbox']});return repo;};

test('owner read batches independent vault and note point reads without dropping history',async()=>{
 const db=new FakeFirestore(),repo=await setup(db);
 const id=rid(901),first=await repo.save(id,note('history version'),null,rid(902));
 await repo.save(id,note('current version'),first.revision,rid(903));
 const before=db.transactionGetAllCalls,result=await repo.read(id);
 assert.equal(db.transactionGetAllCalls,before+1);assert.equal(result.text,'current version');assert.equal(result.history[0].text,'history version');
});

test('native save uses per-note CAS and operation receipts; replay does not advance revision',async()=>{
 const db=new FakeFirestore(),repo=await setup(db);
 const id=rid(1),op=rid(101),first=await repo.save(id,note(),null,op,{includeNote:true});
 assert.equal(first.note.text,'hello');assert.equal(first.revision,'0000000000000001:1');
 const replay=await repo.save(id,note(),null,op);
 assert.equal(replay.replay,true);assert.equal(replay.revision,'0000000000000001:1');
 await assert.rejects(repo.save(id,{text:'stale'},null,rid(102)),e=>e.status===409&&e.message==='REVISION_CONFLICT');
 const stored=db.rows.get(`notesVaults/test-vault/notes/${id}/operations/${op}`).data;
 assert.equal(JSON.stringify(stored).includes('hello'),false,'receipt must not duplicate note body');
});

test('independent note creates can commit concurrently without a catalog document',async()=>{
 const db=new FakeFirestore(),repo=await setup(db);
 await Promise.all([repo.save(rid(1),note('a'),null,rid(101)),repo.save(rid(2),note('b'),null,rid(102))]);
 assert.equal(db.rows.has('catalog/catalog.json'),false);
 assert.equal(db.rows.get(`notesVaults/test-vault/notes/${rid(1)}`).data.currentRevision,1);
 assert.equal(db.rows.get(`notesVaults/test-vault/notes/${rid(2)}`).data.currentRevision,1);
});

test('first save creates a previously unseen folder with its metadata timestamp',async()=>{
 const db=new FakeFirestore(),repo=await setup(db),id=rid(3);
 const saved=await repo.save(id,{...note('folder test'),folder:'First Save Folder'},null,rid(103));
 assert.equal(saved.revision,'0000000000000001:1');
 const folder=db.rows.get(`notesVaults/test-vault/folders/${createHash('sha256').update('First Save Folder').digest('hex').slice(0,40)}`);
 assert.equal(folder.data.state,'active');assert.equal(typeof folder.data.createdAt,'string');
});

test('same-note writes from one base revision are compare-and-swap, not last-writer-wins',async()=>{
 const db=new FakeFirestore(),repo=await setup(db),id=rid(6);
 await repo.save(id,note(),null,rid(109));
 const results=await Promise.allSettled([
  repo.save(id,{text:'writer A'},'0000000000000001:1',rid(110)),
  repo.save(id,{text:'writer B'},'0000000000000001:1',rid(111))
 ]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(results.filter(x=>x.status==='rejected'&&x.reason.status===409).length,1);
 assert.equal((await repo.read(id)).revision,'0000000000000001:2');
});

test('simultaneous identical operation IDs commit once and the loser observes the receipt',async()=>{
 const db=new FakeFirestore(),repo=await setup(db),id=rid(8),op=rid(130);
 const results=await Promise.all([repo.save(id,note('one'),null,op),repo.save(id,note('one'),null,op)]);
 assert.equal(results.filter(x=>x.replay!==true).length,1);
 assert.equal(results.filter(x=>x.replay===true).length,1);
 assert.equal((await repo.read(id)).revision,'0000000000000001:1');
});

test('sharing is checked on every read/write and revocation takes effect',async()=>{
 const db=new FakeFirestore(),repo=await setup(db),id=rid(3);
 await repo.save(id,note(),null,rid(103));
 const {id:shareId,token}=await repo.createShare({scope:'note',target:id,permission:'edit'});
 assert.equal((await repo.read(id,{capabilityToken:token})).note.text,'hello');
 await repo.save(id,{text:'shared edit'},'0000000000000001:1',rid(104),{capabilityToken:token});
 await repo.revokeShare(shareId);
 await assert.rejects(repo.read(id,{capabilityToken:token}),e=>e.status===403);
 await assert.rejects(repo.save(id,{text:'after revoke'},'0000000000000001:2',rid(105),{capabilityToken:token}),e=>e.status===403);
});

test('large content chunks only above threshold and reconstructs under hash check',async()=>{
 const db=new FakeFirestore(),repo=await setup(db),id=rid(4);
 const body='x'.repeat(800*1024);
 await repo.save(id,note(body),null,rid(106));
 const read=await repo.read(id);assert.equal(read.text.length,body.length);
 assert.equal(db.rows.get(`notesVaults/test-vault/notes/${id}/versions/000000000001`).data.chunkCount,2);
});

test('each version is independently retained and the read API exposes the latest five prior versions',async()=>{
 const db=new FakeFirestore(),repo=await setup(db),id=rid(7);
 let revision=null;
 for(let i=0;i<7;i++){
  const op=rid(120+i),out=await repo.save(id,{...note(`v${i}`)},revision,op);
  revision=out.revision;
 }
 const out=await repo.read(id);
 assert.equal(out.text,'v6');
 assert.deepEqual(out.history.map(x=>x.text),['v5','v4','v3','v2','v1']);
 assert.equal(db.rows.has(`notesVaults/test-vault/notes/${id}/versions/000000000001`),true);
});

test('Code Inbox rejects active note and folder shares',async()=>{
 const db=new FakeFirestore(),repo=await setup(db),id=rid(5);
 await repo.save(id,note(),null,rid(107));
 await repo.createShare({scope:'note',target:id,permission:'view'});
 await assert.rejects(repo.save(id,{...note('inbox'),folder:'Inbox'},'0000000000000001:1',rid(108),{inboxFolder:'Inbox'}),e=>e.status===403&&e.message==='INBOX_SHARED_TARGET');
});

test('folder deletion is resumable in bounded transactions and preserves notes in unfiled',async()=>{
 const db=new FakeFirestore(),repo=await setup(db),id=rid(15);await repo.save(id,note(),null,rid(115));
 const result=await repo.deleteFolder('Inbox');assert.equal(result.deleted,true);assert.equal(result.notesAffected,1);
 const read=await repo.read(id);assert.equal(read.folder,'');assert.equal(read.text,'hello');
 const backup=await repo.exportLegacySnapshot();assert.deepEqual(Object.keys(backup.data.catalog.folders),[]);
 assert.equal((await repo.deleteFolder('Inbox')).replay,true);
 await repo.createFolder('Inbox');const second=await repo.deleteFolder('Inbox');assert.equal(second.deleted,true);assert.equal(second.replay,undefined);
});

test('legacy snapshot restore round-trips content, revision, share and idempotency receipt',async()=>{
 const sourceDb=new FakeFirestore(),source=await setup(sourceDb),id=rid(16),op=rid(116);
 const first=await source.save(id,note('old version'),null,op),saved=await source.save(id,note('restore me'),first.revision,rid(117));const link=await source.createShare({scope:'note',target:id,permission:'view'});
 const snapshot=await source.exportLegacySnapshot(),legacyCatalog=structuredClone(snapshot.data.catalog);
 legacyCatalog.receipts=[{opId:op,requestHash:createHash('sha256').update(JSON.stringify({slot:id,patch:note('old version'),expected:null,actor:'owner'})).digest('hex'),revision:first.revision}];
 const migrationSnapshot=JSON.parse(encodeSnapshot(legacyCatalog,snapshot.data.records)),targetDb=new FakeFirestore(),target=new FirestoreNativeRepository(targetDb,{vaultId:'restore-vault'});
 const restored=await target.importLegacySnapshot(migrationSnapshot);assert.equal(restored.restored,1);
 const read=await target.read(id);assert.equal(read.text,'restore me');assert.equal(read.revision,saved.revision);assert.deepEqual(read.history.map(x=>x.text),['old version']);
 assert.equal(compareSnapshots(migrationSnapshot,await target.exportLegacySnapshot()).match,true);
 const replay=await target.save(id,note('old version'),null,op,{includeNote:true});assert.equal(replay.replay,true);assert.ok(replay.note);assert.equal(replay.revision,first.revision);
 assert.equal((await target.read(id,{capabilityToken:link.token})).note.text,'restore me');
});

test('snapshot migration preserves purged ID tombstones and prevents resurrection',async()=>{
 const sourceDb=new FakeFirestore(),source=await setup(sourceDb),id=rid(17);await source.save(id,note(),null,rid(118));await source.reorderNotes([id],'0000000000000001:0',rid(121));
 const before=await source.read(id);await source.remove(id,before.revision);const trashed=await source.trash(id);await source.purgeNote(id,trashed.revision,rid(119));
 assert.deepEqual((await source.listWithFolders()).order,[]);
 const snapshot=await source.exportLegacySnapshot(),targetDb=new FakeFirestore(),target=new FirestoreNativeRepository(targetDb,{vaultId:'purged-vault'});
 await target.importLegacySnapshot(snapshot);assert.equal(compareSnapshots(snapshot,await target.exportLegacySnapshot()).match,true);
 await assert.rejects(target.save(id,note(),null,rid(120)),e=>e.status===409&&e.message==='NOTE_DELETED');
});
