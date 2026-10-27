import {createInboxHandler} from '../lib/inbox.mjs';
import {createApplicationStore} from '../lib/app-config.mjs';
const handler=createInboxHandler({makeStore:createApplicationStore});
export default {fetch:handler};
export const POST=handler;
