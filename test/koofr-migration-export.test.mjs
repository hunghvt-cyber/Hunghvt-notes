import test from 'node:test';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {randomUUID} from 'node:crypto';
import {createKoofrMigrationExportHandler} from '../lib/koofr-migration-export.mjs';
import {backend} from './helpers/collection.mjs';
import {compareSnapshots} from '../lib/firestore-migration.mjs';
import {exportKoofrSnapshotReadOnly} from '../scripts/koofr-readonly-snapshot.mjs';

test('staged migration exporter is closed by default, GET-only, frozen-only, and returns a validated gzip snapshot',async()=>{
 const env={VERCEL_ENV:'production',VERCEL_URL:'stage.vercel.app',NOTES_MIGRATION_EXPORT_ENABLED:'get-only-v1',NOTES_WRITES_FROZEN:'true'};
 const cfg={origin:'https://notes.example',user:'synthetic',password:'synthetic',namespace:'Homepage-Notes-Vercel-Probe-123-'+randomUUID()};
 const b=backend(),source=b.makeStore(cfg);await source.init();await source.seedBatch(0,3);
 const expected=JSON.parse((await exportKoofrSnapshotReadOnly(source)).encoded),start=b.requests.length;
 let made=0;const handler=createKoofrMigrationExportHandler({env:()=>env,config:()=>cfg,authorize:async()=>true,makeStore:()=>{made++;return source;}});
 const closed=createKoofrMigrationExportHandler({env:()=>({...env,NOTES_MIGRATION_EXPORT_ENABLED:undefined}),makeStore:()=>{throw Error('must stay closed');}});
 assert.equal((await closed(new Request(cfg.origin+'/api/migration-export'))).status,404);
 assert.equal((await handler(new Request(cfg.origin+'/api/migration-export',{method:'POST'}))).status,405);
 env.NOTES_WRITES_FROZEN='false';assert.equal((await handler(new Request(cfg.origin+'/api/migration-export'))).status,503);env.NOTES_WRITES_FROZEN='true';
 const unauthorized=createKoofrMigrationExportHandler({env:()=>env,authorize:async()=>false,makeStore:()=>{throw Error('must reject before opening source');}});
 assert.equal((await unauthorized(new Request('https://stage.vercel.app/api/migration-export'))).status,401);
 const response=await handler(new Request('https://stage.vercel.app/api/migration-export'));
 assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'application/gzip');assert.equal(made,1);
 assert.ok(b.requests.slice(start).length>0);assert.ok(b.requests.slice(start).every(x=>x.method==='GET'));
 const snapshot=JSON.parse(gunzipSync(Buffer.from(await response.arrayBuffer())).toString('utf8'));
 assert.equal(compareSnapshots(snapshot,expected).match,true);
 assert.match(response.headers.get('x-notes-snapshot-sha256'),/^[a-f0-9]{64}$/);
 assert.equal(JSON.parse(response.headers.get('x-notes-snapshot-counts')).notes,3);
});
