import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
test('qualification driver reaches safety gate without a JavaScript initialization failure',async()=>{
 const cwd=await mkdtemp(join(tmpdir(),'notes-driver-'));
 try{
  const result=await promisify(execFile)(process.execPath,[fileURLToPath(new URL('../scripts/koofr_preview_qualification.mjs',import.meta.url))],{cwd,env:{PATH:process.env.PATH,NOTES_PREVIEW_URL:'https://homepage-koofr-example123-hunghvt.vercel.app'}}).catch(e=>e);
  assert.equal(result.code,1);
  const report=JSON.parse(result.stdout.trim());
  assert.deepEqual(report.errors,[{code:'TEST_DISABLED'}]);
  assert.equal(report.stages.length,0);
 }finally{await rm(cwd,{recursive:true,force:true});}
});
