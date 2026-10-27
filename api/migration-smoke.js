import {createCipheriv,generateKeyPairSync,publicEncrypt,constants,randomBytes,randomUUID} from 'node:crypto';
import {createAppHandler,createApplicationStore} from '../lib/app-config.mjs';
import {createInboxHandler,inboxAudience,inboxFolder,inboxId,textHash} from '../lib/inbox.mjs';

const reply=(status,body)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const uuid=()=>randomUUID();
function testEnvironment(source){
 const vault=source.NOTES_FIRESTORE_VAULT_ID??'';
 if(source.VERCEL_ENV!=='production'||source.NOTES_SYNTHETIC_FIRESTORE_SMOKE!=='firestore-v1'||!/^notes-cutover-smoke-[a-f0-9-]{36}$/.test(vault))return null;
 return {...source,NOTES_AUTH_MODE:'',NOTES_DATA_NAMESPACE:`Hunghvt-Notes-Data-${uuid()}`,NOTES_BASE_URL:`https://${source.VERCEL_URL}`,NOTES_PASSWORD:`synthetic-${uuid()}-only`,NOTES_SESSION_PASSWORD:`synthetic-session-${uuid()}-only`};
}
async function json(response){const value=await response.json();if(!response.ok)throw Error(`SMOKE_STEP_${response.status}_${String(value.code??'UNKNOWN').replace(/[^A-Z0-9_]/g,'').slice(0,48)}`);return {value,cookie:response.headers.get('set-cookie')};}
function makeInboxEnvelope(payload,publicKey){
 const key=randomBytes(32),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from(inboxAudience));
 const data=Buffer.concat([cipher.update(Buffer.from(JSON.stringify(payload))),cipher.final()]);
 const encrypted=publicEncrypt({key:publicKey,oaepHash:'sha256',padding:constants.RSA_PKCS1_OAEP_PADDING},key);
 return {v:1,key:encrypted.toString('base64url'),iv:iv.toString('base64url'),tag:cipher.getAuthTag().toString('base64url'),data:data.toString('base64url'),expiresAt:Date.now()+60000};
}
export default async function handler(request){
 if(request.method!=='POST')return reply(405,{code:'METHOD_NOT_ALLOWED'});
 const env=testEnvironment(process.env);if(!env||env.NOTES_WRITES_FROZEN==='true')return reply(404,{code:'NOT_FOUND'});
 let store,vaultCreated=false;
 try{
  const cfg=(await import('../lib/app-config.mjs')).appConfig(env);
  store=await createApplicationStore(cfg,request);
  await store.init();vaultCreated=true; // fails closed if this synthetic vault id already exists
  const app=createAppHandler({env:()=>env,makeStore:createApplicationStore,passwordProvider:null,observe:()=>{}});
  const origin=cfg.origin;
  const call=async(route,body,method='POST',cookie='')=>{
   const headers=new Headers({'Origin':origin,'Content-Type':'application/json','sec-fetch-site':'same-origin'});
   if(cookie)headers.set('Cookie',cookie.split(';',1)[0]);
   const response=await app(new Request(`${origin}/api/app?route=${route}`,{method,headers,...(body===undefined?{}:{body:JSON.stringify(body)})}));
   return json(response);
  };
  const login=await call('auth',{password:env.NOTES_PASSWORD});
  const cookie=login.cookie;if(!login.value.authenticated||!cookie)throw Error('SMOKE_LOGIN_FAILED');
  const listed=await call('notes',undefined,'GET',cookie);if(!Array.isArray(listed.value.notes))throw Error('SMOKE_LIST_FAILED');
  const noteId=uuid(),op=uuid();
  const newNote=await call('notes',{action:'save',clientOpId:op,revision:null,id:noteId,title:'Synthetic smoke',text:'temporary synthetic content',checklist:[],pinned:false},'POST',cookie);
  const opened=await call(`notes&id=${noteId}`,undefined,'GET',cookie);if(opened.value.id!==noteId)throw Error('SMOKE_OPEN_FAILED');
  const replay=await call('notes',{action:'save',clientOpId:op,revision:null,id:noteId,title:'Synthetic smoke',text:'temporary synthetic content',checklist:[],pinned:false},'POST',cookie);
  if(!replay.value.replay)throw Error('SMOKE_IDEMPOTENCY_FAILED');
  let cas=false;try{await call('notes',{action:'save',clientOpId:uuid(),revision:null,id:noteId,title:'stale',text:'stale'},'POST',cookie);}catch(e){cas=String(e.message).includes('_409_');}if(!cas)throw Error('SMOKE_CAS_FAILED');
  const folder='Smoke folder '+uuid();await call('folders',{action:'create',folder},'POST',cookie);
  const otherId=uuid();await call('notes',{action:'save',clientOpId:uuid(),revision:null,id:otherId,title:'Order item',text:'synthetic',folder},'POST',cookie);
  const withFolders=await call('notes&includeFolders=1',undefined,'GET',cookie);
  if(!withFolders.value.folders.includes(folder))throw Error('SMOKE_FOLDER_FAILED');
  const order=await call('notes',{action:'reorder',ids:[noteId,otherId],orderRevision:withFolders.value.orderRevision,clientOpId:uuid()},'POST',cookie);
  if(!order.value)throw Error('SMOKE_ORDER_FAILED');
  const share=await call('note-share',{action:'create',noteId,permission:'view'},'POST',cookie);
  if(typeof share.value.token!=='string')throw Error('SMOKE_SHARE_CREATE_FAILED');
  const sharedResponse=await app(new Request(`${origin}/api/app?route=shared-note&id=${noteId}`,{headers:{Authorization:`Bearer ${share.value.token}`}}));
  const shared=await json(sharedResponse);if(shared.value.id!==noteId)throw Error('SMOKE_SHARE_READ_FAILED');
  await call('note-share',{action:'revoke',noteId,id:share.value.id},'POST',cookie);
  const revoked=await app(new Request(`${origin}/api/app?route=shared-note&id=${noteId}`,{headers:{Authorization:`Bearer ${share.value.token}`}}));if(revoked.status!==403)throw Error('SMOKE_SHARE_REVOKE_FAILED');
  const beforeTrash=newNote.value.revision;await call('notes',{action:'delete',id:noteId,revision:beforeTrash},'POST',cookie);
  const trash=await call('trash&id='+noteId,undefined,'GET',cookie);if(trash.value.id!==noteId)throw Error('SMOKE_TRASH_FAILED');
  await call('trash',{action:'restore',id:noteId,revision:trash.value.revision},'POST',cookie);
  const restored=await call(`notes&id=${noteId}`,undefined,'GET',cookie);if(restored.value.id!==noteId)throw Error('SMOKE_RESTORE_FAILED');
  await call('folders',{action:'create',folder:inboxFolder},'POST',cookie);
  const keys=generateKeyPairSync('rsa',{modulusLength:2048});const privateKey=keys.privateKey.export({type:'pkcs8',format:'pem'}).toString();
  const inboxEnv={...env,NOTES_INBOX_ENABLED:'github-oidc-v1',NOTES_INBOX_PRIVATE_KEY:privateKey};
  const inbox=createInboxHandler({env:()=>inboxEnv,authorize:async token=>{if(token!=='synthetic-only')throw Error('DENIED');return {runId:'1',sha:'a'.repeat(40)};},makeStore:createApplicationStore});
  const payload={action:'save',slot:'office-v2',title:'Synthetic inbox',text:'temporary synthetic inbox content',revision:null,clientOpId:uuid()};
  const inboxResponse=await inbox(new Request(`${origin}/api/inbox`,{method:'POST',headers:{Authorization:'Bearer synthetic-only','Content-Type':'application/json',Origin:origin,'sec-fetch-site':'same-origin'},body:JSON.stringify(makeInboxEnvelope(payload,keys.publicKey))}));
  const inboxResult=await json(inboxResponse);if(inboxResult.value.textHash!==textHash(payload.text)||inboxResult.value.verified!==true)throw Error('SMOKE_INBOX_FAILED');
  await store.repo.db.recursiveDelete(store.repo.vault());vaultCreated=false;
  return reply(200,{ok:true,checks:{login:true,list:true,open:true,save:true,idempotency:true,casConflict:true,folder:true,order:true,share:true,shareRevoke:true,trash:true,restore:true,codeInbox:true},syntheticVault:env.NOTES_FIRESTORE_VAULT_ID,syntheticVaultRemoved:true});
 }catch(error){const code=/^(?:SMOKE|FIRESTORE|VAULT|NOTES)_[A-Z0-9_]+$/.test(error?.message??'')?error.message:'SMOKE_RUNTIME_FAILED';return reply(503,{ok:false,code});}
 finally{if(vaultCreated)await store.repo.db.recursiveDelete(store.repo.vault()).catch(()=>{});await store?.close?.().catch(()=>{});}
}
