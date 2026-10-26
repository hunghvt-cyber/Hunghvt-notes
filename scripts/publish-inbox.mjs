import {readFile,writeFile} from 'node:fs/promises';
const endpoint='https://hunghvt-notes.vercel.app/api/inbox';
const audience='hunghvt-notes-code-inbox-v1';
if(process.env.GITHUB_REPOSITORY!=='hunghvt-cyber/Hunghvt-notes'||process.env.GITHUB_REF!=='refs/heads/release/minimal-notes'||process.env.GITHUB_EVENT_NAME!=='push')throw Error('WORKFLOW_CONTEXT_DENIED');
const body=await readFile('.notes-inbox/request.json','utf8');
if(Buffer.byteLength(body)>310000)throw Error('ENVELOPE_TOO_LARGE');
const url=new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);url.searchParams.set('audience',audience);
const tokenResponse=await fetch(url,{headers:{Authorization:'Bearer '+process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN},redirect:'error',signal:AbortSignal.timeout(15000)});
if(!tokenResponse.ok)throw Error('OIDC_REQUEST_FAILED');
const {value:token}=await tokenResponse.json();if(typeof token!=='string')throw Error('OIDC_REQUEST_FAILED');
let result,status;
for(let attempt=0;attempt<3;attempt++){
 try{
  const response=await fetch(endpoint,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body,redirect:'error',signal:AbortSignal.timeout(115000)});
  status=response.status;result=await response.json();
  if(response.ok)break;
  if(![423,503].includes(status))break;
 }catch{status=503;result={code:'NETWORK_OR_TIMEOUT'};}
 if(attempt<2)await new Promise(resolve=>setTimeout(resolve,1500*(attempt+1)));
}
// Print only metadata, never the request, decrypted content, OIDC token or provider response.
const safe={status,...(typeof result?.code==='string'&&/^[A-Z_0-9]{1,80}$/.test(result.code)?{code:result.code}:{}),...(typeof result?.id==='string'&&/^[a-f0-9-]{36}$/.test(result.id)?{id:result.id}:{}),...(result?.revision===null||typeof result?.revision==='string'&&/^[a-f0-9-]{36}:\d+$/.test(result.revision)?{revision:result.revision}:{}),...(result?.textHash===null||typeof result?.textHash==='string'&&/^[a-f0-9]{64}$/.test(result.textHash)?{textHash:result.textHash}:{}),...(result?.verified===true?{verified:true}:{})};
console.log(JSON.stringify(safe));
if(process.env.GITHUB_STEP_SUMMARY)await writeFile(process.env.GITHUB_STEP_SUMMARY,'```json\n'+JSON.stringify(safe,null,2)+'\n```\n',{flag:'a'});
if(status!==200)process.exitCode=1;
