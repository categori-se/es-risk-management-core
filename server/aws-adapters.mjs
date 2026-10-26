import {esiaMigrationRead} from "./storage-migrations.mjs";
import {DynamoDBClient} from "@aws-sdk/client-dynamodb";
import {DynamoDBDocumentClient, GetCommand, QueryCommand, TransactWriteCommand} from "@aws-sdk/lib-dynamodb";
import {CognitoIdentityProviderClient, AdminGetUserCommand} from "@aws-sdk/client-cognito-identity-provider";
import {S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand} from "@aws-sdk/client-s3";
import {LambdaClient,InvokeCommand} from '@aws-sdk/client-lambda';
import {createRemoteClientTemplateNative} from './client-template-native-remote.mjs';
import {createClientTemplateNativeJobs,createClientTemplateNativeJobRepository,verifyNativeTemplateJobAuthority} from './client-template-native-jobs.mjs';
import {createHash} from "node:crypto";
import {getSignedUrl} from "@aws-sdk/s3-request-presigner";
import {createAccountStorage} from "./account-storage.mjs";
import {createRequirementLibrary, validateRequirementTarget, validateRequirementIndex, requirementLibraryLimits} from "./requirement-library.mjs";
import {AccessConflict, assertAppendOnlyAuditOperation, assertGrantSetTransaction, assertTeamSetTransaction, prepareDocumentAuthorityTransaction} from "./access-store.mjs";
import {createS3PolicyOriginalProvider} from "./policy-original-provider.mjs";
import {createS3EngagementObjectStore} from "./engagement-object-store.mjs";
import {canonicalKey, canonicalRow, canonicalOperationChecks, assertCanonicalDeadline, CanonicalIdentityError,
  createCanonicalIdentity, createCanonicalCurrentVerifier} from './canonical-identity.mjs';

export function createDynamoAccessStore({client, tableName, canonicalTable}) {
  if (!client || !tableName) throw new Error("Access table configuration required");
  if(canonicalTable&&client.middlewareStack)client.middlewareStack.add(next=>async args=>{
    assertCanonicalDeadline();return next(args);
  },{name:'esiaCanonicalDeadline',step:'finalizeRequest',priority:'low',override:true});
  function rootTarget(pk,sk){
    if(!canonicalTable||canonicalTable===tableName||!canonicalKey(pk,sk))throw new CanonicalIdentityError(503,'The original ecosystem identity table is not configured.');
    return canonicalTable;
  }
  return {
    async get(pk, sk) {
      const root=pk.startsWith('APP_IDENTITY#');
      const result = await client.send(new GetCommand({TableName: root?rootTarget(pk,sk):tableName, Key: {pk, sk}, ConsistentRead: true}));
      if (root && !result.Item && /^APP_IDENTITY#GROUP_ALIAS#[a-f0-9]{64}$/.test(pk) && sk === 'PROFILE') return null;
      return root?canonicalRow(result.Item,pk,sk):result.Item || null;
    },
    async list(pk, prefix = "") {
      if(pk.startsWith('APP_IDENTITY#'))throw new CanonicalIdentityError(403,'The owning identity registry cannot be listed by this app.');
      const rows = [];
      let cursor;
      do {
        const page = await client.send(new QueryCommand({TableName: tableName, ConsistentRead: true,
          KeyConditionExpression: "#pk = :pk AND begins_with(#sk, :prefix)", ExpressionAttributeNames: {"#pk": "pk", "#sk": "sk"},
          ExpressionAttributeValues: {":pk": pk, ":prefix": prefix}, ...(cursor ? {ExclusiveStartKey: cursor} : {})}));
        rows.push(...(page.Items || [])); cursor = page.LastEvaluatedKey;
        if (rows.length > 2000) throw new Error("Access navigation limit exceeded");
      } while (cursor);
      return rows;
    },
    async listPage(pk, prefix = "", {after = null, limit = 40} = {}) {
      if(pk.startsWith('APP_IDENTITY#'))throw new CanonicalIdentityError(403,'The owning identity registry cannot be listed by this app.');
      if (!Number.isInteger(limit) || limit < 1 || limit > 101 || after !== null && (typeof after !== "string" || !after.startsWith(prefix))) throw new TypeError("Invalid navigation page");
      const page = await client.send(new QueryCommand({TableName: tableName, ConsistentRead: true, Limit: limit,
        KeyConditionExpression: "#pk = :pk AND begins_with(#sk, :prefix)", ExpressionAttributeNames: {"#pk": "pk", "#sk": "sk"},
        ExpressionAttributeValues: {":pk": pk, ":prefix": prefix}, ...(after === null ? {} : {ExclusiveStartKey: {pk, sk: after}})}));
      return {rows: page.Items || [], nextAfter: page.LastEvaluatedKey?.sk || null};
    },
    async transact(operations) {
      operations=canonicalOperationChecks(operations,canonicalTable);
      assertTeamSetTransaction(operations);
      assertGrantSetTransaction(operations);
      operations=await prepareDocumentAuthorityTransaction(operations,{get:async(pk,sk)=>{
        const result=await client.send(new GetCommand({TableName:tableName,Key:{pk,sk},ConsistentRead:true}));return result.Item||null;
      }});
      assertTeamSetTransaction(operations);
      if (!operations.length) return;
      assertGrantSetTransaction(operations);
      const TransactItems = operations.map(operation => {
        assertAppendOnlyAuditOperation(operation);
        if(operation.pk.startsWith('APP_IDENTITY#')){
          rootTarget(operation.pk,operation.sk);
          if (!operation.put && !operation.delete && operation.expected === null && operation.expectedValue === undefined && /^APP_IDENTITY#GROUP_ALIAS#[a-f0-9]{64}$/.test(operation.pk) && operation.sk === 'PROFILE')
            return {ConditionCheck: {TableName: canonicalTable, Key: {pk: operation.pk, sk: operation.sk}, ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)'}};
          if(operation.put||operation.delete||!operation.expectedValue)throw new CanonicalIdentityError(403,'The owning ecosystem registry is read-only in ESIA.');
          canonicalRow({pk:operation.pk,sk:operation.sk,revision:operation.expected,value:operation.expectedValue},operation.pk,operation.sk);
          return {ConditionCheck:{TableName:canonicalTable,Key:{pk:operation.pk,sk:operation.sk},ConditionExpression:'#revision = :revision AND #value = :value',
            ExpressionAttributeNames:{'#revision':'revision','#value':'value'},ExpressionAttributeValues:{':revision':operation.expected,':value':operation.expectedValue}}};
        }
        const conditional = {TableName: tableName,
          ConditionExpression: operation.expected === null ? "attribute_not_exists(#pk)" : "#revision = :revision",
          ExpressionAttributeNames: operation.expected === null ? {"#pk": "pk"} : {"#revision": "revision"},
          ...(operation.expected === null ? {} : {ExpressionAttributeValues: {":revision": operation.expected}})};
        if (Object.hasOwn(operation, 'expectedValue')) {
          if (operation.expected === null || operation.expectedValue === undefined) throw new TypeError('An exact existing value condition is required.');
          conditional.ConditionExpression += ' AND #value = :value';
          conditional.ExpressionAttributeNames['#value'] = 'value';
          conditional.ExpressionAttributeValues[':value'] = operation.expectedValue;
        }
        if (operation.put) return {Put: {...conditional, Item: operation.put}};
        if (operation.delete) return {Delete: {...conditional, Key: {pk: operation.pk, sk: operation.sk}}};
        return {ConditionCheck: {...conditional, Key: {pk: operation.pk, sk: operation.sk}}};
      });
      try { await client.send(new TransactWriteCommand({TransactItems})); }
      catch (error) { if (["TransactionCanceledException", "ConditionalCheckFailedException"].includes(error.name)) throw new AccessConflict(); throw error; }
    }
  };
}

export function createCognitoCurrentVerifier({client, userPoolId, expectedIssuer}) {
  if (!client || !userPoolId || !expectedIssuer) throw new Error("Pinned Cognito configuration required");
  return async principal => {
    if (principal.issuer !== expectedIssuer) return {active: false};
    let current;
    try { current = await client.send(new AdminGetUserCommand({UserPoolId: userPoolId, Username: principal.subject})); }
    catch (error) { if (error.name === "UserNotFoundException") return {active: false}; throw error; }
    const attributes = Object.fromEntries((current.UserAttributes || []).map(item => [item.Name, item.Value]));
    return {subject: attributes.sub, active: current.Enabled === true && current.UserStatus === "CONFIRMED" && attributes.sub === principal.subject,
      name: attributes.name, email: attributes.email};
  };
}

export function createS3ObjectSigner({client, accountStorage, sign = getSignedUrl}) {
  if (!client) throw new Error("Private provider configuration required");
  const storage = createAccountStorage(accountStorage);
  return async ({mode, bucket: targetBucket, key, contentType, tags, expiresIn, signedAt = new Date(), versionId, createOnly = false, sha256, sizeBytes}) => {
    const {bucket, kmsKeyArn, accountId, projectId} = storage.forKey(key);
    let migratedRead;
    try {migratedRead = mode === "get" ? esiaMigrationRead({bucket: targetBucket, key, versionId, sha256, sizeBytes}, bucket) : {bucket: targetBucket, versionId};}
    catch {throw new Error("Invalid configured signing target");}
    targetBucket = migratedRead.bucket; versionId = migratedRead.versionId;
    if (targetBucket !== bucket || typeof key !== "string" || !/^tenants\/[A-Za-z0-9_.:-]+\/projects\/[A-Za-z0-9_.:-]+\//.test(key) || key.includes("..") ||
      !Number.isInteger(expiresIn) || expiresIn < 1 || expiresIn > 60) throw new Error("Invalid configured signing target");
    if (!["get", "put"].includes(mode)) throw new Error("Unsupported storage action");
    if (mode === "put" && (tags?.account_id !== accountId || tags?.project_id !== projectId)) throw new Error("Upload tags must match the server-selected account and project.");
    const original = /\/documents\/[A-Za-z0-9_.:-]+\/original$/.test(key) || /\/assessments\/policy_reviews\/(project_document_review|ifc_ps_me_matrix)\/editions\/review_[a-f0-9-]+\/snapshot\.json$/.test(key);
    if (mode === "put" && (original || createOnly) && (!createOnly || typeof sha256 !== "string" || !/^[a-f0-9]{64}$/.test(sha256) || !Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > 25 * 1024 * 1024)) throw new Error("A create-only original upload requires exact SHA-256 and bounded bytes");
    if (mode === "get" && original && (typeof versionId !== "string" || !versionId || versionId === "null" || versionId.length > 500 || /[\x00-\x1f\x7f]/.test(versionId))) throw new Error("An original read requires its pinned immutable provider version");
    const command = mode === "get" ? new GetObjectCommand({Bucket: bucket, Key: key, ...(versionId ? {VersionId: versionId} : {})}) : new PutObjectCommand({Bucket: bucket, Key: key,
      ContentType: contentType, ...(kmsKeyArn ? {ServerSideEncryption: "aws:kms", SSEKMSKeyId: kmsKeyArn} : {}), Tagging: new URLSearchParams(tags).toString(),
      ...(createOnly ? {IfNoneMatch: "*", ChecksumSHA256: Buffer.from(sha256, "hex").toString("base64"), ContentLength: sizeBytes} : {})});
    if (!(signedAt instanceof Date) || !Number.isFinite(signedAt.getTime())) throw new Error("Invalid signing timestamp");
    return sign(client, command, {expiresIn, signingDate: signedAt,
      ...(mode === "put" ? {unhoistableHeaders: new Set(["x-amz-tagging", ...(kmsKeyArn ? ["x-amz-server-side-encryption", "x-amz-server-side-encryption-aws-kms-key-id"] : []), ...(createOnly ? ["x-amz-checksum-sha256"] : [])]),
        signableHeaders: new Set(["content-type", ...(kmsKeyArn ? ["x-amz-server-side-encryption", "x-amz-server-side-encryption-aws-kms-key-id"] : []), ...(createOnly ? ["if-none-match", "content-length", "x-amz-checksum-sha256"] : [])])} : {})});
  };
}

export function createS3OriginalVerifier({client, accountStorage}) {
  if (!client) throw new Error("Private original verification requires a configured provider");
  const storage = createAccountStorage(accountStorage);
  const conflict = message => { const error = new Error(message); error.statusCode = 409; throw error; };
  return async ({bucket: targetBucket, key, sha256, sizeBytes, contentType, includeJson = false}) => {
    const {bucket, kmsKeyArn} = storage.forKey(key);
    if (targetBucket !== bucket || typeof key !== "string" || !/^tenants\/[A-Za-z0-9_.:-]+\/projects\/[A-Za-z0-9_.:-]+\/documents\/[A-Za-z0-9_.:-]+\/original$/.test(key) || key.includes("..") ||
      typeof sha256 !== "string" || !/^[a-f0-9]{64}$/.test(sha256) || !Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > 25 * 1024 * 1024) throw new Error("Invalid bounded original verification target");
    if (includeJson && (contentType !== 'application/json' || sizeBytes > 1024 * 1024)) throw new Error('Semantic field verification requires JSON of at most1MiB');
    const abortSignal = AbortSignal.timeout(20_000);
    let head;
    try { head = await client.send(new HeadObjectCommand({Bucket: bucket, Key: key, ChecksumMode: "ENABLED"}), {abortSignal}); }
    catch (error) { if (["NotFound", "NoSuchKey"].includes(error.name) || error.$metadata?.httpStatusCode === 404) conflict("The registered original has not been uploaded."); throw error; }
    if (kmsKeyArn && (head.ServerSideEncryption !== "aws:kms" || head.SSEKMSKeyId !== kmsKeyArn)) conflict("The uploaded original does not use its configured account encryption key.");
    const versionId = head.VersionId;
    if (typeof versionId !== "string" || !versionId || versionId === "null" || versionId.length > 500 || /[\x00-\x1f\x7f]/.test(versionId)) conflict("A versioned original is required before finalization.");
    const expectedChecksum = Buffer.from(sha256, "hex").toString("base64");
    if (head.ContentLength !== sizeBytes || head.ContentType !== contentType || head.ChecksumSHA256 !== expectedChecksum) conflict("The uploaded original does not match its registration.");
    const object = await client.send(new GetObjectCommand({Bucket: bucket, Key: key, VersionId: versionId, ChecksumMode: "ENABLED"}), {abortSignal});
    const body = object.Body;
    try {
      if (object.VersionId !== versionId || object.ContentLength !== sizeBytes || object.ContentType !== contentType || object.ChecksumSHA256 !== expectedChecksum) conflict("The pinned original response does not match its provider version.");
      const hash = createHash("sha256"), retained = []; let bytes = 0;
      const chunks = body instanceof Uint8Array ? [body] : body;
      if (!chunks || !(Symbol.asyncIterator in Object(chunks) || Symbol.iterator in Object(chunks))) conflict("The original provider did not return bounded bytes.");
      for await (const chunk of chunks) {
        if (!(chunk instanceof Uint8Array)) conflict("Invalid original byte stream.");
        bytes += chunk.byteLength;
        if (bytes > sizeBytes) conflict("Original byte stream exceeds its registered length.");
        hash.update(chunk);
        if (includeJson) retained.push(Buffer.from(chunk));
      }
      const actual = hash.digest("hex");
      if (bytes !== sizeBytes || actual !== sha256) conflict("Original bytes do not match their registered SHA-256/length.");
      let payload;
      if (includeJson) {try {payload = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(Buffer.concat(retained)));} catch {conflict('The field manifest is not valid UTF-8 JSON.');}}
      return {versionId, sha256: actual, sizeBytes: bytes, contentType, ...(includeJson ? {payload} : {}), ...(typeof head.ETag === "string" ? {etag: head.ETag} : {})};
    } finally { body?.destroy?.(); if (typeof body?.cancel === "function") { try { await body.cancel(); } catch {} } }
  };
}

export function createS3ReviewVerifier({client, accountStorage, timeoutMs = 20_000}) {
  const storage = createAccountStorage(accountStorage);
  if (!client || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 20_000) throw new Error("Bounded private review verification configuration required");
  const conflict = message => { const error = new Error(message); error.statusCode = 409; throw error; };
  return async ({bucket: targetBucket, key, sha256, sizeBytes, contentType, versionId: pinnedVersion}) => {
    const {bucket, kmsKeyArn} = storage.forKey(key);
    const logicalPinnedVersion = pinnedVersion;
    const migratedRead = esiaMigrationRead({bucket: targetBucket, key, versionId: pinnedVersion, sha256, sizeBytes}, bucket);
    targetBucket = migratedRead.bucket; pinnedVersion = migratedRead.versionId;
    if (targetBucket !== bucket || typeof key !== "string" || !/^tenants\/[A-Za-z0-9_.:-]+\/projects\/[A-Za-z0-9_.:-]+\/assessments\/policy_reviews\/(project_document_review|ifc_ps_me_matrix)\/editions\/review_[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\/snapshot\.json$/.test(key) || key.includes("..") ||
        contentType !== "application/json" || typeof sha256 !== "string" || !/^[a-f0-9]{64}$/.test(sha256) || !Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > 25 * 1024 * 1024 ||
        pinnedVersion !== undefined && (typeof pinnedVersion !== "string" || !pinnedVersion || pinnedVersion === "null" || pinnedVersion.length > 500 || /[\x00-\x1f\x7f]/.test(pinnedVersion))) throw new Error("Invalid bounded review verification target");
    const controller = new AbortController(), signal = controller.signal;
    const timer = setTimeout(() => controller.abort(new Error("Review verification deadline exceeded")), timeoutMs);
    const release = stream => {
      try { stream?.destroy?.(); } catch {}
      if (typeof stream?.cancel === "function") { try { Promise.resolve(stream.cancel()).catch(() => {}); } catch {} }
    };
    const bounded = promise => new Promise((resolve, reject) => {
      const abort = () => { const error = new Error("Review verification deadline exceeded"); error.statusCode = 409; reject(error); };
      if (signal.aborted) { abort(); return; }
      signal.addEventListener("abort", abort, {once: true});
      Promise.resolve(promise).then(value => { signal.removeEventListener("abort", abort); if (signal.aborted) release(value?.Body); resolve(value); }, error => { signal.removeEventListener("abort", abort); reject(error); });
    });
    let body;
    try {
      let head;
      try { head = await bounded(client.send(new HeadObjectCommand({Bucket: bucket, Key: key, ...(pinnedVersion !== undefined ? {VersionId: pinnedVersion} : {}), ChecksumMode: "ENABLED"}), {abortSignal: signal})); }
      catch (error) { if (["NotFound", "NoSuchKey"].includes(error.name) || error.$metadata?.httpStatusCode === 404) conflict("The review snapshot has not been uploaded."); throw error; }
      if (kmsKeyArn && (head.ServerSideEncryption !== "aws:kms" || head.SSEKMSKeyId !== kmsKeyArn)) conflict("The uploaded review does not use its configured account encryption key.");
      const versionId = head.VersionId;
      if (typeof versionId !== "string" || !versionId || versionId === "null" || versionId.length > 500 || /[\x00-\x1f\x7f]/.test(versionId)) conflict("A real retained review provider version is required.");
      if (pinnedVersion !== undefined && versionId !== pinnedVersion) conflict("Original retained review provider version changed.");
      const checksum = Buffer.from(sha256, "hex").toString("base64");
      const matches = value => value.VersionId === versionId && value.ContentLength === sizeBytes && value.ContentType === contentType && value.ChecksumSHA256 === checksum;
      if (!matches(head)) conflict("Uploaded review metadata does not match its registration.");
      const object = await bounded(client.send(new GetObjectCommand({Bucket: bucket, Key: key, VersionId: versionId, ChecksumMode: "ENABLED"}), {abortSignal: signal}));
      body = object.Body;
      if (!matches(object)) conflict("Pinned review response does not match its provider version.");
      const iterable = body instanceof Uint8Array ? [body] : body;
      const iterator = iterable?.[Symbol.asyncIterator]?.() || iterable?.[Symbol.iterator]?.();
      if (!iterator) conflict("Review provider did not return a byte stream.");
      const chunks = [], hash = createHash("sha256"); let length = 0;
      while (true) {
        const part = await bounded(iterator.next());
        if (part.done) break;
        if (!(part.value instanceof Uint8Array)) conflict("Invalid review byte stream.");
        length += part.value.byteLength;
        if (length > sizeBytes) conflict("Review stream exceeds registered bytes.");
        const chunk = Buffer.from(part.value); chunks.push(chunk); hash.update(chunk);
      }
      if (length !== sizeBytes || hash.digest("hex") !== sha256) conflict("Review bytes do not match their registered SHA/length.");
      let payload;
      try { payload = JSON.parse(new TextDecoder("utf-8", {fatal: true}).decode(Buffer.concat(chunks, length))); }
      catch { conflict("Review snapshot must contain valid UTF-8 JSON."); }
      return {versionId: logicalPinnedVersion ?? versionId, ...(migratedRead.migrated ? {physicalVersionId: versionId, providerMigration: migratedRead} : {}), sha256, sizeBytes: length, contentType, payload};
    } finally {
      clearTimeout(timer); release(body);
    }
  };
}

export function createNativeTemplateInvoker(){throw Error('No customer native-processing function adapter is configured.');}
export function createNativeTemplateJobInvoker(){throw Error('No customer native-processing job adapter is configured.');}

export function createAwsAdapters({region, tableName, userPoolId, expectedIssuer, accountStorage, canonicalIdentity, requirementLibraryIndex,policyOriginalsIndex,policyOriginalReservedBuckets=[],clientTemplateNativeFunctionArn,clientTemplateNativeJobsEnabled=false,clientTemplateNativeRuntimeCleanupEnabled=false}) {
  if (!region) throw new Error("AWS region must be explicitly configured");
  const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({region}), {marshallOptions: {removeUndefinedValues: true}});
  const s3 = new S3Client({region});
  const store=createDynamoAccessStore({client:dynamo,tableName,canonicalTable:canonicalIdentity?.registryTable});
  const verifyCurrentIdentity=createCognitoCurrentVerifier({client:new CognitoIdentityProviderClient({region}),userPoolId,expectedIssuer});
  const policyProvider=createS3PolicyOriginalProvider({client:s3,index:policyOriginalsIndex,reservedBuckets:[...policyOriginalReservedBuckets,...Object.values(createAccountStorage(accountStorage).accounts).map(value=>value.bucket)]});
  const engagementObjects=createS3EngagementObjectStore({client:s3,accountStorage});
  const nativeInvoke=clientTemplateNativeFunctionArn?createNativeTemplateInvoker({client:new LambdaClient({region,maxAttempts:1}),functionArn:clientTemplateNativeFunctionArn,region}):null;
  const nativeJobInvoke=clientTemplateNativeFunctionArn&&clientTemplateNativeJobsEnabled?createNativeTemplateJobInvoker({client:new LambdaClient({region,maxAttempts:1}),functionArn:clientTemplateNativeFunctionArn,region}):null;
  const nativeJobRepository=nativeJobInvoke?createClientTemplateNativeJobRepository({store}):null;
  const nativeCleanup=nativeJobInvoke&&clientTemplateNativeRuntimeCleanupEnabled?createS3EngagementObjectStore({client:new S3Client({region,maxAttempts:1}),accountStorage}):null;
  return {...policyProvider,store,canonicalEnabled:Boolean(canonicalIdentity),nativeAuthority:canonicalIdentity?.nativeAuthority,
    engagementObjects,...(nativeInvoke?{clientTemplateNativeFactory:({state,prefix,objects,jobAuthority})=>{const scope={accountId:state.target.value.account_id,projectId:state.target.value.project_id,engagementId:state.target.value.engagement_id,bucket:createAccountStorage(accountStorage).forAccount(state.target.value.account_id).bucket};const jobs=nativeJobInvoke?createClientTemplateNativeJobs({repository:nativeJobRepository,invokeOnce:nativeJobInvoke,...(nativeCleanup?{cleanup:target=>nativeCleanup.cleanupNativeJob({...target,recheck:jobAuthority?.recheckAuthority})}:{}),authorize:async request=>JSON.stringify(request.scope)===JSON.stringify(scope),verifyCurrent:job=>verifyNativeTemplateJobAuthority({store,job})}):undefined;return createRemoteClientTemplateNative({objects:objects||engagementObjects,invoke:nativeInvoke,scope,prefix,timeoutMs:20000,jobs,jobAuthority,runtimeCleanupEnabled:clientTemplateNativeRuntimeCleanupEnabled});}}:{}),
    verifyCurrentIdentity:canonicalIdentity?createCanonicalCurrentVerifier({verifyCurrentIdentity,store,
      identity:createCanonicalIdentity({...canonicalIdentity,store,issuer:expectedIssuer}),issuer:expectedIssuer}):verifyCurrentIdentity,
    signObject: createS3ObjectSigner({client: s3, accountStorage}), readObjectRange: createS3RangeReader({client: s3, accountStorage}),
    describeLegacyObject: createLegacyObjectDescriptor({client: s3, accountStorage}), verifyOriginal: createS3OriginalVerifier({client: s3, accountStorage}),
    verifyReviewSnapshot: createS3ReviewVerifier({client: s3, accountStorage}),
    requirementLibrary: createRequirementLibrary({index: requirementLibraryIndex, readVersion: requirementLibraryIndex ? createS3RequirementVersionReader({client: s3, index: requirementLibraryIndex}) : undefined})};
}

// Reference sources deliberately bypass the account-private resolver. Only the
// configured index and entries in its verified immutable bytes can be read.
export function createS3RequirementVersionReader({client, index, timeoutMs = 20_000}) {
  const configured = validateRequirementTarget(index, {maxBytes: requirementLibraryLimits.indexBytes});
  if (!client || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 20_000) throw Error("Bounded reference reader configuration required.");
  const identity = target => JSON.stringify([target.bucket, target.key, target.versionId, target.sha256, target.size]);
  const allowed = new Set([identity(configured)]);
  return async target => {
    target = validateRequirementTarget(target, {bucket: configured.bucket});
    if (!allowed.has(identity(target))) throw Object.assign(Error("The reference read is outside the pinned index allowlist."), {statusCode: 503});
    const controller = new AbortController(), signal = controller.signal;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const bounded = promise => new Promise((resolve, reject) => {
      const abort = () => reject(Object.assign(Error("The protected reference read exceeded its deadline."), {statusCode: 503}));
      if (signal.aborted) {abort();return;}
      signal.addEventListener("abort", abort, {once: true});
      Promise.resolve(promise).then(value => {signal.removeEventListener("abort", abort);if (signal.aborted) value?.Body?.destroy?.();resolve(value);}, error => {signal.removeEventListener("abort", abort);reject(error);});
    });
    let body;
    try {
      const response = await bounded(client.send(new GetObjectCommand({Bucket: target.bucket, Key: target.key, VersionId: target.versionId}), {abortSignal: signal}));
      body = response.Body;
      if (response.VersionId !== target.versionId || response.ContentLength !== target.size) throw Error("The reference provider version or length changed.");
      const iterable = body instanceof Uint8Array ? [body] : body, iterator = iterable?.[Symbol.asyncIterator]?.() || iterable?.[Symbol.iterator]?.();
      if (!iterator) throw Error("The reference provider returned no bounded byte stream.");
      const chunks = [], digest = createHash("sha256");let size = 0;
      while (true) {
        const part = await bounded(iterator.next());if (part.done) break;
        if (!(part.value instanceof Uint8Array)) throw Error("Invalid reference byte stream.");
        size += part.value.byteLength;if (size > target.size) throw Error("Reference stream exceeds its pinned size.");
        const bytes = Buffer.from(part.value);digest.update(bytes);chunks.push(bytes);
      }
      if (size !== target.size || digest.digest("hex") !== target.sha256) throw Error("Reference bytes failed SHA-256 verification.");
      const bytes = Buffer.concat(chunks, size);
      if (identity(target) === identity(configured)) {
        const entries = validateRequirementIndex(JSON.parse(new TextDecoder("utf-8", {fatal: true}).decode(bytes)), configured);
        for (const entry of Object.values(entries)) allowed.add(identity(entry));
      }
      return bytes;
    } finally {clearTimeout(timer);body?.destroy?.();if (typeof body?.cancel === "function") {try {await body.cancel();} catch {}}}
  };
}

function readTarget(storage, target) {
  const {bucket} = storage.forKey(target.key);
  if (target.bucket !== bucket || typeof target.key !== 'string' || !/^tenants\/[A-Za-z0-9_.:-]+\/projects\/[A-Za-z0-9_.:-]+\//.test(target.key) || target.key.includes('..')) throw Error('Invalid private download target');
}

async function boundedBody(body, limit) {
  const parts = []; let length = 0;
  try {
    const chunks = body instanceof Uint8Array ? [body] : body;
    if (!chunks) throw Error('Missing private object bytes');
    for await (const chunk of chunks) {
      if (!(chunk instanceof Uint8Array) || (length += chunk.byteLength) > limit) throw Error('Private object exceeds its pinned range');
      parts.push(Buffer.from(chunk));
    }
    return Buffer.concat(parts);
  } finally {body?.destroy?.(); if (typeof body?.cancel === 'function') {try {await body.cancel();} catch {}}}
}

export function createS3RangeReader({client, accountStorage}) {
  const storage = createAccountStorage(accountStorage);
  return async target => {
    const {bucket} = storage.forKey(target.key);
    const migrated = esiaMigrationRead(target, bucket);
    readTarget(storage, {...target, bucket: migrated.bucket});
    const {sizeBytes, offset, length} = target, versionId = migrated.versionId;
    if (typeof versionId !== 'string' || !versionId || versionId === 'null' || versionId.length > 500 || /[\x00-\x1f\x7f]/.test(versionId) ||
        !Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || !Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(length) || length < 1 || length > 512 * 1024 || offset + length > sizeBytes) throw Error('Invalid immutable private range');
    const result = await client.send(new GetObjectCommand({Bucket: bucket, Key: target.key, VersionId: versionId, Range: `bytes=${offset}-${offset + length - 1}`}), {abortSignal: AbortSignal.timeout(20_000)});
    try {
      if (result.VersionId !== versionId || result.ContentLength !== length || result.ContentRange !== `bytes ${offset}-${offset + length - 1}/${sizeBytes}`) throw Error('Private provider range changed');
      const bytes = await boundedBody(result.Body, length);
      if (bytes.length !== length) throw Error('Private provider range is incomplete');
      return bytes;
    } finally {result.Body?.destroy?.();}
  };
}

// Legacy mutable drafts are pinned to the version actually read, then follow
// the same authenticated range protocol. No old provider GET URL is exposed.
export function createLegacyObjectDescriptor({client, accountStorage}) {
  const storage = createAccountStorage(accountStorage);
  return async target => {
    readTarget(storage, target);
    const {bucket} = storage.forKey(target.key);
    if (!/\/assessments\/policy_reviews\/(project_document_review|ifc_ps_me_matrix)\/working_draft\.json$/.test(target.key)) throw Error('Invalid legacy review target');
    const result = await client.send(new GetObjectCommand({Bucket: bucket, Key: target.key}), {abortSignal: AbortSignal.timeout(20_000)});
    try {
      if (typeof result.VersionId !== 'string' || !result.VersionId || result.VersionId === 'null' || result.VersionId.length > 500 || /[\x00-\x1f\x7f]/.test(result.VersionId) ||
          !Number.isSafeInteger(result.ContentLength) || result.ContentLength < 1 || result.ContentLength > 25 * 1024 * 1024) throw Error('A bounded versioned legacy draft is required');
      const bytes = await boundedBody(result.Body, result.ContentLength);
      if (bytes.length !== result.ContentLength) throw Error('Incomplete legacy review');
      return {version_id: result.VersionId, size_bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex')};
    } finally {result.Body?.destroy?.();}
  };
}
