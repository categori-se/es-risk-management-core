// Deliberately invoked once. Never starts a worker, imports a real client, or
// enables AI. Use a new isolated data directory; never production storage.
import {resolve,join} from 'node:path';
import {mkdir,writeFile,lstat} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createAccountWorkspace} from '../server/local-account-workspace.mjs';

export async function seedCommunityDemo(directory){
  directory=resolve(directory);try{await lstat(directory);throw Error('Choose a new empty demonstration data directory.');}catch(error){if(error.code!=='ENOENT')throw error;}
  await mkdir(directory,{mode:0o700});const workspace=createAccountWorkspace({directory});
  try{const store=workspace.forAccount('local-default');let project=store.createProject({name:'Synthetic Riverlink infrastructure',client:'Example client A — synthetic',phase:'Due diligence',period:'2026 synthetic'});
    const apply=command=>project=store.mutate(project.id,project.revision,command);
    for(const [filename,title,text]of [['esia.txt','Synthetic ESIA','Synthetic ESIA: construction noise requires monitored response measures.'],['rap.txt','Synthetic RAP','Synthetic RAP: livelihood support is planned; completion evidence is missing.'],['sep.txt','Synthetic SEP','Synthetic SEP: meetings are planned; dated consultation records are missing.'],['biodiversity.txt','Synthetic biodiversity study','Synthetic biodiversity study: seasonal survey coverage is incomplete.']])apply({type:'intake',mode:'managed',title,filename,mediaType:'text/plain',contentBase64:Buffer.from(text).toString('base64')});
    const engagement=store.engagements().create({projectId:project.id,actorId:'Synthetic preparer',name:'Synthetic client due diligence',client:'Example client A — synthetic',type:'due_diligence',scope:['Inspect four synthetic studies','Record criteria, findings and action verification'],exclusions:'No real compliance conclusion or professional acceptance',agreementVersionIds:[project.resources[0].versions[0].id],roles:{preparer:['Synthetic preparer'],reviewer:['Synthetic reviewer'],approver:['Synthetic approver'],client:[]},frameworkIds:['ifc_ps_2012'],clientAcceptanceRequired:false,dataRules:'Synthetic demonstration; AI disabled until explicitly configured.'});
    const receipt={format:'esia-community-synthetic-demo',schemaVersion:1,synthetic:true,projectId:project.id,engagementId:engagement.id,dataDirectory:directory,url:`http://127.0.0.1:4173/engagements?project=${project.id}`,aiRequests:0,sourceVersions:project.resources.map(row=>({versionId:row.versions[0].id,sha256:row.versions[0].sha256}))};
    await writeFile(join(directory,'synthetic-demo.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx',mode:0o600});return receipt;
  }finally{workspace.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const args=process.argv.slice(2);if(args.length!==2||args[0]!=='--data')throw Error('Usage: node tools/seed-community-demo.mjs --data /new/private/synthetic-directory');console.log(JSON.stringify(await seedCommunityDemo(args[1]),null,2));}
