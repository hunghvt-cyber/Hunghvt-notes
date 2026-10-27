import {randomUUID,createHash} from 'node:crypto';
import {StoreError,parseCatalog,pool} from './store.mjs';
import {hash,lockXml,validToken} from './storage.mjs';
import {encodeSnapshot,decodeSnapshot} from './store-backup.mjs';
const need=(ok,code)=>{if(!ok)throw new StoreError(503,code);};
export async function provisionStore(store){
 const d=store.dav(),marker=store.dav('restore-control.json');let token;
 const created=await d.call('provision-create','MKCOL',undefined,{},true);
 need([201,405].includes(created.status),'PROVISION_CREATE_FAILED');
 try{
  const l=await d.call('provision-lock','LOCK',lockXml,{Depth:'infinity',Timeout:'Second-60'},true);need([200,201].includes(l.status)&&validToken(l.token),'PROVISION_LOCK_FAILED');token=l.token;
  const expected=JSON.stringify({format:'hunghvt-notes-empty-v1',namespaceHash:createHash('sha256').update(store.input.namespace).digest('hex')});
  const m=await marker.call('provision-marker-read','GET');
  if(m.status===404){need(created.status===201,'PROVISION_UNOWNED_ROOT');need((await d.call('provision-empty-check','GET')).status===404,'PROVISION_OCCUPIED');await put(marker,'provision-marker',expected,token);}
  else need(m.status===200&&m.text===expected,'PROVISION_MARKER_MISMATCH');
  const r=await d.call('provision-catalog-read','GET');
  if(r.status===200){const cat=parseCatalog(r.text);return {initialized:true,replay:true,count:Object.keys(cat.entries).length};}
  need(r.status===404,'PROVISION_READ_FAILED');
  const cat={schema:1,epoch:randomUUID(),version:0,restoring:false,folders:{},entries:{},shares:{},receipts:[]};
  await put(d,'provision-catalog',JSON.stringify(cat),token);return {initialized:true,replay:false,count:0};
 }finally{if(token)await d.call('provision-unlock','UNLOCK',undefined,{'Lock-Token':token},true).catch(()=>{});}
}
async function put(d,label,text,token){let r;try{r=await d.call(label,'PUT',text,{If:'('+token+')'});}catch{}if(r)need([200,201,204].includes(r.status),'PROVISION_PUT_FAILED');const verify=await d.call(label+'-verify','GET');need(verify.status===200&&verify.text===text,'PROVISION_UNCONFIRMED');}
export async function downloadSnapshot(store){
 if(typeof store.exportLegacySnapshot==='function')return store.exportLegacySnapshot();
 // Capture catalog under LOCK; immutable files remain readable after lock release.
 const catalog=await store.capture();need(!catalog.restoring,'RESTORE_INCOMPLETE');need(!Object.values(catalog.entries).some(e=>e.purge),'PURGE_IN_PROGRESS');const records={};
 await pool(Object.values(catalog.entries),async e=>{const r=await store.dav(e.head).call('download-snapshot-read','GET');need(r.status===200&&hash(r.text)===e.headHash,'BACKUP_NOTE_MISMATCH');records[e.head]=r.text;});
 const text=encodeSnapshot(catalog,records);if(Buffer.byteLength(text)>2000000)throw new StoreError(413,'SNAPSHOT_TOO_LARGE');decodeSnapshot(text);return JSON.parse(text);
}
