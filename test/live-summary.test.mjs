import test from 'node:test';
import assert from 'node:assert/strict';
import {summarize} from '../scripts/summarize-live.mjs';
test('public summary allows numeric evidence and error codes, never provider/account payloads',()=>{
 const r={passed:true,completed:true,user:'SECRET_ACCOUNT',password:'SECRET_PASSWORD',namespace:'SECRET_PATH',privateProbe:{token:'SECRET_TOKEN'},stages:[{stage:'verify',passed:true,httpStatus:200,details:{text:'SECRET_NOTE'},metrics:[{operation:'save-note',code:'OK',ms:123,committed:true}]}],errors:[{code:'SAFE_CODE'},{code:'secret=SECRET_CODE'}]};
 const out=summarize(r,'qualification');assert.equal(out.metrics['save-note'].committed.p50,123);
 assert.ok(!JSON.stringify(out).includes('SECRET'));assert.deepEqual(out.errors,['SAFE_CODE']);
});
