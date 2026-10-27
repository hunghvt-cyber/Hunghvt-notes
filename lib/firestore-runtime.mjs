import {Firestore} from '@google-cloud/firestore';
import {GoogleAuth} from 'google-auth-library';
import {createHash} from 'node:crypto';
import {FirestoreNativeStore} from './firestore-native-repository.mjs';
import {StoreError} from './store.mjs';

const need=(ok,code)=>{if(!ok)throw new StoreError(503,code);};
const validId=value=>typeof value==='string'&&/^[a-z][a-z0-9-]{2,60}$/.test(value);
const clients=new Map();

/* Credentials are explicit: NAS uses its dedicated ADC file; Vercel uses the
 * request's OIDC assertion with a reviewed external-account configuration. */
export async function createFirestoreNativeStore(cfg,request,{env=process.env,FirestoreClass=Firestore,tokenProvider=async()=>{const {getVercelOidcToken}=await import('@vercel/oidc');return getVercelOidcToken();}}={}){
 need(validId(cfg.projectId)&&validId(cfg.vaultId),'FIRESTORE_CONFIG_INVALID');
 let auth,cacheKey;
 if(env.VERCEL=== '1'||env.VERCEL_ENV){
  let config;try{config=JSON.parse(env.NOTES_FIRESTORE_WIF_CONFIG??'');}catch{throw new StoreError(503,'FIRESTORE_WIF_CONFIG_INVALID');}
  need(config?.type==='external_account'&&/^\/\/iam\.googleapis\.com\/projects\/\d+\/locations\/global\/workloadIdentityPools\/[a-zA-Z0-9_-]+\/providers\/[a-zA-Z0-9_-]+$/.test(config.audience??'')&&
   config.token_url==='https://sts.googleapis.com/v1/token'&&config.subject_token_type==='urn:ietf:params:oauth:token-type:jwt'&&
   /^https:\/\/iamcredentials\.googleapis\.com\/v1\/projects\/-\/serviceAccounts\/[a-zA-Z0-9._@-]+:generateAccessToken$/.test(config.service_account_impersonation_url??'')&&
   !config.credential_source,'FIRESTORE_WIF_CONFIG_INVALID');
  cacheKey=`wif:${cfg.projectId}:${createHash('sha256').update(JSON.stringify(config)).digest('hex')}`;
  auth=clients.get(cacheKey)?.auth;
  if(!auth){
   auth=new GoogleAuth({projectId:cfg.projectId,credentials:{...config,subject_token_supplier:{getSubjectToken:async()=>{try{const token=await tokenProvider();need(typeof token==='string'&&token.length>100,'FIRESTORE_WIF_UNAVAILABLE');return token;}catch{throw new StoreError(503,'FIRESTORE_WIF_UNAVAILABLE');}}}}});
  }
 }else{
  const adc=env.NOTES_GOOGLE_ADC_FILE;
  need(adc==='/home/admin/.local/state/notes-gcloud-home/.config/gcloud/application_default_credentials.json','FIRESTORE_ADC_NOT_CONFIGURED');
  cacheKey=`adc:${cfg.projectId}:${adc}`;auth=clients.get(cacheKey)?.auth;
  if(!auth)auth=new GoogleAuth({keyFile:adc,scopes:['https://www.googleapis.com/auth/cloud-platform']});
 }
 let db=clients.get(cacheKey)?.db;
 if(!db){db=new FirestoreClass({projectId:cfg.projectId,auth,ignoreUndefinedProperties:false});clients.set(cacheKey,{auth,db});}
 const store=new FirestoreNativeStore({namespace:cfg.namespace,vaultId:cfg.vaultId},{db,ownsDb:false});
 return store;
}
