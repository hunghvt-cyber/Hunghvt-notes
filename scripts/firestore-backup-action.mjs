import {createHash} from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';
import {Firestore} from '@google-cloud/firestore';
import {GoogleAuth} from 'google-auth-library';
import {FirestoreNativeRepository} from '../lib/firestore-native-repository.mjs';
import {inspectSnapshot} from '../lib/firestore-migration.mjs';
import {assertRetentionSafety,snapshotName,validateBackupManifest} from '../lib/firestore-backup-policy.mjs';
import {KoofrFirestoreBackup} from '../lib/koofr-firestore-backup.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex');
const scope={projectId:'notes-lab-56f0f',databaseId:'(default)',vaultId:'notes-production'};
const safe=(name,extra={})=>process.stdout.write(JSON.stringify({event:name,...extra})+'\n');
function calendarDateVN(instant){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(instant);}
function inspectGzip(gzip,manifest){
 if(sha(gzip)!==manifest.compressedSha256)throw new Error('BACKUP_READBACK_HASH_MISMATCH');
 const plain=gunzipSync(gzip,{maxOutputLength:50_000_000});if(plain.length!==manifest.snapshotBytes)throw new Error('BACKUP_READBACK_SIZE_MISMATCH');
 const snapshot=JSON.parse(plain.toString('utf8')),info=inspectSnapshot(snapshot);
 if(info.fingerprint!==manifest.fingerprint||JSON.stringify(info.counts)!==JSON.stringify(manifest.counts))throw new Error('BACKUP_READBACK_PARITY_MISMATCH');
 return {snapshotBytes:plain.length,counts:info.counts,fingerprint:info.fingerprint};
}
async function main(){
 if(process.env.GOOGLE_CLOUD_PROJECT!==scope.projectId||process.env.NOTES_BACKUP_VAULT_ID!==scope.vaultId)throw new Error('BACKUP_SCOPE_CONFIRMATION_FAILED');
 const credential=process.env.NOTES_BACKUP_KOOFR_CREDENTIAL;if(!credential)throw new Error('BACKUP_KOOFR_CREDENTIAL_MISSING');
 const now=new Date(),capturedAt=now.toISOString(),auth=new GoogleAuth({scopes:['https://www.googleapis.com/auth/cloud-platform']}),db=new Firestore({projectId:scope.projectId,auth}),repo=new FirestoreNativeRepository(db,{vaultId:scope.vaultId,maxAttempts:3});
 const remote=new KoofrFirestoreBackup(credential);
 try{
  await remote.ensureRoot();
  const snapshot=await repo.exportLegacySnapshot({maxBytes:50_000_000}),info=inspectSnapshot(snapshot),plain=Buffer.from(JSON.stringify(snapshot));
  if(plain.length>50_000_000)throw new Error('BACKUP_SNAPSHOT_LIMIT_EXCEEDED');
  const gzip=gzipSync(plain,{level:9}),runId=process.env.GITHUB_RUN_ID,attempt=process.env.GITHUB_RUN_ATTEMPT||'1',name=snapshotName(capturedAt,runId,attempt);
  const manifest={schemaVersion:1,backupId:name,projectId:scope.projectId,databaseId:scope.databaseId,vaultId:scope.vaultId,capturedAt,calendarDateVN:calendarDateVN(now),snapshotBytes:plain.length,compressedBytes:gzip.length,compressedSha256:sha(gzip),fingerprint:info.fingerprint,counts:info.counts,sourceCommit:process.env.GITHUB_SHA??'unknown',workflowRunId:String(runId??'unknown'),workflowRunAttempt:String(attempt)};
  validateBackupManifest(manifest,scope);await remote.put(name,gzip,'application/gzip');const manifestName=`${name}.manifest.json`;await remote.put(manifestName,Buffer.from(JSON.stringify(manifest)),'application/json');
  const readback=await remote.get(name),readbackManifest=JSON.parse((await remote.get(manifestName)).toString('utf8'));
  if(JSON.stringify(readbackManifest)!==JSON.stringify(manifest))throw new Error('BACKUP_MANIFEST_READBACK_MISMATCH');
  const verified=inspectGzip(readback,readbackManifest);assertRetentionSafety({newCounts:verified.counts,compressedBytes:readback.length});
  const retention=await remote.prune({scope,newBackupId:name,newCounts:verified.counts,compressedBytes:readback.length,decodeAndInspect:async(gzipBytes,oldManifest)=>inspectGzip(gzipBytes,oldManifest)});
  await remote.putControl('.latest-verified-backup.json',Buffer.from(JSON.stringify({schemaVersion:1,backupId:name,compressedSha256:manifest.compressedSha256,fingerprint:manifest.fingerprint,verifiedAt:new Date().toISOString()})));
  safe('backup_verified',{backupId:name,capturedAt,calendarDateVN:manifest.calendarDateVN,snapshotBytes:plain.length,compressedBytes:gzip.length,compressedSha256:manifest.compressedSha256,...verified,retention});
 }finally{await db.terminate().catch(()=>{});}
}
main().catch(error=>{const code=/^[A-Z0-9_-]{1,100}$/.test(error?.message??'')?error.message:'BACKUP_FAILED';process.stderr.write(JSON.stringify({event:'backup_failed',code})+'\n');process.exitCode=1;});
