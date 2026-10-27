import {randomUUID} from 'node:crypto';
import {appConfig,createApplicationStore} from './app-config.mjs';
import {NoteStore} from './store.mjs';
import {rollbackSnapshotIntoExisting} from './store-backup.mjs';
import {exportKoofrSnapshotReadOnly} from '../scripts/koofr-readonly-snapshot.mjs';
import {compareSnapshots,inspectSnapshot} from './firestore-migration.mjs';

const MAX_SNAPSHOT_BYTES=50_000_000;
const reply=(status,value)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
async function readBody(request){
 const reader=request.body?.getReader();if(!reader)return null;let size=0,parts=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();return null;}parts.push(value);}
 try{return JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{return null;}
}

export function createFirestoreKoofrRollbackHandler({env=()=>process.env,config=appConfig,makeFirestoreStore=createApplicationStore,makeKoofrStore=cfg=>new NoteStore(cfg),rollback=rollbackSnapshotIntoExisting,exportKoofr=exportKoofrSnapshotReadOnly,compare=compareSnapshots}={}){
 return async request=>{
  const e=env();
  if(e.VERCEL_ENV!=='production'||e.NOTES_MIGRATION_ROLLBACK_ENABLED!=='restore-firestore-to-koofr-v1')return reply(404,{code:'NOT_FOUND'});
  if(request.method!=='POST')return reply(405,{code:'METHOD_NOT_ALLOWED'});
  if(e.NOTES_WRITES_FROZEN!=='true')return reply(503,{code:'WRITE_FREEZE_REQUIRED'});
  let firestore,koofr;
  try{
   const cfg=config(e),origin=new URL(request.url).origin;
   if(request.headers.get('origin')!==cfg.origin) return reply(403,{code:'ORIGIN_DENIED'});
   const body=await readBody(request);
   if(body?.action!=='restore-current-firestore-to-original-koofr'||body.namespace!==cfg.namespace||!/^[a-f0-9]{64}$/.test(body.expectedCatalogSha256??''))return reply(400,{code:'ROLLBACK_CONFIRMATION_INVALID'});
   if(e.NOTES_BACKEND!=='firestore-native-v1'||!cfg.projectId||!cfg.vaultId) return reply(503,{code:'FIRESTORE_CONFIG_REQUIRED'});
   if(!e.NOTES_BASE_URL||!e.KOOFR_NOTES_USER||!e.KOOFR_NOTES_APP_PASSWORD)return reply(503,{code:'KOOFR_CONFIG_REQUIRED'});
   firestore=await makeFirestoreStore(cfg,request);
   const snapshot=await firestore.exportLegacySnapshot({maxBytes:MAX_SNAPSHOT_BYTES});
   const info=inspectSnapshot(snapshot);
   koofr=await makeKoofrStore({origin:e.NOTES_BASE_URL,user:e.KOOFR_NOTES_USER,password:e.KOOFR_NOTES_APP_PASSWORD,namespace:cfg.namespace});
   const restored=await rollback(koofr,snapshot,{expectedNamespace:cfg.namespace,expectedCatalogSha256:body.expectedCatalogSha256});
   const verified=await exportKoofr(koofr,{attempts:2}),comparison=compare(snapshot,JSON.parse(verified.encoded));
   if(!comparison.match)return reply(503,{code:'ROLLBACK_PARITY_FAILED'});
   return reply(200,{result:'ROLLBACK_VERIFIED',namespacePreserved:true,tokenBoxPreserved:true,restored,counts:info.counts,fingerprint:info.fingerprint,baselineCatalogSha256:body.expectedCatalogSha256,latestKoofrCatalogSha256:verified.sourceCatalogSha256});
  }catch(error){
   const code=/^(?:[A-Z0-9_-]{1,80})$/.test(error?.message??'')?error.message:'ROLLBACK_FAILED';
   const status=['ROLLBACK_BASELINE_CHANGED','ROLLBACK_EPOCH_MISMATCH','ROLLBACK_NAMESPACE_MISMATCH'].includes(code)?409:(Number.isInteger(error?.status)&&error.status>=400&&error.status<600?error.status:503);
   return reply(status,{code});
  }finally{
   await firestore?.close?.().catch(()=>{});
   koofr?.agent?.destroy();
  }
 };
}
