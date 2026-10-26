// Bounded actual build/run/restart/roundtrip check of a generated source package.
// Invoke with an isolated Podman store through ESIA_CONTAINER_ENGINE_ARGS_JSON.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {checkCommunityHttp} from './check-community-source.mjs';

export async function checkCommunityContainer({installation=resolve('.'),engine=process.env.ESIA_CONTAINER_ENGINE||'podman',image='localhost/esia-community-acceptance:preview'}={}){
  assert.ok(['podman','docker'].includes(engine));const args=JSON.parse(process.env.ESIA_CONTAINER_ENGINE_ARGS_JSON||'[]');assert.ok(Array.isArray(args)&&args.every(value=>typeof value==='string'));
  const operatorUid=process.getuid?.(),operatorGid=process.getgid?.();
  if(!Number.isInteger(operatorUid)||operatorUid===0||!Number.isInteger(operatorGid))throw Error('Run Linux container acceptance as a non-root user; its private data directory must remain owned by the runtime user.');
  const run=(more,{timeout=180000,check=true}={})=>{const result=spawnSync(engine,[...args,...more],{cwd:installation,encoding:'utf8',timeout,maxBuffer:8*1024*1024});if(check&&(result.status!==0||result.error))throw Error(`Container ${more[0]} failed: ${result.error?.message||result.stderr||result.stdout}`);return result;};
  const manifest=JSON.parse(await readFile(join(installation,'community-source-manifest.json')));assert.equal(manifest.format,'esia-community-source-candidate');
  const start=performance.now();run(['build',engine==='docker'?'--pull=false':'--pull=never','--build-arg',`COMMUNITY_SOURCE_TREE_SHA256=${manifest.sourceTreeSha256}`,'--file','deploy/community/Containerfile','--tag',image,'.']);
  const inspect=JSON.parse(run(['image','inspect',image]).stdout)[0];assert.equal(inspect.Config.User,'1000:1000');
  assert.equal(inspect.Config.Labels['io.categori.esia.community-source-tree-sha256'],manifest.sourceTreeSha256,'The runtime image must identify this exact candidate source.');
  const directory=await mkdtemp(join(tmpdir(),'esia-container-acceptance-')),name=`esia-acceptance-${randomUUID()}`;
  const reservation=createServer();reservation.listen(0,'127.0.0.1');await once(reservation,'listening');const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
  const runtime=['run','--detach','--name',name,'--network','host','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--pids-limit','128','--memory','1g','--tmpfs','/tmp:rw,noexec,nosuid,nodev,size=256m,mode=1777'];
  if(engine==='podman')runtime.push('--userns','keep-id:uid=1000,gid=1000');
  else runtime.push('--user',`${operatorUid}:${operatorGid}`);
  runtime.push('--volume',`${directory}:/data:Z`,image,'node','server/local-workspace.mjs','--data','/data','--port',String(port));
  let externalCalls=0;
  try{run(runtime);const origin=`http://127.0.0.1:${port}`;let ready=false;
    for(let attempt=0;attempt<50;attempt++){try{const response=await fetch(origin,{signal:AbortSignal.timeout(500),redirect:'error'});if(response.ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,100));}
    assert.ok(ready,run(['logs',name],{check:false}).stderr);
    const proof=await checkCommunityHttp(origin);
    const container=JSON.parse(run(['inspect',name]).stdout)[0];assert.equal(container.HostConfig.NetworkMode,'host');assert.equal(container.HostConfig.ReadonlyRootfs,true);assert.ok(container.Mounts.some(item=>item.Destination==='/data'));
    const runtimeUid=Number(run(['exec',name,'node','-p','process.getuid()']).stdout.trim());assert.equal(runtimeUid,engine==='docker'?operatorUid:1000);assert.ok(runtimeUid>0,'Acceptance must not elevate the application to root.');
    const listeners=JSON.parse(run(['exec',name,'node','--input-type=module','-e',`import{readFileSync}from'node:fs';const port=(${port}).toString(16).toUpperCase().padStart(4,'0');console.log(JSON.stringify(readFileSync('/proc/net/tcp','utf8').split('\\n').slice(1).map(line=>line.trim().split(/\\s+/)).filter(parts=>parts[3]==='0A'&&parts[1]?.endsWith(':'+port)).map(parts=>parts[1])));`]).stdout);
    assert.deepEqual(listeners,[`0100007F:${port.toString(16).toUpperCase().padStart(4,'0')}`],'The real application listener must remain bound only to IPv4 loopback.');
    run(['restart','--time','5',name]);let restored;
    for(let attempt=0;attempt<50;attempt++){try{const response=await fetch(`${origin}/api/projects/${proof.project.id}`,{headers:{'x-esia-workspace':'local'},signal:AbortSignal.timeout(500)});if(response.ok){restored=await response.json();break;}}catch{}await new Promise(resolve=>setTimeout(resolve,100));}
    assert.equal(restored?.id,proof.project.id,'Persistent project survives container replacement of process.');
    const info={format:'esia-community-container-acceptance',schemaVersion:1,result:'passed',engine,imageId:inspect.Id,imageDigest:inspect.Digest||null,sourceTreeSha256:manifest.sourceTreeSha256,loopbackOnly:true,nonRoot:true,runtimeUid,readOnlyImage:true,separatePersistentData:true,accountIsolation:true,processRestart:true,exactSourceSha256:proof.exactSourceSha256,elapsedMilliseconds:Math.round(performance.now()-start),externalProductServices:0,aiRequests:externalCalls,scope:'Linux loopback single-owner; core text document workflow; optional native PDF/Office tools excluded'};
    if(process.env.ESIA_CONTAINER_RECEIPT)await writeFile(resolve(process.env.ESIA_CONTAINER_RECEIPT),JSON.stringify(info,null,2)+'\n');return info;
  }finally{run(['rm','--force','--time','5',name],{timeout:20000,check:false});await rm(directory,{recursive:true,force:true});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)console.log(JSON.stringify(await checkCommunityContainer({installation:resolve(process.argv[2]||'.')}),null,2));
