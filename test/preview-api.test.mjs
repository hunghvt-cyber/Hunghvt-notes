import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {Readable} from 'node:stream';
import {backend} from './helpers/collection.mjs';
import {NoteStore} from '../lib/store.mjs';
import {createPreviewHandler} from '../lib/preview-api.mjs';
function setup(){const b=backend(),namespace='Homepage-Notes-Vercel-Probe-123-'+randomUUID();const cfg={NOTES_PREVIEW_ENABLED:'synthetic-only-v1',VERCEL_ENV:'preview',PREVIEW_BASE_URL:'https://preview.example',PREVIEW_SESSION_PASSWORD:randomUUID()+randomUUID(),PREVIEW_PORTAL_PASSWORD:'synthetic-test-password',KOOFR_NOTES_USER:'fake',KOOFR_NOTES_APP_PASSWORD:'synthetic-secret',KOOFR_NOTES_NAMESPACE:namespace};const stores=[],logs=[];const makeStore=x=>{const s=new NoteStore(x,{makeDav:b.makeDav,wire:b.wire});stores.push(s);return s;};const handler=createPreviewHandler({env:()=>cfg,makeStore,observe:x=>logs.push(x)});return {b,cfg,logs,stores,makeStore,handler,async init(){await makeStore({user:'fake',password:'synthetic-secret',namespace}).init();}};}
async function call(s,route,{method='GET',data,session,cap,origin='https://preview.example',query=''}={}){
 const r=await s.handler(new Request('https://preview.example/api/preview?route='+route+query,{method,headers:{...(method!=='GET'?{'Content-Type':'application/json',Origin:origin}:{}),...(session?{Cookie:session}:{}),...(cap?{Authorization:'Bearer '+cap}:{})},...(data!==undefined?{body:JSON.stringify(data)}:{})}));return {r,status:r.status,body:await r.json(),session:r.headers.get('set-cookie')?.split(';')[0]};
}
async function owner(s){const r=await call(s,'auth',{method:'POST',data:{password:s.cfg.PREVIEW_PORTAL_PASSWORD}});assert.equal(r.status,200);assert.match(r.r.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Lax/);return r.session;}
test('preview defaults closed, refuses production/project/namespace config; no storage calls before owner auth',async()=>{
 const s=setup();delete s.cfg.NOTES_PREVIEW_ENABLED;assert.equal((await call(s,'notes')).status,503);assert.equal((await call(s,'health')).body.configured,false);
 s.cfg.NOTES_PREVIEW_ENABLED='synthetic-only-v1';assert.equal((await call(s,'notes')).status,401);assert.equal(s.b.requests.length,0);
 s.cfg.VERCEL_ENV='production';assert.equal((await call(s,'notes')).status,503);s.cfg.VERCEL_ENV='preview';s.cfg.KOOFR_NOTES_NAMESPACE='real-notes';assert.equal((await call(s,'notes')).status,503);
});
test('session login, Origin/JSON checks, tamper, logout and password rotation keep owner API private',async()=>{
 const s=setup();await s.init();const session=await owner(s);assert.equal((await call(s,'notes',{session})).status,200);
 assert.equal((await call(s,'notes-save',{method:'POST',session,origin:'https://attacker.example',data:{action:'save'}})).status,403);
 const [name,value]=session.split('='),at=value.indexOf('~')-5,tampered=name+'='+value.slice(0,at)+(value[at]==='A'?'B':'A')+value.slice(at+1);assert.equal((await call(s,'notes',{session:tampered})).status,401);assert.equal((await call(s,'notes',{session:session+'; '+session})).status,401);
 const raw=await s.handler(new Request('https://preview.example/api/preview?route=notes-save',{method:'POST',headers:{Cookie:session,Origin:s.cfg.PREVIEW_BASE_URL,'Content-Type':'text/plain'},body:'{}'}));assert.equal(raw.status,415);
 const out=await call(s,'auth',{method:'DELETE',session});assert.equal(out.status,200);assert.match(out.r.headers.get('set-cookie'),/Max-Age=0/);
 s.cfg.PREVIEW_PORTAL_PASSWORD='changed-test-password';assert.equal((await call(s,'notes',{session})).status,401);
});
test('UUID creation is stable across retry, handles >28KB Unicode, conditional fetch and list delta',async()=>{
 const s=setup();await s.init();const session=await owner(s),op=randomUUID(),data={action:'save',clientOpId:op,title:'UUID thật',text:'đ😀'.repeat(12000),checklist:[{id:'done',text:'Đã làm',checked:true}],folder:'Thư mục mới',pinned:true};
 const saved=await call(s,'notes-save',{method:'POST',session,data});assert.equal(saved.status,200,JSON.stringify(saved.body));assert.equal(saved.body.id,op);assert.equal(saved.body.text,data.text);assert.equal(saved.body.folder,data.folder);
 const retry=await call(s,'notes-save',{method:'POST',session,data});assert.equal(retry.status,200);assert.equal(retry.body.replay,true);assert.equal(retry.body.revision,saved.body.revision);
 const unchanged=await call(s,'notes',{session,query:'&id='+op+'&revision='+encodeURIComponent(saved.body.revision)});assert.equal(unchanged.body.notModified,true);
 const list=await call(s,'notes',{session,query:'&known='+encodeURIComponent(JSON.stringify([[op,saved.body.revision]]))});assert.equal(list.body.delta,true);assert.deepEqual(list.body.notes,[]);assert.equal(list.body.previewOnly,true);
 const stale=await call(s,'notes-save',{method:'POST',session,data:{...data,id:op,clientOpId:randomUUID(),revision:'old',text:'do not overwrite'}});assert.equal(stale.status,409);
 assert.equal((await call(s,'notes-save',{method:'POST',session,data:{...data,clientOpId:undefined}})).status,400);
 assert.ok(!JSON.stringify(s.logs).includes(data.text));assert.ok(!JSON.stringify(s.logs).includes(s.cfg.PREVIEW_PORTAL_PASSWORD));assert.ok(!JSON.stringify(s.logs).includes('synthetic-secret'));
});
test('public note/folder edit and view scopes reject cross-scope access, pin/move and revoked retry',async()=>{
 const s=setup();await s.init();const session=await owner(s),op=randomUUID();const n=await call(s,'notes-save',{method:'POST',session,data:{action:'save',clientOpId:op,title:'Shared',text:'original',folder:'Shared folder'}});
 const create=permission=>call(s,'note-share',{method:'POST',session,data:{action:'create',noteId:op,permission}});const link=await create('edit'),view=await create('view');
 const cap=link.body.token;assert.equal((await call(s,'shared-note',{cap})).status,200);assert.equal((await call(s,'shared-folder',{cap})).status,403);
 const edit={action:'save',clientOpId:randomUUID(),revision:n.body.revision,title:'Shared',text:'edited'};const changed=await call(s,'shared-note',{method:'POST',cap,data:edit});assert.equal(changed.status,200);assert.ok(!('history' in changed.body));assert.ok(!('folder' in changed.body));
 assert.equal((await call(s,'shared-note',{method:'POST',cap,data:{...edit,clientOpId:randomUUID(),pinned:true}})).status,403);
 assert.equal((await call(s,'shared-note',{method:'POST',cap:view.body.token,data:{...edit,revision:changed.body.revision,clientOpId:randomUUID()}})).status,403);
 await call(s,'note-share',{method:'POST',session,data:{action:'revoke',noteId:op,id:link.body.id}});assert.equal((await call(s,'shared-note',{method:'POST',cap,data:edit})).status,403);
 const f=await call(s,'note-share',{method:'POST',session,data:{action:'create',folder:'Shared folder'}});const made=await call(s,'shared-folder',{method:'POST',cap:f.body.token,data:{action:'save',clientOpId:randomUUID(),title:'Folder created',text:'Unicode 日本語'}});assert.equal(made.status,200);
 const listed=await call(s,'shared-folder',{cap:f.body.token});assert.equal(listed.body.notes.length,2);assert.ok(listed.body.notes.every(x=>x.folder==='Shared folder'));
});
test('empty folder shares allow scoped creation and keep view/revocation/deletion guards',async()=>{
 const s=setup();await s.init();const session=await owner(s),folder='Thư mục trống 😀';
 const post=(route,data,cap)=>call(s,route,{method:'POST',data,...(cap?{cap}:{session})});
 assert.equal((await post('folders',{action:'create',folder})).status,200);
 const edit=await post('note-share',{action:'create',folder});
 assert.equal(edit.status,200,JSON.stringify(edit.body));
 const view=await post('note-share',{action:'create',folder,permission:'view'});
 assert.equal(view.status,200);
 const empty=await call(s,'shared-folder',{cap:edit.body.token});
 assert.equal(empty.status,200);assert.equal(empty.body.folder,folder);assert.deepEqual(empty.body.notes,[]);
 assert.equal((await call(s,'note-share',{session,query:'&folder='+encodeURIComponent(folder)})).body.links.length,2);
 const note={action:'save',clientOpId:randomUUID(),title:'First shared note',text:'Created in empty folder'};
 assert.equal((await post('shared-folder',note,view.body.token)).status,403);
 assert.equal((await post('shared-folder',{...note,folder:'Gia đình'},edit.body.token)).status,403);
 const saved=await post('shared-folder',note,edit.body.token);
 assert.equal(saved.status,200);assert.equal((await call(s,'notes',{session,query:'&id='+saved.body.id})).body.folder,folder);
 assert.equal((await post('notes',{action:'folderDelete',folder})).status,409);
 for(const link of [edit,view])assert.equal((await post('note-share',{action:'revoke',folder,id:link.body.id})).status,200);
 assert.equal((await call(s,'shared-folder',{cap:edit.body.token})).status,403);
 assert.equal((await post('shared-folder',note,edit.body.token)).status,403);
 assert.equal((await post('notes',{action:'folderDelete',folder})).status,200);
 assert.equal((await post('note-share',{action:'create',folder})).status,404);
 assert.equal((await post('note-share',{action:'create',folder:'Missing folder'})).status,404);
});
test('login rate limit is durable across handlers; no process-only IP limiter',async()=>{
 const s=setup();await s.init();for(let i=0;i<5;i++)assert.equal((await call(s,'auth',{method:'POST',data:{password:'wrong'}})).status,401);
 const next=await call(s,'auth',{method:'POST',data:{password:s.cfg.PREVIEW_PORTAL_PASSWORD}});assert.equal(next.status,429);assert.equal(next.r.headers.get('retry-after'),'900');
});
test('actual local HTTP server preserves route status, privacy headers, session cookie and CRUD roundtrip',async t=>{
 const s=setup();await s.init();const server=createServer(async(req,res)=>{const request=new Request(s.cfg.PREVIEW_BASE_URL+req.url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Readable.toWeb(req),duplex:'half'}:{})});const r=await s.handler(request);res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>server.close());const base='http://127.0.0.1:'+server.address().port+'/api/preview?route=';
 const login=await fetch(base+'auth',{method:'POST',headers:{Origin:s.cfg.PREVIEW_BASE_URL,'Content-Type':'application/json'},body:JSON.stringify({password:s.cfg.PREVIEW_PORTAL_PASSWORD})});assert.equal(login.status,200);const session=login.headers.get('set-cookie').split(';')[0];
 const r=await fetch(base+'notes-save',{method:'POST',headers:{Origin:s.cfg.PREVIEW_BASE_URL,'Content-Type':'application/json',Cookie:session},body:JSON.stringify({action:'save',clientOpId:randomUUID(),title:'HTTP test',text:'日本語'})});assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');const n=await r.json();
 const read=await fetch(base+'notes&id='+n.id,{headers:{Cookie:session}});assert.equal(read.status,200);assert.equal((await read.json()).text,'日本語');
});

test('cache identity is authenticated, stable, isolated by namespace/account/password and never sent to public shares',async()=>{
 const s=setup();await s.init();assert.equal((await call(s,'auth')).body.cacheScope,undefined);
 const session=await owner(s),one=(await call(s,'auth',{session})).body.cacheScope;
 assert.match(one,/^[a-f0-9]{64}$/);assert.equal((await call(s,'auth',{session})).body.cacheScope,one);
 const before=s.b.requests.length;await call(s,'auth',{session});assert.equal(s.b.requests.length,before);
 s.cfg.KOOFR_NOTES_USER='another-account';assert.notEqual((await call(s,'auth',{session})).body.cacheScope,one);
 s.cfg.KOOFR_NOTES_NAMESPACE='Homepage-Notes-Vercel-Probe-123-'+randomUUID();assert.equal((await call(s,'auth',{session})).body.cacheScope,undefined);
 s.cfg.PREVIEW_PORTAL_PASSWORD='rotated-synthetic-password';assert.equal((await call(s,'auth',{session})).body.cacheScope,undefined);
});

test('owner bootstrap reads notes and folders under exactly one lock',async()=>{
 const s=setup();await s.init();const session=await owner(s);const start=s.b.requests.length;
 const response=await call(s,'notes',{session,query:'&includeFolders=1'});assert.equal(response.status,200);assert.deepEqual(response.body.notes,[]);assert.ok(Array.isArray(response.body.folders));assert.ok(response.body.folders.includes('Công việc'));
 assert.equal(s.b.requests.slice(start).filter(r=>r.method==='LOCK').length,1);
});

test('trash HTTP surface rejects unauthenticated callers and checks restore revision',async()=>{const s=setup();await s.init();assert.equal((await call(s,'trash')).status,401);const session=await owner(s),id=randomUUID();const saved=await call(s,'notes-save',{method:'POST',session,data:{action:'save',id,clientOpId:randomUUID(),title:'Trash HTTP',text:'a'.repeat(120)+' full text match'}});await call(s,'notes',{method:'POST',session,data:{action:'delete',id,revision:saved.body.revision}});const listed=await call(s,'trash',{session,query:'&q='+encodeURIComponent('full text match')});assert.equal(listed.status,200);assert.equal(listed.body.notes.length,1);assert.equal((await call(s,'trash',{session,query:'&id='+id})).body.text,saved.body.text);assert.equal((await call(s,'trash',{method:'POST',session,data:{action:'restore',id,revision:saved.body.revision}})).status,409);assert.equal((await call(s,'trash',{method:'POST',session,data:{action:'restore',id,revision:listed.body.notes[0].revision}})).status,200);assert.equal((await call(s,'notes',{session,query:'&id='+id})).status,200);});

test('owner move/order HTTP routes enforce auth and preserve shared content restrictions',async()=>{const s=setup();await s.init();const session=await owner(s),id=randomUUID();const saved=await call(s,'notes-save',{method:'POST',session,data:{action:'save',id,clientOpId:randomUUID(),title:'Organize',text:'keep',folder:'Gia đình'}});assert.equal((await call(s,'notes',{method:'POST',data:{action:'move'}})).status,401);const listing=await call(s,'notes',{session,query:'&includeFolders=1'});assert.equal((await call(s,'notes',{method:'POST',session,data:{action:'reorder',ids:[id],orderRevision:listing.body.orderRevision,clientOpId:randomUUID()}})).status,200);assert.equal((await call(s,'notes',{method:'POST',session,data:{action:'move',items:[{id,revision:saved.body.revision}],folder:'Công việc',clientOpId:randomUUID()}})).status,200);assert.equal((await call(s,'notes',{session,query:'&id='+id})).body.text,'keep');});


test('owner bootstrap includes active folder share markers in one snapshot without exposing capabilities',async()=>{
 const s=setup();await s.init();const session=await owner(s),folder='Marked empty folder';
 await call(s,'folders',{method:'POST',session,data:{action:'create',folder}});
 const share=permission=>call(s,'note-share',{method:'POST',session,data:{action:'create',folder,permission}});
 const edit=await share('edit'),view=await share('view');
 async function listing(expected){const start=s.b.requests.length,r=await call(s,'notes',{session,query:'&includeFolders=1'});assert.equal(r.status,200);assert.deepEqual(r.body.sharedFolders,expected);assert.equal(s.b.requests.slice(start).filter(r=>r.method==='LOCK').length,1);assert.ok(!JSON.stringify(r.body).includes(edit.body.token));assert.ok(!JSON.stringify(r.body).includes(edit.body.id));}
 await listing([folder]);
 for(const [index,link]of [edit,view].entries()){await call(s,'note-share',{method:'POST',session,data:{action:'revoke',folder,id:link.body.id}});await listing(index===0?[folder]:[]);}
 assert.equal((await call(s,'notes',{query:'&includeFolders=1'})).status,401);
 const fresh=await share('view'),publicList=await call(s,'shared-folder',{cap:fresh.body.token});assert.equal(publicList.status,200);assert.equal(publicList.body.sharedFolders,undefined);
});

test('owner can retrieve new share links across requests; copies are encrypted, private, and removed on revoke',async()=>{
 const s=setup();await s.init();const session=await owner(s),folder='Copy links',noteId=randomUUID();
 await call(s,'notes-save',{method:'POST',session,data:{action:'save',clientOpId:noteId,title:'Synthetic copy',text:'Private',folder}});
 for(const data of [{folder},{noteId}]){
  const made=await call(s,'note-share',{method:'POST',session,data:{action:'create',permission:'view',...data}});assert.equal(made.status,200);
  const query=data.folder?'&folder='+encodeURIComponent(folder):'&noteId='+noteId;
  assert.equal((await call(s,'note-share',{query})).status,401);
  assert.equal((await call(s,'note-share',{cap:made.body.token,query})).status,401);
  const links=await call(s,'note-share',{session,query});assert.equal(links.status,200);assert.equal(links.body.links[0].token,made.body.token);assert.equal(links.body.links[0].permission,'view');assert.equal(links.body.links[0].tokenBox,undefined);
  const cat=await s.makeStore({user:'fake',password:'synthetic-secret',namespace:s.cfg.KOOFR_NOTES_NAMESPACE}).capture();assert.ok(cat.shares[made.body.id].tokenBox);assert.ok(!JSON.stringify(cat).includes(made.body.token));
  const shared=await call(s,data.folder?'shared-folder':'shared-note',{cap:made.body.token});assert.equal(shared.status,200);assert.ok(!JSON.stringify(shared.body).includes(made.body.token));assert.ok(!JSON.stringify(shared.body).includes('tokenBox'));
  assert.ok(!JSON.stringify(s.logs).includes(made.body.token));assert.ok(!JSON.stringify(s.logs).includes(cat.shares[made.body.id].tokenBox));
  await call(s,'note-share',{method:'POST',session,data:{action:'revoke',id:made.body.id,...data}});
  const revoked=await call(s,'note-share',{session,query});assert.equal(revoked.body.links[0].token,undefined);assert.equal(revoked.body.links[0].revoked,true);
  const after=await s.makeStore({user:'fake',password:'synthetic-secret',namespace:s.cfg.KOOFR_NOTES_NAMESPACE}).capture();assert.equal(after.shares[made.body.id].tokenBox,undefined);
  assert.equal((await call(s,data.folder?'shared-folder':'shared-note',{cap:made.body.token})).status,403);
 }
});

test('legacy links remain valid without a recoverable copy, and replacement preserves requested permission',async()=>{
 const s=setup();await s.init();const session=await owner(s),store=s.makeStore({user:'fake',password:'synthetic-secret',namespace:s.cfg.KOOFR_NOTES_NAMESPACE}),folder='Legacy folder';await store.createFolder(folder);
 const legacy=await store.share('folder',folder,'view'),query='&folder='+encodeURIComponent(folder);
 const links=await call(s,'note-share',{session,query});assert.equal(links.body.links[0].token,undefined);assert.equal(links.body.links[0].revoked,false);
 const fresh=await call(s,'note-share',{method:'POST',session,data:{action:'create',folder,permission:'view'}});assert.equal(fresh.status,200);
 const listed=await call(s,'note-share',{session,query});assert.equal(listed.body.links.length,2);assert.equal(listed.body.links.find(l=>l.id===fresh.body.id).token,fresh.body.token);
 for(const token of [legacy.token,fresh.body.token]){const r=await call(s,'shared-folder',{cap:token});assert.equal(r.status,200);assert.equal(r.body.permission,'view');}
});
