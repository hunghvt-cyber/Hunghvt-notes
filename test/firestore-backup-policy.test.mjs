import test from 'node:test';
import assert from 'node:assert/strict';
import {assertRetentionSafety,backupManagedMarker,planBackupRetention,snapshotName,validateBackupManifest} from '../lib/firestore-backup-policy.mjs';

const scope={projectId:'notes-lab-56f0f',databaseId:'(default)',vaultId:'notes-production'};
const sha='a'.repeat(64);
function row(date,run=1){const stamp=`${date}T03-30-00Z`,name=snapshotName(stamp,String(run),'1'),manifest={schemaVersion:1,backupId:name,...scope,capturedAt:`${date}T20:30:00.000Z`,calendarDateVN:date,snapshotBytes:2000,compressedBytes:1500,compressedSha256:sha,fingerprint:sha,counts:{notes:2}};return {snapshotName:name,manifest};}

test('folder ownership marker is stable and scoped to Firestore backup only',()=>{assert.deepEqual(JSON.parse(backupManagedMarker),{kind:'hunghvt-notes-firestore-backup',schemaVersion:1,repository:'hunghvt-cyber/Hunghvt-notes',...scope});});
test('manifest validation rejects wrong project, vault, malformed hash, and invalid backup names',()=>{const good=row('2026-10-27').manifest;assert.equal(validateBackupManifest(good,scope),true);assert.throws(()=>validateBackupManifest({...good,projectId:'other'},scope),/SCOPE/);assert.throws(()=>validateBackupManifest({...good,compressedSha256:'bad'},scope),/INVALID/);assert.throws(()=>validateBackupManifest({...good,backupId:'notes-old.gz'},scope),/INVALID/);});
test('retention keeps the latest 14 dates, 8 ISO weeks and 6 VN months',()=>{
 const rows=[];for(let offset=0;offset<240;offset++){const d=new Date(Date.UTC(2026,9,27-offset));rows.push(row(d.toISOString().slice(0,10),String(offset+1)));}
 const plan=planBackupRetention(rows,{scope}),byName=new Map(rows.map(x=>[x.snapshotName,x.manifest]));assert.equal(plan.verified,240);assert.equal(plan.delete.length,240-plan.keep.length);assert.equal(plan.protectedBaselineExcluded,true);
 assert.ok(new Set(plan.keep.map(x=>byName.get(x).calendarDateVN)).size>=14);
 assert.ok(new Set(plan.keep.map(x=>{const d=new Date(`${byName.get(x).calendarDateVN}T00:00:00Z`);d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10);})).size>=8);
 assert.ok(new Set(plan.keep.map(x=>byName.get(x).calendarDateVN.slice(0,7))).size>=6);
});
test('retention rejects absent or invalid candidates rather than deleting them',()=>{assert.throws(()=>planBackupRetention([], {scope}),/NO_VERIFIED/);const bad=row('2026-10-27');bad.manifest.vaultId='koofr-old';assert.throws(()=>planBackupRetention([bad],{scope}),/NO_VERIFIED/);});
test('suspicious empty or sharply smaller backup blocks retention',()=>{assert.throws(()=>assertRetentionSafety({newCounts:{notes:0},compressedBytes:1500,previousCounts:{notes:4}}),/EMPTY/);assert.throws(()=>assertRetentionSafety({newCounts:{notes:4},compressedBytes:1200,previousCompressedBytes:15000}),/SIZE/);assert.equal(assertRetentionSafety({newCounts:{notes:0},compressedBytes:1500}),true);});
test('snapshot object naming rejects untrusted identifiers',()=>{assert.equal(snapshotName('2026-10-27T20:30:00.000Z','123','2'),'firestore-notes-2026-10-27T20-30-00Z-123-2.json.gz');assert.throws(()=>snapshotName('bad','../../','1'),/INVALID/);});
