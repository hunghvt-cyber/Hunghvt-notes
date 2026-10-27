import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';

const isLocal=host=>['localhost','127.0.0.1','::1','[::1]'].includes(String(host??'').replace(/^\[|\]$/g,''));
function optionsFrom(args){
 const first=args[0],second=args[1];
 if(first instanceof URL)return {hostname:first.hostname};
 if(typeof first==='string'&&/^https?:\/\//i.test(first)){try{return {hostname:new URL(first).hostname};}catch{}}
 if(first&&typeof first==='object')return first;
 if(second&&typeof second==='object')return second;
 if(typeof first==='number'&&typeof second==='string')return {hostname:second};
 return {hostname:'localhost'};
}
function check(args){
 const opts=optionsFrom(args),host=opts.hostname??opts.host??'localhost';
 if(opts.socketPath||isLocal(host))return;
 throw Error('LIVE_NETWORK_DISABLED_IN_OFFLINE_TESTS');
}
function wrapRequest(module){
 for(const method of ['request','get']){
  if(typeof module[method]!=='function')continue;
  const original=module[method];
  module[method]=function(...args){check(args);return original.apply(this,args);};
 }
}
wrapRequest(http);wrapRequest(https);
for(const [module,method] of [[net,'connect'],[tls,'connect']]){
 const original=module[method];module[method]=function(...args){check(args);return original.apply(this,args);};
}
const originalFetch=globalThis.fetch;
globalThis.fetch=async(input,...args)=>{
 const url=input instanceof URL?input:new URL(typeof input==='string'?input:input.url);
 if(!isLocal(url.hostname))throw Error('LIVE_NETWORK_DISABLED_IN_OFFLINE_TESTS');
 return originalFetch(input,...args);
};
