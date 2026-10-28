import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {deleteExactNamespace,legacyNamespace,parseListing} from '../scripts/delete-legacy-koofr-namespace.mjs';
import {encodeSnapshot} from '../lib/store-backup.mjs';
import {inspectSnapshot} from '../lib/firestore-migration.mjs';

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

test('verified cleanup locks and deletes only descendants of the exact legacy namespace',async()=>{
 const hash=value=>createHash('sha256').update(value).digest('hex');
 const snapshot=JSON.parse(encodeSnapshot({schema:1,epoch:'synthetic-epoch',version:1,restoring:false,folders:{},entries:{},shares:{},receipts:[],noteOrder:[],orderVersion:0},{}));
 const info=inspectSnapshot(snapshot),backupId='firestore-notes-2026-10-28T09-18-52Z-40663242871-1.json.gz',compressed=gzipSync(Buffer.from(JSON.stringify(snapshot)));
 const manifest={schemaVersion:1,backupId,projectId:'notes-lab-56f0f',databaseId:'(default)',vaultId:'notes-production',capturedAt:'2026-10-28T09:18:52.624Z',calendarDateVN:'2026-10-28',snapshotBytes:Buffer.byteLength(JSON.stringify(snapshot)),compressedBytes:compressed.length,compressedSha256:hash(compressed),fingerprint:info.fingerprint,counts:info.counts};
 const latest={schemaVersion:1,backupId,fingerprint:info.fingerprint,compressedSha256:manifest.compressedSha256};
 const restore={schemaVersion:1,result:'PASS',backupId,fingerprint:info.fingerprint,counts:info.counts};
 const controls=new Map([['.latest-verified-backup.json',latest],['.restore-qualification-passed.json',restore]]);
 const objects=new Map([[`${backupId}.manifest.json`,manifest],[backupId,compressed]]);
 const remoteFactory=()=>({getControl:async name=>Buffer.from(JSON.stringify(controls.get(name))),get:async name=>{const value=objects.get(name);if(!value)throw Error('unexpected backup object');return Buffer.isBuffer(value)?value:Buffer.from(JSON.stringify(value));}});
 const rootPath=`/dav/Koofr/${legacyNamespace}/`,folderPath=`${rootPath}child/`,filePath=`${folderPath}synthetic.json`;
 const escape=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
 const response=(status,body='',headers={})=>new Response(status===204?null:body,{status,headers});
 const listing=(hrefs)=>response(207,`<d:multistatus xmlns:d="DAV:">${hrefs.map(({href,collection})=>`<d:response><d:href>${escape(href)}</d:href><d:propstat><d:prop><d:resourcetype>${collection?'<d:collection/>':''}</d:resourcetype></d:prop></d:propstat></d:response>`).join('')}</d:multistatus>`);
 const deleted=[],calls=[];let rootGone=false;
 const fetchImpl=async(url,options)=>{
  const path=new URL(url).pathname,method=options.method;calls.push({method,path,depth:options.headers.depth});
  if(method==='PROPFIND'&&path===rootPath&&rootGone)return response(404);
  if(method==='PROPFIND'&&path===rootPath)return listing([{href:rootPath,collection:true},{href:folderPath,collection:true}]);
  if(method==='PROPFIND'&&path===folderPath)return listing([{href:folderPath,collection:true},{href:filePath,collection:false}]);
  if(method==='LOCK'&&path===rootPath){assert.equal(options.headers.depth,'infinity');return response(200,'',{'lock-token':'<opaquelocktoken:synthetic>'});}
  if(method==='GET'&&path===`${rootPath}restore-control.json`)return response(200,JSON.stringify({format:'hunghvt-notes-empty-v1',namespaceHash:hash(legacyNamespace)}));
  if(method==='DELETE'){
   assert.equal(options.headers.if,'(<opaquelocktoken:synthetic>)');deleted.push(path);
   if(path===rootPath)rootGone=true;
   return response(204);
  }
  if(method==='UNLOCK'&&path===rootPath)return response(204);
  throw Error(`unexpected WebDAV operation ${method}`);
 };
 const result=await deleteExactNamespace({user:'synthetic-user',password:'synthetic-password',backupCredential:'synthetic:credential',confirm:'DELETE_KOOFR_NOTES_NAMESPACE_20261028',remoteFactory,fetchImpl});
 assert.equal(result.alreadyAbsent,false);
 assert.deepEqual(deleted,[filePath,folderPath,rootPath]);
 assert.equal(calls.at(-2).method,'PROPFIND');
 assert.equal(calls.at(-2).path,rootPath);
 assert.equal(calls.at(-2).depth,'0');
 assert.equal(calls.at(-1).method,'UNLOCK');
 assert.ok(deleted.every(path=>path.startsWith(rootPath)));
});
