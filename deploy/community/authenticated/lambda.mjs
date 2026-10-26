// Optional customer-owned authenticated API entry. No categori.se pool/client,
// native user aliases, private storage migration map or cloud AI binding.
import {createAccessService} from '../../../server/access-service.mjs';
import {createAwsAdapters} from '../../../server/aws-adapters.mjs';
import {createGatewayHandler,verifiedGatewayPrincipal} from '../../../server/gateway-handler.mjs';
import {canonicalConfiguration} from '../../../server/canonical-identity.mjs';
import {parseAccountStorage} from '../../../server/account-storage.mjs';
import {parseRequirementLibraryIndex} from '../../../server/requirement-library.mjs';
import {parsePolicyOriginalCatalogIndex} from '../../../server/policy-original-catalog.mjs';

export function customerConfiguration(env){
  if(typeof __ESIA_COMMUNITY_SOURCE_TREE_SHA256__==='string'&&env.ESIA_COMMUNITY_SOURCE_SHA256!==__ESIA_COMMUNITY_SOURCE_TREE_SHA256__)throw Error('The deployed configuration does not identify the approved community source artifact.');
  const region=env.AWS_REGION,pool=env.ESIA_COGNITO_POOL,client=env.ESIA_COGNITO_CLIENT,issuer=env.ESIA_COGNITO_ISSUER,authority=env.ESIA_RESOURCE_AUTHORITY;
  if(!/^[a-z]{2}(?:-[a-z]+)+-\d$/.test(region||'')||!pool?.startsWith(region+'_')||!/^[A-Za-z0-9_-]{5,128}$/.test(pool)||!/^[a-z0-9]{10,128}$/.test(client||'')||issuer!==`https://cognito-idp.${region}.amazonaws.com/${pool}`||!/^\d{12}$/.test(env.ESIA_DEPLOYMENT_ACCOUNT_ID||'')||!env.ESIA_ACCESS_TABLE||env.ESIA_PRIVATE_BUCKET)throw Error('Explicit customer identity, deployment account, region and per-account storage configuration are required.');
  let url,origins;try{url=new URL(authority);origins=JSON.parse(env.ESIA_ALLOWED_ORIGINS_JSON);}catch{throw Error('Configure the exact customer HTTPS resource authority and approved origins.');}
  if(url.protocol!=='https:'||url.origin!==authority||url.username||url.password||!Array.isArray(origins)||origins.length<1||origins.length>8||origins.some(value=>{try{const item=new URL(value);return item.protocol!=='https:'||item.origin!==value;}catch{return true;}}))throw Error('Configure exact HTTPS origins without credentials, paths or wildcard access.');
  if(env.ESIA_CLIENT_TEMPLATE_NATIVE_FUNCTION_ARN||env.ESIA_CLIENT_TEMPLATE_NATIVE_JOBS==='true')throw Error('Configure a separately reviewed customer native-processing adapter before enabling remote functions.');
  canonicalConfiguration(env); // Explicitly rejects an unconfigured shared registry.
  const reservedBuckets=[env.ESIA_PUBLIC_ARCHIVE_BUCKET,env.ESIA_DEPLOYMENT_ARTIFACT_BUCKET].filter(Boolean);
  const initial=parseAccountStorage(env.ESIA_ACCOUNT_STORAGE_JSON,{reservedBuckets});
  const separate=[...reservedBuckets,...Object.values(initial).map(row=>row.bucket)];
  const requirementLibraryIndex=parseRequirementLibraryIndex(env.ESIA_REQUIREMENT_LIBRARY_INDEX,{reservedBuckets:separate});
  const policyOriginalsIndex=parsePolicyOriginalCatalogIndex(env.ESIA_POLICY_ORIGINALS_INDEX,{reservedBuckets:separate});
  const accountStorage=parseAccountStorage(env.ESIA_ACCOUNT_STORAGE_JSON,{reservedBuckets:[...separate.filter(bucket=>!Object.values(initial).some(row=>row.bucket===bucket)),...(requirementLibraryIndex?[requirementLibraryIndex.bucket]:[]),...(policyOriginalsIndex?[policyOriginalsIndex.bucket]:[])]});
  return{region,tableName:env.ESIA_ACCESS_TABLE,userPoolId:pool,expectedIssuer:issuer,expectedClientId:client,resourceAuthority:authority,allowedOrigins:origins,accountStorage,...(requirementLibraryIndex?{requirementLibraryIndex}:{}),...(policyOriginalsIndex?{policyOriginalsIndex,policyOriginalReservedBuckets:separate}:{})};
}

export function createCustomerHandler(env=process.env,adaptersFactory=createAwsAdapters,engagementFactory){
  const config=customerConfiguration(env),adapters=adaptersFactory(config),enabled=env.ESIA_AUTHENTICATED_ENGAGEMENTS==='true';
  if(enabled&&(typeof engagementFactory!=='function'||!adapters.engagementObjects))throw Error('Authenticated engagements require the configured immutable object and domain adapters.');
  const service=createAccessService({...config,...adapters,legacySubjects:{},...(enabled?{engagementOperations:engagementFactory({objects:adapters.engagementObjects,...(adapters.resolvePolicyOriginal?{resolvePolicyOriginal:adapters.resolvePolicyOriginal,readPolicyOriginal:adapters.readPolicyOriginal,readPolicyOriginalRange:adapters.readPolicyOriginalRange}:{})})}:{})});
  const gateway=createGatewayHandler({...config,service,recovery:{region:env.AWS_REGION,apiId:env.ESIA_API_ID,stage:env.ESIA_API_STAGE,generation:env.ESIA_DEPLOYMENT_GENERATION}});
  // No anonymous publication route in this customer API profile. API Gateway's
  // JWT authorizer and the service's current provider check remain independent.
  return async event=>{try{verifiedGatewayPrincipal(event,config);}catch{return{statusCode:401,headers:{'content-type':'application/json','cache-control':'no-store'},body:JSON.stringify({error:'A current customer-authorized access token is required.'})};}return gateway(event);};
}
let runtime;
export async function handler(event){if(!runtime){const factory=process.env.ESIA_AUTHENTICATED_ENGAGEMENTS==='true'?(await import('../../../server/authenticated-engagements.mjs')).createAuthenticatedEngagementOperations:undefined;runtime=createCustomerHandler(process.env,createAwsAdapters,factory);}return runtime(event);}
