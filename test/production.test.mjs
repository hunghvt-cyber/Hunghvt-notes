import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {backend} from './helpers/collection.mjs';
import {appConfig,productionProject,createAppHandler} from '../lib/app-config.mjs';
import {provisionStore,downloadSnapshot} from '../lib/production-store.mjs';
import {decodeSnapshot} from '../lib/store-backup.mjs';
const input=()=>({user:'synthetic',password:'fake-password',namespace:'Hunghvt-Notes-Data-'+randomUUID()});
test('production config binds project, exact namespace and origin; preview cannot read live root',()=>{
 const env={NOTES_MODE:'live-v1',NOTES_PROJECT_ID:productionProject,VERCEL_PROJECT_ID:productionProject,VERCEL_ENV:'production',NOTES_BASE_URL:'https://notes.example',NOTES_DATA_NAMESPACE:input().namespace,NOTES_SESSION_PASSWORD:randomUUID()+randomUUID(),NOTES_PASSWORD:'synthetic-password',KOOFR_NOTES_USER:'synthetic',KOOFR_NOTES_APP_PASSWORD:'fake'};
 assert.equal(appConfig(env).cookieName,'__Host-hunghvt-notes');
 for(const patch of [{NOTES_MODE:''},{VERCEL_PROJECT_ID:'homepage'},{NOTES_DATA_NAMESPACE:'backup'},{VERCEL_ENV:'preview',VERCEL_URL:'preview.example'},{NOTES_PASSWORD:''},{KOOFR_NOTES_APP_PASSWORD:''}])assert.throws(()=>appConfig({...env,...patch}));
});
test('synthetic Firestore smoke accepts only an isolated production vault and uses its deployment origin',()=>{
 const env={NOTES_MODE:'live-v1',NOTES_PROJECT_ID:productionProject,VERCEL_PROJECT_ID:productionProject,VERCEL_ENV:'production',VERCEL_URL:'staged.vercel.app',NOTES_BASE_URL:'https://notes.example',NOTES_DATA_NAMESPACE:input().namespace,NOTES_SESSION_PASSWORD:randomUUID()+randomUUID(),NOTES_PASSWORD:'synthetic-password',NOTES_BACKEND:'firestore-native-v1',NOTES_FIRESTORE_PRODUCTION_REVIEW:'approved-v1',NOTES_FIRESTORE_PROJECT_ID:'notes-lab-56f0f',NOTES_FIRESTORE_VAULT_ID:'notes-cutover-smoke-'+randomUUID(),NOTES_SYNTHETIC_FIRESTORE_SMOKE:'firestore-v1'};
 const cfg=appConfig(env);assert.equal(cfg.origin,'https://staged.vercel.app');assert.equal(cfg.vaultId,env.NOTES_FIRESTORE_VAULT_ID);assert.equal(cfg.sharedAuth,false);
 assert.equal(appConfig({...env,NOTES_FIRESTORE_VAULT_ID:'notes-production'}).origin,'https://notes.example');
 assert.equal(appConfig({...env,NOTES_SYNTHETIC_FIRESTORE_SMOKE:'disabled'}).origin,'https://notes.example');
});
test('provisioning is empty, replay-safe, and never adopts a root without its marker',async()=>{
 const b=backend(),i=input(),s=b.makeStore(i);await provisionStore(s);await s.save(randomUUID(),{title:'giữ nguyên',text:'Nội dung 😀'},null,randomUUID());const before=await s.capture();assert.equal((await provisionStore(s)).replay,true);assert.deepEqual(await s.capture(),before);
 const x=b.makeStore(input());await x.dav().call('unowned','MKCOL',undefined,{},true);await assert.rejects(provisionStore(x),/PROVISION_UNOWNED_ROOT/);
});
test('read-only downloadable backups verify notes and can feed existing restore decoder',async()=>{
 const b=backend(),s=b.makeStore(input());await provisionStore(s);const id=randomUUID();await s.save(id,{title:'Sao lưu',text:'Chữ Việt 😀',checklist:[{id:'a',text:'test',checked:true}]},null,randomUUID());const before=await s.capture(),backup=await downloadSnapshot(s);assert.equal(Object.keys(decodeSnapshot(JSON.stringify(backup)).catalog.entries).length,1);assert.deepEqual(await s.capture(),before);
});
test('live API stays closed without production secrets and never reads storage',async()=>{
 let calls=0;const handler=createAppHandler({env:()=>({}),makeStore:()=>{calls++;throw Error();},observe:()=>{}});assert.equal((await handler(new Request('https://notes.example/api/app?route=health'))).status,200);assert.equal((await handler(new Request('https://notes.example/api/app?route=notes'))).status,503);assert.equal(calls,0);
});
