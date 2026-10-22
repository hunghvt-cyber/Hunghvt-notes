import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {newCapability} from '../lib/store.mjs';
import {protectShareToken,revealShareToken} from '../lib/share-links.mjs';

test('encrypted copy is randomized and bound to account, namespace, key, scope, target and link ID',()=>{
 const cfg={sessionPassword:randomUUID()+randomUUID(),namespace:'synthetic-root',user:'fake'},link=newCapability();
 const box=protectShareToken(link.token,cfg,'folder','Shared'),next=protectShareToken(link.token,cfg,'folder','Shared');
 assert.notEqual(box,next);assert.ok(!box.includes(link.token));assert.equal(revealShareToken(box,cfg,'folder','Shared',link.id),link.token);
 for(const [config,scope,target,id]of [
  [{...cfg,user:'other'},'folder','Shared',link.id],
  [{...cfg,namespace:'other'},'folder','Shared',link.id],
  [{...cfg,sessionPassword:'rotated-key'},'folder','Shared',link.id],
  [cfg,'note','Shared',link.id],[cfg,'folder','other',link.id],[cfg,'folder','Shared',newCapability().id]
 ])assert.equal(revealShareToken(box,config,scope,target,id),undefined);
});
test('legacy, malformed and tampered copy data fails closed',()=>{
 const cfg={sessionPassword:'x'.repeat(64),namespace:'fake',user:'fake'},link=newCapability(),box=protectShareToken(link.token,cfg,'note','id');
 for(const value of [undefined,null,{},'',link.token,'v2.'+box.slice(3),box.slice(0,50),box.slice(0,30)+(box[30]==='A'?'B':'A')+box.slice(31)])assert.equal(revealShareToken(value,cfg,'note','id',link.id),undefined);
});
