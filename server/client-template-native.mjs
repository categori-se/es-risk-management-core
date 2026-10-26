import {createHash} from 'node:crypto';
import {spawnSync, spawn} from 'node:child_process';
import {mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync, statSync, lstatSync, fstatSync, realpathSync, mkdirSync, openSync, readSync, closeSync, opendirSync, constants as fsConstants} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, extname, basename, isAbsolute, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import {isDeepStrictEqual} from 'node:util';
import {AsyncLocalStorage} from 'node:async_hooks';
import {boundedZip} from './office-preview.mjs';
import nativeOfficeStartupAssets from './native-office-startup-assets.json' with {type:'json'};

export const nativeTemplateLimits = Object.freeze({sourceBytes:16*1024*1024,outputBytes:48*1024*1024,fields:1000,repeatRows:500,pages:40,dpi:72,renderMilliseconds:45000});
const worker=fileURLToPath(new URL('./client-template-native.py',import.meta.url));
const fail=(message,status=422)=>Object.assign(Error(message),{status});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const failureDiagnostics=new WeakMap();
const nativeExecutionDeadline=new AsyncLocalStorage();
export function withNativeTemplateDeadline({deadlineAt,signal,checkpoint}={},operation){
  const deadline=Date.parse(deadlineAt);
  if(typeof operation!=='function'||!Number.isFinite(deadline)||deadline<=Date.now()||deadline-Date.now()>150000||signal?.aborted)throw fail('The bounded native job deadline expired.',504);
  return nativeExecutionDeadline.run({deadline,signal,checkpoint},operation);
}
function nativeCommandTimeout(timeout){const context=nativeExecutionDeadline.getStore();if(!context)return timeout;const remaining=Math.floor(context.deadline-Date.now());if(context.signal?.aborted||remaining<1)throw fail('The bounded native job deadline expired.',504);return Math.min(timeout,remaining);}
const diagnosticCommands=new Set(['python3','libreoffice','pdfinfo','pdftoppm','pdftotext','fc-list','node']);
const renderPhases=['python_identity','office_prepare','office_version','pdf_version','font_inventory','office_conversion','pdf_info','pdf_geometry','pdf_raster','pdf_text','pdf_boxes','pdf_layout'];
const diagnosticPhases=new Set(['native.command','worker.analyze','worker.populate','worker.validate-fields','worker.pdf-layout','worker.diff','capabilities.office_prepare',...['python_version','office_version','pdf_version','pdf_raster_version','pdf_text_version','font_version','python_identity'].map(phase=>`capabilities.${phase}`),...['reference','populated'].flatMap(kind=>renderPhases.map(phase=>`${kind}.${phase}`))]);
const diagnosticReasons=new Set(['timeout','output_bound','unavailable','exit','invalid_result']);
const boundedMilliseconds=value=>Math.max(0,Math.min(2147483647,Math.round(Number.isFinite(value)?value:0)));
export const nativeCommandProcessDiagnosticLimits=Object.freeze({maximumProcesses:128,maximumTasks:128,maximumReadBytes:64*1024,maximumSerializedBytes:3072,sampledMilliseconds:25});
const processDiagnosticNames=new Set(['node','python','python3','libreoffice','soffice','soffice.bin','oosplash','sh','busybox','pdfinfo','pdftoppm','pdftotext','fc-list','osl_executeProc','osl_executePro']);
const processDiagnosticWaitChannels=new Set(['0','futex_wait','futex_wait_queue','futex_wait_queue_me','__futex_abstimed_wait_common','__futex_abstimed_wait_common64','do_wait','do_wait_intr_irq','wait_woken','wait_for_completion','wait_for_completion_killable','pipe_read','pipe_write','ep_poll','do_epoll_wait','do_select','poll_schedule_timeout','poll_schedule_timeout.constprop.0','hrtimer_nanosleep','__hrtimer_nanosleep','do_nanosleep','unix_stream_read_generic','unix_stream_read','unix_stream_recvmsg','skb_wait_for_more_packets','sk_wait_data','sock_recvmsg','do_signal_stop','ptrace_stop','io_schedule','io_schedule_timeout','folio_wait_bit_common','wait_on_page_bit_common','wait_on_page_bit','filemap_fault','wait_on_buffer','__wait_on_buffer','request_wait_answer','fuse_simple_request','fuse_request_wait_answer','balance_dirty_pages','wait_on_page_writeback','folio_wait_writeback','folio_wait_stable','wait_on_bit_io','bit_wait_io']);
function freezeProcessDiagnostic(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freezeProcessDiagnostic(child);Object.freeze(value);}return value;}
// Only the just-spawned command's own process group is inspected. Child lists
// come from every owned task: LibreOffice can spawn soffice.bin from an OSL
// helper thread. No global PID scan, command line, environment, fd or stack read.
function nativeCommandProcessState(groupId){
  const limits=nativeCommandProcessDiagnosticLimits,result={schemaVersion:1,selection:'bounded_owned_group_tree',available:false,processes:[],truncated:false};
  if(process.platform!=='linux'||!Number.isSafeInteger(groupId)||groupId<2)return freezeProcessDiagnostic(result);
  const started=performance.now(),pending=[groupId],seen=new Set();let readBytes=0,tasks=0;
  const budget=()=>{const ok=performance.now()-started<limits.sampledMilliseconds&&readBytes<limits.maximumReadBytes;if(!ok)result.truncated=true;return ok;};
  const read=(path,maximum)=>{if(!budget())return null;let fd;try{fd=openSync(path,fsConstants.O_RDONLY|fsConstants.O_NOFOLLOW|fsConstants.O_NONBLOCK);const length=Math.min(maximum+1,limits.maximumReadBytes-readBytes),bytes=Buffer.alloc(length),size=readSync(fd,bytes,0,length,null);readBytes+=size;if(size>maximum){result.truncated=true;return null;}return bytes.subarray(0,size).toString('utf8');}catch{return null;}finally{if(fd!==undefined)try{closeSync(fd);}catch{}}};
  const stat=(path,id)=>{const raw=read(path,1024);if(!raw)return null;const end=raw.lastIndexOf(') '),start=raw.indexOf(' (');if(start<1||end<start||raw.slice(0,start)!==String(id))return null;const fields=raw.slice(end+2).trim().split(/\s+/),parentPid=Number(fields[1]);if(!/^[RSDZTtXxKWPI]$/.test(fields[0])||!Number.isSafeInteger(parentPid)||Number(fields[2])!==groupId)return null;const comm=raw.slice(start+2,end);return {id,parentPid,state:fields[0],command:processDiagnosticNames.has(comm)?comm:'unknown'};};
  const channel=path=>{const value=read(path,128)?.trim();return value===undefined?'unavailable':processDiagnosticWaitChannels.has(value)?value:'unknown';};
  while(pending.length&&seen.size<limits.maximumProcesses&&budget()){
    const pid=pending.shift();if(seen.has(pid))continue;seen.add(pid);const processState=stat(`/proc/${pid}/stat`,pid);if(!processState)continue;
    const row={pid,parentPid:processState.parentPid,state:processState.state,command:processState.command,waitChannel:channel(`/proc/${pid}/wchan`),threads:[]};result.processes.push(row);result.available=true;
    const visitTask=tid=>{if(tasks>=limits.maximumTasks||!budget()){result.truncated=true;return;}tasks++;const task=tid===pid?processState:stat(`/proc/${pid}/task/${tid}/stat`,tid);if(!task)return;if(tid!==pid)row.threads.push({tid,state:task.state,command:task.command,waitChannel:channel(`/proc/${pid}/task/${tid}/wchan`)});const children=read(`/proc/${pid}/task/${tid}/children`,4096);if(children===null)return;for(const text of children.trim().split(/\s+/)){if(!/^[1-9][0-9]{0,9}$/.test(text))continue;const child=Number(text);if(!seen.has(child)&&!pending.includes(child)){if(seen.size+pending.length>=limits.maximumProcesses){result.truncated=true;break;}pending.push(child);}}};
    visitTask(pid);let directory;
    try{directory=opendirSync(`/proc/${pid}/task`,{bufferSize:16});let item;while(tasks<limits.maximumTasks&&budget()&&(item=directory.readSync()))if(/^[1-9][0-9]{0,9}$/.test(item.name)&&Number(item.name)!==pid)visitTask(Number(item.name));if(tasks>=limits.maximumTasks)result.truncated=true;}catch{}finally{try{directory?.closeSync();}catch{}}
  }
  if(pending.length)result.truncated=true;
  // Bound the emitted metadata as well as the proc reads. A sampled snapshot
  // can be incomplete through races, permissions, task caps or the time budget.
  while(Buffer.byteLength(JSON.stringify(result))>limits.maximumSerializedBytes){result.truncated=true;const row=result.processes.at(-1);if(row?.threads.length)row.threads.pop();else result.processes.pop();}
  result.available=result.processes.length>0;return freezeProcessDiagnostic(result);
}
function diagnose(error,{phase,command,reason,started,timeout,processState,startupProgress}){
  failureDiagnostics.set(error,Object.freeze({phase:diagnosticPhases.has(phase)?phase:'native.command',command:diagnosticCommands.has(basename(command))?basename(command):'unknown',reason:diagnosticReasons.has(reason)?reason:'exit',elapsedMs:boundedMilliseconds(performance.now()-started),timeoutMs:boundedMilliseconds(timeout),...(processState?{processState}:{}),...(startupProgress?{startupProgress}:{})}));
  return error;
}
/** Only locally produced command diagnostics are available; caller/worker properties are ignored. */
export function nativeFailureDiagnostic(error){return failureDiagnostics.get(error);}
function privateToolEnvironment(directory){
  const home=join(directory,'home'),profileDirectory=join(directory,'profile'),userProfile=join(profileDirectory,'user');
  const env={HOME:home,TMPDIR:join(directory,'tmp'),XDG_CACHE_HOME:join(home,'.cache'),XDG_CONFIG_HOME:join(home,'.config'),XDG_RUNTIME_DIR:join(directory,'runtime'),GSETTINGS_BACKEND:'memory',SAL_USE_VCLPLUGIN:'svp',LANG:'C.UTF-8',LC_ALL:'C.UTF-8',http_proxy:'http://127.0.0.1:9',https_proxy:'http://127.0.0.1:9',ALL_PROXY:'http://127.0.0.1:9',NO_PROXY:''};
  for(const path of [home,env.TMPDIR,env.XDG_CACHE_HOME,env.XDG_CONFIG_HOME,env.XDG_RUNTIME_DIR,profileDirectory,userProfile])mkdirSync(path,{mode:0o700});
  writeFileSync(join(userProfile,'registrymodifications.xcu'),'<?xml version="1.0"?><oor:items xmlns:oor="http://openoffice.org/2001/registry"><item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop></item><item oor:path="/org.openoffice.Office.Common/Load"><prop oor:name="UpdateLink" oor:op="fuse"><value>0</value></prop></item><item oor:path="/org.openoffice.Office.Calc/Formula/Load"><prop oor:name="OOXMLRecalcMode" oor:op="fuse"><value>0</value></prop></item></oor:items>',{mode:0o600,flag:'wx'});
  return {env,profileUri:pathToFileURL(profileDirectory).href};
}
const officePackageDirectory='/opt/esia/office-library-package';
export const nativeOfficePackageLimits=Object.freeze({prepareMilliseconds:9000,versionMilliseconds:10000,expandedBytes:112*1024*1024,compressedBytes:40*1024*1024,scratchReserveBytes:256*1024*1024});
// Self-contained static child: no app imports, user data, network, subprocesses or tar extraction.
async function officePackageChild(){
  const fs=await import('node:fs'),f=await import('node:fs/promises'),{join,basename,dirname}=await import('node:path'),{createHash}=await import('node:crypto'),{Transform}=await import('node:stream'),{pipeline}=await import('node:stream/promises'),{createBrotliDecompress}=await import('node:zlib');
  const input=JSON.parse(process.argv[1]),uid=process.getuid?.(),digest=bytes=>createHash('sha256').update(bytes).digest('hex'),keys=(value,list)=>value&&JSON.stringify(Object.keys(value).sort())===JSON.stringify(list.split(',').sort());
  const regular=async(path,maximum)=>{const s=await f.lstat(path);if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1||s.size>maximum)throw Error();return s;};
  const privateDirectory=async path=>{const s=await f.lstat(path);if(!s.isDirectory()||s.isSymbolicLink()||(s.mode&511)!==448||uid!==undefined&&s.uid!==uid||await f.realpath(path)!==path)throw Error();};
  const space=async()=>{const s=await f.statfs(input.cacheRoot,{bigint:true}),n=s.bavail*s.bsize;return Number(n>BigInt(Number.MAX_SAFE_INTEGER)?BigInt(Number.MAX_SAFE_INTEGER):n);};
  // This reads fixed image assets in place. It neither relocates libraries nor
  // changes the loader environment. Module-only fixture injection cannot arrive
  // through the native request's JSON wire format.
  async function prefetchStartup(){
    const s=input.startup,m=s.manifest,check=()=>{if(process.hrtime.bigint()>=BigInt(input.deadlineNs))throw Error();};
    if(!keys(m,'format,schemaVersion,toolchainInputSha256,fileCount,totalBytes,files')||m.format!=='esia-native-office-startup-assets'||m.schemaVersion!==1||m.toolchainInputSha256!==s.toolchainInputSha256||digest(Buffer.from(JSON.stringify(m)))!==s.manifestSha256||!Array.isArray(m.files)||m.fileCount!==m.files.length||m.fileCount<1||m.fileCount>128||m.totalBytes!==m.files.reduce((n,v)=>n+v.size,0)||m.totalBytes>128*1048576||new Set(m.files.map(v=>v.path)).size!==m.fileCount||!m.files.every(v=>keys(v,'path,size,sha256')&&/^\/(?:lib|usr\/lib)\/[A-Za-z0-9_+./-]+$/.test(v.path)&&!v.path.slice(1).split('/').some(p=>p==='.'||p==='..'||p==='')&&Number.isSafeInteger(v.size)&&v.size>=4&&v.size<=32*1048576&&/^[a-f0-9]{64}$/.test(v.sha256)))throw Error();
    const metadata=join(s.root,'opt/esia/toolchain-inputs.json');let metadataStat;
    try{metadataStat=await f.lstat(metadata);}catch(error){
      if(error.code!=='ENOENT')throw error;
      const parents=[];for(let path=dirname(metadata);;path=dirname(path)){parents.unshift(path);if(dirname(path)===path)break;}
      for(const path of parents){let s;try{s=await f.lstat(path);}catch(missing){if(missing.code==='ENOENT')return {packaged:false};throw missing;}if(!s.isDirectory()||s.isSymbolicLink())throw Error();}
      return {packaged:false};
    }
    if(!metadataStat.isFile()||metadataStat.isSymbolicLink()||metadataStat.nlink!==1||metadataStat.size<1||metadataStat.size>1048576||await f.realpath(metadata)!==metadata)throw Error();
    await privateDirectory(input.staging);const progress={manifestSha256:s.manifestSha256,fileIndex:0,verifiedCount:0,readBytes:0};
    const progressFile=await f.open(join(input.staging,'startup-progress.json'),fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,384);
    const saveProgress=async()=>{const bytes=Buffer.from(JSON.stringify(progress));if(bytes.length>1024)throw Error();await progressFile.write(bytes,0,bytes.length,0);await progressFile.truncate(bytes.length);};
    const same=(a,b)=>a.dev===b.dev&&a.ino===b.ino&&a.size===b.size&&a.mtimeMs===b.mtimeMs&&a.ctimeMs===b.ctimeMs;
    async function openFixed(path,size){check();const before=await f.lstat(path);check();if(!before.isFile()||before.isSymbolicLink()||before.nlink!==1||before.size!==size||await f.realpath(path)!==path)throw Error();check();const handle=await f.open(path,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK);try{if(!same(before,await handle.stat()))throw Error();check();return {handle,before};}catch(error){await handle.close();throw error;}}
    try{
      await saveProgress();const meta=await openFixed(metadata,metadataStat.size),metadataHash=createHash('sha256');
      try{const bytes=Buffer.alloc(metadataStat.size);check();const {bytesRead}=await meta.handle.read(bytes,0,bytes.length,0);check();if(bytesRead!==bytes.length||!same(meta.before,await meta.handle.stat())||!same(meta.before,await f.lstat(metadata)))throw Error();metadataHash.update(bytes);}finally{await meta.handle.close();}
      if(metadataHash.digest('hex')!==s.toolchainInputSha256)throw Error();
      const buffer=Buffer.alloc(1048576);
      for(let index=0;index<m.files.length;index++){
        check();progress.fileIndex=index;await saveProgress();const asset=m.files[index],path=join(s.root,asset.path),opened=await openFixed(path,asset.size),hasher=createHash('sha256');let offset=0;
        try{
          while(offset<asset.size){check();const {bytesRead}=await opened.handle.read(buffer,0,Math.min(buffer.length,asset.size-offset),offset);progress.readBytes+=bytesRead;check();if(bytesRead<1)throw Error();if(offset===0&&(bytesRead<4||buffer.subarray(0,4).toString('hex')!=='7f454c46'))throw Error();hasher.update(buffer.subarray(0,bytesRead));offset+=bytesRead;await saveProgress();}
          check();if(hasher.digest('hex')!==asset.sha256||!same(opened.before,await opened.handle.stat())||!same(opened.before,await f.lstat(path)))throw Error();progress.verifiedCount++;await saveProgress();
        }finally{await opened.handle.close();}
      }
      check();return {packaged:false,startupPrefetch:{manifestSha256:s.manifestSha256,fileCount:m.fileCount,totalBytes:m.totalBytes}};
    }catch(error){try{await saveProgress();}catch{}throw error;}finally{await progressFile.close();}
  }
  try{
    let packageStat;try{packageStat=await f.lstat(input.packageDirectory);}catch(error){if(error.code==='ENOENT'&&!input.required){process.stdout.write(JSON.stringify(await prefetchStartup()));return;}throw error;}
    if(!packageStat.isDirectory()||packageStat.isSymbolicLink()||await f.realpath(input.packageDirectory)!==input.packageDirectory)throw Error();
    await regular(join(input.packageDirectory,'manifest.json'),8192);await regular(join(input.packageDirectory,'manifest.sha256'),65);
    const raw=await f.readFile(join(input.packageDirectory,'manifest.json')),manifestSha256=digest(raw),pin=(await f.readFile(join(input.packageDirectory,'manifest.sha256'),'utf8')).trim();if(pin!==manifestSha256)throw Error();
    const m=JSON.parse(raw),names=['libmergedlo.so','libicudata.so.72'],sources=['/usr/lib/libreoffice/program/libmergedlo.so','/usr/lib/x86_64-linux-gnu/libicudata.so.72.1'];
    if(!keys(m,'format,schemaVersion,compression,quality,window,totalBytes,compressedBytes,files')||m.format!=='esia-native-office-library-package'||m.schemaVersion!==1||m.compression!=='brotli'||m.quality!==11||m.window!==22||!Array.isArray(m.files)||m.files.length!==2||!m.files.every((v,i)=>keys(v,'name,blob,sourcePath,size,sha256,compressedSize,compressedSha256')&&v.name===names[i]&&v.blob===names[i]+'.br'&&v.sourcePath===sources[i]&&Number.isSafeInteger(v.size)&&v.size>0&&v.size<=(i?40:80)*1048576&&Number.isSafeInteger(v.compressedSize)&&v.compressedSize>0&&v.compressedSize<=40*1048576&&/^[a-f0-9]{64}$/.test(v.sha256)&&/^[a-f0-9]{64}$/.test(v.compressedSha256))||m.totalBytes!==m.files.reduce((n,v)=>n+v.size,0)||m.compressedBytes!==m.files.reduce((n,v)=>n+v.compressedSize,0)||m.totalBytes>112*1048576||m.compressedBytes>40*1048576)throw Error();
    const base=join(input.cacheRoot,'esia-native-office-library-cache');try{await f.mkdir(base,{mode:448});}catch(error){if(error.code!=='EEXIST')throw error;}await privateDirectory(base);await privateDirectory(input.staging);
    const target=join(base,manifestSha256),reserve=256*1048576;
    async function verifiedCache(){
      await privateDirectory(target);if(JSON.stringify((await f.readdir(target)).sort())!==JSON.stringify([...names].sort()))throw Error();
      for(const v of m.files){const path=join(target,v.name),s=await regular(path,v.size);if(s.size!==v.size||(s.mode&511)!==320||uid!==undefined&&s.uid!==uid)throw Error();const h=createHash('sha256');let bytes=0;for await(const chunk of fs.createReadStream(path,{flags:fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW,highWaterMark:1048576})){bytes+=chunk.length;if(bytes>v.size)throw Error();h.update(chunk);}if(bytes!==v.size||h.digest('hex')!==v.sha256)throw Error();}
    }
    const response=(cacheHit,available)=>({packaged:true,directory:target,manifestSha256,totalBytes:m.totalBytes,compressedBytes:m.compressedBytes,cacheHit,scratchBytesAvailable:available,scratchReserveBytes:reserve});
    let exists=true;try{await f.lstat(target);}catch(error){if(error.code!=='ENOENT')throw error;exists=false;}
    if(exists){await verifiedCache();const available=await space();if(available<reserve)throw Error();process.stdout.write(JSON.stringify(response(true,available)));return;}
    const available=await space();if(available<m.totalBytes+reserve)throw Error();
    const payload=join(input.staging,'libraries');await f.mkdir(payload,{mode:448});
    for(const v of m.files){
      const path=join(input.packageDirectory,v.blob),s=await regular(path,v.compressedSize);if(s.size!==v.compressedSize)throw Error();
      let compressed=0,expanded=0,header=Buffer.alloc(0);const compressedHash=createHash('sha256'),expandedHash=createHash('sha256');
      const before=new Transform({transform(chunk,encoding,done){compressed+=chunk.length;if(compressed>v.compressedSize){done(Error());return;}compressedHash.update(chunk);done(null,chunk);}});
      const after=new Transform({transform(chunk,encoding,done){expanded+=chunk.length;if(expanded>v.size){done(Error());return;}if(header.length<4)header=Buffer.concat([header,chunk.subarray(0,4-header.length)]);expandedHash.update(chunk);done(null,chunk);}});
      await pipeline(fs.createReadStream(path,{flags:fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW,highWaterMark:1048576}),before,createBrotliDecompress({chunkSize:1048576}),after,fs.createWriteStream(join(payload,v.name),{flags:fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,mode:384}));
      if(compressed!==v.compressedSize||expanded!==v.size||compressedHash.digest('hex')!==v.compressedSha256||expandedHash.digest('hex')!==v.sha256||header.toString('hex')!=='7f454c46')throw Error();await f.chmod(join(payload,v.name),320);
    }
    let cacheHit=false;try{await f.rename(payload,target);}catch(error){if(!['EEXIST','ENOTEMPTY'].includes(error.code))throw error;await verifiedCache();cacheHit=true;}const remaining=await space();if(remaining<reserve)throw Error();process.stdout.write(JSON.stringify(response(cacheHit,remaining)));
  }catch{process.stdout.write(JSON.stringify({error:'NATIVE_OFFICE_PACKAGE_UNAVAILABLE'}));process.exitCode=1;}
}
function officePreparationContext({packageDirectory=officePackageDirectory,cacheRoot=tmpdir(),required=process.env.ESIA_NATIVE_OFFICE_PACKAGE==='required',timeout=nativeOfficePackageLimits.prepareMilliseconds,phase='native.command',startupFixture}={}){
  if(!Number.isFinite(timeout)||timeout<1)throw fail('The native renderer package could not be prepared.',503);
  // A function-valued dependency is for authored local tests only. Serialized
  // native request JSON cannot select another manifest, metadata pin or root.
  if(startupFixture!==undefined&&typeof startupFixture!=='function')throw fail('The native renderer package could not be prepared.',503);
  const fixture=startupFixture?.(),root=fixture?.root??resolve('/'),manifest=JSON.parse(JSON.stringify(fixture?.manifest??nativeOfficeStartupAssets));
  if(!isAbsolute(root)||resolve(root)!==root||!manifest||!Array.isArray(manifest.files)||!/^[a-f0-9]{64}$/.test(manifest.toolchainInputSha256))throw fail('The native renderer package could not be prepared.',503);
  const startup={root,manifest,manifestSha256:hash(Buffer.from(JSON.stringify(manifest))),toolchainInputSha256:manifest.toolchainInputSha256};
  const started=performance.now(),boundedTimeout=nativeCommandTimeout(Math.min(nativeOfficePackageLimits.prepareMilliseconds,Math.floor(timeout))),deadlineNs=String(process.hrtime.bigint()+BigInt(boundedTimeout)*1000000n),staging=mkdtempSync(join(cacheRoot,'esia-native-office-prepare-'));
  return {cacheRoot,required,phase,started,staging,startup,timeout:boundedTimeout,args:['--input-type=module','-e',`(${officePackageChild.toString()})()`,JSON.stringify({packageDirectory,cacheRoot,required,staging,startup,deadlineNs})]};
}
function officeStartupProgress(context){
  let fd;try{
    const directory=lstatSync(context.staging),path=join(context.staging,'startup-progress.json'),s=lstatSync(path),uid=process.getuid?.(),stamp=v=>[v.dev,v.ino,v.size,v.mtimeMs,v.ctimeMs].join(':');
    if(!directory.isDirectory()||directory.isSymbolicLink()||(directory.mode&511)!==448||uid!==undefined&&directory.uid!==uid||realpathSync(context.staging)!==context.staging||!s.isFile()||s.isSymbolicLink()||s.nlink!==1||(s.mode&511)!==384||uid!==undefined&&s.uid!==uid||s.size<1||s.size>1024)return;
    fd=openSync(path,fsConstants.O_RDONLY|fsConstants.O_NOFOLLOW|fsConstants.O_NONBLOCK);if(stamp(s)!==stamp(fstatSync(fd)))return;
    const bytes=Buffer.alloc(s.size),n=readSync(fd,bytes,0,bytes.length,0);if(n!==s.size||stamp(s)!==stamp(fstatSync(fd))||stamp(s)!==stamp(lstatSync(path)))return;
    const value=JSON.parse(bytes),keys=Object.keys(value).sort().join(','),m=context.startup.manifest;
    if(keys!=='fileIndex,manifestSha256,readBytes,verifiedCount'||value.manifestSha256!==context.startup.manifestSha256||!Number.isSafeInteger(value.fileIndex)||value.fileIndex<0||value.fileIndex>=m.files.length||!Number.isSafeInteger(value.verifiedCount)||![value.fileIndex,value.fileIndex+1].includes(value.verifiedCount)||!Number.isSafeInteger(value.readBytes)||value.readBytes<0||value.readBytes<m.files.slice(0,value.verifiedCount).reduce((n,v)=>n+v.size,0)||value.readBytes>m.files.slice(0,value.fileIndex+1).reduce((n,v)=>n+v.size,0))return;
    return Object.freeze(value);
  }catch{}finally{if(fd!==undefined)try{closeSync(fd);}catch{}}
}
function officePreparationFailure(context,reason,original){const prior=nativeFailureDiagnostic(original);return diagnose(fail('The native renderer package could not be prepared.',503),{phase:context.phase,command:'node',reason,started:context.started,timeout:context.timeout,processState:prior?.processState,startupProgress:officeStartupProgress(context)});}
function acceptedOfficePreparation(context,text){
  const {required,cacheRoot}=context;let value;try{value=JSON.parse(text);}catch{throw officePreparationFailure(context,'invalid_result');}
  if(value?.packaged===false&&!required&&Object.keys(value).length===1)return {packaged:false,elapsedMs:boundedMilliseconds(performance.now()-context.started)};
  if(value?.packaged===false&&!required&&Object.keys(value).sort().join(',')==='packaged,startupPrefetch'){
    const expected={manifestSha256:context.startup.manifestSha256,fileCount:context.startup.manifest.fileCount,totalBytes:context.startup.manifest.totalBytes};
    if(!isDeepStrictEqual(value.startupPrefetch,expected))throw officePreparationFailure(context,'invalid_result');return {packaged:false,startupPrefetch:Object.freeze(expected),elapsedMs:boundedMilliseconds(performance.now()-context.started)};
  }
  if(value?.packaged!==true||JSON.stringify(Object.keys(value).sort())!==JSON.stringify('packaged,directory,manifestSha256,totalBytes,compressedBytes,cacheHit,scratchBytesAvailable,scratchReserveBytes'.split(',').sort())||!/^[a-f0-9]{64}$/.test(value.manifestSha256)||value.directory!==join(cacheRoot,'esia-native-office-library-cache',value.manifestSha256)||!Number.isSafeInteger(value.totalBytes)||value.totalBytes<1||value.totalBytes>nativeOfficePackageLimits.expandedBytes||!Number.isSafeInteger(value.compressedBytes)||value.compressedBytes<1||value.compressedBytes>nativeOfficePackageLimits.compressedBytes||typeof value.cacheHit!=='boolean'||!Number.isSafeInteger(value.scratchBytesAvailable)||value.scratchBytesAvailable<nativeOfficePackageLimits.scratchReserveBytes||value.scratchReserveBytes!==nativeOfficePackageLimits.scratchReserveBytes)throw officePreparationFailure(context,'invalid_result');
  return {...value,elapsedMs:boundedMilliseconds(performance.now()-context.started)};
}
function cleanupOfficePreparation({staging}){rmSync(staging,{recursive:true,force:true});}
/** Fixed image assets only; overrides support isolated qualification and are never read from request inputs. */
export function prepareNativeOfficeLibraries(options={}){
  const context=officePreparationContext(options);
  try{const result=(options.run||spawnSync)(process.execPath,context.args,{encoding:'utf8',timeout:context.timeout,maxBuffer:8192,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'},stdio:['ignore','pipe','pipe'],killSignal:'SIGKILL'});if(result.error)throw officePreparationFailure(context,result.error.code==='ETIMEDOUT'?'timeout':'unavailable');if(result.status!==0)throw officePreparationFailure(context,'invalid_result');return acceptedOfficePreparation(context,result.stdout);}
  finally{cleanupOfficePreparation(context);}
}
/** Rendering uses an asynchronous timer and process-group kill; it never waits for a blocked child's exit. */
export async function prepareNativeOfficeLibrariesAsync(options={}){
  const context=officePreparationContext(options);
  try{let result;try{result=await (options.runCommand||executeNativeCommand)(process.execPath,context.args,{env:{PYTHONDONTWRITEBYTECODE:'1'},timeout:context.timeout,maximum:8192,phase:context.phase});}catch(error){throw officePreparationFailure(context,nativeFailureDiagnostic(error)?.reason||'unavailable',error);}return acceptedOfficePreparation(context,result.stdout);}
  finally{cleanupOfficePreparation(context);}
}
// Load merged through its immutable original-path alias so module-relative resources keep their installed origin.
function officeLibraryEnvironment(env,libraries){return libraries.packaged?{...env,LD_LIBRARY_PATH:['/usr/lib/libreoffice/program',libraries.directory,...(process.env.LD_LIBRARY_PATH||'').split(':').filter(Boolean)].join(':')}:env;}
function officeLibraryEvidence(libraries){if(!libraries)return{packaged:null,status:'unavailable'};return libraries.packaged?{packaged:true,manifestSha256:libraries.manifestSha256,expandedBytes:libraries.totalBytes,compressedBytes:libraries.compressedBytes,scratchReserveBytes:libraries.scratchReserveBytes}: {packaged:false,...(libraries.startupPrefetch?{startupPrefetch:libraries.startupPrefetch}:{})};}

// Import the modules used by the worker: distribution metadata can describe a
// different installation from the module selected by this interpreter/site path.
const pythonRuntimeProbe='import json,sys,platform,lxml,pypdf,PIL; print(json.dumps({"format":"esia-native-python-runtime","schemaVersion":1,"implementation":sys.implementation.name,"version":platform.python_version(),"build":" ".join(sys.version.split()),"modules":{"lxml":lxml.__version__,"pypdf":pypdf.__version__,"Pillow":PIL.__version__}}))';
function acceptedPythonRuntime(value){
  const keys=(object,names)=>object&&typeof object==='object'&&!Array.isArray(object)&&isDeepStrictEqual(Object.keys(object).sort(),names.split(',').sort()),text=(value,maximum)=>typeof value==='string'&&value.length>0&&value.length<=maximum&&!/[\x00-\x1f\x7f]/.test(value);
  if(!keys(value,'format,schemaVersion,implementation,version,build,modules')||value.format!=='esia-native-python-runtime'||value.schemaVersion!==1||!text(value.implementation,32)||!text(value.version,64)||!text(value.build,512)||!keys(value.modules,'lxml,pypdf,Pillow')||!Object.values(value.modules).every(version=>text(version,128)))throw fail('The native Python runtime and parser versions could not be identified.',503);
  return value;
}
function pinnedPythonRuntime(engine){try{return acceptedPythonRuntime(engine?.adapter?.pythonRuntime);}catch{throw fail('The rendering engine, native adapter or installed font set differs from the pinned reference environment.',409);}}
async function nativePythonRuntime(renderKind){
  const phase=`${renderKind}.python_identity`,started=performance.now(),timeout=nativeCommandTimeout(10000),result=await executeNativeCommand('python3',['-c',pythonRuntimeProbe],{env:{PYTHONDONTWRITEBYTECODE:'1'},timeout,maximum:8192,phase});
  try{return acceptedPythonRuntime(JSON.parse(result.stdout));}catch{throw diagnose(fail('The native Python runtime and parser versions could not be identified.',503),{phase,command:'python3',reason:'invalid_result',started,timeout});}
}

function nativeCapabilityReport(tools,pythonModules,pythonRuntime,libraries){
  const missing=[...Object.entries(tools).filter(([,tool])=>!tool.available).map(([name])=>name),...(!pythonModules.available?['python_modules']:[])];
  return {format:'esia-native-template-capabilities',schemaVersion:1,available:!missing.length,tools,pythonModules,pythonRuntime,officeLibraries:officeLibraryEvidence(libraries),missing,limits:nativeTemplateLimits,formats:{docx:['split_run_placeholders','paragraph_bookmarks','content_controls','styled_repeated_rows','reviewed_plain_paragraph_or_table_cell','reviewed_untagged_repeated_row'],xlsx:['input_cells','named_inputs','fixed_capacity_tables','preserved_formulas_and_print_configuration','reviewed_untagged_cells_and_fixed_ranges'],pdf:['AcroForm','reviewed_static_or_scanned_text_overlay_regions']},limitations:['No macro, embedded executable, external relationship, XFA or digital-signature round trip.','No arbitrary scanned-PDF reconstruction; static overlays require explicit reviewed page rectangles.','Native references pin the local renderer, Python/parser versions and font fingerprint. Microsoft Word/Excel rendering equivalence is not asserted.','Conversion needs local IPC; a managed sandbox may deny conversion even when executable version checks succeed.'],malwareScanning:{available:false,meaning:'No antivirus engine is assumed. Deterministic package/PDF active-content checks run before native parsing and conversion.'}};
}

export function nativeTemplateCapabilities({prepareOffice=prepareNativeOfficeLibraries,runProbe=spawnSync}={}){
  const directory=mkdtempSync(join(tmpdir(),'esia-native-capabilities-'));
  try{
  const {env,profileUri}=privateToolEnvironment(directory),toolEnv={...process.env,...env},pythonEnv={...process.env,PYTHONDONTWRITEBYTECODE:'1'};
  // Python keeps the configured interpreter's package/user-site environment, as the worker does.
  const probe=(command,args,{timeout=10000,env=command==='python3'?pythonEnv:toolEnv}={})=>{const result=runProbe(command,args,{encoding:'utf8',timeout,maxBuffer:1024*1024,env,stdio:['ignore','pipe','pipe']});return {available:!result.error&&result.status===0,version:(result.stdout||result.stderr||'').split('\n').find(line=>line.trim())?.trim()||null,error:result.error?.code||null};};
  const python=probe('python3',['--version']),officeStarted=performance.now();let libraries,libreoffice;
  try{libraries=prepareOffice({phase:'capabilities.office_prepare'});const remaining=Math.floor(10000-(performance.now()-officeStarted));if(remaining<1)throw fail('The native renderer package could not be prepared.',503);libreoffice=probe('libreoffice',[`-env:UserInstallation=${profileUri}`,'--version'],{timeout:remaining,env:{...process.env,...officeLibraryEnvironment(env,libraries)}});}catch{libreoffice={available:false,version:null,error:'NATIVE_OFFICE_PACKAGE_UNAVAILABLE'};}
  const tools={python,libreoffice,pdfinfo:probe('pdfinfo',['-v']),pdftoppm:probe('pdftoppm',['-v']),pdftotext:probe('pdftotext',['-v']),fontconfig:probe('fc-list',['--version'])};
  const result=runProbe('python3',['-c',pythonRuntimeProbe],{encoding:'utf8',timeout:nativeCommandTimeout(10000),maxBuffer:8192,env:pythonEnv,stdio:['ignore','pipe','pipe']});
  let pythonModules,pythonRuntime=null;try{if(result.error||result.status!==0)throw Error();pythonRuntime=acceptedPythonRuntime(JSON.parse(result.stdout));pythonModules={available:true,versions:pythonRuntime.modules};}catch{pythonModules={available:false,versions:{},error:'Install the documented lxml, pypdf and Pillow runtime modules before native template processing.'};}
  return nativeCapabilityReport(tools,pythonModules,pythonRuntime,libraries);
  }finally{rmSync(directory,{recursive:true,force:true});}
}
/** Hosted capability probes use the same bounded process-group runner as renders.
 * Keep the synchronous export for existing local callers; hosted requests await
 * this path so launcher descendants cannot trap the event loop in spawnSync. */
export async function nativeTemplateCapabilitiesAsync({prepareOffice=prepareNativeOfficeLibrariesAsync,runCommand=executeNativeCommand,onFailureDiagnostic=()=>{}}={}){
  const directory=mkdtempSync(join(tmpdir(),'esia-native-capabilities-'));
  try{
    const {env,profileUri}=privateToolEnvironment(directory),toolEnv={...process.env,...env},pythonEnv={...process.env,PYTHONDONTWRITEBYTECODE:'1'};
    const report=error=>{const diagnostic=nativeFailureDiagnostic(error);if(diagnostic)try{onFailureDiagnostic(diagnostic);}catch{}};
    const probe=async(command,args,{timeout=10000,env=command==='python3'?pythonEnv:toolEnv,phase='native.command'}={})=>{
      try{
        const result=await runCommand(command,args,{env,timeout,maximum:1024*1024,phase});
        return {available:true,version:(result.stdout||result.stderr||'').split('\n').find(line=>line.trim())?.trim()||null,error:null};
      }catch(error){
        report(error);const reason=nativeFailureDiagnostic(error)?.reason;
        return {available:false,version:null,error:reason==='timeout'?'ETIMEDOUT':reason==='output_bound'?'ENOBUFS':reason==='unavailable'?'NATIVE_TOOL_UNAVAILABLE':'NATIVE_TOOL_FAILED'};
      }
    };
    const python=await probe('python3',['--version'],{phase:'capabilities.python_version'}),officeStarted=performance.now();let libraries,libreoffice;
    try{
      libraries=await prepareOffice({phase:'capabilities.office_prepare'});
      const remaining=Math.floor(nativeOfficePackageLimits.versionMilliseconds-(performance.now()-officeStarted));
      if(remaining<1)throw fail('The native renderer package could not be prepared.',503);
      libreoffice=await probe('libreoffice',[`-env:UserInstallation=${profileUri}`,'--version'],{timeout:remaining,env:{...process.env,...officeLibraryEnvironment(env,libraries)},phase:'capabilities.office_version'});
    }catch(error){report(error);libreoffice={available:false,version:null,error:'NATIVE_OFFICE_PACKAGE_UNAVAILABLE'};}
    const tools={python,libreoffice,pdfinfo:await probe('pdfinfo',['-v'],{phase:'capabilities.pdf_version'}),pdftoppm:await probe('pdftoppm',['-v'],{phase:'capabilities.pdf_raster_version'}),pdftotext:await probe('pdftotext',['-v'],{phase:'capabilities.pdf_text_version'}),fontconfig:await probe('fc-list',['--version'],{phase:'capabilities.font_version'})};
    let pythonModules,pythonRuntime=null;
    try{
      const result=await runCommand('python3',['-c',pythonRuntimeProbe],{env:pythonEnv,timeout:nativeCommandTimeout(10000),maximum:8192,phase:'capabilities.python_identity'});
      pythonRuntime=acceptedPythonRuntime(JSON.parse(result.stdout));pythonModules={available:true,versions:pythonRuntime.modules};
    }catch(error){report(error);pythonModules={available:false,versions:{},error:'Install the documented lxml, pypdf and Pillow runtime modules before native template processing.'};}
    return nativeCapabilityReport(tools,pythonModules,pythonRuntime,libraries);
  }finally{rmSync(directory,{recursive:true,force:true});}
}
function formatOf({bytes,filename='',mediaType='',format}={}){
  if(format&& !['docx','xlsx','pdf'].includes(format))throw fail('Choose DOCX, XLSX or PDF native template content.');
  const detected=bytes?.subarray(0,5).toString()==='%PDF-'?'pdf':/\.xlsx$/i.test(filename)||/spreadsheetml/.test(mediaType)?'xlsx':/\.docx$/i.test(filename)||/wordprocessingml/.test(mediaType)?'docx':format;
  if(!detected)throw fail('A native DOCX, XLSX or PDF filename and matching source content are required.');
  if(format&&format!==detected)throw fail('The source format differs from the selected template format.');
  return detected;
}
function checkBytes(bytes){if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>nativeTemplateLimits.sourceBytes)throw fail('Native template sources must contain between 1 byte and 16 MiB.',413);return Buffer.from(bytes);}
function runWorker(input,{timeout=20000,maxBuffer=96*1024*1024,phase=`worker.${input.operation}`}={}){
  timeout=nativeCommandTimeout(timeout);
  timeout=nativeCommandTimeout(timeout);
  // File input avoids platform pipe stalls with bounded Office/PDF payloads.
  const directory=mkdtempSync(join(tmpdir(),'esia-native-input-')),path=join(directory,'input.json'),started=performance.now();let result;
  try{writeFileSync(path,JSON.stringify(input),{mode:0o600,flag:'wx'});result=spawnSync('python3',[worker,path],{encoding:'utf8',timeout,maxBuffer,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'},stdio:['ignore','pipe','pipe']});}finally{rmSync(directory,{recursive:true,force:true});}
  const failure=(error,reason)=>diagnose(error,{phase,command:'python3',reason,started,timeout});
  if(result.error)throw failure(fail(`Native template processing did not complete: ${result.error.code||'execution failure'}.`,503),result.error.code==='ETIMEDOUT'?'timeout':result.error.code==='ENOBUFS'?'output_bound':'unavailable');
  let output;try{output=JSON.parse(result.stdout);}catch{throw failure(fail('The native template adapter did not return a bounded result.',503),'invalid_result');}
  if(result.status!==0||output.error)throw failure(fail(output.error||'The native template source cannot be processed.',output.status||422),'exit');
  return output;
}
function inspectSafety(bytes,format){
  if(format==='pdf')return;
  const entries=boundedZip(bytes);
  if(!entries.has(format==='docx'?'word/document.xml':'xl/workbook.xml'))throw fail('The source package does not match its DOCX/XLSX extension.');
  for(const [name,entry]of entries){
    if(/(?:^|\/)(?:vbaproject|activex|embeddings|externallinks|connections|querytables|customui)|\.(?:bin|exe|dll|js|vbs)$/i.test(name))throw fail('Active content, embedded executable objects and external data are unsupported in native templates.');
    if(/\.(?:svgz?|html?|mhtml?|eps|ps|wmf|emf)$/i.test(name))throw fail('SVG, HTML, PostScript and metafile media need a separate sanitized native adapter.');
    if(/\.(?:xml|rels|vml)$/i.test(name)&&/macroEnabled|vbaProject|activeX|oleObject|altChunk|<\w*:?(?:script|object)(?:\s|>)/i.test(entry.bytes.toString()))throw fail('This template contains unsupported active or embedded content.');
  }
}

/** Native structure and anchor candidates only; no instructions or mappings are executed. */
export function analyzeClientTemplate({bytes,filename='',mediaType=''}={}){
  bytes=checkBytes(bytes);const format=formatOf({bytes,filename,mediaType});inspectSafety(bytes,format);
  return runWorker({operation:'analyze',format,bytes:bytes.toString('base64'),limits:nativeTemplateLimits});
}

/** Manual native inputs retain exact source text/locations and require the
 * ordinary mapping/reference approval workflow. No source original is edited. */
export function validateManualNativeTemplateFields({bytes,definition,filename='',mediaType=''}={}){
  bytes=checkBytes(bytes);const format=formatOf({bytes,filename,mediaType,format:definition?.format});inspectSafety(bytes,format);
  if(!definition||definition.sourceSha256!==hash(bytes))throw fail('Manual input targets require the exact retained original source.',409);
  return runWorker({operation:'validate-fields',format,bytes:bytes.toString('base64'),definition,limits:nativeTemplateLimits},{maxBuffer:1024*1024});
}

/** Receives already-resolved typed values, never binding expressions or canonical writes. */
export function populateNativeTemplate(bytes,{definition,resolvedValues={},filename=''}={}){
  bytes=checkBytes(bytes);const format=formatOf({bytes,filename,format:definition?.format});inspectSafety(bytes,format);
  if(!definition||definition.sourceSha256!==hash(bytes))throw fail('The native definition does not identify this exact retained source.',409);
  const output=runWorker({operation:'populate',format,bytes:bytes.toString('base64'),definition,resolvedValues,limits:nativeTemplateLimits});
  const resultBytes=Buffer.from(output.bytes,'base64');delete output.bytes;
  if(!resultBytes.length||resultBytes.length>nativeTemplateLimits.outputBytes)throw fail('The populated native output exceeds its 48 MiB bound.',413);
  return {...output,bytes:resultBytes,format,mediaType:{docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',pdf:'application/pdf'}[format]};
}

/** Bounded foreground tool runner; diagnostics never retain arguments or tool output. */
export async function executeNativeCommand(command,args,{timeout=nativeTemplateLimits.renderMilliseconds,cwd,env={},maximum=2*1024*1024,phase='native.command'}={}){
  await nativeExecutionDeadline.getStore()?.checkpoint?.();timeout=nativeCommandTimeout(timeout);const signal=nativeExecutionDeadline.getStore()?.signal;
  return new Promise((resolve,reject)=>{
    const started=performance.now(),child=spawn(command,args,{cwd,env:{...process.env,...env},detached:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='',size=0,settled=false;
    const failure=(error,reason,processState)=>diagnose(error,{phase,command,reason,started,timeout,processState});
    const stop=()=>{try{process.kill(-child.pid,'SIGKILL');}catch{try{child.kill('SIGKILL');}catch{}}};
    const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',aborted);error?reject(error):resolve(value);};
    const consume=(chunk,kind)=>{if(settled)return;size+=chunk.length;if(size>maximum){const processState=nativeCommandProcessState(child.pid);stop();finish(failure(fail('The native renderer exceeded its diagnostic output bound.',413),'output_bound',processState));return;}if(kind==='out')stdout+=chunk.toString();else stderr+=chunk.toString();};
    child.stdout.on('data',chunk=>consume(chunk,'out'));child.stderr.on('data',chunk=>consume(chunk,'err'));
    const timer=setTimeout(()=>{const processState=nativeCommandProcessState(child.pid);stop();finish(failure(fail('The native renderer exceeded its bounded stop time.',503),'timeout',processState));},timeout);
    const aborted=()=>{const processState=nativeCommandProcessState(child.pid);stop();finish(failure(fail('The bounded native job deadline expired.',504),'timeout',processState));};signal?.addEventListener('abort',aborted,{once:true});if(signal?.aborted)aborted();
    child.once('error',error=>finish(failure(fail(`Native rendering tool unavailable: ${error.code||command}.`,503),'unavailable')));
    child.once('close',code=>{stop();finish(code===0?null:failure(fail(`Native rendering failed in ${basename(command)} (${code}).`,503),'exit'),{stdout,stderr});});
  });
}
/** Office preparation and version detection share the original ten-second phase. */
export async function nativeOfficeVersion({env={},profileUri,renderKind='reference',prepare=prepareNativeOfficeLibrariesAsync,runCommand=executeNativeCommand}={}){
  const started=performance.now(),phase=name=>`${renderKind}.${name}`,libraries=await prepare({phase:phase('office_prepare')}),officeEnv=officeLibraryEnvironment(env,libraries),remaining=Math.floor(nativeOfficePackageLimits.versionMilliseconds-(performance.now()-started));
  if(remaining<1)throw diagnose(fail('The native renderer exceeded its bounded stop time.',503),{phase:phase('office_prepare'),command:'node',reason:'timeout',started,timeout:nativeOfficePackageLimits.versionMilliseconds});
  const result=await runCommand('libreoffice',[`-env:UserInstallation=${profileUri}`,'--version'],{env:officeEnv,timeout:remaining,phase:phase('office_version')});
  return {version:result.stdout.trim(),libraries,env:officeEnv};
}
let activeRenders=0;
async function renderOne(bytes,{filename='',format,expectedEngine,prepareOffice=prepareNativeOfficeLibrariesAsync}={},renderKind='reference'){
  if(expectedEngine!==undefined)pinnedPythonRuntime(expectedEngine);
  bytes=checkBytes(bytes);format=formatOf({bytes,filename,format});inspectSafety(bytes,format);
  // Re-run semantic package/PDF checks immediately before invoking converters.
  analyzeClientTemplate({bytes,filename:filename||`template.${format}`});
  const directory=mkdtempSync(join(tmpdir(),'esia-native-render-'));
  try{
    const {env,profileUri}=privateToolEnvironment(directory),phase=name=>`${renderKind}.${name}`,pythonRuntime=await nativePythonRuntime(renderKind);
    const {version:office,libraries,env:officeEnv}=await nativeOfficeVersion({env,profileUri,renderKind,prepare:prepareOffice});
    const poppler=(await executeNativeCommand('pdfinfo',['-v'],{env,timeout:10000,phase:phase('pdf_version')})).stderr.split('\n')[0].trim();
    const fonts=(await executeNativeCommand('fc-list',['--format','%{family}|%{style}|%{file}\n'],{env,timeout:10000,phase:phase('font_inventory')})).stdout.split('\n').filter(Boolean).sort();
    const adapter={id:'esia-native-ooxml-pdf',version:'1',javascriptSha256:hash(readFileSync(fileURLToPath(import.meta.url))),pythonSha256:hash(readFileSync(worker)),pythonRuntime,officeLibraries:officeLibraryEvidence(libraries)};
    const engine={id:'libreoffice-poppler',version:office,poppler,adapter,settings:{dpi:nativeTemplateLimits.dpi,color:'RGB',headless:true,locale:'C.UTF-8',fontsSha256:hash(Buffer.from(fonts.join('\n'))),fontCount:fonts.length,pdfExport:'LibreOffice native PDF export; no template scripts',spreadsheetCalculation:'OOXMLRecalcMode=0 (RECALC_ALWAYS); isolated user/registrymodifications.xcu',network:'External relationships, data connections and active content rejected; proxy denies outbound renderer requests.'}};
    if(expectedEngine!==undefined&&!isDeepStrictEqual(expectedEngine,engine))throw fail('The rendering engine, native adapter or installed font set differs from the pinned reference environment.',409);
    const source=join(directory,`source.${format}`);writeFileSync(source,bytes,{mode:0o600,flag:'wx'});
    const output=join(directory,'source.pdf');
    if(format!=='pdf'){
      await executeNativeCommand('libreoffice',[`-env:UserInstallation=${profileUri}`,'--headless','--nologo','--nodefault','--nofirststartwizard','--convert-to',format==='docx'?'pdf:writer_pdf_Export':'pdf:calc_pdf_Export','--outdir',directory,source],{env:officeEnv,cwd:directory,phase:phase('office_conversion')});
    }
    if(statSync(output).size>nativeTemplateLimits.outputBytes)throw fail('The rendered PDF exceeds its bounded size.',413);
    const pdf=readFileSync(output),info=(await executeNativeCommand('pdfinfo',[output],{env,timeout:10000,phase:phase('pdf_info')})).stdout;
    const pageCount=Number(/^Pages:\s+(\d+)/m.exec(info)?.[1]);
    if(!Number.isInteger(pageCount)||pageCount<1||pageCount>nativeTemplateLimits.pages)throw fail('The rendered PDF must contain between 1 and 40 pages.',413);
    // Validate every page's geometry before asking Poppler to allocate pixel buffers.
    runWorker({operation:'pdf-layout',path:output},{timeout:15000,phase:phase('pdf_geometry')});
    await executeNativeCommand('pdftoppm',['-png','-r',String(nativeTemplateLimits.dpi),'-f','1','-l',String(pageCount),output,join(directory,'page')],{env,phase:phase('pdf_raster')});
    const text=(await executeNativeCommand('pdftotext',['-layout',output,'-'],{env,maximum:4*1024*1024,phase:phase('pdf_text')})).stdout;
    const boundingBoxes=(await executeNativeCommand('pdftotext',['-bbox',output,'-'],{env,maximum:8*1024*1024,phase:phase('pdf_boxes')})).stdout;
    const layout=runWorker({operation:'pdf-layout',path:output,boundingBoxes},{timeout:15000,phase:phase('pdf_layout')});
    const pagePaths=readdirSync(directory).filter(name=>/^page-\d+\.png$/.test(name)).sort((a,b)=>Number(a.match(/\d+/)[0])-Number(b.match(/\d+/)[0]));
    const pages=pagePaths.map((name,index)=>{const png=readFileSync(join(directory,name));if(png.length>8*1024*1024)throw fail('A rendered reference page exceeds its 8 MiB bound.',413);return {page:index+1,png,width:png.readUInt32BE(16),height:png.readUInt32BE(20),sha256:hash(png)};});
    if(pages.length!==pageCount)throw fail('The renderer did not return every expected PDF page.',503);
    return {pdf,pages,engine,text,layout,pdfSha256:hash(pdf)};
  }finally{rmSync(directory,{recursive:true,force:true});}
}
export async function renderNativeTemplate(bytes,options={}){
  if(activeRenders)throw fail('A bounded native rendering job is already running. Retry when it finishes.',429);
  activeRenders++;try{return await renderOne(bytes,options);}finally{activeRenders--;}
}

export async function renderClientTemplate({bytes,filename='',definition,resolvedValues={},referenceRender}={}){
  if(activeRenders)throw fail('A bounded native rendering job is already running. Retry when it finishes.',429);
  if(referenceRender!==undefined)pinnedPythonRuntime(referenceRender?.engine);
  activeRenders++;
  try{
    const populated=populateNativeTemplate(bytes,{definition,resolvedValues,filename});
    const original=referenceRender||await renderOne(bytes,{filename,format:populated.format});
    const generated=await renderOne(populated.bytes,{filename:filename||`populated.${populated.format}`,format:populated.format,expectedEngine:original.engine},'populated');
    const directory=mkdtempSync(join(tmpdir(),'esia-native-diff-'));
    let differences;
    try{
      for(const [prefix,render]of [['original',original],['generated',generated]])for(const page of render.pages)writeFileSync(join(directory,`${prefix}-${page.page}.png`),page.png,{mode:0o600});
      differences=runWorker({operation:'diff',directory,originalLayout:original.layout,generatedLayout:generated.layout,changes:populated.changes,structure:populated.structuralValidation,limits:nativeTemplateLimits},{timeout:20000});
      for(const item of differences.pages){item.png=readFileSync(join(directory,item.file));delete item.file;}
    }finally{rmSync(directory,{recursive:true,force:true});}
    const normalize=value=>String(value??'').normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim(),renderedText=normalize(generated.text),renderedWords=renderedText.split(' '),missingFields=[];let checkedValues=0;
    const orderedWords=value=>{let position=0;for(const word of normalize(value).split(' ')){const found=renderedWords.indexOf(word,position);if(found<0)return false;position=found+1;}return true;};
    for(const change of populated.changes){const values=change.kind==='repeat_table'?(change.rows||[]).flatMap(row=>Object.values(row)):[change.value];for(const value of values){if(value===null||value===undefined||String(value).trim()==='')continue;checkedValues++;if(!renderedText.includes(normalize(value))&&!(change.kind==='repeat_table'&&orderedWords(value)))missingFields.push(change.fieldId);}}
    const formulaErrors=populated.format==='xlsx'?[...new Set(generated.text.match(/#(?:REF!|VALUE!|DIV\/0!|NAME\?|NUM!|N\/A\b|SPILL!)/g)||[])]:[];
    const calculations={passed:!formulaErrors.length,formulaErrors,sourceExpressionsPreserved:true,mode:populated.format==='xlsx'?'forced_hard_recalculation':'not_applicable',editableCachePolicy:populated.calculationPolicy||null};
    const semantic={passed:!missingFields.length&&!formulaErrors.length,checkedValueCount:checkedValues,missingFieldIds:[...new Set(missingFields)],method:'Normalized exact scalar text; ordered token subsequences for repeated table cells whose PDF extraction interleaves neighboring columns.',meaning:'Checks inserted values in the actual rendered PDF text alongside native anchor population. Visual overflow, source interpretation and professional conclusions require the independent human review.'};
    const validation={format:'esia-native-template-validation',schemaVersion:1,sourceSha256:populated.sourceSha256,outputSha256:hash(populated.bytes),structural:populated.structuralValidation,semantic,calculations,visual:{...differences,pages:differences.pages.map(({png,...page})=>page)},renderer:generated.engine,originalPdfSha256:original.pdfSha256,outputPdfSha256:generated.pdfSha256,expectedExpansion:populated.expectedExpansion,requiresHumanReview:true,status:'pending_human_review'};
    return {...populated,filename:`${basename(filename||'report',extname(filename||'report'))}-completed.${populated.format}`,renderer:generated.engine,validation,originalPdf:original.pdf,populatedPdf:generated.pdf,populatedText:generated.text,originalPages:original.pages,populatedPages:generated.pages,visualDiffs:differences.pages};
  }finally{activeRenders--;}
}
