import {createFirestoreKoofrRollbackHandler} from '../lib/firestore-koofr-rollback.mjs';
const handler=createFirestoreKoofrRollbackHandler();
export default {fetch:handler};
export const GET=handler;
export const POST=handler;
