import {AccessError} from "./access-service.mjs";
import {randomUUID} from "node:crypto";
import {gatewayAuditContext} from "./mutation-audit.mjs";
import {createEsiaRecoveryContext} from "./recovery-context.mjs";
import {withCanonicalIdentityOperation} from './canonical-identity.mjs';
import {createIntegrationReferenceTasks} from './integration-reference-tasks.mjs';
import {integrationConnectionProof} from './integration-connections.mjs';
import {renderPublicationHtml, renderPublicationFragment, publicationExport} from "./publication-renderers.mjs";

export function verifiedGatewayPrincipal(event, {expectedIssuer, expectedClientId, now = Date.now}) {
  const claims = event?.requestContext?.authorizer?.jwt?.claims;
  if (!claims || claims.iss !== expectedIssuer || claims.token_use !== "access" || claims.client_id !== expectedClientId ||
      typeof claims.sub !== "string" || !claims.sub || claims.sub.length > 512 || !Number.isFinite(Number(claims.exp)) || Number(claims.exp) * 1000 <= now()) {
    throw new AccessError(401, "A current Gateway-verified access token from the configured ESIA pool/client is required.");
  }
  if (claims.aud !== undefined && claims.aud !== expectedClientId) throw new AccessError(401, "Token audience does not match ESIA.");
  return {issuer: claims.iss, subject: claims.sub, clientId: claims.client_id, tokenUse: "access", expiresAt: Number(claims.exp) * 1000, request: gatewayAuditContext(event)};
}

export function createGatewayHandler({service, expectedIssuer, expectedClientId, recovery, now = Date.now, allowedOrigins = []}) {
  if (!service || !expectedIssuer || !expectedClientId) throw new Error("Gateway identity configuration is required.");
  const referenceTasks = createIntegrationReferenceTasks({now, resourceIndex(principal, body) {
    if (typeof service.integrationResourceIndex !== 'function') throw new AccessError(503, 'The owning-service resource index is not configured.');
    return service.integrationResourceIndex(principal, body);
  }});
  const handle=async event => {
    const headers = {"content-type": "application/json", "cache-control": "no-store"};
    try {
      const origin = event.headers?.origin || event.headers?.Origin;
      if (origin && !allowedOrigins.includes(origin)) throw new AccessError(403, "Origin is not configured for ESIA.");
      if (origin) headers["access-control-allow-origin"] = origin;
      const method = event.requestContext?.http?.method || event.httpMethod;
      const path = event.rawPath || event.path || "";
      if (event.isBase64Encoded) throw new AccessError(400, "Encoded request bodies are not supported.");
      const successorPart = method === 'POST' && /^\/api\/engagement-successors\/[a-f0-9-]{36}\/archives\/[a-f0-9]{64}$/.test(path);
      const caseDetails = method === 'PUT' && /^\/api\/engagements\/[a-f0-9-]{36}\/cases\/[a-f0-9-]{36}\/details$/.test(path);
      if (event.body && Buffer.byteLength(event.body) > (successorPart ? 700_000 : caseDetails ? 1536*1024 : 200_000)) throw new AccessError(413, "Request body exceeds the access API limit.");
      let body = {};
      if (event.body) {
        try { body = JSON.parse(event.body); } catch { throw new AccessError(400, "Request body must be JSON."); }
        if (!body || Array.isArray(body) || typeof body !== "object") throw new AccessError(400, "Request body must be an object.");
      }
      const query = event.queryStringParameters || {};
      if (method === "GET" && path === "/api/publication-catalog") {
        const result = await service.publicationCatalog(query);
        return {statusCode: 200, headers, body: JSON.stringify(result)};
      }
      if (method === "GET" && /^\/api\/publication-pages\/[A-Za-z0-9_.:-]+$/.test(path)) {
        const {publication} = await service.publicPublicationRead({publicationId: path.split("/")[3]}, {catalog: true});
        return {statusCode: 200, headers: {...headers, "content-type": "text/html; charset=utf-8", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer",
          "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"},
          body: renderPublicationHtml({...publication, id: publication.editionId}, {visibility: "public"})};
      }
      if (method === "POST" && path === "/api/publication-reads") {
        const result = await service.publicPublicationRead(body);
        return {statusCode: 200, headers, body: JSON.stringify(result)};
      }
      const principal = verifiedGatewayPrincipal(event, {expectedIssuer, expectedClientId, now});
      if (path.startsWith('/api/integrations/')) {
        const integrationStarted = now();
        if (method !== 'POST' || Object.keys(query).length) throw new AccessError(405, 'Use an explicit integration POST without query parameters.');
        const proof = integrationConnectionProof(event.headers, (status, message) => {throw new AccessError(status, message);});
        const manageConnection = path === '/api/integrations/connections/create' || path === '/api/integrations/connections/revoke';
        if (manageConnection && proof) throw new AccessError(403, 'Use native User authority to manage an owner connection.');
        if (proof) principal.integrationConnection = proof;
        // Finish the Gateway identity hook before the owning service performs
        // its final grant/case/field authorization transaction. No later async
        // identity request may leave a stale source decision as the last check.
        if (service.canonicalEnabled) await service.recheckIdentity(principal);
        if (manageConnection) {
          const name = path.endsWith('/create') ? 'integrationConnectionCreate' : 'integrationConnectionRevoke';
          if (typeof service[name] !== 'function') throw new AccessError(503, 'Owner connection management is not configured.');
          const result = await service[name](principal, body);
          if (principal.expiresAt <= now()) throw new AccessError(403, 'Current native authority expired before return.');
          const serialized = JSON.stringify(result);
          if (Buffer.byteLength(serialized) > 65536) throw new AccessError(413, 'The connection response exceeds its metadata limit.');
          return {statusCode:200,headers,body:serialized};
        }
        let result;
        if (path === '/api/integrations/resource-index') {
          if (typeof service.integrationResourceIndex !== 'function') throw new AccessError(503, 'The owning-service resource index is not configured.');
          result = await service.integrationResourceIndex(principal, body);
        } else if (path === '/api/integrations/tasks/plan') result = await referenceTasks.plan(principal, body);
        else if (path === '/api/integrations/tasks/describe') result = await referenceTasks.describe(principal, body);
        else throw new AccessError(404, 'This integration operation has no configured adapter.');
        if (principal.expiresAt <= now() || Date.parse(result.expiresAt) <= now()) throw new AccessError(403, 'Current integration authority expired before return.');
        if (path !== '/api/integrations/resource-index' && now() - integrationStarted >= body.budget.maxDurationMs) throw new AccessError(408, 'The metadata task response deadline elapsed.');
        const serialized = JSON.stringify(result);
        if (Buffer.byteLength(serialized) > 65536) throw new AccessError(413, 'The integration response exceeds its 64 KiB metadata limit.');
        return {statusCode:200, headers, body:serialized};
      }
      const templateStudioRoute=/^\/api\/engagements\/([a-f0-9-]{36})\/client-template-studio$/.exec(path);
      if(templateStudioRoute){
        if(method!=='POST'||Object.keys(query).length)throw new AccessError(405,'Use the exact engagement-scoped Template Studio operation.');
        if(typeof service.clientTemplateOperation!=='function')throw new AccessError(503,'Authenticated Template Studio is not configured.');
        let result=await service.clientTemplateOperation(principal,templateStudioRoute[1],body);
        if(service.canonicalEnabled)await service.recheckIdentity(principal);
        let serialized=JSON.stringify(result);if(Buffer.byteLength(serialized)>4*1024*1024){result=await service.engagementJsonResponse(principal,templateStudioRoute[1],result,'response');serialized=JSON.stringify(result);}
        return {statusCode:200,headers,body:serialized};
      }
      const successorRoute=/^\/api\/engagement-successors(?:\/([a-f0-9-]{36})(?:\/(create|archives\/([a-f0-9]{64})))?)?$/.exec(path);
      if(successorRoute){
        const [,stageId,operation,archiveSha256]=successorRoute;
        if(Object.keys(query).length)throw new AccessError(405,'Use the exact successor operation without query parameters.');
        const call=async(name,...args)=>{if(typeof service[name]!=='function')throw new AccessError(503,'Authenticated successor import is not configured.');return service[name](principal,...args);};
        let result;
        if(!stageId&&method==='POST')result=await call('engagementSuccessorBegin',body);
        else if(stageId&&!operation&&method==='GET'&&!Object.keys(body).length)result=await call('engagementSuccessorStage',stageId);
        else if(operation==='create'&&method==='POST')result=await call('engagementCreateSuccessor',stageId,body);
        else if(archiveSha256&&method==='POST')result=await call('engagementSuccessorPart',stageId,archiveSha256,body);
        else throw new AccessError(405,'Use the exact explicit successor import operation.');
        if(service.canonicalEnabled)await service.recheckIdentity(principal);
        let serialized=JSON.stringify(result);
        if(Buffer.byteLength(serialized)>4*1024*1024){if(operation!=='create'||!/^[a-f0-9-]{36}$/.test(result?.id||'')||typeof service.engagementJsonResponse!=='function')throw new AccessError(413,'This successor response exceeds its bounded metadata transport.');result=await call('engagementJsonResponse',result.id,result,'response');serialized=JSON.stringify(result);}
        return {statusCode:200,headers,body:serialized};
      }
      const originRoute=/^\/api\/engagements\/([a-f0-9-]{36})\/origins(?:\/([a-f0-9]{64})\/(manifest|chunk|download))?$/.exec(path);
      if(originRoute){
        const [,engagementId,archiveSha256,operation]=originRoute;
        const call=async(name,...args)=>{if(typeof service[name]!=='function')throw new AccessError(503,'Authenticated origin history is not configured.');return service[name](principal,...args);};
        const keys=Object.keys(query),historical=operation==='download'&&keys.length===2&&keys.includes('engagementId')&&keys.includes('renditionId')&&keys.every(key=>/^[a-f0-9-]{36}$/.test(query[key]||''));
        if(keys.length&&!historical)throw new AccessError(405,'Choose an exact historical engagement and issued rendition.');
        let result;
        if(!operation&&method==='GET'&&!Object.keys(body).length)result=await call('engagementOrigins',engagementId);
        else if(operation==='manifest'&&method==='GET'&&!Object.keys(body).length)result=await call('engagementOriginTransfer',engagementId,archiveSha256);
        else if(operation==='chunk'&&method==='POST')result=await call('engagementOriginTransfer',engagementId,archiveSha256,body);
        else if(operation==='download'&&method==='POST'&&!Object.keys(body).length){
          if(!historical){const manifest=await call('engagementOriginTransfer',engagementId,archiveSha256);if(manifest.size_bytes>4*1024*1024)throw new AccessError(413,'Use the bounded origin manifest and chunk download.');}
          result=await call('engagementOrigin',engagementId,archiveSha256,historical?query:{});
        }else throw new AccessError(405,'Use the exact historical archive read operation.');
        if(service.canonicalEnabled)await service.recheckIdentity(principal);
        if(operation==='download'){
          if(!(result.bytes instanceof Uint8Array)||result.bytes.length>4*1024*1024)throw new AccessError(413,'Use the bounded original archive transfer to retrieve this retained history.');
          const filename=String(result.filename||'engagement-history.json').replace(/[^A-Za-z0-9._-]/g,'_').slice(0,180);
          return {statusCode:200,headers:{...headers,'content-type':'application/octet-stream','content-disposition':`attachment; filename="${filename}"`,'content-security-policy':"sandbox; default-src 'none'",'x-content-type-options':'nosniff'},isBase64Encoded:true,body:Buffer.from(result.bytes).toString('base64')};
        }
        const serialized=JSON.stringify(result);if(Buffer.byteLength(serialized)>4*1024*1024)throw new AccessError(413,'The origin history metadata exceeds its bounded transport.');return {statusCode:200,headers,body:serialized};
      }
      const engagementLibraryRoute=/^\/api\/engagements\/([a-f0-9-]{36})\/requirements\/([a-z0-9_]+)(?:\/sources\/([a-f0-9]{64})\/(preview|download|manifest|chunk))?$/.exec(path);
      if(engagementLibraryRoute){
        const [,engagementId,frameworkId,sourceSha256,operation]=engagementLibraryRoute;
        if(!sourceSha256&&method!=="GET"||sourceSha256&&method!==(["download","chunk"].includes(operation)?"POST":"GET"))throw new AccessError(405,"Use the exact requirement library read action.");
        if(Object.keys(query).some(key=>key!==(sourceSha256?"page":"after"))||["download","manifest","chunk"].includes(operation)&&Object.keys(query).length)throw new AccessError(400,"Use the exact requirement page or source preview position.");
        const name=["manifest","chunk"].includes(operation)?"engagementPolicySourceTransfer":sourceSha256?"engagementPolicySource":"engagementRequirementLibrary";if(typeof service[name]!=="function")throw new AccessError(503,"Authenticated requirement library access is not configured.");
        const result=["manifest","chunk"].includes(operation)?await service[name](principal,engagementId,frameworkId,sourceSha256,operation==="chunk"?body:undefined):sourceSha256?await service[name](principal,engagementId,frameworkId,sourceSha256,{download:operation==="download",page:query.page||1}):await service[name](principal,engagementId,frameworkId,query);
        if(service.canonicalEnabled)await service.recheckIdentity(principal);
        if(operation==="download"){
          if(!(result.bytes instanceof Uint8Array)||result.bytes.length>4*1024*1024)throw new AccessError(413,"This policy original requires a bounded authorized transfer.");
          const filename=String(result.filename||"policy.pdf").replace(/[^A-Za-z0-9._-]/g,"_").slice(0,180);
          return {statusCode:200,headers:{...headers,"content-type":"application/octet-stream","content-disposition":`attachment; filename="${filename}"`,"content-security-policy":"sandbox; default-src 'none'","x-content-type-options":"nosniff"},isBase64Encoded:true,body:Buffer.from(result.bytes).toString("base64")};
        }
        const serialized=JSON.stringify(result);if(Buffer.byteLength(serialized)>4*1024*1024)throw new AccessError(413,"Use a bounded requirement library page.");return {statusCode:200,headers,body:serialized};
      }
      const caseRoute=/^\/api\/engagements\/([a-f0-9-]{36})\/cases\/([a-f0-9-]{36})\/(access|acl|source-intents|details(?:\/read)?)$/.exec(path);
      if(caseRoute){const [,engagementId,caseId,operation]=caseRoute;if(Object.keys(query).length)throw new AccessError(400,'Use the exact protected case operation.');const name={access:{GET:'engagementCaseAccess'},acl:{GET:'engagementCaseAcl',PUT:'engagementCaseSetAcl'},details:{PUT:'engagementCaseSaveDetails'},'source-intents':{POST:'engagementCaseRegisterSourceIntent'},'details/read':{POST:'engagementCaseDetails'}}[operation]?.[method];if(!name)throw new AccessError(405,'Choose the supported protected case read or update.');if(typeof service[name]!=='function')throw new AccessError(503,'Protected case access is not configured.');let result=await service[name](principal,engagementId,caseId,...(['PUT','POST'].includes(method)?[body]:[]));if(service.canonicalEnabled)await service.recheckIdentity(principal);let json=JSON.stringify(result);if(Buffer.byteLength(json)>4*1024*1024){if(name!=='engagementCaseSaveDetails')throw new AccessError(413,'Choose fewer protected case fields for this bounded read.');result=await service.engagementJsonResponse(principal,engagementId,result,'response');json=JSON.stringify(result);}return {statusCode:200,headers,body:json};}
      const privacyRoute=/^\/api\/projects\/([A-Za-z0-9_.:-]+)\/case-privacy$/.exec(path);
      if(privacyRoute){if(method!=='POST'||Object.keys(query).length)throw new AccessError(405,'Initialize project case privacy explicitly.');if(typeof service.engagementInitializeCasePrivacy!=='function')throw new AccessError(503,'Project privacy initialization is not configured.');const result=await service.engagementInitializeCasePrivacy(principal,privacyRoute[1],body);if(service.canonicalEnabled)await service.recheckIdentity(principal);return {statusCode:200,headers,body:JSON.stringify(result)};}
      const engagementRoute=/^\/api\/engagements(?:\/([a-f0-9-]{36})(?:\/(commands|project|exchange|sources|assistant|index|search|assist|issued|document-classifications|document-comparisons|document-relations|monitoring-attention|baselines|intake-context|source-attachments|field-context|field-captures|offline-assessments|json-transfer)(?:\/([^/]+)(?:\/(preview|passage-preview|download|manifest|chunk|export|exports))?)?)?)?$/.exec(path);
      if(engagementRoute){
        const [,engagementId,operation,encodedVersion,sourceOperation]=engagementRoute;
        if(operation==="offline-assessments"&&(!["prepare","commands","options","validate","renewal-review","renew"].includes(encodedVersion)||sourceOperation)||operation==="field-captures"&&(encodedVersion&&encodedVersion!=="review"||sourceOperation)||operation==="field-context"&&(encodedVersion&&encodedVersion!=="prepare"||sourceOperation)||encodedVersion&&!["sources","issued","baselines","json-transfer","field-context","field-captures","offline-assessments"].includes(operation)||operation==="json-transfer"&&(!encodedVersion||sourceOperation)||operation==="issued"&&sourceOperation&&!["manifest","chunk"].includes(sourceOperation)||operation==="sources"&&(!encodedVersion||!["preview","passage-preview","download","manifest","chunk"].includes(sourceOperation)))throw new AccessError(405,"Use the exact authenticated engagement operation path.");
        const call=async(name,...args)=>{if(typeof service[name]!=="function")throw new AccessError(503,"Authenticated engagement execution is not configured.");return service[name](principal,...args);};
        let result,binary=false;
        if(!engagementId&&method==="GET")result=await call("listEngagements",query);
        else if(!engagementId&&method==="POST")result=await call("createEngagement",body);
        else if(!operation&&method==="GET")result=await call("getEngagement",engagementId);
        else if(operation==="commands"&&method==="POST")result=await call("engagementCommand",engagementId,body);
        else if(operation==="document-classifications"&&method==="POST")result=await call("engagementDocumentClassification",engagementId,body);
        else if(["document-comparisons","document-relations"].includes(operation)&&method==="POST"&&!Object.keys(query).length)result=await call(operation==="document-comparisons"?"engagementDocumentComparison":"engagementDocumentRelation",engagementId,body);
        else if(operation==='monitoring-attention'&&method==='GET')result=await call('engagementMonitoringAttention',engagementId,query);
        else if(operation==="intake-context"&&method==="GET")result=await call("engagementIntakeContext",engagementId);
        else if(operation==="field-context"&&!encodedVersion&&method==="GET")result=await call("engagementFieldContext",engagementId);
        else if(operation==="field-context"&&encodedVersion==="prepare"&&method==="POST")result=await call("engagementPrepareFieldContext",engagementId,body);
        else if(operation==="offline-assessments"&&method==="POST"&&!Object.keys(query).length)result=await call({prepare:"engagementPrepareOfflineAssessment",commands:"engagementOfflineAssessmentCommand",options:"engagementOfflineSourceOptions",validate:"engagementValidateOfflineAssessment","renewal-review":"engagementReviewOfflineRenewal",renew:"engagementRenewOfflineAssessment"}[encodedVersion],engagementId,body);
        else if(operation==="field-captures"&&encodedVersion==="review"&&method==="POST")result=await call("engagementReviewFieldCapture",engagementId,body);
        else if(operation==="field-captures"&&!encodedVersion&&method==="POST")result=await call("engagementAttachFieldCapture",engagementId,body);
        else if(operation==="source-attachments"&&method==="POST")result=await call("engagementAttachSources",engagementId,body);
        else if(operation==="json-transfer"&&["GET","POST"].includes(method)&&!Object.keys(query).length)result=await call("engagementJsonTransfer",engagementId,encodedVersion,method==="POST"?body:undefined);
        else if(operation==="project"&&method==="GET")result=await call("engagementProject",engagementId);
        else if(operation==="exchange"&&method==="GET")result=await call("engagementExchange",engagementId);
        else if(operation==="assistant"&&method==="GET"&&!encodedVersion)result=await call("engagementAnalysis",engagementId,"assistant");
        else if(["index","search","assist"].includes(operation)&&method==="POST"&&!encodedVersion)result=await call("engagementAnalysis",engagementId,operation,body);
        else if(operation==="baselines"&&encodedVersion&&((sourceOperation==="exports"&&method==="POST")||(sourceOperation==="export"&&method==="GET"))){
          if(!/^[a-f0-9-]{36}$/.test(encodedVersion))throw new AccessError(400,"Use an exact approved baseline identifier.");
          let exportBody=body;if(method==="GET"){
            if(Object.keys(query).some(key=>!["format","kind","programId","cycleId","eventId","request_id"].includes(key)))throw new AccessError(400,"Choose an exact output format and report selection.");
            const selection=Object.fromEntries(Object.entries(query).filter(([key])=>!["format","request_id"].includes(key)));exportBody={request_id:query.request_id||randomUUID(),format:query.format||"json",...(Object.keys(selection).length?{selection}:{})};
          }
          result=await call("engagementExport",engagementId,encodedVersion,exportBody);
          if(method==="GET"){const issued=await call("engagementIssued",engagementId,result.rendition.id);result={...issued.metadata,bytes:issued.bytes};binary=true;}
        }
        else if(operation==="issued"&&((method==="GET"&&sourceOperation!=="chunk")||(method==="POST"&&sourceOperation==="chunk"))){
          if(encodedVersion&& !/^[a-f0-9-]{36}$/.test(encodedVersion))throw new AccessError(400,"Use an exact issued rendition identifier.");
          if(sourceOperation){result=await call("engagementIssuedTransfer",engagementId,encodedVersion,sourceOperation==="chunk"?body:undefined);}
          else if(encodedVersion){const issued=await call("engagementIssued",engagementId,encodedVersion);result={...issued.metadata,bytes:issued.bytes};binary=true;}
          else result=await call("engagementAnalysis",engagementId,"issued-list");
        }
        else if(operation==="sources"&&encodedVersion&&method===(["download","chunk","passage-preview"].includes(sourceOperation)?"POST":"GET")){
          let versionId;try{versionId=decodeURIComponent(encodedVersion);}catch{throw new AccessError(400,"Use an exact source-version identifier.");}
          if(!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}$/.test(versionId)||versionId.includes(".."))throw new AccessError(400,"Use an exact source-version identifier.");
          if(sourceOperation==="passage-preview"&&Object.keys(query).length)throw new AccessError(400,"Use an explicit passage preview body with its exact original hash and anchor.");
          result=sourceOperation==="passage-preview"?await call("engagementSourcePassage",engagementId,versionId,body):["manifest","chunk"].includes(sourceOperation)?await call("engagementSourceTransfer",engagementId,versionId,sourceOperation==="chunk"?body:undefined):await call("engagementSource",engagementId,versionId,{preview:sourceOperation==="preview",page:query.page||1});binary=sourceOperation==="download";
        }else throw new AccessError(405,"This authenticated engagement operation is unavailable.");
        if(service.canonicalEnabled)await service.recheckIdentity(principal);
        if(binary){
          if(!(result.bytes instanceof Uint8Array)||result.bytes.length>4*1024*1024)throw new AccessError(413,"This original requires a bounded scoped download transfer.");
          const filename=String(result.filename||"original").replace(/[^A-Za-z0-9._-]/g,"_").slice(0,180);
          return {statusCode:200,headers:{...headers,"content-type":"application/octet-stream","content-disposition":`attachment; filename="${filename}"`,"content-security-policy":"sandbox; default-src 'none'","x-content-type-options":"nosniff"},isBase64Encoded:true,body:Buffer.from(result.bytes).toString("base64")};
        }
        let json=JSON.stringify(result);if(Buffer.byteLength(json)>4*1024*1024){const scope=engagementId||result.id||result.engagement?.id;if(!/^[a-f0-9-]{36}$/.test(scope||""))throw new AccessError(413,"This engagement response requires a bounded scoped transfer.");const projection=method==="GET"&&!operation?"engagement":method==="GET"&&["project","exchange"].includes(operation)?operation:"response";result=await call("engagementJsonResponse",scope,result,projection);json=JSON.stringify(result);}
        return {statusCode:200,headers,body:json};
      }
      if (method === "POST" && path === "/api/publication-previews") {
        await service.recheckIdentity(principal);
        return {statusCode: 200, headers, body: JSON.stringify({html: renderPublicationFragment(body.content)})};
      }
      const publicationDownload = /^\/api\/publications\/([A-Za-z0-9_.:-]+)\/editions\/([A-Za-z0-9_.:-]+)\/export$/.exec(path);
      if (publicationDownload && method === "GET") {
        const [, publicationId, editionId] = publicationDownload, {edition} = await service.getPublicationEdition(principal, publicationId, editionId);
        const artifact = await publicationExport(edition, query.format || "html");
        await service.getPublicationEdition(principal, publicationId, editionId);
        const filename = `${String(edition.content.title).replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 100)}-${edition.id}.${artifact.extension}`;
        return {statusCode: 200, headers: {...headers, "content-type": artifact.mediaType, "content-disposition": `attachment; filename="${filename}"`,
          "x-content-type-options": "nosniff", "content-security-policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'"},
          isBase64Encoded: true, body: artifact.bytes.toString("base64")};
      }
      let result;
      if (method === "GET" && path === "/api/recovery-context") result = await createEsiaRecoveryContext({event, configuration: recovery, principal, service, now});
      else if (method === "GET" && path === "/api/session-context") result = await service.session(principal);
      else if (["GET", "PATCH"].includes(method) && path === "/api/me/workspace") result = await service.workspace(principal, method === "GET" ? undefined : body);
      else if (["GET", "PUT"].includes(method) && path === "/api/me/notifications") result = await service.notifications(principal, method === "GET" ? undefined : body);
      else if (method === "GET" && path === "/api/accounts") result = await service.listAccounts(principal);
      else if (method === "POST" && path === "/api/accounts") result = await service.createAccount(principal, body);
      else if (method === "GET" && path === "/api/projects") result = await service.listProjects(principal);
      else if (method === "POST" && path === "/api/projects") result = await service.createProject(principal, body);
      else if (method === "GET" && /^\/api\/projects\/[^/]+$/.test(path)) result = await service.getProject(principal, path.split("/")[3]);
      else if (method === "GET" && /^\/api\/projects\/[A-Za-z0-9_.:-]+\/requirements\/[A-Za-z0-9_]+$/.test(path)) result = await service.requirementLibrary(principal, path.split("/")[3], path.split("/")[5], query);
      else if (["GET", "PUT"].includes(method) && /^\/api\/(projects|documents|notebooks)\/[^/]+\/grants$/.test(path)) {
        result = await service.grants(principal, {projects: "project", documents: "document", notebooks: "notebook"}[path.split("/")[2]], path.split("/")[3], method === "GET" ? undefined : body);
      }
      else if (method === "GET" && path === "/api/publications") result = await service.listPublications(principal, query);
      else if (method === "POST" && path === "/api/publications") result = await service.createPublication(principal, body);
      else if (["GET", "PATCH"].includes(method) && /^\/api\/publications\/[^/]+$/.test(path)) result = await service[method === "GET" ? "getPublication" : "savePublication"](principal, path.split("/")[3], ...(method === "GET" ? [] : [body]));
      else if (method === "POST" && /^\/api\/publications\/[^/]+\/editions$/.test(path)) result = await service.issuePublication(principal, path.split("/")[3], body);
      else if (method === "GET" && /^\/api\/publications\/[^/]+\/editions\/[^/]+$/.test(path)) result = await service.getPublicationEdition(principal, path.split("/")[3], path.split("/")[5]);
      else if (method === "POST" && /^\/api\/publications\/[^/]+\/share$/.test(path)) result = await service.sharePublication(principal, path.split("/")[3], body);
      else if (method === "GET" && path === "/api/invitations") result = await service.listInvitations(principal,query);
      else if (method === "GET" && /^\/api\/invitations\/[^/]+$/.test(path)) result = await service.previewInvitation(principal, path.split("/")[3]);
      else if (method === "POST" && path === "/api/invitations") result = await service.invitation(principal, body);
      else if (method === "POST" && /^\/api\/invitations\/[^/]+\/(accept|revoke)$/.test(path)) {
        result = await service[path.endsWith("/accept") ? "acceptInvitation" : "revokeInvitation"](principal, path.split("/")[3], body);
      }
      else if (method === "POST" && path === "/api/permissions/effective") result = await service.effective(principal, body);
      else if (method === "GET" && path === "/api/artifacts") result = await service.artifacts(principal, query);
      else if (method === "POST" && path === "/api/artifacts") result = await service.createArtifact(principal, body);
      else if (method === "POST" && /^\/api\/artifacts\/[^/]+\/finalize$/.test(path)) result = await service.finalizeArtifact(principal, path.split("/")[3], body);
      else if (method === "POST" && path === "/api/uploads/presign") result = await service.presignArtifact(principal, body);
      else if (method === "POST" && path === "/api/artifacts/download") result = await service.presignArtifact(principal, body, "get");
      else if (method === 'POST' && path === '/api/downloads/chunk') result = await service.downloadChunk(principal, body);
      else if (method === "POST" && path === "/api/policy-audits/presign") result = await service.presignAudit(principal, body);
      else if (method === "POST" && path === "/api/policy-audits/edition-requests") result = await service.registerReview(principal, body);
      else if (method === "POST" && path === "/api/policy-audits/editions") result = await service.listReviews(principal, body);
      else if (method === "POST" && /^\/api\/policy-audits\/edition-requests\/[^/]+\/(presign|promote)$/.test(path)) result = await service[path.endsWith("/presign") ? "presignReview" : "promoteReview"](principal, path.split("/")[4], body);
      else if (method === "POST" && path === "/api/policy-audits/read") result = await service.readAudit(principal, body);
      else if (method === "PATCH" && /^\/api\/admin\/(users|workspaces|identities|accounts)\/[^/]+\/lifecycle$/.test(path)) {
        const type = {users: "user", workspaces: "workspace", identities: "identity", accounts: "account"}[path.split("/")[3]];
        result = await service.lifecycle(principal, type, path.split("/")[4], body);
      }
      else if (method === "GET" && path === "/api/teams") result = await service.listTeams(principal, query);
      else if (method === "POST" && path === "/api/teams") result = await service.createTeam(principal, body);
      else if (["GET", "PATCH"].includes(method) && /^\/api\/teams\/[^/]+$/.test(path)) result = await service.team(principal, path.split("/")[3], method === "GET" ? undefined : body);
      else if (["GET", "PATCH"].includes(method) && /^\/api\/teams\/[^/]+\/members$/.test(path)) result = await service.teamMembers(principal, path.split("/")[3], method === "GET" ? undefined : body);
      else if (method === "GET" && /^\/api\/accounts\/[^/]+\/teams$/.test(path)) result = await service.listTeams(principal, {...query, account_id: path.split("/")[3]});
      else throw new AccessError(404, "ESIA API route not found.");
      if(service.canonicalEnabled)await service.recheckIdentity(principal);
      return {statusCode: 200, headers, body: JSON.stringify(result)};
    } catch (error) {
      const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : error instanceof TypeError ? 400 : 503;
      return {statusCode, headers, body: JSON.stringify({error: statusCode === 503 ? "ESIA access backend is unavailable." : error.message})};
    }
  };
  return service.canonicalEnabled?event=>withCanonicalIdentityOperation(()=>handle(event)):handle;
}
