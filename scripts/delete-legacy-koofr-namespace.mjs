import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
import {KoofrFirestoreBackup} from '../lib/koofr-firestore-backup.mjs';
import {validateBackupManifest} from '../lib/firestore-backup-policy.mjs';
import {inspectSnapshot} from '../lib/firestore-migration.mjs';

export const legacyNamespace='Hunghvt-Notes-Data-78cd53a3-e871-40e5-bf04-5e70ac20901e';
const scope={projectId:'notes-lab-56f0f',databaseId:'(default)',vaultId:'notes-production'};
const webdavRoot='https://app.koofr.net/dav/Koofr/';
const lockXml='<?xml version="1.0"?><D:lockinfo xmlns:D="DAV:"><D:lockscope><D:exclusive/></D:lockscope><D:locktype><D:write/></D:locktype><D:owner>Approved exact Notes legacy namespace cleanup</D:owner></D:lockinfo>';
const sha=value=>createHash('sha256').update(value).digest('hex');
const xmlEscape=value=>value.replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&quot;','"').replaceAll('&apos;',"'");

export async function verifyLatestRestore(credential,remoteFactory=value=>new KoofrFirestoreBackup(value)){
 const remote=remoteFactory(credential);
 const latestBytes=await remote.getControl('.latest-verified-backup.json');
 const restoreBytes=await remote.getControl('.restore-qualification-passed.json');
 if(!latestBytes||!restoreBytes)throw Error('BACKUP_OR_RESTORE_MARKER_MISSING');
 const latest=JSON.parse(latestBytes.toString('utf8')),restore=JSON.parse(restoreBytes.toString('utf8'));
 if(latest.schemaVersion!==1||restore.schemaVersion!==1||restore.result!=='PASS'||restore.backupId!==latest.backupId||restore.fingerprint!==latest.fingerprint)throw Error('BACKUP_RESTORE_QUALIFICATION_MISMATCH');
 const manifest=JSON.parse((await remote.get(`${latest.backupId}.manifest.json`)).toString('utf8'));
 validateBackupManifest(manifest,scope);
 if(manifest.backupId!==latest.backupId||manifest.fingerprint!==latest.fingerprint||manifest.compressedSha256!==latest.compressedSha256||restore.fingerprint!==manifest.fingerprint)throw Error('BACKUP_RESTORE_MANIFEST_MISMATCH');
 const compressed=await remote.get(latest.backupId);
 if(compressed.length!==manifest.compressedBytes||sha(compressed)!==manifest.compressedSha256)throw Error('BACKUP_READBACK_HASH_MISMATCH');
 const plain=gunzipSync(compressed,{maxOutputLength:50_000_000});
 if(plain.length!==manifest.snapshotBytes)throw Error('BACKUP_READBACK_SIZE_MISMATCH');
 const info=inspectSnapshot(JSON.parse(plain.toString('utf8')));
 if(info.fingerprint!==manifest.fingerprint||JSON.stringify(info.counts)!==JSON.stringify(manifest.counts)||JSON.stringify(restore.counts)!==JSON.stringify(manifest.counts))throw Error('BACKUP_RESTORE_PARITY_MISMATCH');
 return {backupId:manifest.backupId,fingerprint:manifest.fingerprint,counts:manifest.counts};
}

function hrefPath(href){
 const url=new URL(xmlEscape(href),webdavRoot);
 if(url.origin!==new URL(webdavRoot).origin||!url.pathname.startsWith(new URL(webdavRoot).pathname))throw Error('LEGACY_NAMESPACE_FOREIGN_HREF');
 let parts;try{parts=url.pathname.slice(new URL(webdavRoot).pathname.length).split('/').filter(Boolean).map(decodeURIComponent);}catch{throw Error('LEGACY_NAMESPACE_INVALID_HREF');}
 if(parts.some(part=>!part||part==='.'||part==='..'||part.includes('/')||part.includes('\\')))throw Error('LEGACY_NAMESPACE_INVALID_HREF');
 return {url,parts};
}

export function parseListing(xml,baseParts){
 if(typeof xml!=='string'||xml.length>5_000_000||/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('LEGACY_NAMESPACE_LISTING_INVALID');
 const nodes=[];
 for(const match of xml.matchAll(/<(?:[\w.-]+:)?response\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?response>/gi)){
  const href=match[1].match(/<(?:[\w.-]+:)?href\b[^>]*>([^<]+)<\/(?:[\w.-]+:)?href>/i)?.[1];
  if(!href)throw Error('LEGACY_NAMESPACE_LISTING_INVALID');
  const parsed=hrefPath(href),parts=parsed.parts;
  if(parts.length<baseParts.length||baseParts.some((part,index)=>parts[index]!==part))throw Error('LEGACY_NAMESPACE_PATH_ESCAPE');
  if(parts.length===baseParts.length)continue;
  nodes.push({url:parsed.url.href,parts,isCollection:/<(?:[\w.-]+:)?collection\b/i.test(match[1])});
 }
 return nodes;
}

export async function deleteExactNamespace({user,password,confirm,backupCredential,fetchImpl=globalThis.fetch,remoteFactory,log=()=>{}}={}){
 if(confirm!=='DELETE_KOOFR_NOTES_NAMESPACE_20261028')throw Error('LEGACY_DELETE_CONFIRMATION_REQUIRED');
 if(typeof user!=='string'||!user||typeof password!=='string'||!password||/[\r\n]/.test(user+password))throw Error('LEGACY_WEBDAV_CREDENTIALS_MISSING');
 if(typeof backupCredential!=='string'||!backupCredential)throw Error('BACKUP_CREDENTIAL_MISSING');
 const backup=await verifyLatestRestore(backupCredential,remoteFactory);
 const rootParts=[legacyNamespace],rootUrl=new URL(encodeURIComponent(legacyNamespace)+'/',webdavRoot).href;
 const auth='Basic '+Buffer.from(`${user}:${password}`).toString('base64');
 const call=async(method,url,headers={},body)=>fetchImpl(url,{method,headers:{authorization:auth,...headers},...(body===undefined?{}:{body}),redirect:'error',signal:AbortSignal.timeout(30000)});
 const xml='<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/></d:prop></d:propfind>';
 const first=await call('PROPFIND',rootUrl,{depth:'1','content-type':'application/xml; charset=utf-8'},xml);
 if(first.status===404){log({event:'legacy_namespace_already_absent',namespace:legacyNamespace,backupId:backup.backupId});return {alreadyAbsent:true,backup};}
 if(first.status!==207)throw Error('LEGACY_NAMESPACE_PREFLIGHT_FAILED');
 await first.arrayBuffer();
 const lock=await call('LOCK',rootUrl,{depth:'infinity',timeout:'Second-120','content-type':'application/xml'},lockXml);
 const lockToken=lock.headers.get('lock-token');
 if(![200,201].includes(lock.status)||typeof lockToken!=='string'||!/^<[^<>\r\n]{1,300}>$/.test(lockToken))throw Error('LEGACY_NAMESPACE_LOCK_FAILED');
 let deletedFiles=0,deletedFolders=0,visited=0;
 const removeTree=async(folderUrl,base)=>{
  const listing=await call('PROPFIND',folderUrl,{depth:'1','content-type':'application/xml; charset=utf-8'},xml);
  if(listing.status!==207)throw Error('LEGACY_NAMESPACE_RELIST_FAILED');
  for(const item of parseListing(await listing.text(),base)){
   if(++visited>100000)throw Error('LEGACY_NAMESPACE_ENTRY_LIMIT');
   if(item.isCollection){await removeTree(item.url,item.parts);}
   const response=await call('DELETE',item.url,{if:`(${lockToken})`});
   if(![200,204,404].includes(response.status))throw Error('LEGACY_NAMESPACE_DELETE_FAILED');
   if(item.isCollection)deletedFolders++;else deletedFiles++;
  }
 };
 try{
  const rootMarkerUrl=new URL(encodeURIComponent(legacyNamespace)+'/restore-control.json',webdavRoot).href;
  const markerResponse=await call('GET',rootMarkerUrl);
  if(markerResponse.status!==200)throw Error('LEGACY_NAMESPACE_MARKER_MISSING');
  const expectedMarker=JSON.stringify({format:'hunghvt-notes-empty-v1',namespaceHash:sha(legacyNamespace)});
  if(await markerResponse.text()!==expectedMarker)throw Error('LEGACY_NAMESPACE_MARKER_MISMATCH');
  const lockedListing=await call('PROPFIND',rootUrl,{depth:'1','content-type':'application/xml; charset=utf-8'},xml);
  if(lockedListing.status!==207)throw Error('LEGACY_NAMESPACE_RELIST_FAILED');
  parseListing(await lockedListing.text(),rootParts);
  await removeTree(rootUrl,rootParts);
  const deleted=await call('DELETE',rootUrl,{if:`(${lockToken})`});
  if(![200,204,404].includes(deleted.status))throw Error('LEGACY_NAMESPACE_ROOT_DELETE_FAILED');
  const verify=await call('PROPFIND',rootUrl,{depth:'0','content-type':'application/xml; charset=utf-8'},xml);
  if(verify.status!==404)throw Error('LEGACY_NAMESPACE_DELETE_UNVERIFIED');
  log({event:'legacy_namespace_deleted',namespace:legacyNamespace,deletedFiles,deletedFolders,backupId:backup.backupId,fingerprint:backup.fingerprint});
  return {alreadyAbsent:false,deletedFiles,deletedFolders,backup};
 }finally{
  await call('UNLOCK',rootUrl,{'lock-token':lockToken}).catch(()=>{});
 }
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const result=await deleteExactNamespace({user:process.env.KOOFR_WEBDAV_USER,password:process.env.KOOFR_WEBDAV_APP_PASSWORD,backupCredential:process.env.NOTES_BACKUP_KOOFR_CREDENTIAL,confirm:process.env.NOTES_LEGACY_DELETE_CONFIRM,log:value=>process.stdout.write(JSON.stringify(value)+'\n')});
  if(result.alreadyAbsent)process.stdout.write(JSON.stringify({event:'legacy_namespace_cleanup_complete',alreadyAbsent:true})+'\n');
 }catch(error){
  const code=/^[A-Z0-9_]{1,100}$/.test(error?.message??'')?error.message:'LEGACY_NAMESPACE_CLEANUP_FAILED';
  process.stderr.write(JSON.stringify({event:'legacy_namespace_cleanup_failed',code})+'\n');process.exitCode=1;
 }
}
