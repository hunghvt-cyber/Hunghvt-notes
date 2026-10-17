// Dedicated Notes secrets only. Never read or decode the backup rclone config.
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
