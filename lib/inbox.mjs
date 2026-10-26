import {createPublicKey,verify,createHash,privateDecrypt,constants,createDecipheriv} from 'node:crypto';
import {githubKeys} from './oidc.mjs';
import {appConfig} from './app-config.mjs';
import {NoteStore,StoreError,validNoteId} from './store.mjs';

export const inboxAudience='hunghvt-notes-code-inbox-v1';
export const inboxFolder='Code từ GitHub';
const repo='hunghvt-cyber/Hunghvt-notes',ref='refs/heads/release/minimal-notes';
const need=(ok,status,code)=>{if(!ok)throw new StoreError(status,code);};
export const textHash=text=>createHash('sha256').update(text).digest('hex');
export function inboxId(slot){
 need(['office-v2','office-v2-config'].includes(slot),400,'INBOX_SLOT_DENIED');
 const h=textHash('hunghvt-notes-code-inbox-v1/'+slot);
 return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;
}

export async function authorizeInbox(token,{getKeys=githubKeys,now=Date.now()/1000}={}){
 try{
  need(typeof token==='string'&&token.length<=16000,401,'INBOX_UNAUTHORIZED');
  const p=token.split('.');need(p.length===3&&p.every(s=>/^[\w-]+$/.test(s)),401,'INBOX_UNAUTHORIZED');
  const h=JSON.parse(Buffer.from(p[0],'base64url')),c=JSON.parse(Buffer.from(p[1],'base64url'));
  need(h.alg==='RS256'&&typeof h.kid==='string'&&!h.crit,401,'INBOX_UNAUTHORIZED');
  const k=(await getKeys()).find(k=>k.kid===h.kid&&k.kty==='RSA'&&(!k.alg||k.alg==='RS256')&&(!k.use||k.use==='sig'));
  need(k&&verify('RSA-SHA256',Buffer.from(p[0]+'.'+p[1]),createPublicKey({key:k,format:'jwk'}),Buffer.from(p[2],'base64url')),401,'INBOX_UNAUTHORIZED');
  need(c.iss==='https://token.actions.githubusercontent.com'&&c.aud===inboxAudience&&c.repository===repo&&String(c.repository_id)==='1423348828'&&String(c.repository_owner_id)==='252749231',401,'INBOX_UNAUTHORIZED');
  need(c.ref===ref&&c.event_name==='push'&&c.workflow_ref===repo+'/.github/workflows/notes-inbox.yml@'+ref&&c.sub==='repo:hunghvt-cyber@252749231/Hunghvt-notes@1423348828:ref:'+ref,401,'INBOX_UNAUTHORIZED');
  need(Number.isFinite(c.exp)&&Number.isFinite(c.iat)&&c.exp>now&&c.iat<=now+30&&c.iat>=now-600&&c.exp-c.iat>0&&c.exp-c.iat<=600&&(c.nbf===undefined||(Number.isFinite(c.nbf)&&c.nbf<=now+30)),401,'INBOX_UNAUTHORIZED');
  need(/^\d{1,20}$/.test(String(c.run_id))&&/^[a-f0-9]{40}$/.test(c.sha),401,'INBOX_UNAUTHORIZED');
  return {runId:String(c.run_id),sha:c.sha};
 }catch{throw new StoreError(401,'INBOX_UNAUTHORIZED');}
}

export function decryptEnvelope(envelope,privateKey,now=Date.now()){
 try{
  need(envelope?.v===1&&typeof privateKey==='string',400,'INVALID_ENVELOPE');
  const decode=(name,max)=>{const s=envelope[name];need(typeof s==='string'&&s.length<=max&&/^[\w-]+$/.test(s),400,'INVALID_ENVELOPE');return Buffer.from(s,'base64url');};
  const encryptedKey=decode('key',1024),iv=decode('iv',32),tag=decode('tag',32),data=decode('data',300000);
  need(iv.length===12&&tag.length===16,400,'INVALID_ENVELOPE');
  const key=privateDecrypt({key:privateKey,oaepHash:'sha256',padding:constants.RSA_PKCS1_OAEP_PADDING},encryptedKey);
  need(key.length===32,400,'INVALID_ENVELOPE');
  const decipher=createDecipheriv('aes-256-gcm',key,iv);decipher.setAAD(Buffer.from(inboxAudience));decipher.setAuthTag(tag);
  const b=JSON.parse(Buffer.concat([decipher.update(data),decipher.final()]).toString('utf8'));key.fill(0);
  need(Number.isFinite(b.expiresAt)&&b.expiresAt>now&&b.expiresAt<=now+86400000,400,'ENVELOPE_EXPIRED');
  return b;
 }catch(e){throw new StoreError(400,e.message==='ENVELOPE_EXPIRED'?'ENVELOPE_EXPIRED':'INVALID_ENVELOPE');}
}

async function body(request){
 const reader=request.body?.getReader();need(reader,400,'INVALID_ENVELOPE');let size=0,chunks=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>310000){await reader.cancel();throw new StoreError(413,'INBOX_TOO_LARGE');}chunks.push(value);}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new StoreError(400,'INVALID_ENVELOPE');}
}

export function createInboxHandler({env=()=>process.env,config=appConfig,authorize=authorizeInbox,makeStore=cfg=>new NoteStore(cfg),now=Date.now}={}){
 return async request=>{
  let store;
  const reply=(status,value)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
  try{
   const e=env();need(e.NOTES_INBOX_ENABLED==='github-oidc-v1'&&e.VERCEL_ENV==='production'&&typeof e.NOTES_INBOX_PRIVATE_KEY==='string',503,'INBOX_DISABLED');
   const cfg=config(e);need(new URL(request.url).origin===cfg.origin,403,'HOST_DENIED');
   need(request.method==='POST',405,'METHOD_NOT_ALLOWED');
   need((request.headers.get('content-type')??'').startsWith('application/json'),415,'JSON_REQUIRED');
   need(request.headers.get('sec-fetch-site')!=='cross-site',403,'ORIGIN_DENIED');
   const auth=request.headers.get('authorization');need(auth?.startsWith('Bearer '),401,'INBOX_UNAUTHORIZED');await authorize(auth.slice(7));
   const b=decryptEnvelope(await body(request),e.NOTES_INBOX_PRIVATE_KEY,now());
   const id=inboxId(b.slot);need(['status','save'].includes(b.action),400,'INVALID_ACTION');
   // Only these two managed notes are ever accessed; no owner listing or content export.
   store=makeStore(cfg);
   if(b.action==='status'){
    try{const n=await store.get(id);need(n.folder===inboxFolder,403,'INBOX_SCOPE_DENIED');return reply(200,{id,revision:n.revision,textHash:textHash(n.text)});}
    catch(e){if(e.status===404)return reply(200,{id,revision:null,textHash:null});throw e;}
   }
   need(validNoteId(b.clientOpId)&&(b.revision===null||(typeof b.revision==='string'&&b.revision.length<=200)),400,'INVALID_OPERATION');
   need(typeof b.title==='string'&&b.title.trim()&&b.title.length<=200&&typeof b.text==='string'&&Buffer.byteLength(b.text)<=180000,400,'INVALID_NOTE');
   const result=await store.save(id,{title:b.title,text:b.text,checklist:[],pinned:false,folder:inboxFolder},b.revision,b.clientOpId,{owner:true},{includeNote:true,inboxScope:{folder:inboxFolder}});
   need(result.note?.text===b.text,409,'INBOX_READBACK_CHANGED');
   return reply(200,{id,revision:result.note.revision,textHash:textHash(result.note.text),replay:result.replay,verified:true});
  }catch(e){const status=e instanceof StoreError?e.status:503;return reply(status,{code:e instanceof StoreError?e.message:'INBOX_UNAVAILABLE'});}
  finally{store?.agent.destroy();}
 };
}
