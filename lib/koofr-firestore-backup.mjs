import {timingSafeEqual} from 'node:crypto';
import {backupManagedMarker,planBackupRetention,validateBackupManifest} from './firestore-backup-policy.mjs';

const ROOT='https://app.koofr.net/dav/Koofr/Notes-Firestore-Backups/';
const PREFIX=ROOT+'.notes-firestore-backup-managed-v1';
const CONTROL=new Set(['.latest-verified-backup.json','.restore-qualification-passed.json']);
const allowedName=/^firestore-notes-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z-\d+-\d+\.json\.gz(?:\.manifest\.json)?$/;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export class KoofrFirestoreBackup{
 constructor(credential,{fetchImpl=globalThis.fetch,timeoutMs=30000}={}){
  const split=credential.indexOf(':');if(split<1||split===credential.length-1)throw new Error('BACKUP_KOOFR_CREDENTIAL_INVALID');
  this.auth='Basic '+Buffer.from(credential).toString('base64');this.fetch=fetchImpl;this.timeoutMs=timeoutMs;
 }
 async call(method,url,headers={},body){
  let last;
  for(let attempt=0;attempt<3;attempt++){
   try{
    const response=await this.fetch(url,{method,headers:{authorization:this.auth,...headers},body,signal:AbortSignal.timeout(this.timeoutMs),redirect:'error'});
    if((response.status===429||response.status>=500)&&attempt<2){const ra=Number(response.headers.get('retry-after'));await response.arrayBuffer().catch(()=>{});await wait(Number.isFinite(ra)&&ra>0?Math.min(ra*1000,3000):250*(2**attempt));continue;}
    return response;
   }catch{last=new Error('BACKUP_WEBDAV_NETWORK_ERROR');if(attempt<2)await wait(250*(2**attempt));}
  }
  throw last??new Error('BACKUP_WEBDAV_RETRY_EXHAUSTED');
 }
 async ensureRoot(){
  const mk=await this.call('MKCOL',ROOT);
  if(mk.status===201){const put=await this.call('PUT',PREFIX,{'content-type':'application/json','if-none-match':'*'},backupManagedMarker);if(![200,201,204].includes(put.status))throw new Error('BACKUP_MARKER_CREATE_FAILED');}
  else if([405,301,302].includes(mk.status)){
   const marker=await this.call('GET',PREFIX);if(marker.status!==200)throw new Error('BACKUP_ROOT_NOT_OWNED');
   const bytes=Buffer.from(await marker.arrayBuffer()),expected=Buffer.from(backupManagedMarker);
   if(bytes.length!==expected.length||!timingSafeEqual(bytes,expected))throw new Error('BACKUP_ROOT_MARKER_MISMATCH');
  }else throw new Error(`BACKUP_ROOT_CREATE_HTTP_${mk.status}`);
 }
 async put(name,bytes,contentType){if(!allowedName.test(name))throw new Error('BACKUP_OBJECT_NAME_INVALID');const r=await this.call('PUT',ROOT+name,{'content-type':contentType,'if-none-match':'*'},bytes);if(![200,201,204].includes(r.status))throw new Error(`BACKUP_UPLOAD_HTTP_${r.status}`);}
 async get(name){if(!allowedName.test(name))throw new Error('BACKUP_OBJECT_NAME_INVALID');const r=await this.call('GET',ROOT+name);if(r.status!==200)throw new Error(`BACKUP_DOWNLOAD_HTTP_${r.status}`);return Buffer.from(await r.arrayBuffer());}
 async getControl(name){if(!CONTROL.has(name))throw new Error('BACKUP_CONTROL_NAME_INVALID');const r=await this.call('GET',ROOT+name);if(r.status===404)return null;if(r.status!==200)throw new Error(`BACKUP_CONTROL_HTTP_${r.status}`);return Buffer.from(await r.arrayBuffer());}
 async putControl(name,bytes){if(!CONTROL.has(name))throw new Error('BACKUP_CONTROL_NAME_INVALID');const r=await this.call('PUT',ROOT+name,{'content-type':'application/json'},bytes);if(![200,201,204].includes(r.status))throw new Error(`BACKUP_CONTROL_WRITE_HTTP_${r.status}`);}
 async list(){const r=await this.call('PROPFIND',ROOT,{depth:'1','content-type':'application/xml; charset=utf-8'},'<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/><d:getcontentlength/></d:prop></d:propfind>');if(r.status!==207)throw new Error(`BACKUP_LIST_HTTP_${r.status}`);const xml=await r.text(),names=new Set();for(const m of xml.matchAll(/<(?:[\w.-]+:)?href[^>]*>([^<]+)<\/(?:[\w.-]+:)?href>/gi)){let name;try{name=decodeURIComponent(new URL(m[1],ROOT).pathname.split('/').filter(Boolean).at(-1)??'');}catch{continue;}if(allowedName.test(name))names.add(name);}return [...names].sort();}
 async verifiedCandidates(scope){
  const names=await this.list(),manifests=names.filter(n=>n.endsWith('.manifest.json')),out=[];
  for(const manifestName of manifests){const snapshotName=manifestName.slice(0,-'.manifest.json'.length);if(!names.includes(snapshotName))continue;try{
   const manifest=JSON.parse((await this.get(manifestName)).toString('utf8'));validateBackupManifest(manifest,scope);if(manifest.backupId!==snapshotName)continue;
   const gzip=await this.get(snapshotName);if(gzip.length!==manifest.compressedBytes)continue;out.push({snapshotName,manifest,gzip});
  }catch{/* malformed/unreadable pairs are never eligible for deletion */}}
  return out;
 }
 async prune({scope,newBackupId,newCounts,compressedBytes,decodeAndInspect}){
  const existing=(await this.verifiedCandidates(scope)).sort((a,b)=>Date.parse(b.manifest.capturedAt)-Date.parse(a.manifest.capturedAt)),latest=existing.find(x=>x.snapshotName!==newBackupId);
  if(latest) {
   if(newCounts?.notes===0&&latest.manifest.counts.notes>0)throw new Error('RETENTION_SUSPICIOUS_EMPTY_BACKUP');
   if(compressedBytes<latest.manifest.compressedBytes*0.1)throw new Error('RETENTION_SUSPICIOUS_SIZE_DROP');
  }
  for(const row of existing)await decodeAndInspect(row.gzip,row.manifest);
  const plan=planBackupRetention(existing.map(({gzip,...row})=>row),{scope});
  for(const name of plan.delete){for(const object of [name,`${name}.manifest.json`]){const r=await this.call('DELETE',ROOT+object);if(![200,202,204,404].includes(r.status))throw new Error(`BACKUP_RETENTION_DELETE_HTTP_${r.status}`);}}
  return {retained:plan.keep.length,deleted:plan.delete.length,verified:plan.verified};
 }
}
export const koofrBackupRoot=ROOT;
