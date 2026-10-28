import {readdir,readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import path from 'node:path';

const roots=['api','lib','scripts'];
const markers=['Warning: truncated '+'output','Total output '+'lines:','Output exceeded the available '+'model context'];
async function files(dir){
 const found=[];
 for(const entry of await readdir(dir,{withFileTypes:true})){
  const full=path.join(dir,entry.name);
  if(entry.isDirectory())found.push(...await files(full));
  else if(entry.isFile()&&/\.(?:js|mjs)$/.test(entry.name))found.push(full);
 }
 return found;
}
const sourceFiles=(await Promise.all(roots.map(files))).flat().sort();
const moduleFiles=sourceFiles.filter(file=>/[/\\](?:api|lib)[/\\]/.test(file));
if(!sourceFiles.length)throw new Error('SOURCE_CHECK_NO_FILES');
for(const file of sourceFiles){
 const source=await readFile(file,'utf8');
 if(markers.some(marker=>source.includes(marker)))throw new Error(`SOURCE_TRUNCATION_MARKER:${file}`);
 const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
 if(result.status!==0)throw new Error(`SOURCE_SYNTAX_FAILED:${file}:${result.status??'spawn'}`);
}
for(const file of moduleFiles){
 try{await import(pathToFileURL(path.resolve(file)).href+'?source-check='+Date.now());}
 catch(error){throw new Error(`SOURCE_IMPORT_FAILED:${file}:${error?.name??'Error'}`);}
}
process.stdout.write(JSON.stringify({event:'source_check_pass',files:sourceFiles.length,syntax:true,imports:true,truncationMarkers:false})+'\n');
