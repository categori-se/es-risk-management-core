// Build the optional authenticated source closure. No uploads or AWS calls.
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {deflateRawSync} from 'node:zlib';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
// Same fixed-entry ZIP convention as the app's access backend: sorted names,
// fixed DOS epoch, no host paths, no credentials, no directory traversal.
function archive(assets){const local=[],central=[];let offset=0;for(const [name,bytes]of [...assets].sort(([a],[b])=>a.localeCompare(b))){const compressed=deflateRawSync(bytes),filename=Buffer.from(name);let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}crc=(crc^0xffffffff)>>>0;const l=Buffer.alloc(30),c=Buffer.alloc(46);l.writeUInt32LE(0x04034b50);l.writeUInt16LE(20,4);l.writeUInt16LE(8,8);l.writeUInt16LE(33,12);l.writeUInt32LE(crc,14);l.writeUInt32LE(compressed.length,18);l.writeUInt32LE(bytes.length,22);l.writeUInt16LE(filename.length,26);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(8,10);c.writeUInt16LE(33,14);c.writeUInt32LE(crc,16);c.writeUInt32LE(compressed.length,20);c.writeUInt32LE(bytes.length,24);c.writeUInt16LE(filename.length,28);c.writeUInt32LE(offset,42);local.push(l,filename,compressed);central.push(c,filename);offset+=l.length+filename.length+compressed.length;}const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(assets.size,8);end.writeUInt16LE(assets.size,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...local,directory,end]);}
export async function buildCommunityAuthenticated({out=join(root,'.build/authenticated-api')}={}){
  const manifest=JSON.parse(await readFile(join(root,'community-source-manifest.json')));if(manifest.format!=='esia-community-source-candidate')throw Error('Build only from the generated community candidate, with its optional dependencies installed.');
  await mkdir(out,{recursive:true});const hash=value=>createHash('sha256').update(value).digest('hex'),rendererSha=hash(await readFile(join(root,'server/engagement-exports.mjs')));
  const result=await build({absWorkingDir:root,entryPoints:['deploy/community/authenticated/lambda.mjs'],outfile:join(out,'index.mjs'),bundle:true,format:'esm',platform:'node',target:'node24',metafile:true,external:['./xhr-sync-worker.js'],define:{__ESIA_ENGAGEMENT_RENDERER_SOURCE_SHA256__:JSON.stringify(rendererSha),__ESIA_COMMUNITY_SOURCE_TREE_SHA256__:JSON.stringify(manifest.sourceTreeSha256)},banner:{js:'import {createRequire as esiaCreateRequire} from "node:module"; const require = esiaCreateRequire(import.meta.url);'}});
  // jsdom uses an adjacent XHR worker; include its real closure, even though no
  // processing in the accepted manual journey invokes cross-origin XHR.
  const worker=join(root,'node_modules/jsdom/lib/jsdom/living/xhr/xhr-sync-worker.js');
  await build({absWorkingDir:root,entryPoints:[worker],outfile:join(out,'xhr-sync-worker.js'),bundle:true,format:'cjs',platform:'node',target:'node24'});
  await writeFile(join(out,'package.json'),'{"type":"commonjs"}\n');
  const assets=new Map(await Promise.all(['index.mjs','xhr-sync-worker.js','package.json'].map(async path=>[path,await readFile(join(out,path))]))),zip=archive(assets);await writeFile(join(out,'esia-community-access.zip'),zip);
  const receipt={format:'esia-community-authenticated-build',schemaVersion:1,sourceTreeSha256:manifest.sourceTreeSha256,runtime:'nodejs24.x',entry:'index.handler',deployed:false,customerAcceptance:false,inputs:Object.keys(result.metafile.inputs).sort(),files:[...assets].map(([path,bytes])=>({path,size:bytes.length,sha256:hash(bytes)})),artifact:{path:'esia-community-access.zip',size:zip.length,sha256:hash(zip)}};
  await writeFile(join(out,'manifest.json'),JSON.stringify(receipt,null,2)+'\n');return receipt;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const args=process.argv.slice(2);if(args.length&&(args.length!==2||args[0]!=='--out'))throw Error('Usage: node tools/build-community-authenticated.mjs [--out /external/build-output]');const receipt=await buildCommunityAuthenticated(args.length?{out:resolve(args[1])}:{});console.log(JSON.stringify({...receipt,inputs:receipt.inputs.length},null,2));}
