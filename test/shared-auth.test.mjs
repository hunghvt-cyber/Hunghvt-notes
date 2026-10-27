import test from 'node:test';
import assert from 'node:assert/strict';
import {createSharedAuth} from '../lib/shared-auth.mjs';
import {createPreviewHandler} from '../lib/preview-api.mjs';
import {backend} from './helpers/collection.mjs';
import {randomUUID} from 'node:crypto';
test('shared service fails closed, never redirects/falls back, propagates rate limit and rejects malformed versions',async()=>{
 const env=()=>({VERCEL_ENV:'production',NOTES_AUTH_SERVICE_KEY:'a'.repeat(64)});
 for(const response of [new Response('{}',{status:503}),Response.json({version:'bad'}),Response.json({version:randomUUID(),valid:'yes'})]){
  const p=createSharedAuth({env,request:async(url,opts)=>{assert.equal(url,'https://homepage-nas.vercel.app/api/auth/?service=notes');assert.equal(opts.redirect,'error');return response;}});
  await assert.rejects(p.verify('fake','test'),/SHARED_AUTH_UNAVAILABLE/);
 }
 await assert.rejects(createSharedAuth({env,request:async()=>new Response('',{status:429})}).current(),e=>e.status===429);
});
test('Notes uses shared password and revokes a sealed session on central version change; independent inbox unaffected',async()=>{
 const b=backend(),cfg={origin:'https://notes.example',user:'fake',password:'fake',namespace:'test-'+randomUUID(),sharedAuth:true,portalPassword:'old-local-password',sessionPassword:'x'.repeat(40),sessionScope:'shared',cookieName:'__Host-test'},logs=[];
 const s=b.makeStore(cfg);await s.init();let version=randomUUID(),password='homepage-password';
 let handler=createPreviewHandler({config:()=>({...cfg}),passwordProvider:{current:async()=>({version}),verify:async p=>({valid:p===password,version})},makeStore:x=>b.makeStore(x),observe:x=>logs.push(x)});
 const req=(route,data,cookie)=>handler(new Request(cfg.origin+'/api/app?route='+route,{method:data?'POST':'GET',headers:{Origin:cfg.origin,'Content-Type':'application/json',...(cookie?{cookie}:{})},...(data?{body:JSON.stringify(data)}:{})}));
 const bad=await req('auth',{password:cfg.portalPassword});assert.equal(bad.status,401);assert.equal((await bad.json()).code,'INVALID_PASSWORD');
 const good=await req('auth',{password});assert.equal(good.status,200);const cookie=good.headers.get('set-cookie').split(';')[0];
 assert.equal((await req('notes',null,cookie)).status,200);
 assert.equal(logs.find(x=>x.route==='auth'&&x.method==='POST').authMetrics[0].operation,'homepage-verify');assert.equal(logs.find(x=>x.route==='notes').authMetrics[0].operation,'homepage-version');
 version=randomUUID();password='new-homepage-password';
 assert.equal((await req('notes',null,cookie)).status,401);
 assert.equal((await req('auth',{password:'homepage-password'})).status,401);
 assert.equal((await req('auth',{password})).status,200);
 handler=createPreviewHandler({config:()=>({...cfg}),passwordProvider:{current:async()=>{throw Object.assign(Error('PRIVATE_ERROR_MARKER'),{status:503});},verify:async()=>({valid:false,version})},makeStore:x=>b.makeStore(x),observe:x=>logs.push(x)});
 assert.equal((await req('notes',null,cookie)).status,503);const failed=logs.at(-1);assert.deepEqual(failed.authMetrics[0],{operation:'homepage-version',elapsedMs:failed.authMetrics[0].elapsedMs,callReturned:false,status:503});assert.equal(JSON.stringify(logs).includes('PRIVATE_ERROR_MARKER'),false);assert.equal(JSON.stringify(logs).includes('homepage-password'),false);
});
