import test from 'node:test';
import assert from 'node:assert/strict';
import {authorizeLegacyBaselineExport} from '../lib/github-oidc-export-auth.mjs';

const valid={iss:'https://token.actions.githubusercontent.com',aud:'https://hunghvt-notes.vercel.app/notes-legacy-baseline',sub:'repo:hunghvt-cyber@252749231/web-notes@1423348828:ref:refs/heads/main',repository:'hunghvt-cyber/web-notes',repository_id:'1423348828',repository_owner_id:'252749231',ref:'refs/heads/main',workflow_ref:'hunghvt-cyber/web-notes/.github/workflows/notes-legacy-baseline.yml@refs/heads/main',event_name:'push'};
const request=()=>new Request('https://hunghvt-notes.vercel.app/api/migration-export',{headers:{authorization:'Bearer '+('x'.repeat(128))}});
const verifier=payload=>async(_token,_keySet,options)=>({payload:{...payload,iss:options.issuer,aud:options.audience}});

test('legacy export authorization accepts only the canonical main workflow identity',async()=>{
 assert.equal(await authorizeLegacyBaselineExport(request(),{verify:verifier(valid),keySet:{}}),true);
 for(const [key,value] of Object.entries({repository:'evil/repo',repository_id:'1',repository_owner_id:'1',ref:'refs/heads/feature',workflow_ref:'other.yml@refs/heads/main',event_name:'pull_request',sub:'repo:hunghvt-cyber/web-notes:ref:refs/heads/main'})){
  assert.equal(await authorizeLegacyBaselineExport(request(),{verify:verifier({...valid,[key]:value}),keySet:{}}),false,key);
 }
 assert.equal(await authorizeLegacyBaselineExport(new Request('https://x.test'),{verify:verifier(valid),keySet:{}}),false);
});
