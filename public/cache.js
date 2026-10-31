// This database stores only authenticated list previews and sort preferences.
// The legacy draft database is intentionally neither opened nor modified.
export class NoteCache {
 constructor(){this.db=null;}
 async tx(mode,fn){
  if(!this.db)this.db=await new Promise((resolve,reject)=>{const r=indexedDB.open('hunghvt-notes-cache-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('cache',{keyPath:'scope'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  return new Promise((resolve,reject)=>{const t=this.db.transaction('cache',mode),r=fn(t.objectStore('cache'));t.oncomplete=()=>resolve(r.result);t.onerror=t.onabort=()=>reject(t.error);});
 }
 async get(scope){return scope?await this.tx('readonly',s=>s.get(scope)):null;}
 async put(scope,value){if(scope)await this.tx('readwrite',s=>s.put({...value,scope}));}
 async delete(scope){if(scope)await this.tx('readwrite',s=>s.delete(scope));}
 async clearAll(){await this.tx('readwrite',s=>s.clear());}
}
export function reusableNote(note,row){return !!note&&!!row&&note.id===row.id&&note.revision===row.revision;}
export function cachedNoteSize(note){try{return new TextEncoder().encode(JSON.stringify(note)).byteLength;}catch{return Infinity;}}
export const MAX_CACHED_NOTE_BYTES=256*1024;
export const MAX_CACHED_CONTENT_BYTES=1024*1024;
export const MAX_CACHED_NOTES=12;
export const MAX_CACHED_LIST_BYTES=512*1024;
export const MAX_CACHED_LIST_NOTES=1000;
