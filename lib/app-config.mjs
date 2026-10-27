import {StoreError} from './store.mjs';
import {createSharedAuth} from './shared-auth.mjs';
import {createPreviewHandler} from './preview-api.mjs';
import {NoteStore} from './store.mjs';
import {createFirestoreNativeStore} from './firestore-runtime.mjs';
export const productionProject='prj_c4sEp6nB4msWTsPiGoALSuVutVTK';
const need=(ok,code)=>{if(!ok)throw new StoreError(503,code);};
export function appConfig(env=process.env){
 need(env.NOTES_MODE==='live-v1'&&env.NOTES_PROJECT_ID===productionProject&&(!env.VERCEL_PROJECT_ID||env.VERCEL_PROJECT_ID===productionProject),'NOTES_DISABLED');
 const preview=env.VERCEL_ENV==='preview';
 const origin=preview?'https://'+env.VERCEL_URL:env.NOTES_BASE_URL;
 let u;try{u=new URL(origin);}catch{}need(u&&u.protocol==='https:'&&u.origin===origin,'NOTES_ORIGIN_MISSING');
 need(preview?/^Homepage-Notes-Vercel-Probe-\d{1,20}-[a-f0-9-]{36}$/.test(env.NOTES_DATA_NAMESPACE??''):/^Hunghvt-Notes-Data-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(env.NOTES_DATA_NAMESPACE??''),'NOTES_NAMESPACE_FORBIDDEN');
 const sharedAuth=env.NOTES_AUTH_MODE==='homepage-v1';
 need(!env.NOTES_AUTH_MODE||sharedAuth,'NOTES_AUTH_MODE_INVALID');
 need(!sharedAuth||(env.VERCEL_ENV==='production'&&typeof env.NOTES_AUTH_SERVICE_KEY==='string'&&env.NOTES_AUTH_SERVICE_KEY.length>=64),'NOTES_SHARED_AUTH_MISSING');
 need(typeof env.NOTES_SESSION_PASSWORD==='string'&&env.NOTES_SESSION_PASSWORD.length>=32&&(sharedAuth||(typeof env.NOTES_PASSWORD==='string'&&env.NOTES_PASSWORD.length>=12&&env.NOTES_PASSWORD.length<=256)),'NOTES_AUTH_MISSING');
 need(!env.NOTES_BACKEND||['koofr-v1','firestore-native-v1'].includes(env.NOTES_BACKEND),'NOTES_BACKEND_INVALID');
 if(env.NOTES_BACKEND==='firestore-native-v1'){
  need(env.VERCEL_ENV==='preview'||(env.VERCEL_ENV==='production'&&env.NOTES_FIRESTORE_PRODUCTION_REVIEW==='approved-v1'),'FIRESTORE_PRODUCTION_REVIEW_REQUIRED');
  need(/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(env.NOTES_FIRESTORE_PROJECT_ID??''),'FIRESTORE_PROJECT_MISSING');
  need(/^[a-z][a-z0-9-]{2,60}$/.test(env.NOTES_FIRESTORE_VAULT_ID??''),'FIRESTORE_VAULT_MISSING');
  return {backend:'firestore-native-v1',sharedAuth,origin,namespace:env.NOTES_DATA_NAMESPACE,projectId:env.NOTES_FIRESTORE_PROJECT_ID,vaultId:env.NOTES_FIRESTORE_VAULT_ID,portalPassword:sharedAuth?'':env.NOTES_PASSWORD,sessionPassword:env.NOTES_SESSION_PASSWORD,cookieName:'__Host-hunghvt-notes',sessionScope:sharedAuth?'hunghvt-notes-shared-auth-v1':'hunghvt-notes-live-v1'};
 }
 const user=env.KOOFR_NOTES_USER,password=env.KOOFR_NOTES_APP_PASSWORD;
 need(typeof user==='string'&&user.length>0&&user.length<300&&!/[:\r\n]/.test(user)&&typeof password==='string'&&password.length>0&&password.length<600&&!/[\r\n]/.test(password),'NOTES_STORAGE_MISSING');
 return {sharedAuth,origin,user,password,namespace:env.NOTES_DATA_NAMESPACE,portalPassword:sharedAuth?'':env.NOTES_PASSWORD,sessionPassword:env.NOTES_SESSION_PASSWORD,cookieName:'__Host-hunghvt-notes',sessionScope:sharedAuth?'hunghvt-notes-shared-auth-v1':'hunghvt-notes-live-v1'};
}
export async function createApplicationStore(cfg,request){return cfg.backend==='firestore-native-v1'?createFirestoreNativeStore(cfg,request):new NoteStore(cfg);}
export function createAppHandler(options={}){return createPreviewHandler({...options,makeStore:options.makeStore??createApplicationStore,passwordProvider:options.passwordProvider??createSharedAuth({env:options.env??(()=>process.env)}),config:appConfig,live:true});}

