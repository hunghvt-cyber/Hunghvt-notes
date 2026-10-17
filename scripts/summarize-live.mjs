import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const number=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null;
const sha=v=>/^[a-f0-9]{40}$/.test(v??'')?v:null;
const codes=errors=>(errors??[]).map(e=>e.code).filter(v=>typeof v==='string'&&/^[A-Z_0-9]{1,90}$/.test(v));
const stats=values=>{const vs=values.map(number).filter(v=>v!==null).sort((a,b)=>a-b);const p=q=>vs[Math.max(0,Math.ceil(q*vs.length)-1)]??null;return {n:vs.length,p50:p(.5),p95:p(.95),max:vs.at(-1)??null};};
export function summarize(report,suite){
 const rows=suite==='qualification'?(report.stages??[]):(report.requests??[]);
 const out={suite,passed:report.passed===true,completed:report.completed===true,deployedCode:sha(report.deployedCode),driverCode:sha(report.driverCode),errors:codes(report.errors),requests:rows.length,metrics:{}};
 const metrics=rows.flatMap(r=>r.metrics??[]);
 for(const operation of ['save-note','list-notes','get-note','create-share','revoke-share','seed-batch','restore-batch']){
  const found=metrics.filter(x=>x.operation===operation);
  out.metrics[operation]={attempted:found.length,successful:stats(found.filter(x=>x.code==='OK').map(x=>x.ms)),committed:stats(found.filter(x=>x.code==='OK'&&x.committed).map(x=>x.ms))};
 }
 if(suite==='qualification'){
  out.stages=rows.map(r=>({stage:typeof r.stage==='string'&&/^[a-z-]{1,50}$/.test(r.stage)?r.stage:null,passed:r.passed===true,httpStatus:number(r.httpStatus),errors:codes(r.errors),wallMs:number(r.wallMs)}));
  out.verifiedOriginalNotes=number(report.verifiedOriginalNotes);
  out.restore={passed:rows.some(r=>r.stage==='restore-verify'&&r.passed),active:number(report.restoreResult?.active),count:number(report.restoreResult?.count)};
 }else{
  out.counts=Object.fromEntries(['faultCases','faultPassed','samePairs','differentPairs','busyResponses','invocations','runtimes'].map(k=>[k,number(report.summary?.[k])]));
  out.uniqueRequestIds=report.requestIdsVerifiedUnique===true;
  out.faults=(report.faults??[]).map(f=>({case:/^[a-z-]{1,70}$/.test(f.case??'')?f.case:null,passed:f.passed===true,errors:codes(f.errors)}));
 }
 return out;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const suite=process.env.SUITE;if(!['qualification','reliability'].includes(suite))throw Error('INVALID_SUITE');
 const path=suite==='qualification'?'koofr-preview-qualification.local.json':'koofr-store-reliability.local.json';
 let report;try{report=JSON.parse(await readFile(path,'utf8'));}catch{report={passed:false,completed:false,errors:[{code:'REPORT_UNAVAILABLE'}]};}
 await writeFile('notes-live-summary.json',JSON.stringify(summarize(report,suite),null,2)+'\n');
}
