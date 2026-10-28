import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {appConfig,productionProject} from '../lib/app-config.mjs';
import {createFirestoreNativeStore} from '../lib/firestore-runtime.mjs';

const previewEnv={NOTES_MODE:'live-v1',NOTES_PROJECT_ID:productionProject,VERCEL_PROJECT_ID:productionProject,VERCEL_ENV:'preview',VERCEL_URL:'notes-preview.vercel.app',NOTES_DATA_NAMESPACE:'Homepage-Notes-Vercel-Probe-123-12345678-1234-4234-8234-123456789abc',NOTES_SESSION_PASSWORD:'s'.repeat(40),NOTES_PASSWORD:'p'.repeat(20),NOTES_BACKEND:'firestore-native-v1',NOTES_FIRESTORE_PROJECT_ID:'notes-lab-56f0f',NOTES_FIRESTORE_VAULT_ID:'notes-preview'};

test('native backend config is explicit, preview-scoped, and does not require Koofr secrets',()=>{
 const cfg=appConfig(previewEnv);assert.equal(cfg.backend,'firestore-native-v1');assert.equal(cfg.projectId,'notes-lab-56f0f');assert.equal(cfg.vaultId,'notes-preview');
 assert.throws(()=>appConfig({...previewEnv,NOTES_BACKEND:undefined}),e=>e.message==='NOTES_STORAGE_MISSING');
 assert.throws(()=>appConfig({...previewEnv,NOTES_BACKEND:'unknown-backend'}),e=>e.message==='NOTES_BACKEND_INVALID');
 assert.throws(()=>appConfig({...previewEnv,VERCEL_ENV:'production',NOTES_BASE_URL:'https://hunghvt-notes.vercel.app',NOTES_DATA_NAMESPACE:'Hunghvt-Notes-Data-12345678-1234-1234-1234-123456789abc'}),e=>e.message==='FIRESTORE_PRODUCTION_REVIEW_REQUIRED');
});

test('Vercel WIF constructs a GoogleAuth client from a supplier and rejects external credential sources',async()=>{
 let settings;class FirestoreFake{constructor(value){settings=value;}collection(name){return {doc:id=>({get:async()=>({exists:true}),collection:sub=>({doc:leaf=>({name,id,sub,leaf})})})};}}
 const wif={type:'external_account',audience:'//iam.googleapis.com/projects/123456789/locations/global/workloadIdentityPools/vercel/providers/notes',subject_token_type:'urn:ietf:params:oauth:token-type:jwt',token_url:'https://sts.googleapis.com/v1/token',service_account_impersonation_url:'https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/notes@notes-lab-56f0f.iam.gserviceaccount.com:generateAccessToken'};
 const env={VERCEL_ENV:'preview',NOTES_FIRESTORE_WIF_CONFIG:JSON.stringify(wif)};
 const store=await createFirestoreNativeStore({projectId:'notes-lab-56f0f',vaultId:'notes-preview',namespace:'preview'},{headers:new Headers()},{env,FirestoreClass:FirestoreFake,tokenProvider:async()=>'synthetic-oidc-token-'.padEnd(128,'x')});
 const client=await settings.auth.getClient();assert.ok(client);assert.equal(store.vaultId,'notes-preview');
 assert.deepEqual(await store.runtimeHealth(),{readable:true,vaultInitialized:true});
 await assert.rejects(createFirestoreNativeStore({projectId:'notes-lab-56f0f',vaultId:'notes-preview',namespace:'preview'},{headers:new Headers()},{env:{...env,NOTES_FIRESTORE_WIF_CONFIG:JSON.stringify({...wif,credential_source:{file:'/tmp/credentials'}})},FirestoreClass:FirestoreFake,tokenProvider:async()=>'synthetic-oidc-token-'.padEnd(128,'x')}),e=>e.message==='FIRESTORE_WIF_CONFIG_INVALID');
});

test('Firestore runtime records only OIDC subject-token duration, never token text',async()=>{
 let auth,calls=0;
 const document={collection(){return this;},doc(){return this;}};
 const db={collection(){return document;}};
 class FakeFirestore{constructor(options){auth=options.auth;return db;}}
 const cfg={projectId:'test-'+randomBytes(5).toString('hex'),vaultId:'test-vault',namespace:'synthetic'};
 const env={VERCEL_ENV:'preview',NOTES_FIRESTORE_WIF_CONFIG:JSON.stringify({
  type:'external_account',audience:'//iam.googleapis.com/projects/123/locations/global/workloadIdentityPools/notes-pool/providers/github',
  subject_token_type:'urn:ietf:params:oauth:token-type:jwt',token_url:'https://sts.googleapis.com/v1/token',
  service_account_impersonation_url:'https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/notes-test@example.iam.gserviceaccount.com:generateAccessToken'
 })};
 const store=await createFirestoreNativeStore(cfg,null,{env,FirestoreClass:FakeFirestore,tokenProvider:async()=>{calls++;return 'synthetic-short-token';}});
 await assert.rejects(store.runWithRuntimeTiming(()=>auth.getAccessToken()));
 assert.equal(calls,1);assert.equal(store.runtimeTimings.oidcSubjectTokenMs.length,1);
 assert.equal(store.runtimeTimings.oidcSubjectTokenMs[0].succeeded,false);
 assert.ok(store.runtimeTimings.oidcSubjectTokenMs[0].ms>=0);
 assert.equal(JSON.stringify(store.runtimeTimings).includes('synthetic-short-token'),false);
});
