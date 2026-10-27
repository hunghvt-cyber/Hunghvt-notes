import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,randomUUID,sign} from 'node:crypto';
import {authorizeInbox,inboxAudience,inboxFolder,inboxId,decryptEnvelope,createInboxHandler,textHash} from '../lib/inbox.mjs';
import {encryptInbox} from '../scripts/encrypt-inbox.mjs';
import {backend} from './helpers/collection.mjs';
const pair=generateKeyPairSync('rsa',{modulusLength:2048});
const privateKey=pair.privateKey.export({type:'pkcs8',format:'pem'}),publicKey=pair.publicKey.export({type:'spki',format:'pem'});
const now=Date.now(),seconds=Math.floor(now/1000),ref='refs/heads/release/minimal-notes';
function jwt(patch={},head={}){
 const c={iss:'https://token.actions.githubusercontent.com',aud:inboxAudience,sub:'repo:hunghvt-cyber@252749231/Hunghvt-notes@1423348828:ref:'+ref,repository:'hunghvt-cyber/Hunghvt-notes',repository_id:'1423348828',repository_owner_id:'252749231',ref,event_name:'push',workflow_ref:'hunghvt-cyber/Hunghvt-notes/.github/workflows/notes-inbox.yml@'+ref,iat:seconds,exp:seconds+300,run_id:'123',sha:'a'.repeat(40),...patch};
 const p=[{alg:'RS256',kid:'test',...head},c].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url')).join('.');return p+'.'+sign('RSA-SHA256',Buffer.from(p),pair.privateKey).toString('base64url');
}
const options={getKeys:async()=>[{...pair.publicKey.export({format:'jwk'}),kid:'test'}],now:seconds};
test('inbox OIDC binds immutable identity, issuer, audience, ref, event, workflow, lifetime and signature',async()=>{
 assert.equal((await authorizeInbox(jwt(),options)).runId,'123');
 for(const patch of [{iss:'evil'},{aud:'other'},{repository_id:'1'},{repository_owner_id:'1'},{repository:'other'},{sub:'repo:other'},{ref:'refs/heads/main'},{event_name:'pull_request'},{workflow_ref:'other'},{exp:seconds-1},{iat:seconds-601},{nbf:seconds+100},{sha:'bad'}])await assert.rejects(authorizeInbox(jwt(patch),options),/INBOX_UNAUTHORIZED/);
 await assert.rejects(authorizeInbox(jwt({}, {alg:'none'}),options),/INBOX_UNAUTHORIZED/);
 const wrong=generateKeyPairSync('rsa',{modulusLength:2048});await assert.rejects(authorizeInbox(jwt(),{...options,getKeys:async()=>[{...wrong.publicKey.export({format:'jwk'}),kid:'test'}]}),/INBOX_UNAUTHORIZED/);
});
test('envelopes are randomized, confidential and reject tamper/expiry/wrong key',()=>{
 const b={expiresAt:now+60000,text:'Private Unicode 😀'},e=encryptInbox(b,publicKey);
 assert.deepEqual(decryptEnvelope(e,privateKey,now),b);assert.notDeepEqual(e,encryptInbox(b,publicKey));assert.ok(!JSON.stringify(e).includes('Private'));
 assert.throws(()=>decryptEnvelope({...e,tag:'A'.repeat(22)},privateKey,now));
 assert.throws(()=>decryptEnvelope(e,privateKey,now+60001),/ENVELOPE_EXPIRED/);
 assert.throws(()=>decryptEnvelope(e,'bad',now));
});
test('no config/auth, cross-origin, invalid envelope or slot can access storage',async()=>{
 let calls=0;const handler=createInboxHandler({env:()=>({NOTES_INBOX_ENABLED:'github-oidc-v1',VERCEL_ENV:'production',NOTES_INBOX_PRIVATE_KEY:privateKey}),config:()=>({origin:'https://notes.example'}),authorize:async token=>{if(token!=='allowed')throw Error();},makeStore:()=>{calls++;throw Error();}});
 const req=(body,headers={})=>new Request('https://notes.example/api/inbox',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
 assert.equal((await handler(req({}))).status,401);
 assert.equal((await handler(req({}, {Authorization:'Bearer denied'}))).status,503);
 assert.equal((await handler(req({}, {Authorization:'Bearer allowed','sec-fetch-site':'cross-site'}))).status,403);
 assert.equal((await handler(req({}, {Authorization:'Bearer allowed'}))).status,400);
 assert.equal((await handler(req(encryptInbox({slot:'anything',expiresAt:now+60000},publicKey),{Authorization:'Bearer allowed'}))).status,400);
 assert.equal(calls,0);
 assert.equal((await createInboxHandler({env:()=>({}),makeStore:()=>{throw Error();}})(req({}))).status,503);
});
test('inbox only upserts managed notes with exact CAS, replay and hash readback; cannot share/delete/list',async()=>{
 const b=backend(),cfg={origin:'https://notes.example',user:'fake',password:'fake',namespace:'Hunghvt-Notes-Data-'+randomUUID()};
 const s=b.makeStore(cfg);await s.init();const other=randomUUID();await s.save(other,{title:'Existing',text:'untouched'},null,randomUUID());
 const handler=createInboxHandler({env:()=>({NOTES_INBOX_ENABLED:'github-oidc-v1',VERCEL_ENV:'production',NOTES_INBOX_PRIVATE_KEY:privateKey}),config:()=>cfg,authorize:async()=>({}),makeStore:x=>b.makeStore(x)});
 const request=async payload=>{const r=await handler(new Request(cfg.origin+'/api/inbox',{method:'POST',headers:{Authorization:'Bearer test','Content-Type':'application/json'},body:JSON.stringify(encryptInbox({expiresAt:now+60000,...payload},publicKey))}));return {status:r.status,body:await r.json()};};
 const payload={action:'save',slot:'office-v2',title:'Code',text:'Code Việt 😀',revision:null,clientOpId:randomUUID()};
 const first=await request(payload);assert.equal(first.status,200);assert.equal(first.body.verified,true);assert.equal(first.body.textHash,textHash(payload.text));assert.ok(!JSON.stringify(first).includes(payload.text));
 assert.equal((await request(payload)).body.replay,true);
 assert.equal((await request({...payload,text:'different'})).status,409);
 assert.equal((await request({...payload,clientOpId:randomUUID()})).status,409);
 const status=await request({action:'status',slot:'office-v2'});assert.equal(status.body.revision,first.body.revision);
 const next=await request({...payload,text:'next',revision:first.body.revision,clientOpId:randomUUID()});assert.equal(next.status,200);
 // Excel export must create a separate note, never overwrite Office code/config.
 const excel=await request({...payload,slot:'excel-to-txt',title:'Excel qua txt',text:'Excel-only code',revision:null,clientOpId:randomUUID()});
 assert.equal(excel.status,200);assert.equal(excel.body.verified,true);
 assert.notEqual(excel.body.id,inboxId('office-v2'));assert.notEqual(excel.body.id,inboxId('office-v2-config'));
 assert.equal((await s.get(inboxId('office-v2'))).text,'next');
 assert.equal((await s.get(excel.body.id)).title,'Excel qua txt');
 assert.equal((await s.get(excel.body.id)).text,'Excel-only code');
 assert.equal((await request({...payload,slot:'excel-to-txt',revision:null,clientOpId:randomUUID()})).status,409);
 assert.equal((await request({action:'delete',slot:'office-v2'})).status,400);
 assert.equal((await s.get(other)).text,'untouched');
 const n=await s.get(inboxId('office-v2'));assert.equal(n.folder,inboxFolder);
 await s.remove(n.id,n.revision);
 const deleted=await request({action:'status',slot:'office-v2'});assert.equal(deleted.body.deleted,true);
 assert.equal((await request({...payload,revision:deleted.body.revision,clientOpId:randomUUID()})).status,409);
 assert.equal((await request({...payload,restoreDeleted:true,revision:'stale',clientOpId:randomUUID()})).status,409);
 const restored=await request({...payload,restoreDeleted:true,revision:deleted.body.revision,clientOpId:randomUUID()});assert.equal(restored.status,200);assert.equal((await s.get(n.id)).text,payload.text);
 await s.share('folder',inboxFolder,'view');assert.equal((await request({...payload,revision:restored.body.revision,clientOpId:randomUUID()})).status,403);
});

