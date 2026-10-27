const SNAPSHOT_NAME=/^firestore-notes-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z)-([0-9]+)-([0-9]+)\.json\.gz$/;
const sha=/^[a-f0-9]{64}$/;
export const backupManagedMarker=JSON.stringify({kind:'hunghvt-notes-firestore-backup',schemaVersion:1,repository:'hunghvt-cyber/Hunghvt-notes',projectId:'notes-lab-56f0f',databaseId:'(default)',vaultId:'notes-production'});

export function validateBackupManifest(manifest,{projectId='notes-lab-56f0f',databaseId='(default)',vaultId='notes-production'}={}){
 if(!manifest||manifest.schemaVersion!==1||manifest.projectId!==projectId||manifest.databaseId!==databaseId||manifest.vaultId!==vaultId)throw new Error('BACKUP_MANIFEST_SCOPE_INVALID');
 if(typeof manifest.backupId!=='string'||!SNAPSHOT_NAME.test(manifest.backupId)||!sha.test(manifest.compressedSha256??'')||!sha.test(manifest.fingerprint??''))throw new Error('BACKUP_MANIFEST_INVALID');
 if(!Number.isInteger(manifest.compressedBytes)||manifest.compressedBytes<1||!Number.isInteger(manifest.snapshotBytes)||manifest.snapshotBytes<1||!manifest.counts||!Number.isInteger(manifest.counts.notes)||manifest.counts.notes<0)throw new Error('BACKUP_MANIFEST_INVALID');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(manifest.calendarDateVN??'')||Number.isNaN(Date.parse(manifest.capturedAt??'')))throw new Error('BACKUP_MANIFEST_INVALID');
 return true;
}
function weekKey(date){const d=new Date(`${date}T00:00:00Z`),day=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-day);return d.toISOString().slice(0,10);}
function validCandidate(row,scope){
 try{validateBackupManifest(row.manifest,scope);return row.manifest.backupId===row.snapshotName&&row.manifest.calendarDateVN===row.manifest.backupId.slice(16,26);}catch{return false;}
}
export function planBackupRetention(candidates,{daily=14,weekly=8,monthly=6,scope}={}){
 if(!Array.isArray(candidates)||!Number.isInteger(daily)||daily<1||!Number.isInteger(weekly)||weekly<1||!Number.isInteger(monthly)||monthly<1)throw new Error('RETENTION_INPUT_INVALID');
 const valid=candidates.filter(x=>validCandidate(x,scope)).sort((a,b)=>Date.parse(b.manifest.capturedAt)-Date.parse(a.manifest.capturedAt));
 if(!valid.length)throw new Error('RETENTION_NO_VERIFIED_BACKUPS');
 const keep=new Set();
 for(const [field,limit,keyOf] of [['day',daily,x=>x.manifest.calendarDateVN],['week',weekly,x=>weekKey(x.manifest.calendarDateVN)],['month',monthly,x=>x.manifest.calendarDateVN.slice(0,7)]]){
  const selected=new Set();
  for(const item of valid){const key=keyOf(item);if(!selected.has(key)&&selected.size<limit){selected.add(key);keep.add(item.snapshotName);}}
 }
 return {keep:[...keep].sort(),delete:valid.filter(x=>!keep.has(x.snapshotName)).map(x=>x.snapshotName).sort(),verified:valid.length,protectedBaselineExcluded:true};
}
export function assertRetentionSafety({newCounts,previousCounts,compressedBytes,previousCompressedBytes}){
 if(!newCounts||!Number.isInteger(newCounts.notes)||newCounts.notes<0||!Number.isInteger(compressedBytes)||compressedBytes<1024)throw new Error('RETENTION_NEW_BACKUP_SAFETY_GATE');
 if(previousCounts&&Number.isInteger(previousCounts.notes)&&previousCounts.notes>0&&newCounts.notes===0)throw new Error('RETENTION_SUSPICIOUS_EMPTY_BACKUP');
 if(Number.isInteger(previousCompressedBytes)&&previousCompressedBytes>=1024&&compressedBytes<previousCompressedBytes*0.1)throw new Error('RETENTION_SUSPICIOUS_SIZE_DROP');
 return true;
}

export function snapshotName(capturedAt,runId,attempt){
 const stamp=capturedAt.replace(/:/g,'-').replace(/\.\d{3}Z$/,'Z');
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z$/.test(stamp)||!/^\d+$/.test(String(runId))||!/^\d+$/.test(String(attempt)))throw new Error('BACKUP_ID_INVALID');
 return `firestore-notes-${stamp}-${runId}-${attempt}.json.gz`;
}
