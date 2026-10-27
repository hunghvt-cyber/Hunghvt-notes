import {createHash} from 'node:crypto';
import {decodeSnapshot} from './store-backup.mjs';
import {parseNote} from './store.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex');
const json=value=>JSON.stringify(value);
export function inspectSnapshot(snapshot){
 const decoded=decodeSnapshot(json(snapshot)),{catalog,records}=decoded,notes=[];
 for(const entry of Object.values(catalog.entries)){
  const value=parseNote(records[entry.head]).value;
  notes.push({id:entry.id,contentHash:sha(json(value)),folder:entry.folder??'',version:entry.version,deleted:entry.deleted===true});
 }
 notes.sort((a,b)=>a.id.localeCompare(b.id));
 const shares=Object.entries(catalog.shares).map(([id,row])=>({id,scope:row.scope,target:row.target,permission:row.permission,revoked:row.revoked===true})).sort((a,b)=>a.id.localeCompare(b.id));
 const receipts=(catalog.receipts??[]).map(x=>({opId:x.opId,noteId:x.noteId??null,requestHash:x.requestHash,result:x.result??Object.fromEntries(Object.entries(x).filter(([k])=>!['opId','noteId','requestHash','createdAt','kind'].includes(k)))})).sort((a,b)=>a.opId.localeCompare(b.opId));
 const erased=Object.fromEntries(Object.entries(catalog.erased??{}).sort(([a],[b])=>a.localeCompare(b)));
 const normalized={epoch:catalog.epoch,folders:Object.keys(catalog.folders).filter(x=>catalog.folders[x]).sort(),order:catalog.noteOrder??[],orderVersion:catalog.orderVersion??0,notes,shares,receipts,erased};
 return {format:decoded.format,counts:{notes:notes.length,active:notes.filter(x=>!x.deleted).length,trash:notes.filter(x=>x.deleted).length,folders:normalized.folders.length,shares:shares.length,activeShares:shares.filter(x=>!x.revoked).length,receipts:receipts.length,erased:Object.keys(normalized.erased).length},fingerprint:sha(json(normalized)),normalized};
}
export function compareSnapshots(source,target,{ignoreEpoch=false,ignoreShares=false,ignoreOrderVersion=false,allowEpochRebase=false}={}){
 const left=inspectSnapshot(source),right=inspectSnapshot(target);
 if(allowEpochRebase&&left.normalized.epoch!==right.normalized.epoch){
  const sourceEpoch=right.normalized.epoch,targetEpoch=left.normalized.epoch;
  const rebase=(value,key='')=>{
   if(typeof value==='string'&&['revision','orderRevision'].includes(key)&&value.startsWith(sourceEpoch+':'))return targetEpoch+value.slice(sourceEpoch.length);
   if(Array.isArray(value))return value.map(x=>rebase(x));
   if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,rebase(v,k)]));
   return value;
  };
  right.normalized=rebase(right.normalized);right.normalized.epoch=targetEpoch;right.fingerprint=sha(json(right.normalized));
 }
 const differences=[];
 if(!ignoreEpoch&&!allowEpochRebase&&left.normalized.epoch!==right.normalized.epoch)differences.push('epoch');
 if(left.fingerprint!==right.fingerprint){
  const rightNotes=new Map(right.normalized.notes.map(x=>[x.id,x]));
  for(const note of left.normalized.notes){const other=rightNotes.get(note.id);if(!other||json(note)!==json(other))differences.push(`note:${note.id}`);}
  if(left.normalized.notes.length!==right.normalized.notes.length)differences.push('note-count');
  if(json(left.normalized.folders)!==json(right.normalized.folders))differences.push('folders');
  if(json(left.normalized.order)!==json(right.normalized.order)||(!ignoreOrderVersion&&left.normalized.orderVersion!==right.normalized.orderVersion))differences.push('order');
  if(!ignoreShares&&json(left.normalized.shares)!==json(right.normalized.shares))differences.push('shares');
  if(json(left.normalized.receipts)!==json(right.normalized.receipts))differences.push('idempotency-receipts');
  if(json(left.normalized.erased)!==json(right.normalized.erased))differences.push('purge-tombstones');
 }
 return {match:differences.length===0,source:{counts:left.counts,fingerprint:left.fingerprint},target:{counts:right.counts,fingerprint:right.fingerprint},differences:[...new Set(differences)].slice(0,20)};
}
