// Dedicated Notes secrets only. Never read or decode the backup rclone config.
let diagnosed=false;
export function diagnoseOidc(token){
 if(diagnosed)return;diagnosed=true;
 let c={},h={};try{const p=token.split('.');c=JSON.parse(Buffer.from(p[1],'base64url'));h=JSON.parse(Buffer.from(p[0],'base64url'));}catch{}
 const repo='hunghvt-cyber/web-notes',ref='refs/heads/split/notes-standalone',now=Date.now()/1000;
 console.log(JSON.stringify({kind:'oidc-context-check',repository:c.repository===repo,repositoryId:String(c.repository_id)==='1423348828',ownerId:String(c.repository_owner_id)==='252749231',ref:c.ref===ref,subject:c.sub==='repo:hunghvt-cyber@252749231/web-notes@1423348828:ref:'+ref,workflow:c.workflow_ref===repo+'/.github/workflows/notes-preview-qualify.yml@'+ref,event:c.event_name==='push',audience:c.aud==='homepage-koofr-synthetic-benchmark-v1',issuer:c.iss==='https://token.actions.githubusercontent.com',algorithm:h.alg==='RS256',lifetime:Number.isFinite(c.exp)&&Number.isFinite(c.iat)&&c.exp>now&&c.iat<=now+30&&c.iat>=now-600&&c.exp-c.iat<=600,run:String(c.run_id)===process.env.GITHUB_RUN_ID}));
}
export function credentials(env){
 const user=env.KOOFR_WEBDAV_USER,password=env.KOOFR_WEBDAV_APP_PASSWORD;
 if(typeof user!=='string'||!user||user.length>300||/[:\r\n]/.test(user)||typeof password!=='string'||!password||/[\r\n]/.test(password))throw Error('ONE_TIME_SETUP_REQUIRED');
 return {user,password,source:'dedicated_webdav_secret'};
}
export function previewEndpoint(value){
 let u;try{u=new URL(value);}catch{throw Error('PREVIEW_URL_REQUIRED');}
 // Exact immutable deployment URL, not a custom domain, alias or redirect.
 if(u.protocol!=='https:'||u.origin!==value||!/^homepage-koofr-[a-z0-9]+-hunghvt\.vercel\.app$/.test(u.hostname))throw Error('PREVIEW_URL_FORBIDDEN');
 return u.origin+'/api/bench';
}
