// UI profiling against synthetic in-memory storage; never connects to Firestore.
import {chromium,expect} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {backend} from '../test/helpers/collection.mjs';
import {createAppHandler,productionProject} from '../lib/app-config.mjs';
import {provisionStore} from '../lib/production-store.mjs';

const origin='https://notes.typing-profile.test',password='synthetic-only',samples=20,noteCount=12;
const assets=process.env.BROWSER_APP_PUBLIC_DIR??new URL('../public/',import.meta.url).pathname;
const source=process.env.PERF_SOURCE??'candidate';
const variant=process.env.PROFILE_VARIANT??'candidate-prefetch-on-cache-writes-on';
const prefetchOff=variant.includes('prefetch-off'),cacheWritesOff=variant.includes('cache-writes-off');
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
const b=backend(),namespace='Hunghvt-Notes-Data-'+randomUUID(),input={user:'synthetic',password:'synthetic',namespace},store=b.makeStore(input);await provisionStore(store);
const ids=[];for(let i=0;i<noteCount;i++){const id=randomUUID();ids.push(id);await store.save(id,{title:`Typing fixture ${i}`,text:`Synthetic text ${i}`,checklist:[],folder:''},null,randomUUID());}
const env={NOTES_MODE:'live-v1',NOTES_PROJECT_ID:productionProject,VERCEL_PROJECT_ID:productionProject,VERCEL_ENV:'production',NOTES_BASE_URL:origin,NOTES_DATA_NAMESPACE:namespace,NOTES_SESSION_PASSWORD:randomUUID()+randomUUID(),NOTES_PASSWORD:password,KOOFR_NOTES_USER:'fixture',KOOFR_NOTES_APP_PASSWORD:'fixture'};
const handler=createAppHandler({env:()=>env,makeStore:b.makeStore,observe:()=>{}}),context=await browser.newContext({viewport:{width:1024,height:768}}),server=[];
await context.route(origin+'/**',async route=>{
 const req=route.request(),url=new URL(req.url());
 if(url.pathname==='/api/app'){
  if(url.searchParams.has('revision'))await new Promise(resolve=>setTimeout(resolve,120));
  const body=req.postData(),started=performance.now(),response=await handler(new Request(req.url(),{method:req.method(),headers:await req.allHeaders(),...(body?{body}:{})})),bytes=Buffer.from(await response.arrayBuffer());
  server.push({prefetch:url.searchParams.get('prefetch')==='1',revision:url.searchParams.has('revision'),status:response.status,ms:+(performance.now()-started).toFixed(2),bytes:bytes.length});
  await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:bytes});return;
 }
 const file=url.pathname==='/'?'index.html':url.pathname.slice(1);
 try{const body=await readFile(join(assets,file));await route.fulfill({status:200,contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html',body});}
 catch{await route.fulfill({status:404,body:''});}
});
await context.addInitScript(({prefetchOff,cacheWritesOff})=>{
 window.__profile={active:false,opens:[],inputs:[],longTasks:[],events:[],puts:[],mutations:0,mutationTargets:{},replaceCalls:[],noteReads:[],prefetchCount:0,cacheWritesOff,expectedText:''};
 if(prefetchOff)window.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};
 const p=window.__profile;
 try{new PerformanceObserver(list=>{for(const x of list.getEntries())if(p.active)p.longTasks.push({start:x.startTime,duration:x.duration});}).observe({type:'longtask',buffered:true});}catch{}
 try{new PerformanceObserver(list=>{for(const x of list.getEntries())if(p.active)p.events.push({name:x.name,duration:x.duration,processingStart:x.processingStart,start:x.startTime});}).observe({type:'event',buffered:true,durationThreshold:16});}catch{}
 const nativePut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){const start=performance.now();if(p.active&&this.name==='cache'&&p.cacheWritesOff){p.puts.push({skipped:true,ms:0});return undefined;}const out=nativePut.apply(this,args);if(p.active&&this.name==='cache')p.puts.push({skipped:false,ms:performance.now()-start});return out;};
 const nativeReplace=Element.prototype.replaceChildren;Element.prototype.replaceChildren=function(...args){const start=performance.now(),result=nativeReplace.apply(this,args);if(p.active&&['note-list','checklist','history'].includes(this.id))p.replaceCalls.push({root:this.id,ms:performance.now()-start});return result;};
 const nativeFetch=window.fetch.bind(window);window.fetch=async(...args)=>{const url=new URL(typeof args[0]==='string'?args[0]:args[0].url,location.href),isNote=url.searchParams.has('id'),isRevision=url.searchParams.has('revision'),isPrefetch=url.searchParams.get('prefetch')==='1',start=performance.now(),read={kind:isPrefetch?'prefetch':isRevision?'revision':isNote?'content':null,start,end:null};if(p.active&&read.kind)p.noteReads.push(read);if(p.active&&isPrefetch)p.prefetchCount++;const response=await nativeFetch(...args);if(p.active&&read.kind)read.end=performance.now();return response;};
 document.addEventListener('click',event=>{const card=event.target.closest?.('.card[data-note]');if(!card||!p.active)return;p.opens.push({click:performance.now(),ready:null});},true);
 document.addEventListener('input',event=>{if(!p.active||!['title','text'].includes(event.target?.id))return;const row={event:event.timeStamp,at:performance.now(),handlerEnd:null,paint:null};p.inputs.push(row);queueMicrotask(()=>{row.handlerEnd=performance.now();requestAnimationFrame(()=>requestAnimationFrame(()=>{row.paint=performance.now();}));});},true);
 document.addEventListener('DOMContentLoaded',()=>{const root=document.querySelector('#editor');if(root)new MutationObserver(rows=>{if(!p.active)return;p.mutations+=rows.length;for(const row of rows){const target=row.target?.id||row.target?.parentElement?.id||'other';p.mutationTargets[target]=(p.mutationTargets[target]??0)+1;}}).observe(root,{subtree:true,childList:true,attributes:true,characterData:true});});
},{prefetchOff,cacheWritesOff});
const page=await context.newPage(),pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
const rows=[];
try{
 await page.goto(origin);await page.locator('#password').fill(password);await page.locator('#login-form button').click();await expect(page.locator('.card')).toHaveCount(noteCount);
 // Warm exactly the 12-entry acknowledged-content cache; exclude this phase.
 const values=Array.from({length:noteCount},(_,i)=>`Synthetic text ${i}`);
 for(let i=0;i<ids.length;i++){await page.locator(`.card[data-note="${ids[i]}"]`).click();await expect(page.locator('#text')).toHaveValue(values[i]);await page.locator('#close-editor').click();await page.waitForTimeout(5);}
 await page.waitForTimeout(250);server.length=0;
 for(let i=0;i<samples;i++){
  const noteIndex=i%noteCount,id=ids[noteIndex],expected=values[noteIndex];
  await page.evaluate(expected=>{const p=window.__profile;p.active=true;p.expectedText=expected;p.opens=[];p.inputs=[];p.longTasks=[];p.events=[];p.puts=[];p.replaceCalls=[];p.mutations=0;p.noteReads=[];p.prefetchCount=0;},expected);
  await page.locator(`.card[data-note="${id}"]`).click();
  await expect(page.locator('#editor')).toBeVisible();await expect(page.locator('#text')).toHaveValue(expected);await expect(page.locator('#text')).toBeEnabled();
  const open=await page.evaluate(async()=>{const p=window.__profile,s=p.opens.at(-1);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));s.ready=performance.now();return {...s};});
  const textarea=page.locator('#text');await textarea.focus();await textarea.evaluate(el=>el.setSelectionRange(el.value.length,el.value.length));
  await page.evaluate(()=>{const p=window.__profile;p.inputs=[];p.longTasks=[];p.events=[];p.puts=[];p.replaceCalls=[];p.mutations=0;p.mutationTargets={};p.inputPairStart=performance.now();});
  const pressPairStart=performance.now();await textarea.press('End');await textarea.press('x');const pressPairMs=performance.now()-pressPairStart;await page.evaluate(()=>window.__profile.inputPairEnd=performance.now());
  await page.waitForTimeout(35);for(let n=0;n<5;n++){await page.keyboard.insertText('x');await page.waitForTimeout(35);}
  await page.waitForTimeout(160);
  const profile=await page.evaluate(()=>{const p=window.__profile;const result={inputs:p.inputs.map(x=>({dispatchLagMs:+Math.max(0,x.at-x.event).toFixed(2),handlerMs:x.handlerEnd===null?null:+(x.handlerEnd-x.at).toFixed(2),paintMs:x.paint===null?null:+(x.paint-x.at).toFixed(2)})),longTasks:p.longTasks.filter(x=>x.start>=performance.now()-1000),eventTiming:p.events.map(x=>({name:x.name,duration:+x.duration.toFixed(2),processingDelay:+(x.processingStart-x.start).toFixed(2)})),cachePuts:p.puts,domReplace:p.replaceCalls,editorMutationRecords:p.mutations,mutationTargets:p.mutationTargets,noteReads:p.noteReads.map(x=>({kind:x.kind,start:x.start,end:x.end,ms:x.end===null?null:x.end-x.start})),inputPairStart:p.inputPairStart,inputPairEnd:p.inputPairEnd,prefetchCount:p.prefetchCount};p.active=false;return result;});
  const serverNow=server.splice(0);
  await page.locator('#save').click();await expect(page.locator('#save-status')).toHaveAttribute('data-state','saved',{timeout:10000});values[noteIndex]+='x'.repeat(6);await page.locator('#close-editor').click();
  rows.push({clickToUsableMs:open.ready===null?null:+(open.ready-open.click).toFixed(2),revisionMs:profile.noteReads.find(x=>x.kind==='revision')?.ms??null,pressPairMs,input:profile,requests:serverNow.map(x=>({prefetch:x.prefetch,revision:x.revision,status:x.status,ms:x.ms,bytes:x.bytes})),prefetchCount:profile.prefetchCount});
 }
 const percentile=values=>{const sorted=[...values].filter(Number.isFinite).sort((a,b)=>a-b);return sorted.length?{n:sorted.length,p50Ms:+sorted[Math.floor((sorted.length-1)*.5)].toFixed(2),p95Ms:+sorted[Math.ceil((sorted.length-1)*.95)].toFixed(2)}:{n:0,p50Ms:null,p95Ms:null};};
 const allInputs=rows.flatMap(x=>x.input.inputs),allReads=rows.flatMap(x=>x.input.noteReads),allRequests=rows.flatMap(x=>x.requests),allMutationTargets=rows.flatMap(x=>Object.entries(x.input.mutationTargets)).reduce((a,[k,v])=>(a[k]=(a[k]??0)+v,a),{}),revisionOverlapSamples=rows.filter(x=>{const r=x.input.noteReads.find(n=>n.kind==='revision');return r&&r.start<x.input.inputPairEnd&&r.end>x.input.inputPairStart;}).length,result={date:'2026-10-30',source,variant,samples,fixture:`Synthetic-only in-memory Firestore-compatible API; ${noteCount} small notes; Chromium headless on NAS`,prefetchOff,cacheWritesOff,openClickToUsable:percentile(rows.map(x=>x.clickToUsableMs)),backgroundRevision:percentile(rows.map(x=>x.revisionMs)),fullContentRequest:percentile(allReads.filter(x=>x.kind==='content').map(x=>x.ms)),revisionResponseOverlappedPlaywrightInputPair:{samples:revisionOverlapSamples,total:samples},legacyPlaywrightPressPair:percentile(rows.map(x=>x.pressPairMs)),inputEventDispatchLag:percentile(allInputs.map(x=>x.dispatchLagMs)),inputHandlerSync:percentile(allInputs.map(x=>x.handlerMs)),inputToTwoRaf:percentile(allInputs.map(x=>x.paintMs)),longTasks:{count:rows.reduce((n,x)=>n+x.input.longTasks.length,0),maxMs:Math.max(0,...rows.flatMap(x=>x.input.longTasks.map(t=>t.duration)))},cacheWritesDuringInput:rows.reduce((n,x)=>n+x.input.cachePuts.length,0),maxCachePutSyncMs:+Math.max(0,...rows.flatMap(x=>x.input.cachePuts.map(t=>t.ms))).toFixed(2),editorDomReplaceCalls:rows.reduce((n,x)=>n+x.input.domReplace.length,0),editorMutationTargets:allMutationTargets,requestErrors:allRequests.filter(x=>x.status>=400).length,requests:allRequests.length,responseBytes:allRequests.reduce((n,x)=>n+x.bytes,0),prefetchRequests:allRequests.filter(x=>x.prefetch).length,inputEventSamples:allInputs.length};
 await writeFile(process.env.PROFILE_OUTPUT??'/tmp/typing-profile.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));if(pageErrors.length)throw Error('PAGE_ERRORS '+pageErrors.join(';'));
}finally{await context.close();store.agent.destroy();await browser.close();}
