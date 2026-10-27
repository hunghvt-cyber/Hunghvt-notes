import {randomUUID} from 'node:crypto';
import {FirestoreNativeRepository} from '../lib/firestore-native-repository.mjs';

const cleanupOnly=process.argv[2]==='--cleanup';
const projectId=cleanupOnly?(process.argv[3]??''):(process.argv[2]??'');
const selectedProject=process.env.GOOGLE_CLOUD_PROJECT??process.env.GCLOUD_PROJECT??'';
if(!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)||selectedProject!==projectId){
 console.error(JSON.stringify({result:'BLOCKED',code:'PROJECT_CONFIRMATION_MISMATCH',selectedProjectPresent:!!selectedProject}));
 process.exit(64);
}
if(process.env.NOTES_OFFLINE_TESTS==='1'||process.env.FIRESTORE_EMULATOR_HOST){
 console.error(JSON.stringify({result:'BLOCKED',code:'CLOUD_TARGET_GUARD'}));process.exit(64);
}
if(Number(process.versions.node.split('.')[0])!==24){console.error(JSON.stringify({result:'BLOCKED',code:'NODE_24_REQUIRED'}));process.exit(64);}

const {Firestore}=await import('@google-cloud/firestore');
const db=new Firestore({projectId});
const attempts={};
const repo=new FirestoreNativeRepository(db,{onTransactionAttempt:operation=>{attempts[operation]=(attempts[operation]??0)+1;}});
const runId=cleanupOnly?(process.argv[4]??''):randomUUID();
if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(runId)){
 console.error(JSON.stringify({result:'BLOCKED',code:'RUN_ID_INVALID'}));await db.terminate();process.exit(64);
}
const noteId=runId,opId=runId,shareId=runId.replaceAll('-','');
if(cleanupOnly){
 let clean=true;try{await db.recursiveDelete(db.collection('notes').doc(noteId));}catch{clean=false;}
 try{await db.collection('shares').doc(shareId).delete();}catch{clean=false;}
 try{await repo.accessGuard('note',noteId).delete();}catch{clean=false;}
 await db.terminate();
 console.log(JSON.stringify({result:clean?'CLEANED':'CLEANUP_UNVERIFIED',projectId,runId,syntheticOnly:true}));
 process.exitCode=clean?0:1;
} 
let step='initialize',failure=null,success=null;
const times={};
const measure=async(name,fn)=>{const start=performance.now();try{return await fn();}finally{times[name]=Math.round((performance.now()-start)*10)/10;}};
const sample={title:'Synthetic Firestore smoke '+runId.slice(0,8),text:'synthetic-only',checklist:[],pinned:false,folder:'cloud-smoke-'+runId};
console.log(JSON.stringify({event:'START',projectId,runId,syntheticOnly:true}));
try{
 step='owner-save';const saved=await measure(step,()=>repo.save(noteId,sample,null,opId));
 step='owner-open';const opened=await measure(step,()=>repo.read(noteId));
 if(opened.text!==sample.text||opened.revision!==saved.revision)throw Object.assign(new Error(),{code:'OPEN_MISMATCH'});
 step='cas-conflict';await measure(step,async()=>{
  try{await repo.save(noteId,{...sample,text:'should-not-commit'},null,randomUUID());}
  catch(error){if(error.status===409)return;throw error;}
  throw Object.assign(new Error(),{code:'CAS_CONFLICT_NOT_DETECTED'});
 });
 step='share-create';const link=await measure(step,()=>repo.createShare({scope:'note',target:noteId,permission:'view',id:shareId}));
 step='shared-open';const shared=await measure(step,()=>repo.read(noteId,{capabilityToken:link.token}));
 if(shared.note.text!==sample.text||shared.permission!=='view')throw Object.assign(new Error(),{code:'SHARE_READ_MISMATCH'});
 step='share-revoke';await measure(step,()=>repo.revokeShare(shareId));
 step='revocation-check';await measure(step,async()=>{
  try{await repo.read(noteId,{capabilityToken:link.token});}
  catch(error){if(error.status===403)return;throw error;}
  throw Object.assign(new Error(),{code:'REVOCATION_NOT_ENFORCED'});
 });
 success={result:'PASS',projectId,database:'(default)',runId,checks:['owner-save','owner-open','revision-conflict','shared-open','share-revocation'],wallMs:times,transactionCallbackAttempts:attempts,estimatedLogicalOps:{ownerCreate:{reads:2,writes:3},ownerOpenOneVersion:{reads:2,writes:0},failedCas:{reads:2,writes:0},shareCreate:{reads:2,writes:2},sharedOpenOneVersion:{reads:3,writes:0},revoke:{reads:2,writes:2},revokedOpen:{reads:2,writes:0}}};
}catch(error){failure={result:'FAIL',step,code:/^[A-Z0-9_-]{1,80}$/.test(error?.code)?error.code:(Number.isInteger(error?.status)?`HTTP_${error.status}`:(/^[A-Z][A-Z0-9_]{1,80}$/.test(error?.message)?error.message:'REQUEST_FAILED')),wallMs:times};}
finally{
 let cleanupOk=true;
 try{await db.recursiveDelete(db.collection('notes').doc(noteId));}catch{cleanupOk=false;}
 try{await db.collection('shares').doc(shareId).delete();}catch{cleanupOk=false;}
 try{await repo.accessGuard('note',noteId).delete();}catch{cleanupOk=false;}
 await db.terminate();
  if(!cleanupOk){if(!failure)failure={result:'FAIL',step:'cleanup',code:'SYNTHETIC_CLEANUP_UNVERIFIED',wallMs:times};else failure.cleanup='SYNTHETIC_CLEANUP_UNVERIFIED';}
}
if(failure){console.error(JSON.stringify({...failure,projectId,syntheticOnly:true}));process.exitCode=1;}
else console.log(JSON.stringify(success));
