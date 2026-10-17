import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {authorize,audience} from '../lib/oidc.mjs';
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...publicKey.export({format:'jwk'}),kid:'fake',alg:'RS256',use:'sig'};
const now=1792209000,repo='hunghvt-cyber/Hunghvt-notes',ref='refs/heads/main';
const claims={iss:'https://token.actions.githubusercontent.com',aud:audience,sub:'repo:'+repo+':ref:'+ref,repository:repo,repository_id:'1423348828',ref,event_name:'workflow_dispatch',workflow_ref:repo+'/.github/workflows/notes-live.yml@'+ref,iat:now-10,exp:now+290,run_id:'123'};
function token(patch={},header={}){const parts=[Buffer.from(JSON.stringify({alg:'RS256',kid:'fake',...header})).toString('base64url'),Buffer.from(JSON.stringify({...claims,...patch})).toString('base64url')];return parts.join('.')+'.'+sign('RSA-SHA256',Buffer.from(parts.join('.')),privateKey).toString('base64url');}
const options={getKeys:async()=>[jwk],now};
test('isolated feature branch accepts only its exact push workflow identity',async()=>{
 const branch='refs/heads/split/notes-standalone';
 const patch={ref:branch,sub:'repo:'+repo+':ref:'+branch,event_name:'push',workflow_ref:repo+'/.github/workflows/notes-preview-qualify.yml@'+branch};
 assert.deepEqual(await authorize(token(patch),options),{runId:'123'});
 for(const invalid of [{event_name:'pull_request'},{workflow_ref:repo+'/.github/workflows/notes-ci.yml@'+branch},{repository_id:'1191594464'},{sub:'repo:untrusted/fork:ref:'+branch}])await assert.rejects(authorize(token({...patch,...invalid}),options),/UNAUTHORIZED/);
});
test('only correctly signed repository, workflow, branch and audience can call preview',async()=>{assert.deepEqual(await authorize(token(),options),{runId:'123'});});
test('wrong claims, expiry, algorithm, signature and remote JWKS injection fail closed',async()=>{
 for(const patch of [{aud:'other'},{repository:'other/repo'},{repository:'hunghvt-cyber/my-backup-gdrive-koofr'},{repository_id:'1191594464'},{ref:'refs/heads/feature/untrusted'},{sub:'other'},{event_name:'push'},{event_name:'pull_request'},{workflow_ref:repo+'/.github/workflows/bisync.yml@'+ref},{exp:now-1},{iat:now+100},{iat:now-700},{exp:now+700},{run_id:'../private'}])await assert.rejects(authorize(token(patch),options),/UNAUTHORIZED/);
 for(const header of [{alg:'none'},{kid:'bad'},{crit:['jku']}])await assert.rejects(authorize(token({},header),options),/UNAUTHORIZED/);
 await assert.rejects(authorize(token().slice(0,-20)+'A',options),/UNAUTHORIZED/);
});
