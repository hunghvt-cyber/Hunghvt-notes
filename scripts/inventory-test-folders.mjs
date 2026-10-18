// Read-only inventory. Never print unrelated paths, credentials or file contents.
import {credentials} from './live-config.mjs';
import {pathToFileURL} from 'node:url';
export const liveRoot='Hunghvt-Notes-Data-78cd53a3-e871-40e5-bf04-5e70ac20901e';
const uuid='[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
export const testName=new RegExp('^(?:Homepage-Notes-Vercel-Probe-[0-9]+-'+uuid+'|Homepage-Notes-WebDAV-Probe-'+uuid+')$');
const base='https://app.koofr.net/dav/Koofr/';
export function parseFolders(xml){
 if(typeof xml!=='string'||xml.length>2000000||/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('INVALID_LISTING');
 const result=[];
 for(const m of xml.matchAll(/<(?:[\w.-]+:)?response\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?response>/g)){
  if(!/<(?:[\w.-]+:)?collection\b/.test(m[1]))continue;
  const href=m[1].match(/<(?:[\w.-]+:)?href\b[^>]*>([^<]+)<\/(?:[\w.-]+:)?href>/)?.[1];
  if(!href)throw Error('INVALID_HREF');
  const u=new URL(href.replaceAll('&amp;','&'),base);
  if(u.origin!==new URL(base).origin)throw Error('FOREIGN_HREF');
  if(u.pathname==='/dav/Koofr'||u.pathname==='/dav/Koofr/')continue;
  if(!u.pathname.startsWith('/dav/Koofr/'))throw Error('FOREIGN_HREF');
  let name;try{name=decodeURIComponent(u.pathname.slice('/dav/Koofr/'.length).replace(/\/$/,''));}catch{throw Error('INVALID_ENCODING');}
  if(!name||name.includes('/')||name.includes('\\'))continue;
  result.push(name);
 }
 return [...new Set(result)].sort();
}
export async function inventory(env=process.env){
 if(env.NOTES_MAINTENANCE!=='READ_ONLY_TEST_FOLDER_INVENTORY')throw Error('INVENTORY_DISABLED');
 const c=credentials(env);
 const r=await fetch(base,{method:'PROPFIND',headers:{Authorization:'Basic '+Buffer.from(c.user+':'+c.password).toString('base64'),Depth:'1','Content-Type':'application/xml'},body:'<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/></d:prop></d:propfind>',redirect:'error',signal:AbortSignal.timeout(30000)});
 if(r.status!==207)throw Error('INVENTORY_HTTP_'+r.status);
 const folders=parseFolders(await r.text()),candidates=folders.filter(n=>testName.test(n));
 return {kind:'NOTES_TEST_FOLDER_INVENTORY',readOnly:true,productionRootPresent:folders.includes(liveRoot),candidateCount:candidates.length,candidates,otherFoldersNotListed:true};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{console.log(JSON.stringify(await inventory()));}catch(e){console.error(JSON.stringify({kind:'NOTES_TEST_FOLDER_INVENTORY',passed:false,code:/^[A-Z0-9_]{1,90}$/.test(e.message)?e.message:'INVENTORY_FAILED'}));process.exitCode=1;}
}
