import {readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const files=(await readdir(path.join(root,'test')))
 .filter(name=>name.endsWith('.test.mjs'))
 .sort()
 .map(name=>path.join('test',name));
if(!files.length)throw Error('NO_TEST_FILES');

const env={...process.env};
for(const name of [
 'KOOFR_WEBDAV_USER','KOOFR_WEBDAV_APP_PASSWORD','KOOFR_WEBDAV_PROBE',
 'NOTES_MAINTENANCE','NOTES_PROVISION','NOTES_DATA_NAMESPACE',
 'NOTES_INBOX_ENABLED','NOTES_INBOX_PRIVATE_KEY','NOTES_PREVIEW_URL',
 'NOTES_SECOND_PREVIEW_URL','ACTIONS_ID_TOKEN_REQUEST_URL',
 'ACTIONS_ID_TOKEN_REQUEST_TOKEN'
])delete env[name];
env.NOTES_OFFLINE_TESTS='1';

const result=spawnSync(process.execPath,[
 '--import',path.join(root,'scripts/test-network-guard.mjs'),
 '--test',...files
],{cwd:root,env,stdio:'inherit'});
if(result.error)throw result.error;
process.exitCode=result.status??1;
