import test from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import net from 'node:net';

test('default unit-test harness removes provider credentials and blocks non-loopback network',async()=>{
 assert.equal(process.env.NOTES_OFFLINE_TESTS,'1');
 for(const name of ['KOOFR_WEBDAV_USER','KOOFR_WEBDAV_APP_PASSWORD','NOTES_MAINTENANCE','ACTIONS_ID_TOKEN_REQUEST_TOKEN'])assert.equal(process.env[name],undefined);
 await assert.rejects(fetch('https://example.com'),/LIVE_NETWORK_DISABLED_IN_OFFLINE_TESTS/);
 assert.throws(()=>https.request('https://example.com'),/LIVE_NETWORK_DISABLED_IN_OFFLINE_TESTS/);
 assert.throws(()=>net.connect(443,'example.com'),/LIVE_NETWORK_DISABLED_IN_OFFLINE_TESTS/);
});
