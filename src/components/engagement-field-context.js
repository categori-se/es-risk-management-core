import {sealMonitoringPayload,unlockMonitoringPayload} from "./monitoring-private.js";
import {normalizeFieldDevicePolicy,createFieldDeviceLease,validateFieldDeviceLease,fieldDevicePolicyDigestInput} from "../lib/field-device-policy.js";

const object=value=>value!==null&&typeof value==="object"&&!Array.isArray(value);
const id=value=>{if(typeof value!=="string"||!/^[A-Za-z0-9_.:-]{1,192}$/.test(value))throw Error("Use the owning engagement, project and account for field preparation.");return value;};
const label=value=>String(value||"").slice(0,500);
const optionNames=["requirementIds","findingIds","commitmentIds","engagementActionIds","observationIds"];
const rows=(items,title)=>items.slice(0,100).map(item=>({id:id(item.id),label:label(title(item))}));
export const engagementFieldContextKey=scope=>`esia.engagement-field-context.v1.${id(scope.routingAccountId)}.${id(scope.projectId)}.${id(scope.engagementId)}`;
export function assertCurrentEngagementFieldContext(context,engagement){
  if(engagement.id!==context.scope.engagementId||engagement.projectId!==context.scope.projectId||engagement.accountId!==context.scope.accountId)throw Error("The current engagement belongs to another account or project.");
  if(fieldDevicePolicyDigestInput(engagement.devicePolicy)!==fieldDevicePolicyDigestInput(context.devicePolicy))throw Error("The engagement device policy changed. Review the current rules and explicitly prepare or renew field access.");
}

export function validateEngagementFieldContext(value,expected){
  if(!object(value)||value.format!=="esia-engagement-field-context"||value.schemaVersion!==1||Object.keys(value).some(key=>!["format","schemaVersion","scope","name","projectName","revision","preparedAt","devicePolicy","deviceLease","linkOptions"].includes(key)))throw Error("Choose a prepared encrypted engagement field context.");
  if(!object(value.scope)||Object.keys(value.scope).length!==4||["accountId","routingAccountId","projectId","engagementId"].some(key=>!id(value.scope[key])||expected?.[key]&&expected[key]!==value.scope[key]))throw Error("This prepared context belongs to another account, project or engagement.");
  if(typeof value.name!=="string"||value.name.length>500||typeof value.projectName!=="string"||value.projectName.length>500||!Number.isSafeInteger(value.revision)||value.revision<1||typeof value.preparedAt!=="string"||!Number.isFinite(Date.parse(value.preparedAt)))throw Error("The prepared engagement identity or date is invalid.");
  if(!object(value.linkOptions)||Object.keys(value.linkOptions).some(key=>!optionNames.includes(key)))throw Error("The prepared field links are invalid.");
  for(const name of optionNames){const options=value.linkOptions[name];if(!Array.isArray(options)||options.length>100||new Set(options.map(item=>item?.id)).size!==options.length||options.some(item=>!object(item)||Object.keys(item).some(key=>!["id","label"].includes(key))||!id(item.id)||typeof item.label!=="string"||item.label.length>500))throw Error("The prepared field links exceed their supported scope.");}
  normalizeFieldDevicePolicy(value.devicePolicy);return value;
}

export async function prepareEngagementFieldContext({engagement,project,routingAccountId},passphrase,{crypto=globalThis.crypto,now=Date.now()}={}){
  if(engagement.projectId!==project.id)throw Error("Select this engagement's owning project before field preparation.");
  const scope={accountId:id(engagement.accountId),routingAccountId:id(routingAccountId),projectId:id(project.id),engagementId:id(engagement.id)},policy=normalizeFieldDevicePolicy(engagement.devicePolicy);
  const deviceLease=await createFieldDeviceLease(policy,{accountId:scope.accountId,projectId:scope.projectId,engagementId:scope.engagementId},{crypto,now});
  const context={format:"esia-engagement-field-context",schemaVersion:1,scope,name:label(engagement.name),projectName:label(project.name),revision:engagement.revision,preparedAt:new Date(now).toISOString(),...(policy?{devicePolicy:policy,deviceLease}:{}),linkOptions:{
    requirementIds:rows(engagement.requirements||[],item=>item.title),findingIds:rows((engagement.findings||[]).filter(item=>!item.cycleId),item=>item.rationale),commitmentIds:rows(engagement.obligations||[],item=>item.text),engagementActionIds:rows((engagement.actions||[]).filter(item=>!item.cycleId),item=>item.description),observationIds:rows((engagement.sourceVersions||[]).filter(item=>/^field:/.test(item.resourceId||"")&&!/:attachment:/.test(item.resourceId)).map(item=>({...item,id:item.resourceId.slice(6)})),item=>item.title||item.filename)}};
  validateEngagementFieldContext(context,scope);await checkPolicy(context,{crypto,now});
  return {context,package:{format:"esia-encrypted-engagement-field-context",schemaVersion:1,restricted:await sealMonitoringPayload(context,passphrase,crypto)}};
}
async function checkPolicy(context,{crypto,now}){return validateFieldDeviceLease(context.devicePolicy,context.deviceLease,{scope:{accountId:context.scope.accountId,projectId:context.scope.projectId,engagementId:context.scope.engagementId},crypto,now});}
export async function openEngagementFieldContext(pack,passphrase,scope,{crypto=globalThis.crypto,now=Date.now()}={}){
  if(!object(pack)||Object.keys(pack).some(key=>!["format","schemaVersion","restricted"].includes(key))||pack.format!=="esia-encrypted-engagement-field-context"||pack.schemaVersion!==1||JSON.stringify(pack).length>512000)throw Error("Choose a bounded encrypted engagement field context.");
  const context=validateEngagementFieldContext(await unlockMonitoringPayload(pack.restricted,passphrase,crypto),scope);await checkPolicy(context,{crypto,now});return context;
}
