import test from 'node:test';
import assert from 'node:assert/strict';
import {PerformanceDiagnostics,diagnosticsRequested} from '../public/performance-diagnostics.js';

test('diagnostics stay off by default and disabled hooks do not read the clock',()=>{
 let reads=0;
 const diagnostics=new PerformanceDiagnostics({clock:()=>{reads++;throw Error('clock used while off');}});
 assert.equal(diagnostics.enabled,false);
 assert.equal(diagnostics.begin('list'),null);
 diagnostics.phase(null,'network_ms',1);diagnostics.request(null);diagnostics.error(null,503);diagnostics.finish(null);diagnostics.markInput();
 assert.equal(reads,0);assert.deepEqual(diagnostics.summary(),{version:1,sample_limit:120,samples_retained:0,groups:[]});
});

test('opt-in summary contains only bounded timing, cache, request, and allowed error data',()=>{
 let time=10;
 const diagnostics=new PerformanceDiagnostics({enabled:true,clock:()=>time,frame:callback=>callback()});
 const trace=diagnostics.begin('open_note',{state:'clean',cache:'hit'});
 trace.id='must-not-export';trace.title='must-not-export';
 diagnostics.request(trace);diagnostics.phase(trace,'queue_wait_ms',4);diagnostics.phase(trace,'network_ms',21);diagnostics.phase(trace,'content_assign_ms',2);diagnostics.error(trace,409);diagnostics.error(trace,418);
 diagnostics.phase(trace,'server_pre_response_ms',18);diagnostics.phase(trace,'server_store_operation_ms',15);
 time=40;diagnostics.afterUpdate(trace,20);diagnostics.finish(trace);
 const result=diagnostics.summary();
 assert.deepEqual(result.groups[0],{
  flow:'open_note',editor:'clean',cache:'hit',samples:1,requests:1,
  phases:{queue_wait_ms:{count:1,p50_ms:4,p95_ms:4,min_ms:4,max_ms:4},network_ms:{count:1,p50_ms:21,p95_ms:21,min_ms:21,max_ms:21},content_assign_ms:{count:1,p50_ms:2,p95_ms:2,min_ms:2,max_ms:2},server_pre_response_ms:{count:1,p50_ms:18,p95_ms:18,min_ms:18,max_ms:18},server_store_operation_ms:{count:1,p50_ms:15,p95_ms:15,min_ms:15,max_ms:15},frame_after_update_ms:{count:1,p50_ms:20,p95_ms:20,min_ms:20,max_ms:20}},errors:{'409':1,network:1}
 });
 const json=JSON.stringify(result);
 assert.doesNotMatch(json,/must-not-export|title|id|url|token|session|folder/i);
});

test('cache miss reasons export only fixed enum counts',()=>{
 const diagnostics=new PerformanceDiagnostics({enabled:true,clock:()=>1}),trace=diagnostics.begin('open_note',{cache:'miss'});
 diagnostics.cacheMissReason(trace,'note_too_large');diagnostics.cacheMissReason(trace,'private-id-must-not-export');diagnostics.finish(trace);
 assert.deepEqual(diagnostics.summary().groups[0].cache_miss_reasons,{note_too_large:1});
 assert.doesNotMatch(JSON.stringify(diagnostics.summary()),/private-id|title|session|token/i);
});

test('RAM sample buffer remains capped and diagnostic query is explicit',()=>{
 let time=0;const diagnostics=new PerformanceDiagnostics({enabled:true,clock:()=>++time});
 for(let i=0;i<125;i++){const sample=diagnostics.begin('save',{state:'dirty'});diagnostics.finish(sample);}
 assert.equal(diagnostics.samples.length,120);assert.equal(diagnostics.summary().samples_retained,120);
 assert.equal(diagnosticsRequested('?diag=1'),true);assert.equal(diagnosticsRequested(''),false);assert.equal(diagnosticsRequested('?diag=0'),false);
});

test('in-flight traces are capped and clear also drops pending samples',()=>{
 let time=0;const diagnostics=new PerformanceDiagnostics({enabled:true,clock:()=>++time});
 const traces=Array.from({length:12},()=>diagnostics.begin('open_note'));
 assert.equal(traces.filter(Boolean).length,8);assert.equal(diagnostics.active.size,8);
 diagnostics.clear();assert.equal(diagnostics.active.size,0);
 for(const trace of traces)diagnostics.finish(trace);
 assert.equal(diagnostics.samples.length,0);
});

test('input-to-ACK is recorded once against the acknowledged session version',()=>{
 let time=100;const diagnostics=new PerformanceDiagnostics({enabled:true,clock:()=>time,frame:()=>{}}),session={},trace=diagnostics.begin('save');
 diagnostics.markInput(session,1);time=115;diagnostics.markInput(session,2);time=140;
 diagnostics.acknowledgeInput(trace,session,1);diagnostics.acknowledgeInput(trace,session,1);diagnostics.finish(trace);
 assert.equal(trace.phases.input_to_ack_ms,40);
 const next=diagnostics.begin('save');diagnostics.acknowledgeInput(next,session,2);diagnostics.finish(next);
 assert.equal(next.phases.input_to_ack_ms,25);
});

test('open-note measures first content separately and omits flow total',()=>{
 let time=10,frameCallback;const diagnostics=new PerformanceDiagnostics({enabled:true,clock:()=>time,frame:fn=>{frameCallback=fn;}}),trace=diagnostics.begin('open_note');
 time=18;diagnostics.firstContent(trace,18);diagnostics.afterUpdate(trace,18);time=45;diagnostics.afterUpdate(trace,18,true);frameCallback();diagnostics.finish(trace);
 assert.equal(trace.phases.click_to_content_assign_ms,8);
 assert.equal(trace.phases.click_to_first_frame_ms,35);
 assert.equal(trace.phases.flow_total_ms,undefined);
});
