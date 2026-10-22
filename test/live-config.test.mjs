import test from 'node:test';
import assert from 'node:assert/strict';
import {credentials,previewEndpoint} from '../scripts/live-config.mjs';
test('Notes credentials require dedicated secrets, not a backup config',()=>{
 assert.throws(()=>credentials({RCLONE_CONFIG_CONTENT:'ignored'}),/ONE_TIME_SETUP_REQUIRED/);
 assert.deepEqual(credentials({KOOFR_WEBDAV_USER:'synthetic',KOOFR_WEBDAV_APP_PASSWORD:'fake'}),{user:'synthetic',password:'fake',source:'dedicated_webdav_secret'});
 for(const user of ['x:y','x\ny'])assert.throws(()=>credentials({KOOFR_WEBDAV_USER:user,KOOFR_WEBDAV_APP_PASSWORD:'fake'}));
});
test('live drivers cannot default to stale deployments or send credentials to arbitrary hosts',()=>{
 assert.equal(previewEndpoint('https://homepage-koofr-example123-hunghvt.vercel.app'),'https://homepage-koofr-example123-hunghvt.vercel.app/api/bench');
 for(const value of [undefined,'https://homepage-nas.vercel.app','https://attacker.example','http://homepage-koofr-a-hunghvt.vercel.app','https://homepage-koofr-a-hunghvt.vercel.app/','https://homepage-koofr-a-hunghvt.vercel.app?secret=x','https://homepage-koofr-a-hunghvt.vercel.app.attacker.example'])assert.throws(()=>previewEndpoint(value));
});
