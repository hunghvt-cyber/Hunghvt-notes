import test from 'node:test';
import assert from 'node:assert/strict';
import {FirestoreNativeRepository} from '../lib/firestore-native-repository.mjs';

const copy=x=>x===undefined?undefined:structuredClone(x);
class DocRef{
 constructor(db,path){this.db=db;this.path=path;}
 collection(name){return new CollectionRef(this.db,`${this.path}/${name}`);}
}
class CollectionRef{
 constructor(db,path,filters=[],sort=null,max=Infinity){this.db=db;this.path=path;this.filters=filters;this.sort=sort;this.max=max;}
 doc(id){return new DocRef(this.db,`${this.path}/${id}`);}
 where(field,op,value){assert.equal(op,'==');return new CollectionRef(this.db,this.path,[...this.filters,[field,value]],this.sort,this.max);}
 orderBy(field,direction='asc'){return new CollectionRef(this.db,this.path,this.filters,[field,direction],this.max);}
 limit(max){return new CollectionRef(this.db,this.path,this.filters,this.sort,max);}
}
class Snapshot{
 constructor(path,row){this.ref={path};this.exists=!!row;this.row=copy(row?.data);}
 data(){return copy(this.row);}
}
class FakeFirestore{
 constructor(){this.rows=new Map();this.collectionReads=0;this.attempts=0;}
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
       if(ref.filters.every(([key,value])=>entry.data[key]===value)){reads.set(path,entry.version);rows.push(new Snapshot(path,entry));}
      }
      if(ref.sort){const [field,direction]=ref.sort;rows.sort((a,b)=>(a.data()[field]-b.data()[field])*(direction==='desc'?-1:1));}
      rows.splice(ref.max);
      this.collectionReads++;
      return {docs:rows,empty:rows.length===0,size:rows.length};
     }
     const entry=this.rows.get(ref.path);reads.set(ref.path,entry?.version??0);return new Snapshot(ref.path,entry);
    },
    set:(ref,data)=>writes.push({kind:'set',path:ref.path,data:copy(data)}),
    create:(ref,data)=>writes.push({kind:'create',path:ref.path,data:copy(data)}),
    update:(ref,data)=>writes.push({kind:'update',path:ref.path,data:copy(data)})
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
    const current=this.rows.get(w.path),data=w.kind==='update'?{...current.data,...w.data}:w.data;
    this.rows.set(w.path,{data:copy(data),version:(current?.version??0)+1});
   }
   return result;
  }
  throw Object.assign(new Error('too much contention'),{code:10});
 }
}
const rid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const note=(text='hello')=>({title:'Test',text,checklist:[],pinned:false,folder:'Inbox'});

test('native save uses per-note CAS and operation receipts; replay does not advance revision',async()=>{
 const db=new FakeFirestore(),repo=new FirestoreNativeRepository(db);
 const id=rid(1),op=rid(101),first=await repo.save(id,note(),null,op,{includeNote:true});
 assert.equal(first.note.text,'hello');assert.equal(first.revision,'1');
 const replay=await repo.save(id,note(),null,op);
 assert.equal(replay.replay,true);assert.equal(replay.revision,'1');
 await assert.rejects(repo.save(id,{text:'stale'},null,rid(102)),e=>e.status===409&&e.message==='REVISION_CONFLICT');
 const stored=db.rows.get(`notes/${id}/operations/${op}`).data;
 assert.equal(JSON.stringify(stored).includes('hello'),false,'receipt must not duplicate note body');
});

test('independent note creates can commit concurrently without a catalog document',async()=>{
 const db=new FakeFirestore(),repo=new FirestoreNativeRepository(db);
 await Promise.all([repo.save(rid(1),note('a'),null,rid(101)),repo.save(rid(2),note('b'),null,rid(102))]);
 assert.equal(db.rows.has('catalog/catalog.json'),false);
 assert.equal(db.rows.get(`notes/${rid(1)}`).data.currentRevision,1);
 assert.equal(db.rows.get(`notes/${rid(2)}`).data.currentRevision,1);
});

test('same-note writes from one base revision are compare-and-swap, not last-writer-wins',async()=>{
 const db=new FakeFirestore(),repo=new FirestoreNativeRepository(db),id=rid(6);
 await repo.save(id,note(),null,rid(109));
 const results=await Promise.allSettled([
  repo.save(id,{text:'writer A'},'1',rid(110)),
  repo.save(id,{text:'writer B'},'1',rid(111))
 ]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(results.filter(x=>x.status==='rejected'&&x.reason.status===409).length,1);
 assert.equal((await repo.read(id)).revision,'2');
});

test('simultaneous identical operation IDs commit once and the loser observes the receipt',async()=>{
 const db=new FakeFirestore(),repo=new FirestoreNativeRepository(db),id=rid(8),op=rid(130);
 const results=await Promise.all([repo.save(id,note('one'),null,op),repo.save(id,note('one'),null,op)]);
 assert.equal(results.filter(x=>x.replay!==true).length,1);
 assert.equal(results.filter(x=>x.replay===true).length,1);
 assert.equal((await repo.read(id)).revision,'1');
});

test('sharing is checked on every read/write and revocation takes effect',async()=>{
 const db=new FakeFirestore(),repo=new FirestoreNativeRepository(db),id=rid(3);
 await repo.save(id,note(),null,rid(103));
 const {id:shareId,token}=await repo.createShare({scope:'note',target:id,permission:'edit'});
 assert.equal((await repo.read(id,{capabilityToken:token})).note.text,'hello');
 await repo.save(id,{text:'shared edit'},'1',rid(104),{capabilityToken:token});
 await repo.revokeShare(shareId);
 await assert.rejects(repo.read(id,{capabilityToken:token}),e=>e.status===403);
 await assert.rejects(repo.save(id,{text:'after revoke'},'2',rid(105),{capabilityToken:token}),e=>e.status===403);
});

test('large content chunks only above threshold and reconstructs under hash check',async()=>{
 const db=new FakeFirestore(),repo=new FirestoreNativeRepository(db),id=rid(4);
 const body='x'.repeat(800*1024);
 await repo.save(id,note(body),null,rid(106));
 const read=await repo.read(id);assert.equal(read.text.length,body.length);
 assert.equal(db.rows.get(`notes/${id}/versions/000000000001`).data.chunkCount,2);
});

test('each version is independently retained and the read API exposes the latest five prior versions',async()=>{
 const db=new FakeFirestore(),repo=new FirestoreNativeRepository(db),id=rid(7);
 let revision=null;
 for(let i=0;i<7;i++){
  const op=rid(120+i),out=await repo.save(id,{...note(`v${i}`)},revision,op);
  revision=out.revision;
 }
 const out=await repo.read(id);
 assert.equal(out.text,'v6');
 assert.deepEqual(out.history.map(x=>x.text),['v5','v4','v3','v2','v1']);
 assert.equal(db.rows.has(`notes/${id}/versions/000000000001`),true);
});

test('Code Inbox rejects active note and folder shares',async()=>{
 const db=new FakeFirestore(),repo=new FirestoreNativeRepository(db),id=rid(5);
 await repo.save(id,note(),null,rid(107));
 await repo.createShare({scope:'note',target:id,permission:'view'});
 await assert.rejects(repo.save(id,{...note('inbox'),folder:'Inbox'},'1',rid(108),{inboxFolder:'Inbox'}),e=>e.status===403&&e.message==='INBOX_SHARED_TARGET');
});
