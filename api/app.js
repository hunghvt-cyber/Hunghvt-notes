import {createAppHandler} from '../lib/app-config.mjs';
const handler=createAppHandler();
export default {fetch:handler};
export const GET=handler;
export const POST=handler;
export const DELETE=handler;
