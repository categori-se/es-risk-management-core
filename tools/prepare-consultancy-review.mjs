#!/usr/bin/env node
import {readFile,writeFile,lstat} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {createConsultancyOperationsPacket,validateConsultancyOperationsPacket} from '../src/lib/consultancy-operations.js';

export async function prepareConsultancyReview(args=process.argv.slice(2)){
  const [operation,path,...flags]=args;
  if(!['--template','--check'].includes(operation)||!path||flags.some(flag=>flag!=='--require-evidence')||operation==='--template'&&flags.length)throw Error('Use --template NEW_PRIVATE_FILE.json or --check PRIVATE_FILE.json [--require-evidence].');
  if(operation==='--template'){
    await writeFile(path,`${JSON.stringify(createConsultancyOperationsPacket(),null,2)}\n`,{flag:'wx',mode:0o600});
    return {status:'draft_created',preparationOnly:true,acceptanceGranted:false};
  }
  const stat=await lstat(path);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>512*1024)throw Error('Choose a regular preparation JSON file of at most 512 KiB.');
  const input=JSON.parse(await readFile(path,'utf8'));let result;
  try{result=validateConsultancyOperationsPacket(input);}catch(error){error.safePreparationMessage=true;throw error;}
  return {...result,...(flags.includes('--require-evidence')&&!result.evidenceCompleteForReview?{exitCode:2}:{})};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{const result=await prepareConsultancyReview();process.stdout.write(`${JSON.stringify(result,null,2)}\n`);process.exitCode=result.exitCode||0;}
  catch(error){process.stderr.write(`Consultancy preparation failed. ${error.safePreparationMessage?error.message:'Check the documented arguments and JSON file.'} No referenced evidence was opened or accepted.\n`);process.exitCode=1;}
}
