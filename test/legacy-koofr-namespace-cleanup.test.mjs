import test from 'node:test';
import assert from 'node:assert/strict';
import {deleteExactNamespace,legacyNamespace,parseListing} from '../scripts/delete-legacy-koofr-namespace.mjs';

test('legacy namespace listing accepts only exact in-root descendants',()=>{
 const root=`/dav/Koofr/${legacyNamespace}/`;
 const xml=`<d:multistatus xmlns:d="DAV:"><d:response><d:href>${root}</d:href><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat></d:response><d:response><d:href>${root}catalog.json</d:href><d:propstat><d:prop><d:resourcetype/></d:prop></d:propstat></d:response></d:multistatus>`;
 const nodes=parseListing(xml,[legacyNamespace]);
 assert.equal(nodes.length,1);
 assert.equal(nodes[0].parts.at(-1),'catalog.json');
 assert.equal(nodes[0].isCollection,false);
});

test('legacy namespace listing rejects paths outside the exact namespace',()=>{
 const xml='<d:multistatus xmlns:d="DAV:"><d:response><d:href>/dav/Koofr/Photos/</d:href><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat></d:response></d:multistatus>';
 assert.throws(()=>parseListing(xml,[legacyNamespace]),/LEGACY_NAMESPACE_PATH_ESCAPE/);
});

test('cleanup requires exact confirmation before reading any remote control',async()=>{
 let remoteCalls=0;
 await assert.rejects(deleteExactNamespace({user:'u',password:'p',backupCredential:'u:p',confirm:'wrong',remoteFactory:()=>{remoteCalls++;throw Error('unexpected')}}),/LEGACY_DELETE_CONFIRMATION_REQUIRED/);
 assert.equal(remoteCalls,0);
});

test('cleanup stops before Koofr legacy access when matching restore markers are absent',async()=>{
 let legacyCalls=0;
 await assert.rejects(deleteExactNamespace({user:'u',password:'p',backupCredential:'u:p',confirm:'DELETE_KOOFR_NOTES_NAMESPACE_20261028',remoteFactory:()=>({getControl:async()=>null}),fetchImpl:async()=>{legacyCalls++;throw Error('unexpected')}}),/BACKUP_OR_RESTORE_MARKER_MISSING/);
 assert.equal(legacyCalls,0);
});
