import test from 'node:test';
import assert from 'node:assert/strict';
import {KoofrFirestoreBackup,koofrBackupRoot} from '../lib/koofr-firestore-backup.mjs';
import {backupManagedMarker} from '../lib/firestore-backup-policy.mjs';

const response=(status,body='',headers={})=>new Response(status===204?null:body,{status,headers});
test('new backup root is marked only after MKCOL creates it',async()=>{
 const calls=[],store=new KoofrFirestoreBackup('u:p',{fetchImpl:async(url,options)=>{calls.push({url,options});return options.method==='MKCOL'?response(201):response(201);}});
 await store.ensureRoot();assert.equal(calls[0].options.method,'MKCOL');assert.equal(calls[1].options.method,'PUT');assert.equal(calls[1].options.body,backupManagedMarker);assert.equal(calls[1].options.headers['if-none-match'],'*');assert.ok(calls[1].url.startsWith(koofrBackupRoot));
});
test('pre-existing backup path without exact ownership marker fails closed',async()=>{
 const store=new KoofrFirestoreBackup('u:p',{fetchImpl:async(_url,options)=>options.method==='MKCOL'?response(405):response(404)});
 await assert.rejects(store.ensureRoot(),/BACKUP_ROOT_NOT_OWNED/);
});
test('baseline archive uses an isolated exact prefix and verifies its ownership marker',async()=>{
 const calls=[],marker=Buffer.from('notes-legacy-baseline-managed-v1\n');
 const store=new KoofrFirestoreBackup('u:p',{fetchImpl:async(url,options)=>{calls.push({url,options});if(options.method==='MKCOL')return response(201);return response(201);}});
 await store.ensureBaselineRoot();
 await store.putBaseline('legacy-koofr-1-1.json.gz',Buffer.from('snapshot'),'application/gzip');
 assert.ok(calls[0].url.endsWith('/legacy-baselines/'));assert.deepEqual(calls[1].options.body,marker);
 assert.ok(calls[2].url.endsWith('/legacy-baselines/legacy-koofr-1-1.json.gz'));
 assert.equal(calls.some(x=>x.options.method==='DELETE'),false);
});
test('unowned baseline prefix and unsafe object names fail closed',async()=>{
 const store=new KoofrFirestoreBackup('u:p',{fetchImpl:async(_url,options)=>options.method==='MKCOL'?response(405):response(404)});
 await assert.rejects(store.ensureBaselineRoot(),/BASELINE_ROOT_NOT_OWNED/);
 await assert.rejects(store.putBaseline('../private',Buffer.from('x'),'application/gzip'));
});
test('WebDAV transient 503 retries are bounded to three requests',async()=>{
 let count=0;const store=new KoofrFirestoreBackup('u:p',{fetchImpl:async()=>{count++;return response(503);},timeoutMs:1000});
 const r=await store.call('GET',koofrBackupRoot);assert.equal(r.status,503);assert.equal(count,3);
});
test('WebDAV object methods reject names outside the exact backup grammar',async()=>{
 let count=0;const store=new KoofrFirestoreBackup('u:p',{fetchImpl:async()=>{count++;return response(200);}});
 await assert.rejects(store.get('../private'));await assert.rejects(store.put('notes-old.json',Buffer.from('x'),'application/octet-stream'));assert.equal(count,0);
});
test('WebDAV authentication header is generated in memory and request is not redirected',async()=>{
 let options;const store=new KoofrFirestoreBackup('u:p',{fetchImpl:async(_url,x)=>{options=x;return response(204);}});
 await store.put('firestore-notes-2026-10-27T03-30-00Z-1-1.json.gz',Buffer.from('x'),'application/gzip');
 assert.equal(options.headers.authorization,'Basic dTpw');assert.equal(options.redirect,'error');
});
