import {createHash} from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';
import {Firestore} from '@google-cloud/firestore';
import {GoogleAuth} from 'google-auth-library';
import {FirestoreNativeRepository} from '../lib/firestore-native-repository.mjs';
import {compareSnapshots,inspectSnapshot} from '../lib/firestore-migration.mjs';
import {KoofrFirestoreBackup} from '../lib/koofr-firestore-backup.mjs';

const projectId='notes-lab-56f0f',vaultId='notes-production';
const sha=value=>createHash('sha256').update(value).digest('hex');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function report(event,data={}){process.stdout.write(JSON.stringify({event,...data})+'\n');}
function required(name){const value=process.env[name];if(!value)throw new Error(name+'_MISSING');return value;}
async function actionsToken(){
 const endpoint=new URL(required('ACTIONS_ID_TOKEN_REQUEST_URL'));endpoint.searchParams.set('audience','https://hunghvt-notes.vercel.app/notes-legacy-baseline');
 const response=await fetch(endpoint,{headers:{authorization:'Bearer '+required('ACTIONS_ID_TOKEN_REQUEST_TOKEN')},signal:AbortSignal.timeout(15000),redirect:'error'});
 if(!response.ok)throw new Error('ACTIONS_OIDC_TOKEN_FAILED');
 const body=await response.json();if(typeof body.value!=='string'||body.value.length<100)throw new Error('ACTIONS_OIDC_TOKEN_INVALID');return body.value;
}
async function exportKoofr(url,token){
 let response,last;
 for(let attempt=0;attempt<3;attempt++){
  try{response=await fetch(url,{headers:{authorization:'Bearer '+token,'x-vercel-trusted-oidc-idp-token':token,accept:'application/gzip'},signal:AbortSignal.timeout(130000),redirect:'error'});if((response.status===429||response.status>=500)&&attempt<2){await response.arrayBuffer().catch(()=>{});await sleep(300*(2**attempt));continue;}break;}catch{last=new Error('KOFR_EXPORT_NETWORK_FAILED');if(attempt<2)await sleep(300*(2**attempt));}
 }
 if(!response){throw last??new Error('KOFR_EXPORT_NETWORK_FAILED');}
 if(response.status!==200)throw new Error(`KOFR_EXPORT_HTTP_${response.status}`);
 if(response.headers.get('content-type')!=='application/gzip')throw new Error('KOFR_EXPORT_CONTENT_TYPE_INVALID');
 const gzip=Buffer.from(await response.arrayBuffer());if(gzip.length>50_000_000)throw new Error('KOFR_EXPORT_COMPRESSED_LIMIT');
 const plain=gunzipSync(gzip,{maxOutputLength:50_000_000}),snapshot=JSON.parse(plain.toString('utf8')),info=inspectSnapshot(snapshot);
 if(sha(plain)!==response.headers.get('x-notes-snapshot-sha256'))throw new Error('KOFR_EXPORT_HASH_MISMATCH');
 if(info.fingerprint!==response.headers.get('x-notes-snapshot-fingerprint'))throw new Error('KOFR_EXPORT_FINGERPRINT_MISMATCH');
 if(JSON.stringify(info.counts)!==response.headers.get('x-notes-snapshot-counts'))throw new Error('KOFR_EXPORT_COUNTS_MISMATCH');
 return {gzip,plain,snapshot,counts:info.counts,fingerprint:info.fingerprint,sourceCatalogSha256:response.headers.get('x-notes-source-catalog-sha256')};
}
async function exportFirestore(repo){const snapshot=await repo.exportLegacySnapshot({maxBytes:50_000_000}),plain=Buffer.from(JSON.stringify(snapshot)),info=inspectSnapshot(snapshot);return {snapshot,plain,gzip:null,counts:info.counts,fingerprint:info.fingerprint};}
async function main(){
 const url=new URL(required('NOTES_EXPORT_URL'));
 const hostAllowed=url.hostname==='hunghvt-notes.vercel.app'||/^hunghvt-notes-[a-z0-9-]+-hunghvt\.vercel\.app$/.test(url.hostname);
 if(url.protocol!=='https:'||!hostAllowed||url.pathname!=='/api/migration-export'||url.search)throw new Error('KOFR_EXPORT_URL_SCOPE_INVALID');
 if(process.env.GOOGLE_CLOUD_PROJECT!==projectId||process.env.NOTES_BACKUP_VAULT_ID!==vaultId)throw new Error('FIRESTORE_SCOPE_CONFIRMATION_FAILED');
 const run=required('GITHUB_RUN_ID'),attempt=process.env.GITHUB_RUN_ATTEMPT||'1';if(!/^\d+$/.test(run)||!/^\d+$/.test(attempt))throw new Error('RUN_ID_INVALID');
 const token=await actionsToken(),koofr=await exportKoofr(url,token);let auth,db,repo;
 try{
  auth=new GoogleAuth({projectId,scopes:['https://www.googleapis.com/auth/cloud-platform']});db=new Firestore({projectId,auth});repo=new FirestoreNativeRepository(db,{vaultId,maxAttempts:3});
  const before=await exportFirestore(repo),after=await exportFirestore(repo),stable=compareSnapshots(before.snapshot,after.snapshot);
  const comparison=compareSnapshots(koofr.snapshot,after.snapshot);
  const firstName=`legacy-koofr-${run}-${attempt}.json.gz`,secondName=`legacy-firestore-${run}-${attempt}.json.gz`,manifestName=`legacy-${run}-${attempt}.manifest.json`;
  const firestoreGzip=gzipSync(after.plain,{level:9});
  const manifest={schemaVersion:1,runId:run,attempt,capturedAt:new Date().toISOString(),scope:{projectId,databaseId:'(default)',vaultId,namespace:'Hunghvt-Notes-Data-78cd53a3-e871-40e5-bf04-5e70ac20901e'},koofr:{object:firstName,compressedSha256:sha(koofr.gzip),snapshotSha256:sha(koofr.plain),sourceCatalogSha256:koofr.sourceCatalogSha256,counts:koofr.counts,fingerprint:koofr.fingerprint},firestore:{object:secondName,compressedSha256:sha(firestoreGzip),snapshotSha256:sha(after.plain),counts:after.counts,fingerprint:after.fingerprint},firestoreStableDuringCapture:stable.match,parity:{match:comparison.match,differences:[...new Set(comparison.differences.map(x=>x.startsWith('note:')?'notes':x))]}};
  const remote=new KoofrFirestoreBackup(required('NOTES_BACKUP_KOOFR_CREDENTIAL'));
  await remote.ensureRoot();await remote.ensureBaselineRoot();
  await remote.putBaseline(firstName,koofr.gzip,'application/gzip');
  await remote.putBaseline(secondName,firestoreGzip,'application/gzip');
  await remote.putBaseline(manifestName,Buffer.from(JSON.stringify(manifest)),'application/json');
  const [koofrReadback,firestoreReadback,manifestReadback]=await Promise.all([remote.getBaseline(firstName),remote.getBaseline(secondName),remote.getBaseline(manifestName)]);
  if(sha(koofrReadback)!==manifest.koofr.compressedSha256||sha(firestoreReadback)!==manifest.firestore.compressedSha256||manifestReadback.toString('utf8')!==JSON.stringify(manifest))throw new Error('BASELINE_READBACK_MISMATCH');
  for(const [gzip,expected] of [[koofrReadback,manifest.koofr],[firestoreReadback,manifest.firestore]]){const plain=gunzipSync(gzip,{maxOutputLength:50_000_000}),info=inspectSnapshot(JSON.parse(plain.toString('utf8')));if(sha(plain)!==expected.snapshotSha256||info.fingerprint!==expected.fingerprint||JSON.stringify(info.counts)!==JSON.stringify(expected.counts))throw new Error('BASELINE_PARITY_READBACK_MISMATCH');}
  report('legacy_baseline_verified',{manifestName,koofr:manifest.koofr,firestore:manifest.firestore,firestoreStableDuringCapture:stable.match,parity:manifest.parity,remoteReadback:'PASS'});
 }finally{if(db)await db.terminate().catch(()=>{});}
}
main().catch(error=>{const code=/^[A-Z0-9_-]{1,100}$/.test(error?.message??'')?error.message:'LEGACY_BASELINE_FAILED';process.stderr.write(JSON.stringify({event:'legacy_baseline_failed',code})+'\n');process.exitCode=1;});
