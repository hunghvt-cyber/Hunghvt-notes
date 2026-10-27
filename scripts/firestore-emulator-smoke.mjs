// Destructive only to this ephemeral demo-project emulator. Never accepts a
// real project ID or a non-loopback emulator endpoint.
import {randomUUID} from 'node:crypto';
import {createFirestoreNoteStore} from '../lib/firestore-storage.mjs';

const projectId=process.env.GCLOUD_PROJECT??process.env.GOOGLE_CLOUD_PROJECT??'';
const endpoint=process.env.FIRESTORE_EMULATOR_HOST??'';
const validProject=/^demo-[a-z0-9-]{1,50}$/.test(projectId);
const validEndpoint=/^(127\.0\.0\.1|localhost|\[::1\]):8089$/.test(endpoint);
if(!validProject||!validEndpoint)throw Error('FIRESTORE_EMULATOR_GUARD');
const {Firestore}=await import('@google-cloud/firestore');
const db=new Firestore({projectId});
const namespace='Homepage-Notes-Vercel-Probe-123-'+randomUUID();
const store=createFirestoreNoteStore({user:'emulator',password:'not-a-secret',namespace},{db});
try{
 await store.init();
 const id=randomUUID(),op=randomUUID(),first=await store.save(id,{title:'Emulator fixture',text:'Firestore emulator — synthetic',checklist:[]},null,op);
 const retry=await store.save(id,{title:'Emulator fixture',text:'Firestore emulator — synthetic',checklist:[]},null,op);
 if(!retry.replay||retry.revision!==first.revision)throw Error('EMULATOR_IDEMPOTENCY_FAILED');
 const read=await store.get(id);if(read.text!=='Firestore emulator — synthetic'||read.revision!==first.revision)throw Error('EMULATOR_READ_FAILED');
 const link=await store.share('note',id,'view'),shared=await store.readShared('note',null,{token:link.token});
 if(shared.note.text!==read.text)throw Error('EMULATOR_SHARE_FAILED');
 await store.revoke(link.id);let revoked=false;try{await store.readShared('note',null,{token:link.token});}catch(e){revoked=e.status===403;}
 if(!revoked)throw Error('EMULATOR_REVOCATION_FAILED');
 process.stdout.write(JSON.stringify({result:'PASS',projectId,checks:['init','save','idempotency','hash-verified-read','share','live-revocation']})+'\n');
}finally{store.agent.destroy();await db.terminate();}
