import {StoreError} from './store.mjs';
export function createSharedAuth({env=()=>process.env,request=fetch}={}){
 async function call(body){
  const e=env();if(e.VERCEL_ENV!=='production'||typeof e.NOTES_AUTH_SERVICE_KEY!=='string'||e.NOTES_AUTH_SERVICE_KEY.length<64)throw new StoreError(503,'SHARED_AUTH_UNAVAILABLE');
  try{
   const r=await request('https://homepage-nas.vercel.app/api/auth?service=notes',{method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12000),headers:{'Content-Type':'application/json',Authorization:'Bearer '+e.NOTES_AUTH_SERVICE_KEY},body:JSON.stringify(body)});
   if(r.status===429)throw new StoreError(429,'LOGIN_RATE_LIMITED');
   if(!r.ok)throw Error();const b=await r.json();
   if(typeof b.version!=='string'||!/^([a-f0-9]{64}|[a-f0-9-]{36})$/.test(b.version)||body.action==='verify'&&typeof b.valid!=='boolean')throw Error();return b;
  }catch(e){if(e instanceof StoreError)throw e;throw new StoreError(503,'SHARED_AUTH_UNAVAILABLE');}
 }
 return {current:()=>call({action:'version'}),verify:(password,clientIp)=>call({action:'verify',password,clientIp})};
}
