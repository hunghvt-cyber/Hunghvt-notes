import {randomUUID} from 'node:crypto';
import {GoogleAuth} from 'google-auth-library';
import {Firestore} from '@google-cloud/firestore';
import {FirestoreNativeRepository} from '../lib/firestore-native-repository.mjs';

const fixedProject='notes-lab-56f0f';
const cleanupOnly=process.argv[2]==='--cleanup';
const projectId=cleanupOnly?(process.argv[3]??''):(process.argv[2]??'');
const selectedProject=process.env.GOOGLE_CLOUD_PROJECT??process.env.GCLOUD_PROJECT??'';
const adcFile='/home/admin/.local/state/notes-gcloud-home/.config/gcloud/application_default_credentials.json';
if(projectId!==fixedProject||selectedProject!==projectId){console.error(JSON.stringify({result:'BLOCKED',code:'PROJECT_CONFIRMATION_MISMATCH',selectedProjectPresent:!!selectedProject}));process.exit(64);}
if(process.env.NOTES_OFFLINE_TESTS==='1'||process.env.FIRESTORE_EMULATOR_HOST){console.error(JSON.stringify({result:'BLOCKED',code:'CLOUD_TARGET_GUARD'}));process.exit(64);}
if(Number(process.versions.node.split('.')[0])!==24){console.error(JSON.stringify({result:'BLOCKED',code:'NODE_24_REQUIRED'}));process.exit(64);}
const runId=cleanupOnly?(process.argv[4]??''):randomUUID();
if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(runId)){console.error(JSON.stringify({result:'BLOCKED',code:'RUN_ID_INVALID'}));process.exit(64);}
const auth=new GoogleAuth({keyFile:adcFile,scopes:['https://www.googleapis.com/auth/cloud-platform']});
const db=new Firestore({projectId,auth});
const vaults=[`smoke-${runId.replaceAll('-','')}`,`restore-${runId.replaceAll('-','')}`];
const makeRepo=vaultId=>new FirestoreNativeRepository(db,{vaultId});
if(cleanupOnly){let clean=true;for(const vaultId of vaults){try{await db.recursiveDelete(db.collection('notesVaults').doc(vaultId));}catch{clean=false;}}await db.terminate();console.log(JSON.stringify({result:clean?'CLEANED':'CLEANUP_UNVERIFIED',projectId,runId,syntheticOnly:true}));process.exitCode=clean?0:1;}
const repo=makeRepo(vaults[0]),restore=makeRepo(vaults[1]),attempts={},times={};
for(const r of [repo,restore])r.onTransactionAttempt=operation=>{attempts[operation]=(attempts[operation]??0)+1;};
const noteId=runId,opId=runId,shareId=runId.replaceAll('-',''),folder='probe-'+runId.slice(0,8);
let step='initialize',failure;
const measure=async(name,fn)=>{const t=performance.now();try{return await fn();}finally{times[name]=Math.round((performance.now()-t)*10)/10;}};
try{
 await measure('initialize',()=>repo.initialize({folders:['Inbox']}));
 const value={title:'Synthetic Firestore probe',text:'synthetic-only',checklist:[],pinned:false,folder};
 step='owner-save';const saved=await measure(step,()=>repo.save(noteId,value,null,opId,{includeNote:true}));
 step='owner-open';const opened=await measure(step,()=>repo.read(noteId));if(opened.text!==value.text||opened.revision!==saved.revision)throw Object.assign(new Error(),{code:'OPEN_MISMATCH'});
 step='known-revision';const unchanged=await measure(step,()=>repo.read(noteId,{knownRevision:saved.revision}));if(!unchanged.notModified)throw Object.assign(new Error(),{code:'KNOWN_REVISION_MISMATCH'});
 step='cas-conflict';await measure(step,async()=>{try{await repo.save(noteId,{text:'must-not-commit'},null,randomUUID());}catch(e){if(e.status===409)return;throw e;}throw Object.assign(new Error(),{code:'CAS_CONFLICT_NOT_DETECTED'});});
 step='share-create';const link=await measure(step,()=>repo.createShare({scope:'note',target:noteId,permission:'view',id:shareId,tokenBox:'synthetic-token-box'}));
 step='shared-open';const shared=await measure(step,()=>repo.read(noteId,{capabilityToken:link.token}));if(shared.note.text!==value.text)throw Object.assign(new Error(),{code:'SHARE_READ_MISMATCH'});
 step='share-revoke';await measure(step,()=>repo.revokeShare(shareId));
 step='revocation-check';await measure(step,async()=>{try{await repo.read(noteId,{capabilityToken:link.token});}catch(e){if(e.status===403)return;throw e;}throw Object.assign(new Error(),{code:'REVOCATION_NOT_ENFORCED'});});
 step='folder-delete';await measure(step,async()=>{const result=await repo.deleteFolder(folder,false);if(!result.deleted)throw Object.assign(new Error(),{code:'FOLDER_DELETE_FAILED'});});
 step='folder-readback';const moved=await measure(step,()=>repo.read(noteId));if(moved.folder!=='')throw Object.assign(new Error(),{code:'FOLDER_MOVE_MISMATCH'});
 step='trash-restore';await measure(step,async()=>{await repo.remove(noteId,moved.revision);const trash=await repo.trash(noteId);const restored=await repo.restoreNote(noteId,trash.revision);const back=await repo.read(noteId);if(!restored.restored||back.text!==value.text)throw Object.assign(new Error(),{code:'TRASH_RESTORE_MISMATCH'});});
 step='snapshot-restore';await measure(step,async()=>{const snapshot=await repo.exportLegacySnapshot();await restore.importLegacySnapshot(snapshot);const copy=await restore.read(noteId);if(copy.text!==value.text||copy.revision!==(await repo.read(noteId)).revision)throw Object.assign(new Error(),{code:'SNAPSHOT_RESTORE_MISMATCH'});});
 step='purge';await measure(step,async()=>{const current=await repo.read(noteId);await repo.remove(noteId,current.revision);const trashed=await repo.trash(noteId);await repo.purgeNote(noteId,trashed.revision,randomUUID());const tombstone=await repo.note(noteId).get();if(tombstone.data()?.state!=='purged')throw Object.assign(new Error(),{code:'PURGE_TOMBSTONE_MISSING'});});
 const results={result:'PASS',projectId,database:'(default)',runId,syntheticOnly:true,checks:['vault-isolation','owner-save','owner-open','known-revision','revision-cas','share-open','live-revocation','folder-delete-resume-path','trash-restore','snapshot-count-hash-restore','purge-tombstone'],wallMs:times,transactionCallbackAttempts:attempts};
 await db.recursiveDelete(db.collection('notesVaults').doc(vaults[0]));await db.recursiveDelete(db.collection('notesVaults').doc(vaults[1]));await db.terminate();console.log(JSON.stringify(results));
}catch(error){failure={result:'FAIL',step,code:/^[A-Z][A-Z0-9_-]{1,80}$/.test(error?.code)?error.code:(/^[A-Z][A-Z0-9_-]{1,80}$/.test(error?.message)?error.message:(Number.isInteger(error?.status)?`HTTP_${error.status}`:'REQUEST_FAILED')),wallMs:times};
 let cleanupOk=true;for(const vaultId of vaults){try{await db.recursiveDelete(db.collection('notesVaults').doc(vaultId));}catch{cleanupOk=false;}}try{await db.terminate();}catch{cleanupOk=false;}if(!cleanupOk)failure.cleanup='SYNTHETIC_CLEANUP_UNVERIFIED';console.error(JSON.stringify({...failure,projectId,runId,syntheticOnly:true}));process.exitCode=1;
}
