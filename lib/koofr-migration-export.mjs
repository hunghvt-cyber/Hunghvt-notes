import {gzipSync} from 'node:zlib';
import {appConfig} from './app-config.mjs';
import {NoteStore,StoreError} from './store.mjs';
import {exportKoofrSnapshotReadOnly} from '../scripts/koofr-readonly-snapshot.mjs';
import {authorizeLegacyBaselineExport} from './github-oidc-export-auth.mjs';

const MAX_SNAPSHOT_BYTES=50_000_000;
const allowedErrors=new Set([
 'INVALID_ATTEMPT_LIMIT','SOURCE_CATALOG_READ_FAILED','SOURCE_RESTORE_IN_PROGRESS',
 'SOURCE_PURGE_IN_PROGRESS','SOURCE_RECORD_HASH_MISMATCH','SOURCE_RECORD_ID_MISMATCH',
 'SOURCE_CATALOG_RECHECK_FAILED','SOURCE_CHANGED_DURING_READ','SNAPSHOT_TOO_LARGE',
 'NOTES_DISABLED','NOTES_ORIGIN_MISSING','NOTES_NAMESPACE_FORBIDDEN','NOTES_SHARED_AUTH_MISSING',
 'NOTES_AUTH_MISSING','NOTES_BACKEND_INVALID','NOTES_STORAGE_MISSING'
]);
const json=(status,value,headers={})=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',...headers}});

export function createKoofrMigrationExportHandler({env=()=>process.env,config=appConfig,makeStore=cfg=>new NoteStore(cfg),exportSnapshot=exportKoofrSnapshotReadOnly,authorize=authorizeLegacyBaselineExport}={}){
 return async request=>{
  const e=env();
  if(e.VERCEL_ENV!=='production'||e.NOTES_MIGRATION_EXPORT_ENABLED!=='get-only-v1')return json(404,{code:'NOT_FOUND'});
  if(!await authorize(request))return json(401,{code:'UNAUTHORIZED'});
  if(request.method!=='GET')return json(405,{code:'METHOD_NOT_ALLOWED'});
  if(e.NOTES_WRITES_FROZEN!=='true')return json(503,{code:'WRITE_FREEZE_REQUIRED'});
  let store;
  try{
   const cfg=config(e);
   if(e.NOTES_BACKEND&&e.NOTES_BACKEND!=='koofr-v1')throw new StoreError(503,'NOTES_BACKEND_NOT_KOOFR');
   const requestOrigin=new URL(request.url).origin;
   const deploymentOrigin=typeof e.VERCEL_URL==='string'?'https://'+e.VERCEL_URL:'';
   if(requestOrigin!==cfg.origin&&requestOrigin!==deploymentOrigin)throw new StoreError(403,'HOST_DENIED');
   store=await makeStore(cfg,request);
   const result=await exportSnapshot(store,{attempts:2});
   const bytes=Buffer.from(result.encoded,'utf8');
   if(bytes.byteLength>MAX_SNAPSHOT_BYTES)throw new StoreError(413,'SNAPSHOT_TOO_LARGE');
   const compressed=gzipSync(bytes);
   return new Response(compressed,{status:200,headers:{
    'Cache-Control':'no-store','Content-Type':'application/gzip',
    'Content-Disposition':'attachment; filename="notes-koofr-final.json.gz"',
    'X-Notes-Snapshot-Bytes':String(bytes.byteLength),'X-Notes-Snapshot-Sha256':result.sha256,
    'X-Notes-Source-Catalog-Sha256':result.sourceCatalogSha256,
    'X-Notes-Snapshot-Fingerprint':result.fingerprint,
    'X-Notes-Snapshot-Counts':JSON.stringify(result.counts),
    'X-Notes-Snapshot-Requests':String(result.requests)
   }});
  }catch(error){
   const code=allowedErrors.has(error?.message)?error.message:'SNAPSHOT_EXPORT_FAILED';
   return json(error instanceof StoreError?error.status:503,{code});
  }finally{
   if(store?.close)await store.close().catch(()=>{});else store?.agent?.destroy();
  }
 };
}
