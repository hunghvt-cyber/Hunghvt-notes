import {createKoofrMigrationExportHandler} from '../lib/koofr-migration-export.mjs';
const handler=createKoofrMigrationExportHandler();
export default {fetch:handler};
export const GET=handler;
export const POST=handler;
