// Portable browser modules derived from the reviewed JSON catalogs. Observable
// 1.13's module parser does not support JSON import attributes.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),check=process.argv.slice(2).includes('--check');
for(const name of ['product-editions','service-offerings','consultancy-demo','consultancy-output-preview']) {
  const path=resolve(root,'src/data',name),raw=await readFile(path+'.json'),value=JSON.parse(raw);
  const module=`// Generated from ${name}.json; source SHA256 ${createHash('sha256').update(raw).digest('hex')}.\n// Regenerate with node tools/build-product-catalog.mjs.\nexport default ${JSON.stringify(value,null,2)};\n`;
  if(check){if(await readFile(path+'.js','utf8')!==module)throw Error(`${name} browser catalog differs from its reviewed JSON source.`);}
  else await writeFile(path+'.js',module);
}
console.log(check?'Product browser catalogs match their reviewed sources.':'Generated portable product browser catalogs.');
