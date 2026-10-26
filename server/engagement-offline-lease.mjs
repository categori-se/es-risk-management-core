// INTERNAL adapter proof, never a browser permission or portable attestation.
// The adapter freshly validates the canonical live server lease/role/project
// policy before supplying this proof, then rechecks authority at its head CAS.
import {createHash} from "node:crypto";
import {normalizeFieldDevicePolicy,fieldDevicePolicyDigestInput,assertFieldDeviceLease} from "../src/lib/field-device-policy.js";
import {assertEngagement as assert,exactKeys,stableJson,uuidPattern} from "../src/lib/engagement-domain.js";
import {normalizeEngagementFieldLeaseCaseScope} from './engagement-field-lease.mjs';

const hash=value=>createHash("sha256").update(value).digest("hex");
const same=(a,b)=>stableJson(a)===stableJson(b);
const identifier=value=>typeof value==="string"&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}$/.test(value)&&!value.includes("..");
const timestamp=value=>typeof value==="string"&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;

export function assertAuthenticatedOfflineLease(proof,{authentication,actorId,core,project,deviceLease,now=Date.now()}={}){
  assert(Number.isSafeInteger(now)&&now>=0,"Use the trusted current permission-validation clock.",403);
  exactKeys(proof,["format","schemaVersion","issuer","subject","sensitivity","includesOriginals","lease"],"Trusted authenticated offline permission");
  assert(authentication&&core.executionAuthority&&proof.format==="esia-authenticated-offline-lease"&&proof.schemaVersion===1&&proof.issuer===authentication.issuer&&proof.subject===authentication.subject&&authentication.userId===actorId&&core.executionAuthority.issuer===authentication.issuer,"The offline permission must use the current externally verified native User and original execution issuer.",403);
  assert(["internal","confidential","restricted"].includes(proof.sensitivity)&&typeof proof.includesOriginals==="boolean","The trusted offline permission requires explicit sensitivity and original-file scope.",403);
  const lease=proof.lease;
  exactKeys(lease,["id","revision","scope","policySha256","expiresAt","retentionReviewAt","devicePolicy","deviceLease","caseScope"],"Canonical server field permission proof");normalizeEngagementFieldLeaseCaseScope(lease.caseScope);
  assert(uuidPattern.test(lease.id||"")&&Number.isSafeInteger(lease.revision)&&lease.revision>=1&&lease.revision<=101,"Use the exact canonical server field permission and retained revision.",403);
  exactKeys(lease.scope,["accountId","projectId","workspaceId","engagementId","userId"],"Canonical server permission scope");
  assert(["accountId","projectId","workspaceId","engagementId","userId"].every(key=>identifier(lease.scope[key]))&&lease.scope.accountId===core.accountId&&lease.scope.projectId===core.projectId&&lease.scope.engagementId===core.id&&lease.scope.userId===actorId,"The offline permission belongs to another native User, account, project or engagement.",403);
  assert(project.id===core.projectId&&project.accountId===core.accountId&&(!project.workspaceId||project.workspaceId===lease.scope.workspaceId),"The offline permission differs from the authorized source-project scope.",403);
  for(const resource of project.resources||[])for(const version of resource.versions||[])if(version.reference?.workspace_id)assert(version.reference.workspace_id===lease.scope.workspaceId,"The offline permission differs from the exact original workspace authority.",403);
  const effective=normalizeFieldDevicePolicy(lease.devicePolicy),configured=normalizeFieldDevicePolicy(core.devicePolicy);
  assert(effective&&same(effective,lease.devicePolicy)&&hash(fieldDevicePolicyDigestInput(effective))===lease.policySha256,"The effective server device policy differs from its exact retained SHA256.",403);
  if(configured)assert((!effective.offlineAllowed||configured.offlineAllowed)&&(!effective.allowSourceOriginals||configured.allowSourceOriginals)&&effective.allowedSensitivities.every(value=>configured.allowedSensitivities.includes(value))&&["maxOfflineHours","autoLockMinutes","retentionHours"].every(key=>effective[key]<=configured[key]),"The effective server permission cannot weaken the current engagement device policy.",403);
  assert(same(deviceLease,lease.deviceLease)&&timestamp(lease.expiresAt)&&timestamp(lease.retentionReviewAt)&&lease.expiresAt===lease.deviceLease?.expiresAt&&lease.retentionReviewAt===lease.deviceLease?.retentionReviewAt,"The reviewed offline draft permission differs from the current exact server lease and dates.",403);
  return assertFieldDeviceLease(effective,lease.deviceLease,{scope:{accountId:core.accountId,projectId:core.projectId,engagementId:core.id},policySha256:lease.policySha256,now,sensitivity:proof.sensitivity,includesOriginals:proof.includesOriginals});
}
