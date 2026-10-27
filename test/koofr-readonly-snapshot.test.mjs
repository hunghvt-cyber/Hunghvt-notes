import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {exportKoofrSnapshotReadOnly} from '../scripts/koofr-readonly-snapshot.mjs';
import {backend} from './helpers/collection.mjs';
import {compareSnapshots} from '../lib/firestore-migration.mjs';
import {decodeSnapshot,encodeSnapshot} from '../lib/store-backup.mjs';

const input=()=>({user:'fixture',password:'synthetic-only',namespace:'Homepage-Notes-Vercel-Probe-123-'+randomUUID()});
test('Koofr snapshot exporter verifies catalog and hashes using GET only',async()=>{
 const b=backend(),i=input(),source=b.makeStore(i);await source.init();await source.seedBatch(0,4);
 const before=await source.verifyAll(),start=b.requests.length,result=await exportKoofrSnapshotReadOnly(source);
 const requests=b.requests.slice(start);
 assert.ok(requests.length>0);assert.ok(requests.every(x=>x.method==='GET'));
 assert.equal(result.counts.notes,4);assert.equal(result.requests,6);assert.equal(result.catalogCanonicalSha256,result.sourceCatalogSha256);
 const raw=Object.fromEntries(Object.values(before.cat.entries).map(entry=>[entry.head,b.files.get('/dav/Koofr/'+i.namespace+'/'+entry.head)]));
 assert.equal(compareSnapshots(JSON.parse(encodeSnapshot(before.cat,raw)),JSON.parse(result.encoded)).match,true);
 assert.equal(decodeSnapshot(result.encoded).catalog.version,before.cat.version);
});

test('rollback restores post-cutover state into original namespace while fencing unexpected Koofr writes',async()=>{
 const {hash}=await import('../lib/storage.mjs');
 const b=backend(),i=input(),source=b.makeStore(i);await source.init();await source.seedBatch(0,2);
 const share=await source.share('note','00000000-0000-4000-8000-000000000000','view',undefined,{protectToken:()=> 'encrypted-token-box'});
 const baseline=await source.readCatalog(),baselineHash=hash(JSON.stringify(baseline));
 const targetBackend=backend();for(const [k,v] of b.files)targetBackend.files.set(k,v);
 const target=targetBackend.makeStore(i);
 const current=await source.get('00000000-0000-4000-8000-000000000000');await source.save(0,{text:'Saved after cutover'},current.revision,randomUUID());
 const exported=await exportKoofrSnapshotReadOnly(source),envelope=JSON.parse(exported.encoded);
 const {rollbackSnapshotIntoExisting}=await import('../lib/store-backup.mjs');
 const outcome=await rollbackSnapshotIntoExisting(target,envelope,{expectedNamespace:i.namespace,expectedCatalogSha256:baselineHash});
 assert.equal(outcome.namespacePreserved,true);assert.equal((await target.get(current.id)).text,'Saved after cutover');
 const after=await target.readCatalog();assert.equal(after.shares[share.id].tokenBox,'encrypted-token-box');
 const bad=await target.readCatalog();bad.version++;
 const wrongHash=hash(JSON.stringify(bad));
 await assert.rejects(rollbackSnapshotIntoExisting(target,envelope,{expectedNamespace:i.namespace,expectedCatalogSha256:wrongHash}),e=>e.message==='ROLLBACK_BASELINE_CHANGED');
});
