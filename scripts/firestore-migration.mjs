import {readFile,writeFile,stat,realpath} from 'node:fs/promises';
import path from 'node:path';
import {GoogleAuth} from 'google-auth-library';
import {Firestore} from '@google-cloud/firestore';
import {FirestoreNativeRepository} from '../lib/firestore-native-repository.mjs';
import {compareSnapshots,inspectSnapshot} from '../lib/firestore-migration.mjs';
import {NoteStore} from '../lib/store.mjs';
import {initRestore,restoreBatch} from '../lib/store-backup.mjs';
import {downloadSnapshot} from '../lib/production-store.mjs';

const projectOnly='notes-lab-56f0f',adcFile='/home/admin/.local/state/notes-gcloud-home/.config/gcloud/application_default_credentials.json';
const usage='firestore-migration.mjs verify --snapshot FILE | import --snapshot FILE --project notes-lab-56f0f --vault migration-ID [--apply] | export --project notes-lab-56f0f --vault ID --output FILE --apply | rollback --snapshot FILE --namespace Hunghvt-Notes-Rollback-UUID --apply';
const args=process.argv.slice(2),action=args[0];
const option=name=>{const i=args.indexOf('--'+name);return i<0?undefined:args[i+1];};
const has=name=>args.includes('--'+name);
function report(value){process.stdout.write(JSON.stringify(value)+'\n');}
function safeError(code='MIGRATION_FAILED'){console.error(JSON.stringify({result:'FAIL',code}));process.exitCode=1;}
async function loadSnapshot(file){const metadata=await stat(file);if((metadata.mode&0o077)!==0)throw Error('SNAPSHOT_PERMISSIONS_MUST_BE_0600');const data=await readFile(file,'utf8');if(data.length>50000000)throw Error('SNAPSHOT_TOO_LARGE');return JSON.parse(data);}
function cloud(projectId,vaultId){if(projectId!==projectOnly||process.env.GOOGLE_CLOUD_PROJECT!==projectId)throw Error('PROJECT_CONFIRMATION_MISMATCH');if(!/^(lab|migration)-[a-z0-9-]{3,50}$/.test(vaultId))throw Error('VAULT_ID_NOT_ISOLATED');return new FirestoreNativeRepository(new Firestore({projectId,auth:new GoogleAuth({keyFile:adcFile,scopes:['https://www.googleapis.com/auth/cloud-platform']})}),{vaultId});}
function outsideRepo(file){const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..'),target=path.resolve(file);if(target===root||target.startsWith(root+path.sep))throw Error('PRIVATE_FILE_MUST_BE_OUTSIDE_REPOSITORY');return target;}
async function writePrivate(file,text){const target=outsideRepo(file),parent=await realpath(path.dirname(target));if(parent===path.resolve(path.dirname(new URL(import.meta.url).pathname),'..')||parent.startsWith(path.resolve(path.dirname(new URL(import.meta.url).pathname),'..')+path.sep))throw Error('PRIVATE_FILE_MUST_BE_OUTSIDE_REPOSITORY');await writeFile(target,text,{flag:'wx',mode:0o600});}
try{
 if(!['verify','import','export','rollback'].includes(action))throw Error('USAGE');
 if(action==='verify'){
  const file=option('snapshot');if(!file)throw Error('USAGE');const info=inspectSnapshot(await loadSnapshot(file));report({result:'VALID',counts:info.counts,fingerprint:info.fingerprint});
 }else if(action==='import'){
  const file=option('snapshot'),project=option('project'),vaultId=option('vault');if(!file||!project||!vaultId)throw Error('USAGE');const snapshot=await loadSnapshot(file),before=inspectSnapshot(snapshot);
  if(!has('apply')){report({result:'DRY_RUN',projectId:project,vaultId,counts:before.counts,fingerprint:before.fingerprint});}
  else{const repo=cloud(project,vaultId);try{const imported=await repo.importLegacySnapshot(snapshot),after=await repo.exportLegacySnapshot(),comparison=compareSnapshots(snapshot,after);report({result:comparison.match?'PASS':'MISMATCH',projectId:project,vaultId,imported,comparison});if(!comparison.match)process.exitCode=2;}finally{await repo.db.terminate();}}
 }else if(action==='export'){
  const project=option('project'),vaultId=option('vault'),file=option('output');if(!project||!vaultId||!file||!has('apply'))throw Error('EXPORT_REQUIRES_APPLY_AND_OUTPUT');const repo=cloud(project,vaultId);
  try{const snapshot=await repo.exportLegacySnapshot(),info=inspectSnapshot(snapshot);await writePrivate(file,JSON.stringify(snapshot));report({result:'EXPORTED',projectId:project,vaultId,path:path.resolve(file),counts:info.counts,fingerprint:info.fingerprint,mode:'0600'});}finally{await repo.db.terminate();}
 }else{
  const file=option('snapshot'),namespace=option('namespace');if(!file||!namespace||!has('apply')||!/^Hunghvt-Notes-Rollback-[a-f0-9-]{36}$/.test(namespace))throw Error('ROLLBACK_REQUIRES_FRESH_NAMESPACE');
  const env=process.env;if(!env.NOTES_BASE_URL||!env.KOOFR_NOTES_USER||!env.KOOFR_NOTES_APP_PASSWORD)throw Error('DEDICATED_NOTES_WEBDAV_CONFIG_REQUIRED');
  const snapshot=await loadSnapshot(file),sourceText=JSON.stringify(snapshot),source={input:{namespace:'local-firestore-snapshot'},dav:()=>({call:async(_label,method)=>method==='GET'?{status:200,text:sourceText}:{status:405}})};
  const target=new NoteStore({origin:env.NOTES_BASE_URL,user:env.KOOFR_NOTES_USER,password:env.KOOFR_NOTES_APP_PASSWORD,namespace});
  try{const initialized=await initRestore(target,source,{preservePermissions:true,preserveIdempotency:true});let result=initialized;for(let i=0;result.restoring;i++)result=await restoreBatch(target,source,i);const restored=await downloadSnapshot(target),comparison=compareSnapshots(snapshot,restored,{allowEpochRebase:true});report({result:comparison.match?'ROLLBACK_READY':'ROLLBACK_MISMATCH',namespace,initialized,comparison,shareTokensRewrapped:false});if(!comparison.match)process.exitCode=2;}finally{target.agent.destroy();}
 }
}catch(error){safeError(/^[A-Z0-9_-]{1,80}$/.test(error.message)?error.message:'MIGRATION_FAILED');}
