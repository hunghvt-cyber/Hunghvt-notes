import {createInboxHandler} from '../lib/inbox.mjs';
const handler=createInboxHandler();
export default {fetch:handler};
export const POST=handler;
