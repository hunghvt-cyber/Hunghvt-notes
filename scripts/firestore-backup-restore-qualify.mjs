import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {Firestore} from '@google-cloud/firestore';
import {GoogleAuth} from 'google-auth-library';
import {FirestoreNativeRepository} from '../lib/firestore-native-repository.mjs';
import {compareSnapshots,inspectSnapshot} from '../lib/firestore-migration.mjs';
import {KoofrFirestoreBackup} from '../lib/koofr-firestore-backup.mjs';
import {validateBackupManifest} from '../lib/firestore-backup-policy.mjs';

const scope={projectId:'notes-lab-56f0f',databaseId:'(default)',vaultId:'notes-production'},sha=x=>createHash('sha256').update(x).digest('hex');
const safe=(event,fields={})=>process.stdout.write(JSON.stringify({event,...fields})+'\n');
async function main(){
 if(process.env.GOOGLE_CLOUD_PROJECT!==scope.projectId)throw new Error('RESTORE_PROJECT_CONFIRMATION_FAILED');
 const runId=process.env.GITHUB_RUN_ID;
 if(!/^\d+$/.test(runId??''))throw new Error('RESTORE_RUN_ID_INVALID');
 const remote=new KoofrFirestoreBackup(process.env.NOTES_BACKUP_KOOFR_CREDENTIAL??'');await remote.ensureRoot();
 const bytes=await remote.getControl('.latest-verified-backup.json');if(!bytes)throw new Error('RESTORE_LATEST_BACKUP_MARKER_MISSING');
 const latest=JSON.parse(bytes.toString('utf8')),backupId=latest.backupId;
 if(!/^firestore-notes-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z-\d+-\d+\.json\.gz$/.test(backupId??''))throw new Error('RESTORE_BACKUP_ID_INVALID');
 const qualified=await remote.getControl('.restore-qualification-passed.json');
 if(qualified){const marker=JSON.parse(qualified.toString('utf8'));if(marker.schemaVersion!==1||marker.result!=='PASS'||!/^firestore-notes-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z-\d+-\d+\.json\.gz$/.test(marker.backupId??''))throw new Error('RESTORE_QUALIFICATION_MARKER_INVALID');if(marker.backupId===backupId&&marker.fingerprint===latest.fingerprint)safe('restore_qualification_already_passed',{backupId:marker.backupId,fingerprint:marker.fingerprint});if(marker.backupId===backupId&&marker.fingerprint===latest.fingerprint)return;}
 const manifest=JSON.parse((await remote.get(`${backupId}.manifest.json`)).toString('utf8'));validateBackupManifest(manifest,scope);if(manifest.backupId!==backupId)throw new Error('RESTORE_MANIFEST_MISMATCH');
 const compressed=await remote.get(backupId);if(compressed.length!==manifest.compressedBytes||sha(compressed)!==manifest.compressedSha256||latest&&(latest.backupId!==backupId||latest.compressedSha256!==manifest.compressedSha256||latest.fingerprint!==manifest.fingerprint))throw new Error('RESTORE_DOWNLOAD_HASH_MISMATCH');
 const plain=gunzipSync(compressed,{maxOutputLength:50_000_000});if(plain.length!==manifest.snapshotBytes)throw new Error('RESTORE_SNAPSHOT_SIZE_MISMATCH');
 const snapshot=JSON.parse(plain.toString('utf8')),sourceInfo=inspectSnapshot(snapshot);if(sourceInfo.fingerprint!==manifest.fingerprint||JSON.stringify(sourceInfo.counts)!==JSON.stringify(manifest.counts))throw new Error('RESTORE_SOURCE_PARITY_MISMATCH');
 const vaultId=`notes-restore-${runId}`;if(vaultId.length>60)throw new Error('RESTORE_VAULT_ID_INVALID');
 const auth=new GoogleAuth({scopes:['https://www.googleapis.com/auth/cloud-platform']}),db=new Firestore({projectId:scope.projectId,auth}),repo=new FirestoreNativeRepository(db,{vaultId,maxAttempts:3});let attempted=false;
 try{
  if((await repo.vault().get()).exists)throw new Error('RESTORE_VAULT_COLLISION');
  attempted=true;await repo.importLegacySnapshot(snapshot);
  const restored=await repo.exportLegacySnapshot({maxBytes:50_000_000}),comparison=compareSnapshots(snapshot,restored);
  if(!comparison.match)throw new Error('RESTORE_PARITY_MISMATCH');
  safe('restore_parity_pass',{backupId,vaultId,sourceCounts:sourceInfo.counts,restoreCounts:comparison.target.counts,fingerprint:sourceInfo.fingerprint});
 }finally{
  if(attempted){const rootBefore=await repo.vault().get();if(rootBefore.exists)await db.recursiveDelete(repo.vault());const rootAfter=await repo.vault().get();if(rootAfter.exists)throw new Error('RESTORE_TEST_CLEANUP_FAILED');safe('restore_vault_removed',{vaultId});}
  await db.terminate().catch(()=>{});
 }
 await remote.putControl('.restore-qualification-passed.json',Buffer.from(JSON.stringify({schemaVersion:1,result:'PASS',backupId,fingerprint:sourceInfo.fingerprint,counts:sourceInfo.counts,qualifiedAt:new Date().toISOString()})));
}
main().catch(error=>{const code=/^[A-Z0-9_-]{1,100}$/.test(error?.message??'')?error.message:'RESTORE_QUALIFICATION_FAILED';process.stderr.write(JSON.stringify({event:'restore_qualification_failed',code})+'\n');process.exitCode=1;});
