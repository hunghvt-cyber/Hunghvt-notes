import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {backend} from './helpers/collection.mjs';
import {createPreviewHandler} from '../lib/preview-api.mjs';

async function fixture(t){
 const b=backend(),input={user:'fake',password:'fake',namespace:'Homepage-Notes-Vercel-Probe-123-'+randomUUID()},store=b.makeStore(input);
 t.after(()=>store.agent.destroy());await store.init();
 const id=randomUUID();await store.save(id,{title:'Synthetic',text:'original',folder:'Shared'},null,randomUUID());
 const link=await store.share('folder','Shared','edit'),single=await store.share('note',id,'edit'),head=await store.get(id);
 const h=createPreviewHandler({config:()=>({...input,origin:'https://fixture.test',sessionPassword:'x'.repeat(64),portalPassword:'synthetic-only'}),makeStore:b.makeStore,observe:()=>{}});
 async function call(route,{token=link.token,data,query=''}={}){
  const start=b.requests.length,r=await h(new Request('https://fixture.test/api/app?route='+route+query,{method:data?'POST':'GET',headers:{Authorization:'Bearer '+token,...(data?{Origin:'https://fixture.test','Content-Type':'application/json'}:{})},...(data?{body:JSON.stringify(data)}:{})}));
  return {status:r.status,body:await r.json(),calls:b.requests.slice(start)};
 }
 return {b,store,id,link,single,head,call};
}
const locks=r=>r.calls.filter(x=>x.method==='LOCK').length;

test('shared list/open/save each use one lock while retaining exact acknowledged content',async t=>{
 const {id,head,call}=await fixture(t);
 const list=await call('shared-folder');assert.equal(list.status,200);assert.equal(list.body.notes.length,1);assert.equal(locks(list),1);assert.equal(list.calls.length,3);
 const open=await call('shared-folder',{query:'&id='+id});assert.equal(open.body.text,'original');assert.equal(locks(open),1);assert.equal(open.calls.length,4);
 const op=randomUUID(),data={action:'save',id,revision:head.revision,clientOpId:op,title:'Synthetic',text:'changed'};
 const saved=await call('shared-folder',{data});assert.equal(saved.status,200);assert.equal(saved.body.text,'changed');assert.equal(saved.body.revision,saved.body.acknowledgedRevision);assert.equal(saved.body.clientOpId,op);assert.equal(locks(saved),1);assert.equal(saved.calls.length,9);
 assert.equal((await call('shared-folder',{query:'&id='+id})).body.text,'changed');
});

test('shared scope, revocation and membership are checked inside the operation including replay',async t=>{
 const {store,id,head,link,single,call}=await fixture(t);
 assert.equal((await call('shared-note')).status,403);
 assert.equal((await call('shared-folder',{token:single.token})).status,403);
 const op=randomUUID(),data={action:'save',id,revision:head.revision,clientOpId:op,title:'Synthetic',text:'saved'};
 assert.equal((await call('shared-note',{data})).status,403);
 assert.equal((await call('shared-folder',{data})).status,200);
 await store.revoke(link.id);
 const denied=await call('shared-folder',{data});assert.equal(denied.status,403);assert.equal(denied.calls.some(x=>x.method==='PUT'),false);
 assert.equal((await call('shared-folder')).status,403);
 const fresh=await store.get(id);await store.moveNotes([{id,revision:fresh.revision}],'',randomUUID());
 const folder=await store.share('folder','Shared','edit').catch(()=>null);assert.equal(folder,null);
 const n=await call('shared-note',{token:single.token});assert.equal(n.status,200);assert.equal(n.body.text,'saved');
});

test('replay returns current head and original acknowledgement without publishing twice',async t=>{
 const {store,id,head,call}=await fixture(t),op=randomUUID(),data={action:'save',id,revision:head.revision,clientOpId:op,title:'Synthetic',text:'first'};
 const first=await call('shared-folder',{data});
 const second=await store.save(id,{text:'second'},first.body.revision,randomUUID());
 const retry=await call('shared-folder',{data});assert.equal(retry.status,200);assert.equal(retry.body.replay,true);assert.equal(retry.body.text,'second');assert.equal(retry.body.revision,second.revision);assert.equal(retry.body.acknowledgedRevision,first.body.revision);assert.equal(retry.calls.some(x=>x.method==='PUT'),false);assert.equal(locks(retry),1);
});

test('shared-note save resolves its target under lock and ignores a caller-supplied alternate id',async t=>{
 const {id,single,head,call}=await fixture(t);
 const r=await call('shared-note',{token:single.token,data:{action:'save',id:randomUUID(),revision:head.revision,clientOpId:randomUUID(),title:'Synthetic',text:'right target'}});
 assert.equal(r.status,200);assert.equal(r.body.id,id);assert.equal(r.body.text,'right target');assert.equal(locks(r),1);
});

test('unchanged revalidation avoids content GET but never bypasses current authorization',async t=>{
 const {store,id,head,link,b}=await fixture(t);let start=b.requests.length;
 const same=await store.get(id,{token:link.token},head.revision);assert.deepEqual(same,{notModified:true,revision:head.revision});assert.equal(b.requests.slice(start).filter(x=>x.method==='GET').length,1);
 await store.revoke(link.id);start=b.requests.length;
 await assert.rejects(store.get(id,{token:link.token},head.revision),e=>e.status===403);assert.equal(b.requests.slice(start).some(x=>x.method==='PUT'),false);
});

test('save with inline note never acknowledges a failed catalog verification; exact replay recovers',async t=>{
 const {store,id,head}=await fixture(t),op=randomUUID();const dav=store.dav(),original=dav.call;
 dav.call=async(...args)=>args[0]==='catalog-verify'?{status:200,text:'corrupt synthetic readback'}:original(...args);
 await assert.rejects(store.save(id,{text:'committed'},head.revision,op,undefined,{includeNote:true}),e=>e.status===503);
 dav.call=original;const retry=await store.save(id,{text:'committed'},head.revision,op,undefined,{includeNote:true});assert.equal(retry.replay,true);assert.equal(retry.note.text,'committed');assert.equal(retry.note.revision,retry.revision);
});
