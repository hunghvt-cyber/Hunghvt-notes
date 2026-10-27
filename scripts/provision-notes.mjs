import {NoteStore} from '../lib/store.mjs';
import {provisionStore} from '../lib/production-store.mjs';
import {credentials} from './live-config.mjs';
const namespace=process.env.NOTES_DATA_NAMESPACE;
if(process.env.NOTES_PROVISION!=='CREATE_FRESH_NOTES_STORE'||!/^Hunghvt-Notes-Data-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(namespace??''))throw Error('PROVISION_DISABLED');
const c=credentials(process.env),store=new NoteStore({user:c.user,password:c.password,namespace});
try{const result=await provisionStore(store);console.log(JSON.stringify({kind:'NOTES_PROVISION',...result}));}catch(e){console.error(JSON.stringify({kind:'NOTES_PROVISION',passed:false,code:/^[A-Z_]{1,90}$/.test(e.message)?e.message:'PROVISION_UNCONFIRMED'}));process.exitCode=1;}finally{store.agent.destroy();}
