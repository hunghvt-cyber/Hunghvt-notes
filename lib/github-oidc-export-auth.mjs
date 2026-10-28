import {createRemoteJWKSet,jwtVerify} from 'jose';

const ISSUER='https://token.actions.githubusercontent.com';
const AUDIENCE='https://hunghvt-notes.vercel.app/notes-legacy-baseline';
const SUBJECT='repo:hunghvt-cyber@252749231/web-notes@1423348828:ref:refs/heads/main';
const WORKFLOW='hunghvt-cyber/web-notes/.github/workflows/notes-legacy-baseline.yml@refs/heads/main';
const jwks=createRemoteJWKSet(new URL(ISSUER+'/.well-known/jwks'));

export async function authorizeLegacyBaselineExport(request,{verify=jwtVerify,keySet=jwks}={}){
 const header=request.headers.get('authorization')??'';
 if(header.length<100||header.length>16000||!header.startsWith('Bearer '))return false;
 try{
  const {payload}=await verify(header.slice(7),keySet,{issuer:ISSUER,audience:AUDIENCE,algorithms:['RS256'],clockTolerance:5,maxTokenAge:'5m'});
  return payload.sub===SUBJECT&&payload.repository==='hunghvt-cyber/web-notes'&&String(payload.repository_id)==='1423348828'&&String(payload.repository_owner_id)==='252749231'&&payload.ref==='refs/heads/main'&&payload.workflow_ref===WORKFLOW&&payload.event_name==='push';
 }catch{return false;}
}
