import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cleanup,validateTargets} from '../scripts/cleanup-test-folders.mjs';
import {liveRoot,parseFolders} from '../scripts/inventory-test-folders.mjs';
const names=JSON.parse(readFileSync(new URL('../scripts/test-folder-cleanup-targets.json',import.meta.url)));
const env={NOTES_MAINTENANCE:'DELETE_EXACT_39_TEST_ROOTS_20261018',KOOFR_WEBDAV_USER:'fake-user',KOOFR_WEBDAV_APP_PASSWORD:'synthetic-only'};
const listing=rows=>'<d:multistatus xmlns:d="DAV:">'+['',...rows].map(n=>'<d:response><d:href>/dav/Koofr'+(n?'/'+encodeURIComponent(n)+'/':'')+'</d:href><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat></d:response>').join('')+'</d:multistatus>';
test('inventory handles collection self row and excludes nested encoded paths',()=>{
 assert.deepEqual(parseFolders(listing(['a','nested/path'])),['a']);
 assert.throws(()=>parseFolders('<!DOCTYPE x>'));
});
test('cleanup allowlist rejects live root, traversal, duplicates and empty list',()=>{
 assert.equal(validateTargets(names).length,39);
 for(const invalid of [[liveRoot,...names.slice(1)],['../',...names.slice(1)],[names[0],...names.slice(0,38)],[]])assert.throws(()=>validateTargets(invalid));
});
test('cleanup default disabled without issuing requests',async()=>{
 let called=false;await assert.rejects(cleanup({},()=>{called=true;}));assert.equal(called,false);
});
test('cleanup deletes only the 39 exact roots and verifies untouched folder names',async()=>{
 let lists=0;const deletes=[];
 const request=async(url,opts)=>{
  assert.equal(opts.redirect,'error');
  if(opts.method==='PROPFIND'){lists++;return new Response(listing([liveRoot,'unrelated-synthetic-backup',...(lists===1?names:[])]),{status:207});}
  assert.equal(opts.method,'DELETE');const name=decodeURIComponent(new URL(url).pathname.slice('/dav/Koofr/'.length,-1));assert.ok(names.includes(name));deletes.push(name);return new Response(null,{status:204});
 };
 const report=await cleanup(env,request,{log:()=>{}});assert.equal(report.verified,true);assert.equal(report.removed,39);assert.equal(report.trashPurgeCalled,false);assert.deepEqual(deletes,names);assert.equal(lists,2);
});
test('missing production root or access denial stops cleanup',async()=>{
 let writes=0;await assert.rejects(cleanup(env,async(_u,o)=>{if(o.method==='DELETE')writes++;return new Response(listing(names),{status:207});},{log:()=>{}}),/LIVE_ROOT_NOT_PRESENT/);assert.equal(writes,0);
 await assert.rejects(cleanup(env,async(_u,o)=>{if(o.method==='PROPFIND')return new Response(listing([liveRoot,...names]),{status:207});writes++;return new Response(null,{status:403});},{log:()=>{}}),/DELETE_HTTP_403/);assert.equal(writes,1);
});
