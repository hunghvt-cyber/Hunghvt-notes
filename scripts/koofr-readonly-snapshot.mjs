import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {mkdir,open,realpath,stat} from 'node:fs/promises';
import {NoteStore,parseCatalog,parseNote,pool} from '../lib/store.mjs';
import {hash} from '../lib/storage.mjs';
import {encodeSnapshot,decodeSnapshot} from '../lib/store-backup.mjs';
import {inspectSnapshot} from '../lib/firestore-migration.mjs';
const fail=code=>{throw new Error(code);};
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function exportKoofrSnapshotReadOnly(store,{attempts=2}={}){
 if(!Number.isInteger(attempts)||attempts<1||attempts>3)fail('INVALID_ATTEMPT_LIMIT');
 for(let attempt=0;attempt<attempts;attempt++){
  const first=await store.dav().call('readonly-snapshot-catalog-before','GET');
  if(first.status!==200)fail('SOURCE_CATALOG_READ_FAILED');
  const catalog=parseCatalog(first.text);
  if(catalog.restoring)fail('SOURCE_RESTORE_IN_PROGRESS');
  if(Object.values(catalog.entries).some(entry=>entry.purge))fail('SOURCE_PURGE_IN_PROGRESS');
  const records={};
  await pool(Object.values(catalog.entries),async entry=>{
   const response=await store.dav(entry.head).call('readonly-snapshot-record','GET');
   if(response.status!==200||hash(response.text)!==entry.headHash)fail('SOURCE_RECORD_HASH_MISMATCH');
   const parsed=parseNote(response.text);
   if(parsed.value.id!==entry.id)fail('SOURCE_RECORD_ID_MISMATCH');
   records[entry.head]=response.text;
  },2);
  const second=await store.dav().call('readonly-snapshot-catalog-after','GET');
  if(second.status!==200)fail('SOURCE_CATALOG_RECHECK_FAILED');
  if(hash(first.text)!==hash(second.text))continue;
  const encoded=encodeSnapshot(catalog,records),info=inspectSnapshot(JSON.parse(encoded));
  decodeSnapshot(encoded);
  return {encoded,bytes:Buffer.byteLength(encoded),sha256:hash(encoded),counts:info.counts,fingerprint:info.fingerprint,sourceCatalogSha256:hash(first.text),catalogCanonicalSha256:hash(JSON.stringify(catalog)),requests:Object.keys(records).length+2,attempt:attempt+1};
 }
 fail('SOURCE_CHANGED_DURING_READ');
}
export async function writePrivateSnapshot(target,encoded){
 const absolute=path.resolve(target);
 if(absolute===root||absolute.startsWith(root+path.sep))fail('SNAPSHOT_MUST_BE_OUTSIDE_REPOSITORY');
 const parent=path.dirname(absolute);
 await mkdir(parent,{recursive:true,mode:0o700});
 const realParent=await realpath(parent),repo=await realpath(root);
 if(realParent===repo||realParent.startsWith(repo+path.sep))fail('SNAPSHOT_MUST_BE_OUTSIDE_REPOSITORY');
 if(( (await stat(realParent)).mode&0o077)!==0)fail('SNAPSHOT_DIRECTORY_MUST_BE_0700');
 const file=await open(absolute,'wx',0o600);
 try{await file.writeFile(encoded,'utf8');await file.sync();}finally{await file.close();}
 return absolute;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 let store;
 try{
  const output=process.argv[2];if(!output)fail('USAGE');
  const env=process.env;
  for(const name of ['NOTES_BASE_URL','KOOFR_NOTES_USER','KOOFR_NOTES_APP_PASSWORD','NOTES_DATA_NAMESPACE'])if(!env[name])fail('DEDICATED_NOTES_WEBDAV_CONFIG_REQUIRED');
  store=new NoteStore({origin:env.NOTES_BASE_URL,user:env.KOOFR_NOTES_USER,password:env.KOOFR_NOTES_APP_PASSWORD,namespace:env.NOTES_DATA_NAMESPACE});
  const result=await exportKoofrSnapshotReadOnly(store),file=await writePrivateSnapshot(output,result.encoded);
  process.stdout.write(JSON.stringify({result:'EXPORTED_READ_ONLY',file,bytes:result.bytes,sha256:result.sha256,sourceCatalogSha256:result.sourceCatalogSha256,catalogCanonicalSha256:result.catalogCanonicalSha256,counts:result.counts,requests:result.requests,attempt:result.attempt,mode:'0600',directoryMode:'0700'})+'\n');
 }catch(error){const code=/^[A-Z0-9_-]{1,80}$/.test(error?.message??'')?error.message:'SNAPSHOT_EXPORT_FAILED';process.stderr.write(JSON.stringify({result:'FAIL',code})+'\n');process.exitCode=1;}
 finally{store?.agent.destroy();}
}
