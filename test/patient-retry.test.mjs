import test from 'node:test';
import assert from 'node:assert/strict';
import {patientRetry,apiClient} from '../public/sync.js';

test('patient delivery survives more than three busy responses with dispersed waits',async()=>{
 let calls=0,now=0;const delays=[];
 const result=await patientRetry(async()=>{if(++calls<=10)throw Object.assign(Error('BUSY'),{status:423});return 'ack';},{now:()=>now,random:()=>.5,wait:async ms=>{delays.push(ms);now+=ms;}});
 assert.equal(result,'ack');assert.equal(calls,11);assert.equal(delays.length,10);assert.ok(delays.every(ms=>ms>=1000&&ms<10000));
});
test('terminal errors never retry, including conflict, revoked permission and missing note',async()=>{
 for(const status of [400,401,403,404,409,413,429]){let calls=0;await assert.rejects(patientRetry(async()=>{calls++;throw Object.assign(Error('terminal'),{status});},{wait:async()=>assert.fail('terminal error waited')}),e=>e.status===status);assert.equal(calls,1);}
});
test('patient delivery stops within its retry budget and honors cancellation',async()=>{
 let now=0,calls=0;await assert.rejects(patientRetry(async()=>{calls++;throw Object.assign(Error('BUSY'),{status:423});},{now:()=>now,random:()=>.5,wait:async ms=>{now+=ms;}}),e=>e.status===423);assert.ok(now<120000);assert.ok(calls<=32);
 let active=true;calls=0;await assert.rejects(patientRetry(async()=>{calls++;throw TypeError('network');},{canContinue:()=>active,wait:async()=>{active=false;}}),e=>e.cancelled);assert.equal(calls,1);
});
test('patient wrapper controls GET attempts without nested legacy retry loops',async()=>{
 let calls=0;const client=apiClient({getRetries:0,fetcher:async()=>{calls++;return Response.json({code:'BUSY'},{status:423});}});
 await assert.rejects(patientRetry(()=>client('notes'),{maxAttempts:5,wait:async()=>{}}),e=>e.status===423);assert.equal(calls,5);
});
