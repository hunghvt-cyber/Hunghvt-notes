const clone=value=>{
 if(Buffer.isBuffer(value))return Buffer.from(value);
 if(value instanceof Uint8Array)return new Uint8Array(value);
 if(Array.isArray(value))return value.map(clone);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,clone(v)]));
 return value;
};
class Snapshot{constructor(id,value){this.id=id;this.exists=value!==undefined;this._value=clone(value);}data(){return clone(this._value);}}
class DocumentReference{
 constructor(db,path){this.db=db;this.path=path;this.id=path.split('/').at(-1);}
 collection(id){return new CollectionReference(this.db,this.path+'/'+id);}
 async get(){return new Snapshot(this.id,this.db.docs.get(this.path));}
}
class CollectionReference{
 constructor(db,path){this.db=db;this.path=path;}
 doc(id){return new DocumentReference(this.db,this.path+'/'+id);}
 async get(){const prefix=this.path+'/',docs=[];for(const [path,value]of this.db.docs){if(!path.startsWith(prefix))continue;const rest=path.slice(prefix.length);if(!rest.includes('/'))docs.push(new Snapshot(rest,value));}return {docs};}
}
export class FakeFirestore{
 constructor(){this.docs=new Map();this.tail=Promise.resolve();}
 collection(id){return new CollectionReference(this,id);}
 async runTransaction(callback){let release;const previous=this.tail;this.tail=new Promise(resolve=>release=resolve);await previous;const writes=[];
  const tx={get:async ref=>new Snapshot(ref.id,this.docs.get(ref.path)),create:(ref,data)=>writes.push({kind:'create',ref,data:clone(data)}),set:(ref,data)=>writes.push({kind:'set',ref,data:clone(data)}),delete:ref=>writes.push({kind:'delete',ref})};
  try{const result=await callback(tx);for(const w of writes){if(w.kind==='delete')this.docs.delete(w.ref.path);else this.docs.set(w.ref.path,clone(w.data));}return result;}finally{release();}
 }
}
