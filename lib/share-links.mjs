import {createCipheriv,createDecipheriv,createHmac,randomBytes} from 'node:crypto';

const tokenPattern=/^[a-f0-9]{32}\.[a-f0-9]{64}$/;
const key=cfg=>createHmac('sha256',cfg.sessionPassword).update(JSON.stringify(['notes-share-copy-v1',cfg.namespace,cfg.user])).digest();
const context=(scope,target,id)=>Buffer.from(JSON.stringify(['notes-share-copy-v1',scope,target,id]));

// The capability hash remains the authorization mechanism. This owner-only copy
// is encrypted at rest and bound to its account, namespace, scope, target and ID.
export function protectShareToken(token,cfg,scope,target){
 if(!tokenPattern.test(token))throw Error('INVALID_SHARE_TOKEN');
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(cfg),iv);
 cipher.setAAD(context(scope,target,token.split('.')[0]));
 const encrypted=Buffer.concat([cipher.update(token,'utf8'),cipher.final()]);
 return 'v1.'+Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString('base64url');
}
export function revealShareToken(box,cfg,scope,target,id){
 try{
  if(typeof box!=='string'||!/^v1\.[A-Za-z0-9_-]{167}$/.test(box))return undefined;
  const bytes=Buffer.from(box.slice(3),'base64url'),decipher=createDecipheriv('aes-256-gcm',key(cfg),bytes.subarray(0,12));
  decipher.setAuthTag(bytes.subarray(12,28));decipher.setAAD(context(scope,target,id));
  const token=Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString('utf8');
  return tokenPattern.test(token)&&token.startsWith(id+'.')?token:undefined;
 }catch{return undefined;}
}
