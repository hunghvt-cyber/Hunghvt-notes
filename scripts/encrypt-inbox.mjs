// Run locally: node scripts/encrypt-inbox.mjs PRIVATE_PAYLOAD.json ENVELOPE.json
// Public key only. Never commit the plaintext input.
import {readFile,writeFile} from 'node:fs/promises';
import {randomBytes,publicEncrypt,constants,createCipheriv} from 'node:crypto';
export function encryptInbox(payload,publicKey){
 const key=randomBytes(32),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
 cipher.setAAD(Buffer.from('hunghvt-notes-code-inbox-v1'));
 const data=Buffer.concat([cipher.update(JSON.stringify(payload),'utf8'),cipher.final()]);
 const wrapped=publicEncrypt({key:publicKey,oaepHash:'sha256',padding:constants.RSA_PKCS1_OAEP_PADDING},key);key.fill(0);
 return {v:1,key:wrapped.toString('base64url'),iv:iv.toString('base64url'),tag:cipher.getAuthTag().toString('base64url'),data:data.toString('base64url')};
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 const [input,output]=process.argv.slice(2);if(!input||!output)throw Error('INPUT_AND_OUTPUT_REQUIRED');
 const payload=JSON.parse(await readFile(input,'utf8'));
 const publicKey=await readFile(new URL('../.notes-inbox/public-key.pem',import.meta.url),'utf8');
 await writeFile(output,JSON.stringify(encryptInbox(payload,publicKey))+'\n',{mode:0o600});
 console.log('ENCRYPTED; publish only the output envelope, never the input.');
}
