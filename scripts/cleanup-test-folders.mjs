// User requested removal of all agent-created Notes test folders, 2026-10-18.
// Exact inventory allowlist only. No recursive listing and no trash purge API.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {credentials} from './live-config.mjs';
import {parseFolders,testName,liveRoot} from './inventory-test-folders.mjs';
const base='https://app.koofr.net/dav/Koofr/';
export function validateTargets(names){
 if(!Array.isArray(names)||names.length!==39||new Set(names).size!==39||names.some(n=>typeof n!=='string'||!testName.test(n)||n===liveRoot))throw Error('TARGETS_FORBIDDEN');
 return names;
}
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export async function cleanup(env=process.env,request=fetch,{log=console.log}={}){
 if(env.NOTES_MAINTENANCE!=='DELETE_EXACT_39_TEST_ROOTS_20261018')throw Error('CLEANUP_DISABLED');
 const names=validateTargets(JSON.parse(await readFile(new URL('./test-folder-cleanup-targets.json',import.meta.url),'utf8')));
 const targets=new Set(names),c=credentials(env),auth='Basic '+Buffer.from(c.user+':'+c.password).toString('base64');
 const call=(name,method,extra={})=>request(base+name,{method,headers:{Authorization:auth,...(extra.headers??{})},...(extra.body?{body:extra.body}:{}),redirect:'error',signal:AbortSignal.timeout(30000)});
 async function list(){const r=await call('','PROPFIND',{headers:{Depth:'1','Content-Type':'application/xml'},body:'<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/></d:prop></d:propfind>'});if(r.status!==207)throw Error('LIST_HTTP_'+r.status);return parseFolders(await r.text());}
 const before=await list();if(!before.includes(liveRoot))throw Error('LIVE_ROOT_NOT_PRESENT');
 const untouched=digest(before.filter(n=>!targets.has(n))),present=before.filter(n=>targets.has(n));
 log(JSON.stringify({kind:'NOTES_TEST_CLEANUP_START',allowlistCount:names.length,present:present.length,productionExcluded:true}));
 const results=[];
 for(const name of present){
  let status;try{const r=await call(encodeURIComponent(name)+'/','DELETE');status=r.status;await r.arrayBuffer();}catch{status='UNCONFIRMED';}
  results.push({name,status});log(JSON.stringify({kind:'NOTES_TEST_CLEANUP_ITEM',name,status}));
  if(status!==204&&status!==200&&status!==207&&status!==404&&status!=='UNCONFIRMED')throw Error('DELETE_HTTP_'+status);
  if(status==='UNCONFIRMED')throw Error('DELETE_OUTCOME_UNCONFIRMED');
 }
 const after=await list(),remaining=after.filter(n=>targets.has(n));
 const verified=remaining.length===0&&after.includes(liveRoot)&&digest(after.filter(n=>!targets.has(n)))===untouched;
 const report={kind:'NOTES_TEST_CLEANUP_DONE',verified,removed:present.length-remaining.length,remaining:remaining.length,productionRootPresent:after.includes(liveRoot),otherFolderNamesUnchanged:digest(after.filter(n=>!targets.has(n)))===untouched,trashPurgeCalled:false,results};
 log(JSON.stringify(report));if(!verified)throw Error('CLEANUP_NOT_VERIFIED');return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{await cleanup();}catch(e){console.error(JSON.stringify({kind:'NOTES_TEST_CLEANUP_ERROR',code:/^[A-Z0-9_]{1,90}$/.test(e.message)?e.message:'CLEANUP_FAILED'}));process.exitCode=1;}}
