import {esiaMigrationOriginalMatches} from "./storage-migrations.mjs";
import {createHash, randomBytes, randomUUID, timingSafeEqual} from "node:crypto";
import {
  createExternalIdentityLink, createIdentityUser, createIdentityWorkspace,
  createWorkspaceParticipation, validateWorkspaceParticipation, externalIdentityKey, resolveIdentityUser,
  resolveScopedResourceAccess, resolveResourceAccess, createResourceGrant, assertCollaborationResource, createResourceReference, assertResourceReference,
  assertPreservedRecord, validatePortableData, createProjectBusinessContext, normalizeProjectAccountIds
} from "@categori/workspace-contracts";
import {monetizationPlans, createDefaultNotificationPreferences} from "../src/lib/access-model.js";
import {getDocumentReviewRequirements, lenderFrameworkCatalog} from "../src/lib/document-review-catalog.js";
import {ifcMePerformanceStandards} from "../src/lib/ifc-me-matrix-template.js";
import {record, assertDocumentSourceScope, assertProjectSourceAuthority} from "./access-store.mjs";
import {createMutationAudit} from "./mutation-audit.mjs";
import {createReviewEditionOperations} from "./review-editions.mjs";
import {createPublicationOperations} from "./publications.mjs";
import {createTeamOperations} from "./team-collaboration.mjs";
import {createMediatedDownloads} from './mediated-downloads.mjs';
import {createIntegrationResourceIndex} from './integration-resource-index.mjs';
import {createIntegrationConnections, integrationConnectionPartition} from './integration-connections.mjs';
import {mappedTeamEligibility} from './ecosystem-groups.mjs';
import {isDeepStrictEqual} from 'node:util';
import {createAccountStorage, storageEncryptionHeaders} from './account-storage.mjs';
import {hostedFieldMetadata, hostedFieldMediaTypes, assertHostedFieldMetadata, assertHostedFieldManifest, assertConfiguredResourceAuthority, fieldUploadPolicy} from '../src/lib/hosted-field-capture-model.js';
import {engagementCaseAccessKey,engagementCaseSourceKey,validateEngagementCaseSources,mergeEngagementCaseSources,protectedEngagementCaseSourceBindings,assertEngagementCaseAccess} from './engagement-case-access.mjs';

export class AccessError extends Error {
  constructor(statusCode, message) { super(message); this.statusCode = statusCode; }
}
const fail = (code, message) => { throw new AccessError(code, message); };
const digest = value => createHash("sha256").update(value).digest("hex");
const opaque = value => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}(?![\s\S])/.test(value) && value !== "user_unknown";
const id = value => opaque(value) ? value : fail(400, "An exact opaque identifier is required.");
const text = (value, max = 200) => typeof value === "string" && value.trim() && value.length <= max ? value.trim() : fail(400, "A bounded nonempty text value is required.");
const key = (pk, sk) => JSON.stringify([pk, sk]);
const guestActions = new Set(["view", "comment", "review", "edit"]);
const toActions = permissions => {
  if (!Array.isArray(permissions) || !permissions.length || permissions.length > 4) fail(400, "Explicit guest permissions are required.");
  const actions = [...new Set(permissions.map(permission => permission === "write" ? "edit" : permission))];
  if (actions.some(action => !guestActions.has(action)) || !actions.includes("view")) fail(400, "Guests require view and cannot manage access or execute providers.");
  return actions;
};
const legacyActions = actions => actions.map(action => action === "edit" ? "write" : action).filter(action => ["view", "comment", "review", "write", "manage_access"].includes(action));
const engagementRoles = Object.freeze(["preparer", "reviewer", "approver", "client"]);
const engagementRoleAction = role => role === "preparer" ? "edit" : "review";

// These are the existing ESIA domain choices, used to whitelist audit object paths.
const requirements = getDocumentReviewRequirements({
  frameworks: Object.fromEntries(lenderFrameworkCatalog.map(item => [item.framework_id, {...item, selected: true}])),
  standards: Object.fromEntries(ifcMePerformanceStandards.map(item => [item.performance_standard, {...item, selected: true}]))
});
const auditSuffixes = new Map([
  ["manifest.json", "manifest"], ["working_draft.json", "working_draft"],
  ["standards/applicability.json", "standards_applicability"], ["rollups/status.json", "status_rollup"],
  ["exports/latest/policy_audit.json", "latest_export"],
  ...requirements.map(item => [`requirements/${segment(item.framework_id)}/${segment(item.standard_id)}/${segment(item.requirement_id)}.json`, "requirement_result"]),
  ...requirements.filter(item => item.diagnostic).map(item => [`diagnostics/${segment(item.standard_id)}/${segment(item.group)}/${item.diagnostic_id}.json`, "diagnostic_result"])
]);
function segment(value) { return String(value).toLowerCase().replace(/[^a-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "item"; }

export function createAccessService({store, expectedIssuer, expectedClientId, verifyCurrentIdentity, signObject, readObjectRange, describeLegacyObject, verifyOriginal, verifyReviewSnapshot, requirementLibrary, canonicalEnabled=false, nativeAuthority, resourceAuthority,
  accountStorage, engagementOperations, now = () => new Date(), newId = () => randomUUID(), legacySubjects = {}}) {
  if (!store || typeof verifyCurrentIdentity !== "function" || !expectedClientId || !accountStorage) throw new Error("ESIA store, current provider verifier, client and account storage must be configured.");
  assertConfiguredResourceAuthority(resourceAuthority);
  const storage = createAccountStorage(accountStorage);
  externalIdentityKey({issuer: expectedIssuer, subject: "configuration-check"});
  if (!Object.values(legacySubjects).every(opaque)) throw new Error("Invalid explicit legacy identity mapping");
  const instant = () => { const date = now(); if (!(date instanceof Date) || !Number.isFinite(date.getTime())) throw new Error("Invalid service clock"); return date; };
  const iso = () => instant().toISOString();
  let authenticatedEngagements = null;
  const engagementConfigured = () => authenticatedEngagements && ["createEngagement", "getEngagement", "engagementCommand", "invitationChange", "invitationPreview"].every(name => typeof authenticatedEngagements[name] === "function");
  function requireEngagementOperations() { if (!engagementConfigured()) fail(503, "Authenticated engagement execution and invitations are not configured."); return authenticatedEngagements; }

  function context(principal, userId = null) { return {reads: new Map(), principal, userId, providerPrincipals: new Map([[externalIdentityKey(principal), principal]]), authorityDeadlines: new Map()}; }
  function rememberCanonical(ctx,profile){
    if(!canonicalEnabled)return;
    if(!profile?.canonicalUser||!Array.isArray(profile.canonicalChecks)||profile.canonicalChecks.length!==4)fail(503,'Current ecosystem identity proof is unavailable.');
    for(const row of profile.canonicalChecks){const k=key(row.pk,row.sk),old=ctx.reads.get(k);
      if(old&&!isDeepStrictEqual(old.row,row))fail(409,'Current ecosystem identity changed. Reopen before continuing.');
      if(!old)ctx.reads.set(k,{pk:row.pk,sk:row.sk,row:structuredClone(row)});}
  }
  async function get(ctx, pk, sk) {
    const k = key(pk, sk);
    if (!ctx.reads.has(k)) ctx.reads.set(k, ctx.directoryReadCache?.get(k) || {pk, sk, row: await store.get(pk, sk)});
    return ctx.reads.get(k).row;
  }
  async function commit(ctx, values = []) {
    const sourceDocuments = new Set();
    for (const row of values) {
      if (/^DOCUMENT#/.test(row.pk) && (row.sk === "PROFILE" || row.sk === "GRANT_SET" || row.sk.startsWith("GRANT#"))) sourceDocuments.add(row.pk);
      if (/^WORKSPACE#/.test(row.pk) && /^GUEST#document#[^#]+#[^#]+$/.test(row.sk)) sourceDocuments.add(`DOCUMENT#${row.sk.split("#")[2]}`);
    }
    const sourceProjects = new Map();
    for (const pk of sourceDocuments) {
      let scopeRow = await get(ctx, pk, "SOURCE_SCOPE");
      if (!scopeRow) {
        const profile = values.find(row => row.pk === pk && row.sk === "PROFILE");
        const previous = profile ? await get(ctx, pk, "PROFILE") : null;
        if (profile && !previous) {
          const marker = await get(ctx, `PROJECT#${id(profile.value.project_id)}`, "SOURCE_AUTHORITY_SET");
          if (marker) {
            assertProjectSourceAuthority(marker, profile.value);
            scopeRow = record(pk, "SOURCE_SCOPE", {object_type: "document_source_scope", schema_version: 1, document_id: pk.slice(9),
              project_id: profile.value.project_id, workspace_id: profile.value.workspace_id, account_id: profile.value.account_id});
            values = [...values, scopeRow];
          }
        }
      }
      if (scopeRow) {
        const scope = assertDocumentSourceScope(scopeRow);
        sourceProjects.set(scope.project_id, scope);
      }
    }
    for (const [projectId, scope] of sourceProjects) {
      const previous = await get(ctx, `PROJECT#${projectId}`, "SOURCE_AUTHORITY_SET");
      assertProjectSourceAuthority(previous, scope);
      const revision = previous.revision + 1;
      if (!Number.isSafeInteger(revision)) fail(413, "The project source authority generation limit was reached.");
      values = [...values, record(previous.pk, previous.sk, {...previous.value, generation: revision}, revision)];
    }
    for (const pk of new Set(values.filter(item => /^(PROJECT|DOCUMENT|NOTEBOOK|ENGAGEMENT)#/.test(item.pk) && item.sk.startsWith("GRANT#")).map(item => item.pk))) {
      const previous = await get(ctx, pk, "GRANT_SET"), revision = (previous?.revision || 0) + 1;
      values = [...values, record(pk, "GRANT_SET", {object_type: "resource_grant_set", generation: revision}, revision)];
    }
    for (const [pattern, prefix, marker, objectType] of [
      [/^TEAM#/, "MEMBER#", "MEMBER_SET", "team_member_set"],
      [/^WORKSPACE#/, "TEAM#", "TEAM_SET", "workspace_team_set"]]) {
      for (const pk of new Set(values.filter(item => pattern.test(item.pk) && item.sk.startsWith(prefix)).map(item => item.pk))) {
        const previous = await get(ctx, pk, marker), revision = (previous?.revision || 0) + 1;
        values = [...values, record(pk, marker, {object_type: objectType, generation: revision}, revision)];
      }
    }
    if (ctx.principal.expiresAt <= instant().getTime()) fail(401, "The current access token expired.");
    if ([...ctx.authorityDeadlines.values()].some(until => until <= instant().getTime())) fail(403, "The engagement authority expired before the request completed.");
    for (const principal of ctx.providerPrincipals.values()) {
      const current = await verifyCurrentIdentity(principal);
      if (current?.active !== true || current.subject !== principal.subject) fail(403, "The current provider account is inactive.");
      rememberCanonical(ctx,current);
    }
    if (values.length) values = [...values, createMutationAudit({principal: ctx.principal, userId: ctx.userId, reads: ctx.reads, values, timestamp: iso()})];
    const changes = new Map(values.map(item => [key(item.pk, item.sk), item]));
    const sourceCompaction = entry => {
      const proof = entry.sourceAuthority;
      // The project marker fences every source mutation in this transaction.
      // Preserve full row conditions for documents being changed; unchanged
      // selected sources still use their exact marker + immutable scope proof.
      if (!proof || sourceDocuments.has(`DOCUMENT#${proof.document_id}`) || changes.has(key(entry.pk,entry.sk))) return false;
      const marker = ctx.reads.get(key(`PROJECT#${proof.project_id}`, "SOURCE_AUTHORITY_SET"))?.row;
      const scopeRow = ctx.reads.get(key(`DOCUMENT#${proof.document_id}`, "SOURCE_SCOPE"))?.row;
      assertProjectSourceAuthority(marker, proof);
      const scope = assertDocumentSourceScope(scopeRow);
      if (marker.revision !== proof.marker_revision || ["document_id", "project_id", "workspace_id", "account_id"].some(field => scope[field] !== proof[field])) fail(409, "The source authority proof changed before commit.");
      if (proof.until <= instant().getTime()) fail(403, "The document authority expired before the request completed.");
      return entry.pk === `DOCUMENT#${scope.document_id}` && (entry.sk === "PROFILE" || entry.sk === "GRANT_SET" || entry.sk.startsWith("GRANT#")) ||
        entry.pk === `WORKSPACE#${scope.workspace_id}` && entry.sk === `GUEST#document#${scope.document_id}#${proof.user_id}`;
    };
    const operations = [...ctx.reads.values()].filter(entry => !sourceCompaction(entry)).map(({pk, sk, row}) => {
      const put = changes.get(key(pk, sk));
      changes.delete(key(pk, sk));
      return {pk, sk, expected: row?.revision ?? null, ...(put ? {put} : {}),...((pk.startsWith('APP_IDENTITY#') || pk.startsWith(integrationConnectionPartition)) && row ? {expectedValue:row.value} : {})};
    });
    for (const put of changes.values()) operations.push({pk: put.pk, sk: put.sk, expected: null, put});
    if (operations.length > 100) fail(413, "The requested access change exceeds the transaction limit.");
    if (ctx.principal.expiresAt <= instant().getTime()) fail(401, "The current access token expired.");
    if ([...ctx.authorityDeadlines.values()].some(until => until <= instant().getTime())) fail(403, "The engagement authority expired before the request completed.");
    await store.transact(operations);
    if ((ctx.authorityDeadlines.size || [...ctx.reads.values()].some(entry => entry.sourceAuthority)) &&
        (ctx.principal.expiresAt <= instant().getTime() || [...ctx.authorityDeadlines.values()].some(until => until <= instant().getTime()) ||
          [...ctx.reads.values()].some(entry => entry.sourceAuthority?.until <= instant().getTime())))
      fail(403, "The engagement authority expired before its current receipt could be returned.");
  }
  function update(row, value) { return record(row.pk, row.sk, value, row.revision + 1); }
  function directoryAuth(auth) {
    return {...auth, ctx: {...auth.ctx, reads: new Map(auth.ctx.reads), providerPrincipals: new Map(auth.ctx.providerPrincipals), authorityDeadlines: new Map(auth.ctx.authorityDeadlines)}};
  }
  async function readDirectory(auth, hints, read) {
    // A directory is a sequence of current resource projections, not a mutation.
    // Keep each resource's complete authority proof in one transaction, and
    // repeat the common identity/project conditions in every bounded batch.
    // Mutation callers continue to use commit with their full atomic snapshot.
    let batch = directoryAuth(auth);
    const result = [], deadlines = new Map(auth.ctx.authorityDeadlines);
    for (const hint of hints) {
      const current = directoryAuth(auth);
      // Reuse reads already checked in this batch without carrying unrelated
      // documents into this resource's proof. Every reused row is still added
      // to current.reads and conditioned in its transaction.
      current.ctx.directoryReadCache = batch.ctx.reads;
      let value;
      try { value = await read(current, hint); }
      catch (error) { if ([403, 404].includes(error.statusCode)) continue; throw error; }
      if (value === null || value === undefined) continue;
      if (current.ctx.reads.size > 100) fail(413, "This resource's authority proof exceeds the transaction limit.");
      for (const [k, entry] of current.ctx.reads) {
        const previous = batch.ctx.reads.get(k);
        if (previous && !isDeepStrictEqual(previous.row, entry.row)) fail(409, "Access records changed; reload and retry.");
      }
      if (new Set([...batch.ctx.reads.keys(), ...current.ctx.reads.keys()]).size > 100) {
        await commit(batch.ctx);
        batch = directoryAuth(auth);
      }
      for (const name of ["reads", "providerPrincipals", "authorityDeadlines"]) for (const [k, entry] of current.ctx[name]) batch.ctx[name].set(k, entry);
      for (const [k, until] of current.ctx.authorityDeadlines) deadlines.set(k, until);
      result.push(value);
    }
    await commit(batch.ctx);
    if ([...deadlines.values()].some(until => until <= instant().getTime())) fail(403, "The directory authority expired before the request completed.");
    return result;
  }
  async function authenticate(principal, {enroll = true} = {}) {
    if (!principal || principal.issuer !== expectedIssuer || principal.clientId !== expectedClientId || !principal.subject || principal.tokenUse !== "access") fail(401, "A verified access-token principal is required.");
    externalIdentityKey({issuer: principal.issuer, subject: principal.subject});
    if (!Number.isFinite(principal.expiresAt) || principal.expiresAt <= instant().getTime()) fail(401, "The access token expired or has no verified expiry.");
    // Gateway verifies the signature; this check sees provider disable/revoke state now.
    const profile = await verifyCurrentIdentity(principal);
    if (!profile || profile.subject !== principal.subject || profile.active !== true) fail(403, "The current identity provider account is inactive.");
    let ctx = context(principal);
    rememberCanonical(ctx,profile);
    const identityId = `identity_${digest(externalIdentityKey(principal)).slice(0, 48)}`;
    let link = await get(ctx, `IDENTITY#${identityId}`, "LINK");
    if (!link) {
      if (!enroll) fail(403, "Identity is not enrolled.");
      const userId = legacySubjects[principal.subject] || `user_${digest(externalIdentityKey(principal)).slice(0, 40)}`;
      ctx.userId = userId;
      const user = await get(ctx, `USER#${userId}`, "PROFILE");
      // Existing rows are never adopted by matching an email or sample ID.
      if (user && user.value.cognito_sub !== principal.subject) fail(409, "A reviewed identity migration is required.");
      link = record(`IDENTITY#${identityId}`, "LINK", createExternalIdentityLink({linkId: identityId, issuer: principal.issuer,
        subject: principal.subject, userId, verifiedAt: iso()}));
      const writes = [link];
      if (!user) writes.push(record(`USER#${userId}`, "PROFILE", {identity: createIdentityUser({userId}), cognito_sub: principal.subject,
        user_id: userId, status: "active", name: profile.name || "ESIA user", email: profile.email || "", deployment_roles: []}));
      try { await commit(ctx, writes); } catch (error) { if (error.statusCode !== 409) throw error; }
      ctx = context(principal);
      rememberCanonical(ctx,profile);
      link = await get(ctx, `IDENTITY#${identityId}`, "LINK");
    }
    if (!link) fail(403, "Identity enrollment failed.");
    const user = await get(ctx, `USER#${link.value.user_id}`, "PROFILE");
    const resolved = resolveIdentityUser({verifiedIdentity: {issuer: principal.issuer, subject: principal.subject}, identityLinks: [link.value], users: user ? [user.value.identity] : []});
    if (!resolved.allowed || user?.value.status !== "active" || user.value.user_id !== resolved.user_id || user.value.cognito_sub !== principal.subject) fail(403, "The current User or identity link is inactive.");
    ctx.userId = resolved.user_id;
    return {ctx, principal, link, user, userId: resolved.user_id,...(canonicalEnabled?{canonicalUser:profile.canonicalUser}:{})};
  }
  async function personal(auth) {
    const existing = await get(auth.ctx, `USER#${auth.userId}`, "WORKSPACE");
    if (existing) {
      const workspace = await get(auth.ctx, `WORKSPACE#${existing.value.workspace_id}`, "PROFILE");
      const member = await get(auth.ctx, `WORKSPACE#${existing.value.workspace_id}`, `MEMBER#${auth.userId}`);
      if (workspace?.value.identity?.status !== "active" || member?.value.identity?.status !== "active" || member.value.identity.mode !== "member") fail(403, "The personal workspace is inactive.");
      const account = await get(auth.ctx, `ACCOUNT#${existing.value.account_id}`, "PROFILE");
      if (account?.value.status !== "active") fail(403, "The personal account is inactive.");
      return {workspace, member, accountId: existing.value.account_id};
    }
    const suffix = digest(auth.userId).slice(0, 32), workspaceId = `ws_${suffix}`, accountId = `acct_${suffix}`;
    const workspace = record(`WORKSPACE#${workspaceId}`, "PROFILE", {identity: createIdentityWorkspace({workspaceId}), owner_user_id: auth.userId, name: `${auth.user.value.name}'s workspace`, account_id: accountId});
    const member = record(workspace.pk, `MEMBER#${auth.userId}`, {identity: createWorkspaceParticipation({participationId: `member_${suffix}`, workspaceId, userId: auth.userId}), role: "owner"});
    const account = record(`ACCOUNT#${accountId}`, "PROFILE", {account_id: accountId, workspace_id: workspaceId, name: workspace.value.name, type: "personal", status: "active", owner_user_id: auth.userId, billing_plan: "individual", data_classification: "confidential", default_project_visibility: "private"});
    await commit(auth.ctx, [workspace, member, account,
      record(`USER#${auth.userId}`, "WORKSPACE", {workspace_id: workspaceId, account_id: accountId}),
      record(`USER#${auth.userId}`, `ACCOUNT#${accountId}`, {account_id: accountId}),
      record(`ACCOUNT#${accountId}`, `MEMBER#${auth.userId}`, {user_id: auth.userId, role: "owner", status: "active", permissions: ["manage_account", "create_project", "manage_access"]}),
      record(workspace.pk, "ENTITLEMENT", {status: "active", plan: "individual", can_create_projects: true, can_invite_editors: false, max_private_projects: 3, storage_writes: true}),
      record(workspace.pk, "PROJECT_COUNTER", {count: 0})]);
    // Start a fresh authority snapshot after creating the rows.
    const current = await authenticate(auth.principal);
    return {...await personal(current), auth: current};
  }
  async function memberWorkspace(auth, workspaceId, {owner = false} = {}) {
    const workspace = await get(auth.ctx, `WORKSPACE#${id(workspaceId)}`, "PROFILE");
    const member = await get(auth.ctx, `WORKSPACE#${workspaceId}`, `MEMBER#${auth.userId}`);
    if (workspace?.value.identity?.workspace_id !== workspaceId || workspace.value.identity.status !== "active" || member?.value.identity?.status !== "active" || member.value.identity.mode !== "member" ||
      member.value.identity.user_id !== auth.userId || member.value.identity.workspace_id !== workspaceId || validateWorkspaceParticipation(member.value.identity).length ||
      (member.value.identity.not_before !== null && Date.parse(member.value.identity.not_before) > instant().getTime()) ||
      (member.value.identity.expires_at !== null && Date.parse(member.value.identity.expires_at) <= instant().getTime()) || (owner && workspace.value.owner_user_id !== auth.userId)) fail(403, "An active workspace member with the requested authority is required.");
    const account = await get(auth.ctx, `ACCOUNT#${workspace.value.account_id}`, "PROFILE");
    if (account?.value.account_id !== workspace.value.account_id || account.value.status !== "active" || account.value.workspace_id !== workspaceId) fail(403, "The workspace account is inactive.");
    return {workspace, member};
  }
  async function entitlement(auth, workspaceId, capability) {
    const row = await get(auth.ctx, `WORKSPACE#${workspaceId}`, "ENTITLEMENT");
    if (row?.value.status !== "active" || row.value[capability] !== true) fail(403, "The current workspace entitlement does not include this feature.");
    return row;
  }
  function assertEngagementProfile(target) {
    const value = target?.value, resource = value?.resource;
    if (value?.object_type !== "engagement_resource" || value.status !== "active" ||
        target.pk !== `ENGAGEMENT#${value.engagement_id}` || target.sk !== "PROFILE" ||
        ![value.engagement_id, value.project_id, value.workspace_id, value.account_id, value.owner_user_id].every(opaque) ||
        resource?.resource_type !== "engagement" || resource.resource_id !== value.engagement_id ||
        resource.project_id !== value.project_id || resource.workspace_id !== value.workspace_id || resource.owner_id !== value.owner_user_id ||
        resource.access_policy?.inheritance !== "restricted" || resource.access_policy.allow_public_links !== false ||
        !Array.isArray(value.source_artifact_ids) || value.source_artifact_ids.length > 100 ||
        value.source_artifact_ids.some(artifactId => !opaque(artifactId)) || new Set(value.source_artifact_ids).size !== value.source_artifact_ids.length ||
        !value.professional_roles || Object.keys(value.professional_roles).length !== engagementRoles.length ||
        Object.keys(value.professional_roles).some(role => !engagementRoles.includes(role)) ||
        engagementRoles.some(role => !Array.isArray(value.professional_roles[role]) || value.professional_roles[role].length > 100 ||
          value.professional_roles[role].some(userId => !opaque(userId)) || new Set(value.professional_roles[role]).size !== value.professional_roles[role].length))
      fail(409, "The exact restricted engagement resource and native User role configuration must be repaired.");
    try { assertCollaborationResource(resource); } catch { fail(409, "The engagement collaboration resource is invalid."); }
    return value;
  }
  function assertRoleBinding(row, target, role, userId) {
    if (!row || row.value?.object_type !== "engagement_role_binding" || row.value.engagement_id !== target.value.engagement_id ||
        row.value.user_id !== userId || row.value.role !== role || typeof row.value.initial_assigned !== "boolean" ||
        !Array.isArray(row.value.invitation_ids) || row.value.invitation_ids.length > 100 ||
        row.value.invitation_ids.some(value => !opaque(value)) || new Set(row.value.invitation_ids).size !== row.value.invitation_ids.length)
      fail(409, "The engagement role binding changed or is invalid.");
    return row.value;
  }
  async function assertEngagementRole(auth, target, roles) {
    assertEngagementProfile(target);
    if (!Array.isArray(roles) || !roles.length || roles.length > engagementRoles.length || new Set(roles).size !== roles.length || roles.some(role => !engagementRoles.includes(role))) fail(400, "An exact professional responsibility is required.");
    let until = -Infinity, selected;
    for (const role of roles) {
      if (!target.value.professional_roles[role].includes(auth.userId)) continue;
      const binding = await get(auth.ctx, target.pk, `ROLE_BINDING#${role}#${auth.userId}`);
      // Initial owner/manual assignments are part of the exact configuration.
      // Once invitations participate, their independent finite proofs are read.
      if (!binding || assertRoleBinding(binding, target, role, auth.userId).initial_assigned) { until = Infinity; selected = role; continue; }
      for (const invitationId of binding.value.invitation_ids) {
        const invitation = await get(auth.ctx, `INVITATION#${invitationId}`, "PROFILE"), value = invitation?.value;
        if (value?.resource_type !== "engagement" || value.resource_id !== target.value.engagement_id || value.professional_role !== role ||
            value.status !== "accepted" || value.accepted_by !== auth.userId || !(Date.parse(value.expires_at) > instant().getTime())) continue;
        const grant = await get(auth.ctx, target.pk, `GRANT#${id(value.grant_id)}`), identity = grant?.value.identity;
        if (identity?.resource_type !== "engagement" || identity.resource_id !== target.value.engagement_id || identity.workspace_id !== target.value.workspace_id ||
            identity.subject_type !== "user" || identity.subject_id !== auth.userId || identity.status !== "active" || identity.effect !== "allow" ||
            !identity.actions?.includes(engagementRoleAction(role)) || (identity.expires_at !== null && !(Date.parse(identity.expires_at) > instant().getTime()))) continue;
        const roleAccess = resolveResourceAccess({principal: {principal_type: "user", principal_id: auth.userId}, resource: target.value.resource, grants: [identity], now: instant()});
        if (!roleAccess.allowed_actions.includes(engagementRoleAction(role))) continue;
        const horizon = Math.min(Date.parse(value.expires_at), identity.expires_at === null ? Infinity : Date.parse(identity.expires_at));
        if (horizon > until) { until = horizon; selected = role; }
      }
    }
    if (!selected) fail(403, "A current accepted native User assignment to the required engagement responsibility is required.");
    auth.ctx.authorityDeadlines.set(`engagement-role:${target.value.engagement_id}:${auth.userId}:${[...roles].sort().join(",")}`, until);
    return selected;
  }
  async function resourceAccess(auth, type, resourceId, action = "view") {
    if (type === "engagement") requireEngagementOperations();
    const target = await get(auth.ctx, `${type.toUpperCase()}#${id(resourceId)}`, "PROFILE");
    if (!target || target.value.status !== "active") fail(404, "Resource not available.");
    if (type === "engagement") assertEngagementProfile(target);
    if (type === "notebook" || type === "engagement") {
      const project = await get(auth.ctx, `PROJECT#${id(target.value.project_id)}`, "PROFILE");
      if (project?.value.status !== "active" || project.value.project_id !== target.value.project_id || project.value.workspace_id !== target.value.workspace_id ||
          project.value.account_id !== target.value.account_id) fail(404, "Publication project not available.");
    }
    const workspace = await get(auth.ctx, `WORKSPACE#${target.value.workspace_id}`, "PROFILE");
    const account = await get(auth.ctx, `ACCOUNT#${target.value.account_id}`, "PROFILE");
    if (workspace?.value.identity?.workspace_id !== target.value.workspace_id || workspace.value.identity.status !== "active" ||
      workspace.value.account_id !== target.value.account_id || account?.value.account_id !== target.value.account_id ||
      account.value.status !== "active" || account.value.workspace_id !== target.value.workspace_id) fail(403, "The resource's current workspace/account is inactive.");
    const member = await get(auth.ctx, workspace.pk, `MEMBER#${auth.userId}`);
    const guest = await get(auth.ctx, workspace.pk, `GUEST#${type}#${resourceId}#${auth.userId}`);
    await get(auth.ctx, target.pk, "GRANT_SET");
    const grants = [];
    for (const hint of await store.list(target.pk, "GRANT#")) {
      const row = await get(auth.ctx, target.pk, hint.sk);
      if (row?.value.identity) grants.push(row.value.identity);
    }
    const teamPaths = [];
    for (const teamId of new Set(grants.filter(grant => grant.subject_type === "team").map(grant => grant.subject_id))) {
      try {
        const scoped = await teams.scope(auth, teamId);
        if (scoped.team.value.workspace_id !== target.value.workspace_id || scoped.team.value.account_id !== target.value.account_id) continue;
        await get(auth.ctx, scoped.team.pk, "MEMBER_SET");
        const membership = await get(auth.ctx, scoped.team.pk, `MEMBER#${auth.userId}`);
        if (teams.validMember(membership, scoped.team.value, auth.userId)) {
          const canonical = canonicalEnabled ? await mappedTeamEligibility({get, ctx: auth.ctx, teamId, canonicalTeamId: scoped.team.value.canonical_team_id, userId: auth.canonicalUser?.userId,
            nativeAuthority, now: instant().getTime(), fail}) : {eligible: true, until: Infinity};
          if (canonical.eligible) teamPaths.push({membership, teamId, canonicalUntil: canonical.until});
        }
      } catch (error) { if (![403, 404].includes(error.statusCode)) throw error; }
    }
    const memberships = teamPaths.map(path => path.membership.value);
    if (member?.value.identity?.status === "active" && member.value.identity.user_id === auth.userId && member.value.identity.workspace_id === target.value.workspace_id && member.value.identity.mode === "member")
      memberships.push({user_id: auth.userId, workspace_id: target.value.workspace_id, status: "active"});
    // Direct workspace, direct guest, and Team eligibility are separate paths.
    // A Team deny constrains every applicable Team path, not an independent guest.
    const denyByMode = Object.fromEntries(["member", "guest", "team"].map(mode => [mode, resolveResourceAccess({
      principal: {principal_type: "user", principal_id: auth.userId}, resource: target.value.resource,
      grants: grants.filter(grant => grant.effect === "deny" && (grant.subject_type === "user" ||
        (mode === "team" && grant.subject_type === "team") || (mode === "member" && grant.subject_type === "workspace"))),
      memberships: mode === "team" ? memberships.filter(row => row.team_id) : mode === "member" ? memberships.filter(row => !row.team_id) : [],
      now: instant()}).denied_actions]));
    const evaluations = [];
    const options = {verifiedIdentity: {issuer: auth.principal.issuer, subject: auth.principal.subject}, identityLinks: [auth.link.value],
      users: [auth.user.value.identity], workspace: workspace.value.identity, resource: target.value.resource, now: instant()};
    for (const path of [
      ...(member ? [{participation: member.value.identity, mode: "member"}] : []),
      ...(guest ? [{participation: guest.value.identity, mode: "guest"}] : []),
      ...teamPaths.map(({membership, teamId, canonicalUntil}) => ({participation: membership.value.participation, mode: "team", teamId, canonicalUntil}))]) {
      const pathGrants = grants.filter(grant => grant.effect === "deny"
        ? grant.subject_type === "user" || (path.mode === "team" && grant.subject_type === "team") || (path.mode === "member" && grant.subject_type === "workspace")
        : path.mode === "team" ? grant.subject_type === "team" && grant.subject_id === path.teamId : grant.subject_type !== "team");
      const access = resolveScopedResourceAccess({...options, participations: [path.participation], grants: pathGrants,
        memberships: path.mode === "team" ? memberships.filter(row => row.team_id) : path.mode === "member" ? memberships.filter(row => !row.team_id) : []});
      const horizons = {};
      for (const candidate of access.allowed_actions) {
        if (denyByMode[path.mode].includes(candidate)) continue;
        const sources = access.access?.provenance[candidate]?.allowed_by || [];
        const until = sources.map(source => {
          if (source.source_type === "ownership") return path.mode === "team" ? NaN : Infinity;
          const grant = pathGrants.find(grant => grant.grant_id === source.source_id);
          if (!grant || (path.mode === "team" && (grant.subject_type !== "team" || grant.subject_id !== path.teamId))) return NaN;
          return grant.expires_at === null ? Infinity : Date.parse(grant.expires_at);
        }).filter(value => !Number.isNaN(value));
        if (!until.length) continue;
        const participationUntil = path.participation.expires_at === null ? Infinity : Date.parse(path.participation.expires_at);
        const horizon = Math.min(participationUntil, path.canonicalUntil ?? Infinity, Math.max(...until));
        if (horizon > instant().getTime()) horizons[candidate] = horizon;
      }
      evaluations.push({access, horizons, mode: path.mode, teamId: path.teamId || null});
    }
    const actionHorizons = {};
    for (const evaluation of evaluations) for (const [candidate, horizon] of Object.entries(evaluation.horizons))
      actionHorizons[candidate] = Math.max(actionHorizons[candidate] ?? -Infinity, horizon);
    if (!(action in actionHorizons)) {
      const error = new AccessError(403, "Current scoped access does not allow this action.");
      error.denyInheritance = denyByMode.guest.includes(action); error.denyByMode = denyByMode; throw error;
    }
    const selected = evaluations.find(item => item.horizons[action] === actionHorizons[action]);
    const access = {...selected.access, mode: selected.mode, allowed_actions: Object.keys(actionHorizons),
      access: {...selected.access.access, allowed_actions: Object.keys(actionHorizons), denied_actions: denyByMode[selected.mode]}};
    const horizon = actionHorizons[action];
    if (type === "engagement") auth.ctx.authorityDeadlines.set(`engagement-action:${resourceId}:${auth.userId}:${action}`, horizon);
    return {target, workspace, access, authorityUntil: Number.isFinite(horizon) ? horizon : null, actionHorizons, denyByMode, pathAuthorities: evaluations};
  }
  function projectProjection(row, access) {
    const project = {...row.value}; delete project.resource;
    return {...project, server_authoritative: true, revision: row.revision, role: row.value.owner_user_id === access.identity.user_id ? "Owner" : "Reviewer", permissions: legacyActions(access.allowed_actions)};
  }
  async function projects(auth) {
    const hints = [...await store.list(`USER#${auth.userId}`, "RESOURCE#project#"), ...await teams.resourceHints(auth, "project")];
    const result = [];
    for (const hint of new Map(hints.map(hint => [hint.value.resource_id, hint])).values()) {
      try { const scoped = await resourceAccess(auth, "project", hint.value.resource_id); result.push(projectProjection(scoped.target, scoped.access)); }
      catch (error) { if (![403, 404].includes(error.statusCode)) throw error; }
    }
    return result;
  }
  async function accounts(auth) {
    const result = [];
    // Platform admins can inspect business metadata, never restricted content.
    const ownHints = await store.list(`USER#${auth.userId}`, "ACCOUNT#");
    const hints = auth.user.value.deployment_roles?.includes("application_super_admin")
      ? [...new Map([...ownHints, ...await store.list("CATALOG", "ACCOUNT#")].map(row => [row.value.account_id, row])).values()] : ownHints;
    for (const hint of hints) {
      const row = await get(auth.ctx, `ACCOUNT#${hint.value.account_id}`, "PROFILE");
      if (!row || row.value.status !== "active") continue;
      const membership = await get(auth.ctx, row.pk, `MEMBER#${auth.userId}`);
      if (auth.user.value.deployment_roles?.includes("application_super_admin") || membership?.value.status === "active") result.push({...row.value, revision: row.revision});
    }
    return result;
  }
  async function session(principal) {
    let auth = await authenticate(principal);
    const personalScope = await personal(auth); auth = personalScope.auth || auth;
    const [projectRows, accountRows, teamRows] = await Promise.all([projects(auth), accounts(auth), teams.teamRows(auth)]);
    const teamMembers = [];
    for (const team of teamRows) { const row = await get(auth.ctx, `TEAM#${team.team_id}`, "PROFILE"); teamMembers.push(...await teams.roster(auth, row, {ownOnly: !team.can_manage})); }
    const accountMembers = [];
    for (const account of accountRows) {
      const row = await get(auth.ctx, `ACCOUNT#${account.account_id}`, `MEMBER#${auth.userId}`);
      if (row?.value.status === "active") accountMembers.push({...row.value, account_id: account.account_id});
    }
    const notifications = await get(auth.ctx, `USER#${auth.userId}`, "PREFERENCE#notifications");
    const user = {...auth.user.value, revision: auth.user.revision, server_authoritative: true, cognito_groups: [], groups: []}; delete user.identity;
    const shared = await artifacts(principal), sharedDocuments = shared.artifacts, invitations = (await listInvitations(principal)).invitations;
    await commit(auth.ctx);
    return {user, workspace: {...personalScope.workspace.value, workspace_id: personalScope.workspace.value.identity.workspace_id, revision: personalScope.workspace.revision},
      accounts: accountRows, accountMembers, teams: teamRows, teamMembers, projects: projectRows,
      projectGrants: projectRows.map(project => ({grant_id: `projection_${project.project_id}_${auth.userId}`, project_id: project.project_id, target_type: "user", target_id: auth.userId,
        permissions: project.role === "Owner" ? ["owner"] : project.permissions, status: "active", source: "server_projection"})),
      sharedDocuments, sharedDocumentsNextCursor: shared.next_cursor, invitations,...(canonicalEnabled?{canonicalUser:auth.canonicalUser}:{}),
      capabilities: {authenticated_engagements: Boolean(engagementConfigured()), engagement_invitations: Boolean(engagementConfigured())},
      notificationPreferencesByUserId: {[auth.userId]: notifications?.value || createDefaultNotificationPreferences({userId: auth.userId, email: user.email})},
      unsupported: ["account_team_inherited_grants", "AI_runs", "billing_checkout"]};
  }
  async function createProject(principal, body) {
    let auth = await authenticate(principal);
    const personalScope = await personal(auth); auth = personalScope.auth || auth;
    const workspaceId = body.workspace_id || personalScope.workspace.value.identity.workspace_id;
    const {workspace} = await memberWorkspace(auth, workspaceId, {owner: true});
    const plan = await entitlement(auth, workspaceId, "can_create_projects");
    const counter = await get(auth.ctx, workspace.pk, "PROJECT_COUNTER");
    if (!counter || !Number.isSafeInteger(counter.value.count) || (plan.value.max_private_projects !== null && counter.value.count >= plan.value.max_private_projects)) fail(403, "The current project quota is exhausted or unconfigured.");
    if (["bucket", "key", "storage_prefix", "kmsKeyArn"].some(name => Object.hasOwn(body, name))) fail(400, "The canonical account selects project storage on the server.");
    const accountId = workspace.value.account_id;
    if (body.account_id && body.account_id !== accountId) fail(403, "Project storage belongs to its explicit security workspace.");
    if (body.team_id || (body.owner_type && !["user_workspace", "account"].includes(body.owner_type))) fail(501, "Team-owned project creation is not implemented by this backend.");
    let related;
    try { related = normalizeProjectAccountIds(body.related_account_ids ?? []); }
    catch (error) { if (error instanceof TypeError) fail(400, error.message); throw error; }
    const accessibleAccounts = await accounts(auth);
    for (const account of related) if (!accessibleAccounts.some(row => row.account_id === id(account))) fail(403, "Business account metadata is not available.");
    const projectId = `project_${newId()}`;
    const resource = assertCollaborationResource({schema_version: 1, resource_type: "project", resource_id: projectId, workspace_id: workspaceId,
      owner_id: auth.userId, creator_id: auth.userId, access_policy: {inheritance: "restricted", allow_public_links: false}});
    const project = record(`PROJECT#${projectId}`, "PROFILE", {project_id: projectId, workspace_id: workspaceId, account_id: accountId,
      related_account_ids: related, business_context: createProjectBusinessContext({projectId, workspaceId,
        homeAccountId: accountId, relatedAccountIds: related}), team_id: null, owner_type: workspace.value.owner_user_id === auth.userId ? "user_workspace" : "account", owner_id: workspaceId,
      owner_user_id: auth.userId, resource, name: text(body.name), country: text(body.country || "Not specified", 100), sector: text(body.sector || "Not specified", 100),
      status: "active", restricted: true, source_authority_version: 1, members: 1, reports: 0, standards: [], compliance: 0, updated_at: iso(), created_by: auth.userId,
      storage_prefix: `s3://${storage.forAccount(accountId).bucket}/tenants/${accountId}/projects/${projectId}/`});
    const caseSources=mergeEngagementCaseSources({row:null,scope:{accountId,projectId,workspaceId},bindings:[],initialize:true});
    await commit(auth.ctx, [project,caseSources, record(project.pk, "SOURCE_AUTHORITY_SET", {object_type: "project_source_authority_set", coverage_version: 1,
      project_id: projectId, workspace_id: workspaceId, account_id: accountId, generation: 1}), update(counter, {count: counter.value.count + 1}),
      record(workspace.pk, `PROJECT#${projectId}`, {resource_id: projectId}),
      record(`USER#${auth.userId}`, `RESOURCE#project#${projectId}`, {resource_id: projectId})]);
    return {project: {...project.value, resource: undefined, revision: 1}};
  }
  async function createAccount(principal, body) {
    const auth = await authenticate(principal);
    if (!auth.user.value.deployment_roles?.includes("application_super_admin")) fail(403, "A persisted application administrator is required.");
    if (!["client_org", "consulting_firm"].includes(body.type)) fail(400, "An existing ESIA business account type is required.");
    const accountId = `acct_${newId()}`;
    const account = record(`ACCOUNT#${accountId}`, "PROFILE", {account_id: accountId, name: text(body.name), type: body.type,
      status: "active", owner_user_id: auth.userId, data_classification: "confidential", default_project_visibility: "private", created_by: auth.userId, created_at: iso()});
    // A business relationship creates no workspace membership or resource grant.
    await commit(auth.ctx, [account, record("CATALOG", `ACCOUNT#${accountId}`, {account_id: accountId}),
      record(`USER#${auth.userId}`, `ACCOUNT#${accountId}`, {account_id: accountId}),
      record(`ACCOUNT#${accountId}`, `MEMBER#${auth.userId}`, {user_id: auth.userId, role: "account_admin", permissions: ["manage_account"], status: "active"})]);
    return {account: {...account.value, revision: 1}};
  }
  function engagementInvitation(value, target) {
    assertEngagementProfile(target);
    if (value.resource_type !== "engagement" || value.resource_id !== target.value.engagement_id || value.workspace_id !== target.value.workspace_id ||
        value.project_id !== target.value.project_id || value.account_id !== target.value.account_id || !engagementRoles.includes(value.professional_role) ||
        !Number.isSafeInteger(value.configuration_revision) || value.configuration_revision < 1 || !Array.isArray(value.permissions) ||
        !value.permissions.includes(engagementRoleAction(value.professional_role))) fail(409, "The invitation's exact engagement scope or professional responsibility is invalid.");
  }
  async function engagementWrites(auth, target, result, {readOnly = false} = {}) {
    const writes = result?.extraWrites;
    if (!Array.isArray(writes) || writes.length > 20 || (readOnly && writes.length)) fail(503, "The engagement invitation adapter returned an invalid transaction plan.");
    const keys = new Set();
    for (const row of writes) {
      const allowed = row?.pk === target.pk && row.sk === "HEAD" || /^(ENGAGEMENT_REVISION|ENGAGEMENT_REQUEST)#[A-Za-z0-9_.:-]+$/.test(row?.pk || "") && row.sk === "PROFILE";
      if (!allowed || !Number.isSafeInteger(row.revision) || row.revision < 1 || !row.value || keys.has(key(row.pk, row.sk))) fail(503, "The engagement invitation adapter cannot change access-owned or duplicate records.");
      keys.add(key(row.pk, row.sk)); await get(auth.ctx, row.pk, row.sk);
    }
    return writes;
  }
  async function currentInviter(auth, invitation) {
    const creator = await get(auth.ctx, `USER#${id(invitation.created_by)}`, "PROFILE");
    if (creator?.value.status !== "active" || creator.value.identity?.status !== "active" || creator.value.user_id !== invitation.created_by) fail(403, "The inviter is inactive.");
    const creatorPrincipal = {...auth.principal, subject: creator.value.cognito_sub};
    const creatorLinkId = `identity_${digest(externalIdentityKey(creatorPrincipal)).slice(0, 48)}`;
    const creatorLink = await get(auth.ctx, `IDENTITY#${creatorLinkId}`, "LINK");
    const resolved = resolveIdentityUser({verifiedIdentity: {issuer: creatorPrincipal.issuer, subject: creatorPrincipal.subject},
      identityLinks: creatorLink ? [creatorLink.value] : [], users: [creator.value.identity]});
    if (!resolved.allowed || resolved.user_id !== invitation.created_by) fail(403, "The inviter identity link is inactive.");
    auth.ctx.providerPrincipals.set(externalIdentityKey(creatorPrincipal), creatorPrincipal);
    const current = await verifyCurrentIdentity(creatorPrincipal);
    if (current?.active !== true || current.subject !== creatorPrincipal.subject) fail(403, "The inviter provider account is inactive.");
    rememberCanonical(auth.ctx, current);
    return {...auth, user: creator, userId: creator.value.user_id, link: creatorLink, principal: creatorPrincipal,
      ...(canonicalEnabled ? {canonicalUser: current.canonicalUser} : {})};
  }
  const engagementDestination = target => ({account_id: target.value.account_id, project_id: target.value.project_id, engagement_id: target.value.engagement_id});
  async function previewInvitation(principal, invitationId) {
    const auth = await authenticate(principal), row = await get(auth.ctx, `INVITATION#${id(invitationId)}`, "PROFILE");
    if (row?.value.kind === "team") return teams.previewInvitation(principal, invitationId);
    if (row?.value.resource_type !== "engagement") fail(404, "An engagement or Team invitation is required for preview.");
    const operations = requireEngagementOperations(), recipient = row.value.recipient;
    const exactRecipient = recipient?.issuer === principal.issuer && recipient?.subject === principal.subject;
    const inviterAuth = await currentInviter(auth, row.value);
    const {target} = await resourceAccess(inviterAuth, "engagement", row.value.resource_id, "manage_access");
    engagementInvitation(row.value, target);
    if (!exactRecipient) await resourceAccess(auth, "engagement", row.value.resource_id, "manage_access");
    if (!["pending", "accepted"].includes(row.value.status)) fail(409, "The engagement invitation is no longer available.");
    if (row.value.status === "pending" && row.value.configuration_revision !== target.revision) fail(409, "The engagement configuration changed. Request a new invitation.");
    if (row.value.status === "pending" && !(Date.parse(row.value.expires_at) > instant().getTime())) fail(409, "The engagement invitation expired.");
    if (row.value.status === "pending") auth.ctx.authorityDeadlines.set(`engagement-invitation:${row.value.invitation_id}`, Date.parse(row.value.expires_at));
    if (row.value.status === "accepted" && exactRecipient) {
      await resourceAccess(auth, "engagement", row.value.resource_id, "view");
      await assertEngagementRole(auth, target, [row.value.professional_role]);
    }
    await operations.invitationPreview({auth, inviterAuth, target, invitation: row.value});
    await commit(auth.ctx);
    return {invitation: {invitation_id: row.value.invitation_id, resource_type: "engagement", resource_id: target.value.engagement_id,
      engagement_id: target.value.engagement_id, name: text(target.value.name, 500), ...engagementDestination(target),
      professional_role: row.value.professional_role, permissions: [...row.value.permissions], recipient: {...recipient}, status: row.value.status,
      revision: row.revision, configuration_revision: row.value.configuration_revision, expires_at: row.value.expires_at}};
  }
  async function invitation(principal, body) {
    if (body.kind === "team") return teams.inviteTeam(principal, body);
    const auth = await authenticate(principal), type = body.resource_type;
    if (!["project", "document", "notebook", "engagement"].includes(type)) fail(400, "An explicit project, document, notebook or engagement target is required.");
    const operations = type === "engagement" ? requireEngagementOperations() : null;
    const {target} = await resourceAccess(auth, type, body.resource_id, "manage_access");
    if(type==="engagement"&&Object.keys(body).some(field=>!["resource_type","resource_id","professional_role","permissions","recipient","configuration_revision","expires_at","request_id"].includes(field)))fail(400,"Use the exact engagement invitation fields; the verified session supplies its maker.");
    const actions = toActions(body.permissions);
    if (type === "engagement" && (!engagementRoles.includes(body.professional_role) || !actions.includes(engagementRoleAction(body.professional_role)))) fail(400, "An exact professional role and its explicit edit or review permission are required.");
    if (actions.includes("edit")) await entitlement(auth, target.value.workspace_id, "can_invite_editors");
    const recipient = body.recipient;
    if (!recipient || recipient.issuer !== expectedIssuer) fail(400, "The recipient must name the configured issuer and exact subject.");
    externalIdentityKey(recipient);
    if (Object.keys(recipient).some(field => !["issuer", "subject"].includes(field))) fail(400, "Email and browser user IDs cannot identify invitation recipients.");
    const expires = Date.parse(body.expires_at);
    let attempt,inputSha256;
    if(type==="engagement"){
      if(!Number.isSafeInteger(body.configuration_revision)||body.configuration_revision<1||!Number.isFinite(expires))fail(400,"Use the exact engagement configuration and a finite invitation expiry.");
      // Inspect the exact provider identity without enrolling or granting it.
      const recipientPrincipal={...principal,issuer:recipient.issuer,subject:recipient.subject},profile=await verifyCurrentIdentity(recipientPrincipal);
      if(profile?.active!==true||profile.subject!==recipient.subject)fail(403,"The selected recipient account is inactive or unavailable.");
      auth.ctx.providerPrincipals.set(externalIdentityKey(recipientPrincipal),recipientPrincipal);rememberCanonical(auth.ctx,profile);
      const recipientLinkId=`identity_${digest(externalIdentityKey(recipient)).slice(0,48)}`,recipientLink=await get(auth.ctx,`IDENTITY#${recipientLinkId}`,"LINK");
      if(recipientLink){const user=await get(auth.ctx,`USER#${id(recipientLink.value.user_id)}`,"PROFILE"),resolved=resolveIdentityUser({verifiedIdentity:recipient,identityLinks:[recipientLink.value],users:user?[user.value.identity]:[]});if(!resolved.allowed||user?.value.status!=="active"||user.value.cognito_sub!==recipient.subject||resolved.user_id!==user.value.user_id)fail(403,"The selected recipient's native identity is inactive.");}
      if(body.request_id!==undefined){
        if(typeof body.request_id!=="string"||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(body.request_id))fail(400,"Use an explicit invitation request UUID.");
        inputSha256=digest(JSON.stringify({resource_type:type,resource_id:target.value.engagement_id,configuration_revision:body.configuration_revision,professional_role:body.professional_role,permissions:[...actions].sort(),recipient:{issuer:recipient.issuer,subject:recipient.subject},expires_at:new Date(expires).toISOString()}));
        attempt=await get(auth.ctx,`ENGAGEMENT_INVITATION_REQUEST#${body.request_id}`,"PROFILE");
        if(attempt){
          if(attempt.value.object_type!=="engagement_invitation_request"||attempt.value.user_id!==auth.userId||attempt.value.issuer!==principal.issuer||attempt.value.subject!==principal.subject||attempt.value.input_sha256!==inputSha256)fail(409,"This invitation request UUID already belongs to different work.");
          const previous=await get(auth.ctx,`INVITATION#${id(attempt.value.invitation_id)}`,"PROFILE");if(!previous)fail(409,"The saved invitation receipt is unavailable.");engagementInvitation(previous.value,target);if(previous.value.created_by!==auth.userId)fail(409,"The saved invitation belongs to another maker.");
          await commit(auth.ctx);const {token_sha256,...visible}=previous.value;return {invitation:{...visible,revision:previous.revision},duplicate:true,token_unavailable:true,request_id:body.request_id};
        }
      }
    }
    if (body.configuration_revision !== target.revision) fail(409, "The resource configuration changed.");
    if (!Number.isFinite(expires) || expires <= instant().getTime() || expires > instant().getTime() + 7 * 86400_000) fail(400, "Invitations require a finite expiry within seven days.");
    const invitationId = `${type === "engagement" ? "invite_engagement_" : "invite_"}${newId()}`, token = randomBytes(32).toString("base64url");
    const value = {invitation_id: invitationId, resource_type: type, resource_id: target.value.resource.resource_id, workspace_id: target.value.workspace_id,
      recipient, permissions: actions, token_sha256: digest(token), status: "pending", expires_at: new Date(expires).toISOString(), created_by: auth.userId, created_at: iso()};
    if (type === "engagement") {
      Object.assign(value, {project_id: target.value.project_id, account_id: target.value.account_id, professional_role: body.professional_role, configuration_revision: target.revision});
      auth.ctx.authorityDeadlines.set(`engagement-invitation:${invitationId}`, expires);
      const result = await operations.invitationChange({stage: "issue", auth, inviterAuth: auth, target, invitation: value, role: body.professional_role, professionalRole: body.professional_role});
      await engagementWrites(auth, target, result, {readOnly: true});
    }
    const writes=[record(`INVITATION#${invitationId}`, "PROFILE", value),record(`USER#${auth.userId}`, `INVITATION#${invitationId}`, {invitation_id: invitationId,...(type==="engagement"?{resource_type:type,resource_id:target.value.engagement_id}:{})})];
    if(type==="engagement"&&body.request_id!==undefined)writes.push(record(`ENGAGEMENT_INVITATION_REQUEST#${body.request_id}`,"PROFILE",{object_type:"engagement_invitation_request",user_id:auth.userId,issuer:principal.issuer,subject:principal.subject,input_sha256:inputSha256,invitation_id:invitationId,created_at:iso()}));
    await commit(auth.ctx, writes);
    const {token_sha256, ...visible} = value;
    return {invitation: {...visible, revision: 1}, token,...(type==="engagement"&&body.request_id!==undefined?{request_id:body.request_id}:{})};
  }
  async function acceptInvitation(principal, invitationId, body) {
    const auth = await authenticate(principal), row = await get(auth.ctx, `INVITATION#${id(invitationId)}`, "PROFILE");
    if (row?.value.kind === "team") return teams.acceptTeam(auth, row, body);
    if (!row || row.value.recipient?.issuer !== principal.issuer || row.value.recipient?.subject !== principal.subject) fail(403, "The invitation belongs to a different verified identity.");
    const engagement = row.value.resource_type === "engagement", operations = engagement ? requireEngagementOperations() : null;
    if (engagement && (Object.keys(body).some(field => !["token", "expected_revision"].includes(field)) || !Number.isSafeInteger(body.expected_revision) || body.expected_revision < 1)) fail(400, "Explicit invitation token and revision are required; the verified session selects the recipient.");
    const replay = engagement && row.value.status === "accepted" && row.value.accepted_by === auth.userId && row.revision === body.expected_revision + 1;
    if ((!replay && (row.revision !== body.expected_revision || row.value.status !== "pending")) || !(Date.parse(row.value.expires_at) > instant().getTime())) fail(409, "The invitation is no longer pending at this revision.");
    if (typeof body.token !== "string" || body.token.length > 200 || !/^[a-f0-9]{64}$/.test(row.value.token_sha256 || "") || !timingSafeEqual(Buffer.from(digest(body.token)), Buffer.from(row.value.token_sha256))) fail(403, "Invitation token invalid.");
    if (engagement) auth.ctx.authorityDeadlines.set(`engagement-invitation:${invitationId}`, Date.parse(row.value.expires_at));
    // Acceptance rechecks the inviter's current persisted identity, lifecycle and authority.
    const creatorAuth = await currentInviter(auth, row.value);
    const {target} = await resourceAccess(creatorAuth, row.value.resource_type, row.value.resource_id, "manage_access");
    if (engagement) {
      engagementInvitation(row.value, target);
      if (replay) {
        await resourceAccess(auth, "engagement", target.value.engagement_id, "view");
        await assertEngagementRole(auth, target, [row.value.professional_role]);
        await operations.invitationPreview({auth, inviterAuth: creatorAuth, target, invitation: row.value});
        await commit(auth.ctx);
        return {invitation_id: invitationId, status: "accepted", revision: row.revision, destination: engagementDestination(target)};
      }
      if (row.value.configuration_revision !== target.revision) fail(409, "The engagement configuration changed. Request a new invitation.");
    }
    if (row.value.permissions.includes("edit")) await entitlement(auth, row.value.workspace_id, "can_invite_editors");
    const guestKey = `GUEST#${row.value.resource_type}#${row.value.resource_id}#${auth.userId}`;
    const oldGuest = await get(auth.ctx, `WORKSPACE#${row.value.workspace_id}`, guestKey);
    const grantId = `grant_${invitationId}`;
    const oldGrant = await get(auth.ctx, target.pk, `GRANT#${grantId}`);
    const indexKey = `RESOURCE#${row.value.resource_type}#${row.value.resource_id}`;
    const oldIndex = await get(auth.ctx, `USER#${auth.userId}`, indexKey);
    if (oldGrant) fail(409, "This invitation was already consumed.");
    if (engagement && oldGuest && (validateWorkspaceParticipation(oldGuest.value.identity).length || oldGuest.value.identity.user_id !== auth.userId ||
        oldGuest.value.identity.workspace_id !== row.value.workspace_id || oldGuest.value.identity.mode !== "guest" ||
        !oldGuest.value.identity.resource_scopes.some(scope => scope.resource_type === "engagement" && scope.resource_id === row.value.resource_id)))
      fail(409, "The exact engagement Guest participation changed or is invalid.");
    const guestExpires = engagement && oldGuest?.value.identity && (oldGuest.value.identity.expires_at === null || Date.parse(oldGuest.value.identity.expires_at) > Date.parse(row.value.expires_at))
      ? oldGuest.value.identity.expires_at : row.value.expires_at;
    const guest = createWorkspaceParticipation({participationId: oldGuest?.value.identity.participation_id || `guest_${newId()}`,
      workspaceId: row.value.workspace_id, userId: auth.userId, mode: "guest", revision: (oldGuest?.value.identity.revision || 0) + 1,
      resourceScopes: [{resource_type: row.value.resource_type, resource_id: row.value.resource_id}], expiresAt: guestExpires});
    const grant = createResourceGrant({grantId, resourceType: row.value.resource_type, resourceId: row.value.resource_id, workspaceId: row.value.workspace_id,
      subjectType: "user", subjectId: auth.userId, actions: row.value.permissions, expiresAt: row.value.expires_at, createdBy: row.value.created_by, resource: target.value.resource, now: instant()});
    const writes = [];
    if (engagement) {
      const role = row.value.professional_role, bindingKey = `ROLE_BINDING#${role}#${auth.userId}`;
      const previous = await get(auth.ctx, target.pk, bindingKey);
      const binding = previous ? assertRoleBinding(previous, target, role, auth.userId) : {object_type: "engagement_role_binding", engagement_id: target.value.engagement_id,
        user_id: auth.userId, role, initial_assigned: target.value.professional_roles[role].includes(auth.userId), invitation_ids: []};
      if (binding.invitation_ids.length >= 100) fail(413, "This professional assignment has reached its invitation limit.");
      const result = await operations.invitationChange({stage: "accept", auth, inviterAuth: creatorAuth, target, invitation: row.value, role, professionalRole: role, recipientUserId: auth.userId});
      writes.push(...await engagementWrites(auth, target, result),
        record(target.pk, bindingKey, {...binding, invitation_ids: [...binding.invitation_ids, invitationId]}, (previous?.revision || 0) + 1),
        update(target, {...target.value, professional_roles: {...target.value.professional_roles, [role]: [...new Set([...target.value.professional_roles[role], auth.userId])]}, updated_at: iso()}));
    }
    await commit(auth.ctx, [update(row, {...row.value, status: "accepted", accepted_by: auth.userId, grant_id: grantId, accepted_at: iso(),
      ...(engagement ? {accepted_configuration_revision: target.revision + 1} : {})}),
      record(`WORKSPACE#${row.value.workspace_id}`, guestKey, {identity: guest}, (oldGuest?.revision || 0) + 1),
      record(target.pk, `GRANT#${grantId}`, {identity: grant}),
      record(`USER#${auth.userId}`, indexKey, {resource_id: row.value.resource_id}, (oldIndex?.revision || 0) + 1), ...writes]);
    return {invitation_id: invitationId, status: "accepted", revision: row.revision + 1, ...(engagement ? {destination: engagementDestination(target)} : {})};
  }
  async function revokeInvitation(principal, invitationId, body) {
    const auth = await authenticate(principal), row = await get(auth.ctx, `INVITATION#${id(invitationId)}`, "PROFILE");
    if (!row) fail(404, "Invitation unavailable.");
    if (row.value.kind === "team") return teams.revokeTeam(auth, row, body);
    const {target} = await resourceAccess(auth, row.value.resource_type, row.value.resource_id, "manage_access");
    if (body.expected_revision !== row.revision) fail(409, "Invitation revision changed.");
    const engagement = row.value.resource_type === "engagement", operations = engagement ? requireEngagementOperations() : null;
    if (engagement) {
      engagementInvitation(row.value, target);
      if (!["pending", "accepted"].includes(row.value.status)) fail(409, "The engagement invitation is already inactive.");
    }
    const writes = [update(row, {...row.value, status: "revoked", revoked_at: iso()})];
    if (row.value.grant_id) {
      const grant = await get(auth.ctx, target.pk, `GRANT#${row.value.grant_id}`);
      if (grant) writes.push(update(grant, {identity: {...grant.value.identity, status: "revoked", revision: grant.value.identity.revision + 1}}));
    }
    if (engagement) {
      const role = row.value.professional_role;
      const result = await operations.invitationChange({stage: "revoke", auth, inviterAuth: auth, target, invitation: row.value, role, professionalRole: role,
        ...(row.value.accepted_by ? {recipientUserId: row.value.accepted_by} : {})});
      writes.push(...await engagementWrites(auth, target, result));
      if (row.value.accepted_by) {
        const bindingKey = `ROLE_BINDING#${role}#${id(row.value.accepted_by)}`, previous = await get(auth.ctx, target.pk, bindingKey);
        const binding = assertRoleBinding(previous, target, role, row.value.accepted_by), remaining = binding.invitation_ids.filter(value => value !== invitationId);
        const professional_roles = {...target.value.professional_roles, [role]: binding.initial_assigned || remaining.length
          ? target.value.professional_roles[role] : target.value.professional_roles[role].filter(userId => userId !== row.value.accepted_by)};
        writes.push(update(previous, {...binding, invitation_ids: remaining}), update(target, {...target.value, professional_roles, updated_at: iso()}));
      }
    }
    await commit(auth.ctx, writes); return {invitation_id: invitationId, status: "revoked", revision: row.revision + 1};
  }
  async function grants(principal, type, resourceId, body) {
    const auth = await authenticate(principal), {target} = await resourceAccess(auth, type, resourceId, "manage_access");
    if (!body) {
      const rows = [];
      for (const hint of await store.list(target.pk, "GRANT#")) { const row = await get(auth.ctx, target.pk, hint.sk); if (row) rows.push({...row.value.identity, revision: row.revision}); }
      await commit(auth.ctx); return {grants: rows, configuration_revision: target.revision};
    }
    if (body.configuration_revision !== target.revision) fail(409, "Resource configuration changed.");
    if (body.subject_type === "team") {
      const teamId = id(body.subject_id), scoped = await teams.scope(auth, teamId, {inactive: body.status === "revoked"});
      if (scoped.team.value.workspace_id !== target.value.workspace_id || scoped.team.value.account_id !== target.value.account_id) fail(400, "Team grant must belong to the exact resource workspace/account.");
      if (body.status && !["active", "revoked"].includes(body.status)) fail(400, "Team grant status is invalid.");
      const grantId = body.grant_id ? id(body.grant_id) : `grant_team_${newId()}`;
      const previous = await get(auth.ctx, target.pk, `GRANT#${grantId}`);
      if (body.grant_id && (!previous || previous.revision !== body.expected_revision || previous.value.identity.subject_type !== "team" || previous.value.identity.subject_id !== teamId)) fail(409, "Exact Team grant revision changed.");
      if (!body.grant_id && previous) fail(409, "Team grant identifier already exists.");
      let identity;
      if (body.status === "revoked") {
        if (!previous) fail(400, "Revocation requires an existing Team grant.");
        identity = {...previous.value.identity, status: "revoked", revision: previous.value.identity.revision + 1};
      } else {
        const actions = toActions(body.permissions);
        if (actions.includes("edit")) await entitlement(auth, target.value.workspace_id, "can_invite_editors");
        if (body.expires_at !== undefined && body.expires_at !== null && (!Number.isFinite(Date.parse(body.expires_at)) || Date.parse(body.expires_at) <= instant().getTime())) fail(400, "Team grant expiry must be null or a future finite instant.");
        identity = createResourceGrant({grantId, resourceType: type, resourceId, workspaceId: target.value.workspace_id, subjectType: "team", subjectId: teamId,
          actions, expiresAt: body.expires_at ?? null, createdBy: previous?.value.identity.created_by || auth.userId, revision: (previous?.value.identity.revision || 0) + 1, resource: target.value.resource, now: instant()});
      }
      const hint = await get(auth.ctx, scoped.team.pk, `RESOURCE#${type}#${resourceId}`);
      const row = record(target.pk, `GRANT#${grantId}`, {identity}, (previous?.revision || 0) + 1);
      await commit(auth.ctx, [row, record(scoped.team.pk, `RESOURCE#${type}#${resourceId}`, {resource_id: resourceId}, (hint?.revision || 0) + 1)]);
      return {grant_id: grantId, status: identity.status, revision: row.revision};
    }
    if (body.status !== "revoked") fail(501, "New individual recipients must accept an exact resource invitation.");
    const row = await get(auth.ctx, target.pk, `GRANT#${id(body.grant_id)}`);
    if (!row || row.revision !== body.expected_revision) fail(409, "Grant revision changed.");
    await commit(auth.ctx, [update(row, {identity: {...row.value.identity, status: "revoked", revision: row.value.identity.revision + 1}})]);
    return {grant_id: body.grant_id, status: "revoked", revision: row.revision + 1};
  }
  const originalFields = ["artifact_id", "document_id", "project_id", "workspace_id", "account_id", "resource", "owner_type", "owner_id", "owner_user_id", "filename", "content_type", "original_metadata", "upload", "storage_key", "created_by", "created_at"];
  const artifactProjection = row => { const {resource, ...value} = row.value; return {...value, revision: row.revision}; };
  function uploadManifest(body) {
    if (["bucket", "key", "storage_key", "kmsKeyArn"].some(name => Object.hasOwn(body, name))) fail(400, "The canonical account selects document storage on the server.");
    if (typeof body.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(body.sha256) || !Number.isSafeInteger(body.size_bytes) || body.size_bytes < 1 || body.size_bytes > 25 * 1024 * 1024) fail(400, "Registration requires an exact SHA-256 and a byte length from 1 byte to 25 MiB.");
    if (!hostedFieldMediaTypes.includes(body.content_type)) fail(400, "Unsupported document content type.");
    const metadata = Object.hasOwn(body, "original_metadata") ? body.original_metadata : null;
    if (validatePortableData(metadata).length || JSON.stringify(metadata).length > 20_000) fail(400, "Original metadata must be bounded portable JSON.");
    const field = metadata?.[hostedFieldMetadata];
    if (field !== undefined) {
      try {assertHostedFieldMetadata(field);} catch (error) {fail(400, error.message);}
      if (field.role === 'manifest' && (body.content_type !== 'application/json' || body.size_bytes > 1024 * 1024) || field.role === 'original' && body.size_bytes > 10 * 1024 * 1024) fail(400, 'A field manifest is bounded JSON; field originals are at most10MiB.');
      if (typeof body.filename !== 'string' || /[\\/\x00-\x1f\x7f]/.test(body.filename)) fail(400, 'A field original filename cannot contain a path or control character.');
    } else if (/^(image|audio)\//.test(body.content_type)) fail(400, 'Photo and audio originals require a typed field registration.');
    text(body.filename, 180);
    return {registration_id: id(body.registration_id), sha256: body.sha256, size_bytes: body.size_bytes, content_type: body.content_type, filename: body.filename, original_metadata: structuredClone(metadata)};
  }
  async function fieldRegistrationAuthority(auth,project,field,captureRecord,source) {
    if(field.engagementId!==undefined||field.leaseId!==undefined){
      if(typeof authenticatedEngagements?.fieldRegistrationAuthority!=="function")fail(503,"Scoped engagement field capture is not configured.");
      return authenticatedEngagements.fieldRegistrationAuthority({auth,project,field,captureRecord,source});
    }
    try {fieldUploadPolicy(project.value);} catch(error){fail(403,error.message);}
  }
  async function createArtifact(principal, body) {
    const auth = await authenticate(principal), {target: project} = await resourceAccess(auth, "project", body.project_id, "edit");
    if (body.configuration_revision !== project.revision) fail(409, "Project configuration changed.");
    await entitlement(auth, project.value.workspace_id, "storage_writes");
    storage.forAccount(project.value.account_id);
    const manifest = uploadManifest(body), artifactId = `document_${digest(JSON.stringify([body.project_id, auth.userId, manifest.registration_id])).slice(0, 48)}`;
    await caseSourceAuthority(auth,{account_id:project.value.account_id,project_id:project.value.project_id,workspace_id:project.value.workspace_id,artifact_id:artifactId,upload:{sha256:manifest.sha256}});
    const field = manifest.original_metadata?.[hostedFieldMetadata],fieldPermission=field?await fieldRegistrationAuthority(auth,project,field,undefined,{sha256:manifest.sha256,artifactId,register:true}):undefined,fieldWrites=fieldPermission?.extraWrites||[];
    const captureMarker = field?.role === 'manifest' ? await get(auth.ctx, project.pk, `FIELD_CAPTURE#${field.captureId}`) : null;
    if (captureMarker && (captureMarker.value.artifact_id !== artifactId || captureMarker.value.record_sha256 !== field.recordSha256 || captureMarker.value.sha256 !== manifest.sha256)) fail(409, 'This capture identity already selects an immutable original. Create a new record for later changes.');
    const existing = await get(auth.ctx, `DOCUMENT#${artifactId}`, "PROFILE");
    if (existing) {
      const saved = existing.value;
      if (saved.created_by !== auth.userId || saved.project_id !== body.project_id || saved.upload.project_configuration_revision !== body.configuration_revision ||
          saved.filename !== manifest.filename || saved.content_type !== manifest.content_type || saved.upload.sha256 !== manifest.sha256 || saved.upload.size_bytes !== manifest.size_bytes ||
          JSON.stringify(saved.original_metadata) !== JSON.stringify(manifest.original_metadata)) fail(409, "This registration identifier already selects a different original.");
      if (field && saved.status === 'pending_upload' && Date.parse(saved.field_transfer_expires_at || saved.upload.expires_at) <= instant().getTime()) {
        // Explicit retry after a long offline period renews only a temporary
        // transfer horizon. The original registration and byte identity remain.
        const renewed = update(existing, {...saved, field_transfer_expires_at: new Date(instant().getTime() + 3600_000).toISOString()});
        await commit(auth.ctx, [renewed,...fieldWrites]);return {artifact: artifactProjection(renewed)};
      }
      await commit(auth.ctx,fieldWrites); return {artifact: artifactProjection(existing)};
    }
    const resource = assertCollaborationResource({schema_version: 1, resource_type: "document", resource_id: artifactId,
      workspace_id: project.value.workspace_id, project_id: body.project_id, owner_id: project.value.owner_user_id, creator_id: auth.userId,
      access_policy: {inheritance: "restricted", allow_public_links: false}});
    const artifact = record(`DOCUMENT#${artifactId}`, "PROFILE", {artifact_id: artifactId, document_id: artifactId,
      project_id: body.project_id, workspace_id: project.value.workspace_id, account_id: project.value.account_id,
      owner_type: "project", owner_id: body.project_id, owner_user_id: project.value.owner_user_id, resource,
      filename: manifest.filename, content_type: manifest.content_type, original_metadata: manifest.original_metadata,
      upload: {registration_id: manifest.registration_id, sha256: manifest.sha256, size_bytes: manifest.size_bytes, content_type: manifest.content_type,
        project_configuration_revision: project.revision, registration_revision: 1, expires_at: new Date(instant().getTime() + 3600_000).toISOString()},
      data_classification: "confidential", data_type: "document", status: "pending_upload", content_state: "pending",
      storage_key: `tenants/${project.value.account_id}/projects/${body.project_id}/documents/${artifactId}/original`, created_by: auth.userId, created_at: iso()});
    await commit(auth.ctx, [artifact,...fieldWrites, record(project.pk, `ARTIFACT#${artifactId}`, {resource_id: artifactId}), ...(field?.role === 'manifest' ? [record(project.pk, `FIELD_CAPTURE#${field.captureId}`, {artifact_id: artifactId, record_sha256: field.recordSha256, sha256: manifest.sha256})] : [])]);
    return {artifact: artifactProjection(artifact)};
  }
  async function pendingArtifactAccess(auth, artifactId) {
    const target = await get(auth.ctx, `DOCUMENT#${id(artifactId)}`, "PROFILE");
    if (!target || !["pending_upload", "active"].includes(target.value.status)) fail(404, "Document unavailable.");
    const parent = await resourceAccess(auth, "project", target.value.project_id, "edit");
    if (target.value.workspace_id !== parent.target.value.workspace_id || target.value.account_id !== parent.target.value.account_id) fail(403, "Document crosses project scope.");
    if (target.value.upload?.project_configuration_revision !== parent.target.revision) fail(409, "The registered project configuration changed.");
    await entitlement(auth, target.value.workspace_id, "storage_writes");
    const fieldPermission=target.value.original_metadata?.[hostedFieldMetadata]?await fieldRegistrationAuthority(auth,parent.target,target.value.original_metadata[hostedFieldMetadata],undefined,{sha256:target.value.upload.sha256,artifactId,register:false}):null;
    await caseSourceAuthority(auth,target);
    return {...parent,target,...(fieldPermission?{authorityUntil:Math.min(parent.authorityUntil??Infinity,...auth.ctx.authorityDeadlines.values())}:{})};
  }
  function pendingHorizon(scoped) {
    const expiry = Date.parse(scoped.target.value.original_metadata?.[hostedFieldMetadata] ? scoped.target.value.field_transfer_expires_at || scoped.target.value.upload?.expires_at : scoped.target.value.upload?.expires_at);
    if (!Number.isFinite(expiry)) fail(409, "A finite upload registration is required.");
    return {...scoped, authorityUntil: Math.min(scoped.authorityUntil ?? Infinity, expiry)};
  }
  async function finalizeArtifact(principal, artifactId, body) {
    let auth = await authenticate(principal), scoped = await pendingArtifactAccess(auth, artifactId), target = scoped.target;
    if (body.registration_id !== target.value.upload.registration_id || ![target.revision, target.value.upload.registration_revision].includes(body.expected_revision)) fail(409, "The upload registration/revision changed.");
    if (body.bucket || body.key || body.original || body.storage_key) fail(400, "The server selects and verifies the original target.");
    if (target.value.content_state === "ready") { await commit(auth.ctx); return {artifact: artifactProjection(target)}; }
    if (target.value.status !== "pending_upload" || target.value.original) fail(409, "Original state is inconsistent.");
    ttl(auth, pendingHorizon(scoped));
    if (typeof verifyOriginal !== "function") fail(503, "Original byte verification is not configured.");
    const field = target.value.original_metadata?.[hostedFieldMetadata];
    const verified = await verifyOriginal({bucket: storage.forAccount(target.value.account_id).bucket, key: target.value.storage_key, sha256: target.value.upload.sha256,
      sizeBytes: target.value.upload.size_bytes, contentType: target.value.content_type, ...(field?.role === 'manifest' ? {includeJson: true} : {})});
    if (!verified || verified.sha256 !== target.value.upload.sha256 || verified.sizeBytes !== target.value.upload.size_bytes || verified.contentType !== target.value.content_type ||
        typeof verified.versionId !== "string" || verified.versionId === "null") fail(409, "The verified original does not match its registration.");
    const registered = target;
    // Byte verification may take time: recheck the provider and all current database authority before marking ready.
    auth = await authenticate(principal, {enroll: false}); scoped = await pendingArtifactAccess(auth, artifactId); target = scoped.target;
    if (target.value.content_state === "ready") {
      if (target.value.original?.reference?.version_id !== verified.versionId) fail(409, "The retained original was finalized to another version.");
      await commit(auth.ctx); return {artifact: artifactProjection(target)};
    }
    if (target.revision !== registered.revision) fail(409, "The upload registration changed during verification.");
    const mediaReleases=[];
    if (field?.role === 'manifest') {
      let manifest;
      try {manifest = assertHostedFieldManifest(verified.payload, {resourceAuthority, projectId: target.value.project_id, accountId: target.value.account_id, workspaceId: target.value.workspace_id, forUpload: true});} catch (error) {fail(409, error.message);}
      await fieldRegistrationAuthority(auth,(await resourceAccess(auth,'project',target.value.project_id,'edit')).target,field,manifest.record,{sha256:target.value.upload.sha256,artifactId,register:false});
      if (manifest.record.captureId !== field.captureId || manifest.recordSha256 !== field.recordSha256 || digest(JSON.stringify(manifest.record)) !== field.recordSha256) fail(409, 'The capture record does not match its immutable registration.');
      for (const [index, media] of manifest.media.entries()) {
        const {target: original} = await artifactAccess(auth, media.reference.resource_id, 'view');
        const source = original.value, binding = source.original_metadata?.[hostedFieldMetadata];
        if (source.project_id !== target.value.project_id || source.account_id !== target.value.account_id || source.workspace_id !== target.value.workspace_id || binding?.captureId !== field.captureId || binding?.recordSha256 !== field.recordSha256 || binding?.role !== 'original' || binding.index !== index || binding.engagementId !== field.engagementId || binding.leaseId !== field.leaseId || source.filename !== media.filename || source.content_type !== media.mediaType || source.original.sha256 !== media.sha256 || source.original.size_bytes !== media.size || !isDeepStrictEqual(source.original.reference, media.reference)) fail(409, 'A capture original does not match its exact project, registration and retained version.');
        const release={schemaVersion:1,captureId:field.captureId,recordSha256:field.recordSha256,manifestArtifactId:artifactId,manifestSha256:verified.sha256,manifestVersionId:verified.versionId};
        if(source.field_capture_manifest&&!isDeepStrictEqual(source.field_capture_manifest,release))fail(409,'This retained field original already belongs to a different verified manifest.');
        if(!source.field_capture_manifest)mediaReleases.push(update(original,{...source,field_capture_manifest:release}));
      }
    }
    ttl(auth, pendingHorizon(scoped));
    const reference = assertResourceReference(createResourceReference({authority: resourceAuthority, resourceId: artifactId,
      resourceType: "document_original", workspaceId: target.value.workspace_id, versionId: verified.versionId}), {immutable: true});
    const changed = update(target, {...target.value, status: "active", content_state: "ready", original: {reference, bucket: storage.forAccount(target.value.account_id).bucket,
      key: target.value.storage_key, sha256: verified.sha256, size_bytes: verified.sizeBytes, content_type: verified.contentType,
      verified_at: iso(), finalized_by: auth.userId}});
    assertPreservedRecord(target.value, changed.value, {immutableFields: originalFields});
    await commit(auth.ctx, [changed,...mediaReleases]);
    // A request crossing token/grant expiry never returns a new ready receipt as current authority.
    ttl(auth, pendingHorizon(scoped));
    return {artifact: artifactProjection(changed)};
  }
  async function artifactBaseAccess(auth, artifactId, action) {
    let direct, documentDenies = {member: [], guest: [], team: []};
    try { direct = await resourceAccess(auth, "document", artifactId, action); documentDenies = direct.denyByMode; }
    catch (error) {
      if (![403, 404].includes(error.statusCode) || error.denyInheritance) throw error;
      documentDenies = error.denyByMode || documentDenies;
    }
    const document = await get(auth.ctx, `DOCUMENT#${id(artifactId)}`, "PROFILE");
    if (!document || document.value.status !== "active" || document.value.content_state !== "ready" || !document.value.original) fail(404, "A verified original is not available.");
    let parent;
    try {
      parent = await resourceAccess(auth, "project", document.value.project_id, action);
      if (document.value.workspace_id !== parent.target.value.workspace_id || document.value.account_id !== parent.target.value.account_id ||
        document.value.resource.workspace_id !== parent.target.value.workspace_id) fail(403, "Document crosses its exact project workspace/account.");
    } catch (error) { if (![403, 404].includes(error.statusCode)) throw error; parent = null; }
    const paths = [...direct?.pathAuthorities || []];
    for (const path of parent?.pathAuthorities || []) {
      const horizons = Object.fromEntries(Object.entries(path.horizons).filter(([candidate]) => !documentDenies[path.mode].includes(candidate)));
      paths.push({...path, horizons});
    }
    const actionHorizons = {};
    for (const path of paths) for (const [candidate, horizon] of Object.entries(path.horizons)) actionHorizons[candidate] = Math.max(actionHorizons[candidate] ?? -Infinity, horizon);
    if (!(action in actionHorizons)) fail(403, "Current scoped access does not allow this document action.");
    const selected = paths.find(path => path.horizons[action] === actionHorizons[action]), horizon = actionHorizons[action];
    return {target: document, workspace: direct?.workspace || parent.workspace, pathAuthorities: paths, actionHorizons,
      authorityUntil: Number.isFinite(horizon) ? horizon : null, access: {...selected.access, mode: selected.mode, allowed_actions: Object.keys(actionHorizons)}};
  }
  async function caseSourceAuthority(auth, document, {action='read'}={}) {
    const value=document.value||document,scope={accountId:value.account_id,projectId:value.project_id,workspaceId:value.workspace_id},key=engagementCaseSourceKey(scope.projectId),registry=await get(auth.ctx,key.pk,key.sk);
    if(!registry){
      // Old native heads may contain sealed/current/history private originals.
      // Absence of the new registry is not evidence that those bytes are public.
      const hints=await store.list(key.pk,'ENGAGEMENT#');if(hints.length)fail(503,'Initialize this project’s protected source coverage explicitly before reading its private document register.');
      return {bindings:[]};
    }
    validateEngagementCaseSources(registry,{scope});
    const sha256=value.original?.sha256||value.upload?.sha256,versionId=value.original?`hosted:${value.artifact_id}:${sha256}`:undefined,bindings=protectedEngagementCaseSourceBindings(registry,{scope,sha256,versionId});let until=Infinity;
    for(const binding of bindings){
      const resource=await resourceAccess(auth,'engagement',binding.engagementId,'view');if(resource.target.value.account_id!==scope.accountId||resource.target.value.project_id!==scope.projectId||resource.target.value.workspace_id!==scope.workspaceId)fail(403,'The protected original belongs to another exact case custody scope.');
      const policyKey=engagementCaseAccessKey(binding.engagementId),policy=await get(auth.ctx,policyKey.pk,policyKey.sk),permission=assertEngagementCaseAccess(policy,{scope:{...scope,engagementId:binding.engagementId},caseId:binding.caseId,userId:auth.userId,groups:binding.groups,action,now:instant().getTime()});
      until=Math.min(until,Date.parse(permission.expiresAt));auth.ctx.authorityDeadlines.set(`case-source:${binding.engagementId}:${binding.caseId}:${auth.userId}`,Date.parse(permission.expiresAt));
    }
    return {bindings,authorityUntil:Number.isFinite(until)?until:null};
  }
  async function verifyCaseParticipant(state,userId){
    const peer=await currentInviter(state.auth,{created_by:id(userId)}),scoped=await resourceAccess(peer,'engagement',state.target.value.engagement_id,'view');
    if(scoped.target.value.account_id!==state.target.value.account_id||scoped.target.value.project_id!==state.target.value.project_id||scoped.target.value.workspace_id!==state.target.value.workspace_id)fail(403,'The native case recipient belongs to another exact engagement scope.');
    return {userId:peer.userId,name:peer.user.value.name||peer.userId,roles:engagementRoles.filter(role=>scoped.target.value.professional_roles[role].includes(peer.userId))};
  }
  async function verifyEngagementReviewer(state,userId){
    const peer=await currentInviter(state.auth,{created_by:id(userId)}),scoped=await resourceAccess(peer,'engagement',state.target.value.engagement_id,'review');
    if(scoped.target.revision!==state.target.revision||scoped.target.value.account_id!==state.target.value.account_id||scoped.target.value.project_id!==state.target.value.project_id||scoped.target.value.workspace_id!==state.target.value.workspace_id)fail(409,'Refresh the engagement before assigning its completion reviewer.');
    await assertEngagementRole(peer,scoped.target,['reviewer']);return {userId:peer.userId};
  }
  async function fieldMediaAuthority(auth,target){
    const value=target.value,field=value.original_metadata?.[hostedFieldMetadata];if(!field||value.created_by===auth.userId)return;
    if(value.status==='pending_upload')fail(403,'This unfinished field capture is visible only to its verified uploader.');if(field.role!=='original')return;
    const release=value.field_capture_manifest;if(!release||release.schemaVersion!==1||release.captureId!==field.captureId||release.recordSha256!==field.recordSha256)fail(403,'This field original needs a verified matching manifest before disclosure. Legacy originals require explicit custody review.');
    const manifest=await artifactBaseAccess(auth,release.manifestArtifactId,'view');
    if(Number.isFinite(manifest.authorityUntil))auth.ctx.authorityDeadlines.set(`field-manifest:${release.manifestArtifactId}:${auth.userId}:view`,manifest.authorityUntil);
    const row=manifest.target.value,binding=row.original_metadata?.[hostedFieldMetadata];
    if(row.project_id!==value.project_id||row.account_id!==value.account_id||row.workspace_id!==value.workspace_id||row.original?.sha256!==release.manifestSha256||row.original?.reference?.version_id!==release.manifestVersionId||binding?.role!=='manifest'||binding.captureId!==field.captureId||binding.recordSha256!==field.recordSha256)fail(403,'The exact field manifest release is unavailable or changed.');await caseSourceAuthority(auth,manifest.target);
  }
  async function artifactAccess(auth,artifactId,action){const scoped=await artifactBaseAccess(auth,artifactId,action);await fieldMediaAuthority(auth,scoped.target);const protection=await caseSourceAuthority(auth,scoped.target);return {...scoped,authorityUntil:Math.min(scoped.authorityUntil??Infinity,protection.authorityUntil??Infinity),caseProtection:protection};}
  async function engagementSourceAccess(auth, {projectId, workspaceId, accountId, artifactIds}, {retainedDescriptors=false}={}) {
    if (!Array.isArray(artifactIds) || artifactIds.length > 100 || new Set(artifactIds).size !== artifactIds.length) fail(400, "Select up to 100 exact source documents explicitly.");
    const project = await get(auth.ctx, `PROJECT#${id(projectId)}`, "PROFILE");
    if (project?.value.status !== "active" || project.value.project_id !== projectId || project.value.workspace_id !== workspaceId || project.value.account_id !== accountId) fail(404, "The exact source project is unavailable.");
    // Begin the marker proof before reading any selected document. An absent
    // legacy marker never becomes coverage by inference or by a read request.
    const marker = await get(auth.ctx, project.pk, "SOURCE_AUTHORITY_SET"), scopes = new Map(), documentRows = [];
    let covered = Boolean(marker);
    if (marker) assertProjectSourceAuthority(marker, project.value);
    for (const artifactId of artifactIds) {
      id(artifactId);
      if (marker) {
        const row = await get(auth.ctx, `DOCUMENT#${artifactId}`, "SOURCE_SCOPE");
        if (!row) covered = false;
        else {
          const scope = assertDocumentSourceScope(row);
          if (scope.project_id !== projectId || scope.workspace_id !== workspaceId || scope.account_id !== accountId) fail(403, "The source document is outside this exact engagement project.");
          scopes.set(artifactId, scope);
        }
      }
      const scoped = await (retainedDescriptors?artifactBaseAccess:artifactAccess)(auth, artifactId, "view"), value = scoped.target.value;
      if (value.project_id !== projectId || value.workspace_id !== workspaceId || value.account_id !== accountId) fail(403, "The source document is outside this exact engagement project.");
      const until = scoped.actionHorizons.view;
      auth.ctx.authorityDeadlines.set(`engagement-source:${artifactId}:${auth.userId}`, until);
      documentRows.push(scoped.target);
      if (scopes.has(artifactId)) scopes.set(artifactId, {...scopes.get(artifactId), until});
    }
    if (covered) for (const [documentId, scope] of scopes) {
      const proof = {...scope, user_id: auth.userId, marker_revision: marker.revision};
      for (const entry of auth.ctx.reads.values()) {
        if (entry.pk === `DOCUMENT#${documentId}` && (entry.sk === "PROFILE" || entry.sk === "GRANT_SET" || entry.sk.startsWith("GRANT#")) ||
            entry.pk === `WORKSPACE#${workspaceId}` && entry.sk === `GUEST#document#${documentId}#${auth.userId}`) entry.sourceAuthority = proof;
      }
    }
    return documentRows;
  }
  async function artifacts(principal, query = {}) {
    const auth = await authenticate(principal);
    if (query.artifact_id) { const {target} = await artifactAccess(auth, query.artifact_id, "view"); await commit(auth.ctx); return {artifacts: [{...target.value, resource: undefined, revision: target.revision}]}; }
    const limit = query.limit === undefined ? 40 : Number(query.limit), projectId = query.project_id === undefined ? null : id(query.project_id);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) fail(400, "A document page must contain between 1 and 100 directory entries.");
    let after = null;
    if (query.after !== undefined) {
      try {
        if (typeof query.after !== "string" || !/^[A-Za-z0-9_-]{1,2048}$/.test(query.after)) throw new Error();
        const cursor = JSON.parse(Buffer.from(query.after, "base64url").toString("utf8"));
        if (cursor.version !== 1 || cursor.user_id !== auth.userId || cursor.project_id !== projectId || !opaque(cursor.after)) throw new Error();
        after = cursor.after;
      } catch { fail(400, "The document page cursor does not match this user and project."); }
    }
    const projectScope = projectId ? await resourceAccess(auth, "project", projectId, "view") : null, project = projectScope?.target;
    if (Number.isFinite(projectScope?.authorityUntil)) auth.ctx.authorityDeadlines.set(`document-directory-project:${projectId}`, projectScope.authorityUntil);
    const directories = project ? [{pk: project.pk, prefix: "ARTIFACT#"}] : [
      {pk: `USER#${auth.userId}`, prefix: "RESOURCE#document#"},
      ...(await teams.teamRows(auth)).filter(team => team.status === "active").map(team => ({pk: `TEAM#${team.team_id}`, prefix: "RESOURCE#document#"}))
    ];
    const candidates = new Set();
    let more = false;
    for (const {pk, prefix} of directories) {
      let start = after === null ? null : `${prefix}${after}`, remaining = limit + 1;
      // Dynamo may stop before Limit at its byte ceiling. Fill this bounded
      // hint window before merging directories, so another Team's later keys
      // cannot advance the cursor past an unread key in this directory.
      for (let pages = 0; pages <= limit; pages++) {
        const page = await store.listPage(pk, prefix, {after: start, limit: remaining});
        for (const hint of page.rows) {
          const artifactId = hint.sk.slice(prefix.length);
          if (!opaque(artifactId) || artifactId !== hint.value.resource_id || hint.pk !== pk || !hint.sk.startsWith(prefix) || start !== null && hint.sk <= start) fail(409, "A document directory entry is inconsistent.");
          candidates.add(artifactId);
        }
        remaining -= page.rows.length;
        if (page.nextAfter === null) break;
        if (!page.rows.length || typeof page.nextAfter !== "string" || page.nextAfter !== page.rows.at(-1).sk) fail(409, "The document directory cursor did not advance.");
        if (remaining <= 0) { more = true; break; }
        start = page.nextAfter;
      }
    }
    const ordered = [...candidates].sort(), selected = ordered.slice(0, limit);
    const items = await readDirectory(auth, selected, async (current, artifactId) => {
      if (!project) {
        const scoped = await artifactAccess(current, artifactId, "view");
        current.ctx.authorityDeadlines.set(`document-directory:${artifactId}`, scoped.authorityUntil);
        return {...scoped.target.value, resource: undefined, revision: scoped.target.revision};
      }
      const target = await get(current.ctx, `DOCUMENT#${artifactId}`, "PROFILE");
      if (!target || target.value.workspace_id !== project.value.workspace_id || target.value.project_id !== project.value.project_id) return null;
      if (target.value.status === "pending_upload") {
        await fieldMediaAuthority(current, target); await caseSourceAuthority(current, target);
        return artifactProjection(target);
      }
      const scoped = await artifactAccess(current, artifactId, "view");
      current.ctx.authorityDeadlines.set(`document-directory:${artifactId}`, scoped.authorityUntil);
      return artifactProjection(scoped.target);
    });
    const next = selected.at(-1);
    return {artifacts: items, next_cursor: next && (more || ordered.length > limit)
      ? Buffer.from(JSON.stringify({version: 1, user_id: auth.userId, project_id: projectId, after: next})).toString("base64url") : null};
  }
  async function presignArtifact(principal, body, mode = "put") {
    if (mode === 'get') return artifactDownload(principal, body);
    let auth = await authenticate(principal);
    let scoped = mode === "put" ? await pendingArtifactAccess(auth, body.artifact_id) : await artifactAccess(auth, body.artifact_id, "view");
    const {target} = scoped;
    if (body.configuration_revision !== target.revision) fail(409, "Document configuration changed.");
    if (body.bucket || body.key || body.storage_key) fail(400, "Storage targets are selected by the current document configuration.");
    if (mode === "put") {
      if (target.value.status !== "pending_upload" || target.value.original) fail(409, "A retained original cannot be overwritten. Register a separate document.");
      scoped = pendingHorizon(scoped);
    }
    if (typeof signObject !== "function") fail(503, "Private storage signing is not configured.");
    await commit(auth.ctx);
    const signedAt = instant(), expiresIn = ttl(auth, scoped, signedAt);
    const tags = {account_id: target.value.account_id, project_id: target.value.project_id, data_classification: "confidential", data_type: "document"};
    const url = await signObject({mode, bucket: storage.forAccount(target.value.account_id).bucket, key: target.value.storage_key, contentType: target.value.content_type,
      expiresIn, signedAt, tags, ...(mode === "put" ? {createOnly: true, sha256: target.value.upload.sha256, sizeBytes: target.value.upload.size_bytes}
        : {versionId: target.value.original.reference.version_id})});
    auth = await authenticate(principal, {enroll: false});
    scoped = mode === "put" ? pendingHorizon(await pendingArtifactAccess(auth, body.artifact_id)) : await artifactAccess(auth, body.artifact_id, "view");
    if (scoped.target.revision !== target.revision || scoped.target.value.storage_key !== target.value.storage_key) fail(409, "Document configuration changed during signing.");
    assertSignedHorizon(auth, scoped, [{signedAt, expiresIn}]);
    if (mode === "put") await commit(auth.ctx, [record(`PROJECT#${target.value.project_id}`, `WRITE_INTENT#${newId()}`, {
      object_type: "storage_write_intent", status: "authorized", workspace_id: target.value.workspace_id, project_id: target.value.project_id,
      artifact_id: body.artifact_id, keys: [target.value.storage_key], create_only: true, sha256: target.value.upload.sha256, size_bytes: target.value.upload.size_bytes,
      authorized_by: auth.userId, authorized_at: signedAt.toISOString(), expires_at: new Date(signedAt.getTime() + expiresIn * 1000).toISOString()})]);
    else await commit(auth.ctx);
    ttl(auth, scoped);
    return {artifact_id: body.artifact_id, bucket: storage.forAccount(target.value.account_id).bucket, key: target.value.storage_key, [mode === "put" ? "put_url" : "get_url"]: url, expires_in: expiresIn,
      ...(mode === "get" ? {version_id: target.value.original.reference.version_id} : {put_headers: {"content-type": target.value.content_type,
        ...storageEncryptionHeaders(storage.forAccount(target.value.account_id)), "x-amz-tagging": new URLSearchParams(tags).toString(), "if-none-match": "*", "x-amz-checksum-sha256": Buffer.from(target.value.upload.sha256, "hex").toString("base64")}})};
  }
  function ttl(auth, scoped, signedAt = instant()) {
    const horizon = Math.min(auth.principal.expiresAt, scoped.authorityUntil ?? Infinity);
    const seconds = Math.min(60, Math.floor((horizon - signedAt.getTime()) / 1000));
    if (!Number.isFinite(seconds) || seconds < 1) fail(403, "Less than one full second of current token/scoped authority remains.");
    return seconds;
  }
  async function artifactDownload(principal, body) {
    const auth = await authenticate(principal, {enroll: false}), scoped = await artifactAccess(auth, body.artifact_id, 'view');
    const {target} = scoped;
    if (Object.keys(body).some(name => !['artifact_id', 'configuration_revision'].includes(name))) fail(400, 'The document configuration selects the download target.');
    if (body.configuration_revision !== target.revision) fail(409, 'Document configuration changed.');
    if (!esiaMigrationOriginalMatches(target.value.original, storage.forAccount(target.value.account_id).bucket) || target.value.original.key !== target.value.storage_key ||
        target.value.storage_key !== `tenants/${target.value.account_id}/projects/${target.value.project_id}/documents/${target.value.artifact_id}/original`) fail(409, 'Retained document storage needs an explicit verified account migration.');
    await commit(auth.ctx); ttl(auth, scoped);
    return {artifact_id: body.artifact_id, key: target.value.storage_key, version_id: target.value.original.reference.version_id,
      sha256: target.value.original.sha256, size_bytes: target.value.original.size_bytes, content_type: target.value.content_type,
      filename: target.value.filename, mediated: true};
  }
  function assertSignedHorizon(auth, scoped, capabilities) {
    ttl(auth, scoped);
    for (const {signedAt, expiresIn} of capabilities) if (ttl(auth, scoped, signedAt) < expiresIn) fail(409, "Current scoped authority shortened during signing; request a fresh capability.");
  }
  async function presignAudit(principal, body) {
    let auth = await authenticate(principal), scoped = await resourceAccess(auth, "project", body.project_id, "review");
    const {target} = scoped;
    // Review is an ESIA domain write capability; viewers never receive write URLs.
    await entitlement(auth, target.value.workspace_id, "storage_writes");
    if (body.configuration_revision !== target.revision) fail(409, "Project configuration changed.");
    if (body.account_id !== target.value.account_id || body.bucket) fail(400, "Audit storage must match the configured project account.");
    const reviewId = id(body.policy_review_id);
    if (!["project_document_review", "ifc_ps_me_matrix"].includes(reviewId)) fail(400, "An existing ESIA assessment choice is required.");
    if (!Array.isArray(body.objects) || !body.objects.length || body.objects.length > 500) fail(400, "A bounded audit object plan is required.");
    const base = `tenants/${target.value.account_id}/projects/${target.value.project_id}/assessments/policy_reviews/${reviewId}/`;
    const seen = new Set();
    const plan = body.objects.map(object => {
      if (typeof object.key !== "string" || !object.key.startsWith(base) || object.content_type !== "application/json" || auditSuffixes.get(object.key.slice(base.length)) !== object.role || seen.has(object.key)) fail(400, "Audit object is outside the configured standards/path whitelist.");
      seen.add(object.key); return {role: object.role, key: object.key, content_type: "application/json"};
    });
    fail(410, "Mutable review writes are retired. Save a retained review edition.");
  }
  async function readAudit(principal, body) {
    if (body.legacy !== true) return reviewEditions.retainedReview(principal, body);
    if (body.edition_id) fail(400, "Legacy draft loading cannot select a retained edition.");
    let auth = await authenticate(principal), scoped = await resourceAccess(auth, "project", body.project_id, "view");
    const {target} = scoped;
    if (body.configuration_revision !== target.revision) fail(409, "Project configuration changed.");
    if (!["project_document_review", "ifc_ps_me_matrix"].includes(body.policy_review_id) || body.bucket || body.key) fail(400, "The current ESIA assessment configuration selects the audit target.");
    if (typeof describeLegacyObject !== "function") fail(503, "Authenticated legacy draft reads are not configured.");
    const objectKey = `tenants/${target.value.account_id}/projects/${target.value.project_id}/assessments/policy_reviews/${body.policy_review_id}/working_draft.json`;
    await commit(auth.ctx);
    const descriptor = await describeLegacyObject({bucket: storage.forAccount(target.value.account_id).bucket, key: objectKey});
    auth = await authenticate(principal, {enroll: false}); scoped = await resourceAccess(auth, "project", body.project_id, "view");
    if (scoped.target.revision !== target.revision) fail(409, "Project configuration changed during signing.");
    await commit(auth.ctx);
    ttl(auth, scoped);
    return {key: objectKey, ...descriptor, legacy: true, mediated: true};
  }
  async function workspace(principal, body) {
    let auth = await authenticate(principal), scope = await personal(auth); auth = scope.auth || auth;
    if (!body) return {workspace: {...scope.workspace.value, workspace_id: scope.workspace.value.identity.workspace_id, revision: scope.workspace.revision}};
    if (body.expected_revision !== scope.workspace.revision) fail(409, "Workspace revision changed.");
    if (Object.keys(body).some(field => !["expected_revision", "display_name"].includes(field))) fail(400, "Only workspace display metadata can be changed here.");
    const changed = update(scope.workspace, {...scope.workspace.value, name: text(body.display_name)});
    await commit(auth.ctx, [changed]); return {workspace: {...changed.value, revision: changed.revision}};
  }
  async function notifications(principal, body) {
    const auth = await authenticate(principal), row = await get(auth.ctx, `USER#${auth.userId}`, "PREFERENCE#notifications");
    if (!body) return {preferences: row?.value || createDefaultNotificationPreferences({userId: auth.userId, email: auth.user.value.email}), revision: row?.revision || 0};
    if (body.expected_revision !== (row?.revision || 0)) fail(409, "Notification preferences changed.");
    if (!body.preferences || JSON.stringify(body.preferences).length > 20_000) fail(400, "A bounded preferences object is required.");
    const changed = record(`USER#${auth.userId}`, "PREFERENCE#notifications", {...body.preferences, user_id: auth.userId}, (row?.revision || 0) + 1);
    await commit(auth.ctx, [changed]); return {preferences: changed.value, revision: changed.revision};
  }
  async function effective(principal, body) {
    const auth = await authenticate(principal);
    if (body.user_id || body.principal || !["project", "document", "notebook", "engagement"].includes(body.resource_type)) fail(400, "Effective permissions are evaluated only for the current caller and exact resource.");
    const scoped = body.resource_type === "document" ? await artifactAccess(auth, body.resource_id, "view") : await resourceAccess(auth, body.resource_type, body.resource_id, "view");
    await commit(auth.ctx);
    return {resource_type: body.resource_type, resource_id: body.resource_id, workspace_id: scoped.target.value.workspace_id, permissions: legacyActions(scoped.access.allowed_actions), participation_mode: scoped.access.mode};
  }
  async function lifecycle(principal, type, targetId, body) {
    const auth = await authenticate(principal);
    if (!auth.user.value.deployment_roles?.includes("application_super_admin")) fail(403, "Persisted application administrator required.");
    if (!["user", "workspace", "identity", "account"].includes(type) || !["active", "suspended", "revoked"].includes(body.status)) fail(400, "Invalid lifecycle transition.");
    const row = await get(auth.ctx, `${type.toUpperCase()}#${id(targetId)}`, type === "identity" ? "LINK" : "PROFILE");
    if (!row || row.revision !== body.expected_revision) fail(409, "Lifecycle record changed.");
    const value = type === "account" ? {...row.value, status: body.status} : type === "identity" ? {...row.value, status: body.status, revision: row.value.revision + 1}
      : {...row.value, ...(type === "user" ? {status: body.status} : {}), identity: {...row.value.identity, status: body.status, revision: row.value.identity.revision + 1}};
    await commit(auth.ctx, [update(row, value)]); return {status: body.status, revision: row.revision + 1};
  }
  async function listInvitations(principal,query={}) {
    if(!query||typeof query!=="object"||Array.isArray(query)||Object.keys(query).some(field=>field!=="engagement_id"))fail(400,"Choose an exact engagement invitation list.");
    const auth = await authenticate(principal), engagementId=query.engagement_id===undefined?undefined:id(query.engagement_id);
    if(engagementId)await resourceAccess(auth,"engagement",engagementId,"manage_access");
    const hints=await store.list(`USER#${auth.userId}`, "INVITATION#");if(engagementId&&hints.length>100)fail(413,"This maker's invitation list exceeds 100 entries. Review older invitations before requesting this bounded list.");
    const invitations = await readDirectory(auth, hints, async (current, hint) => {
      if(engagementId&&hint.value.resource_type&&(hint.value.resource_type!=="engagement"||hint.value.resource_id!==engagementId))return null;
      const row = await get(current.ctx, `INVITATION#${hint.value.invitation_id}`, "PROFILE");
      if (!row) return null;
      if(engagementId&&(row.value.resource_type!=="engagement"||row.value.resource_id!==engagementId))return null;
      if (row.value.kind === "team") await teams.authority(current, row.value.team_id, {manage: true, inactive: true});
      else await resourceAccess(current, row.value.resource_type, row.value.resource_id, "manage_access");
      const {token_sha256, ...value} = row.value; return {...value, revision: row.revision};
    });
    return {invitations};
  }
  const teams = createTeamOperations({authenticate, memberWorkspace, get, commit, update, store, instant, iso, newId,
    expectedIssuer, verifyCurrentIdentity, fail, id, text});
  const reviewEditions = createReviewEditionOperations({resourceAuthority, authenticate, resourceAccess, entitlement, get, commit, update, instant, iso, ttl,
    assertSignedHorizon, store, storage, signObject, verifyReviewSnapshot, fail});
  const publications = createPublicationOperations({authenticate, resourceAccess, entitlement, get, commit, update, store, teams, iso, newId, id, fail});
  const downloadChunk = createMediatedDownloads({artifact: artifactDownload, review: readAudit, readObjectRange, storage, fail});
  const integrationConnections = createIntegrationConnections({resourceAuthority, authenticate, artifactAccess, memberWorkspace, get, commit, instant, newId, fail});
  const integrationResourceIndex = createIntegrationResourceIndex({resourceAuthority, authenticate, artifactAccess, commit, instant, fail, authorizeConnection:integrationConnections.authorize});
  if (engagementOperations !== undefined) {
    if (typeof engagementOperations !== "function") throw new TypeError("Authenticated engagement operations must be supplied as a configured factory.");
    authenticatedEngagements = engagementOperations({resourceAuthority, authenticate, resourceAccess, assertEngagementRole, assertEngagementProfile, artifactAccess, artifactBaseAccess, caseSourceAuthority, verifyCaseParticipant, verifyEngagementReviewer, engagementSourceAccess, get, commit, update, instant, iso, newId, id, text, fail,
      record, store, storage, entitlement, ttl, expectedIssuer, expectedClientId, verifyCurrentIdentity, requirementLibrary,projectProjection});
    if (!engagementConfigured()) throw new TypeError("Authenticated engagement execution and invitation hooks must be configured together.");
  }
  const engagementApi = Object.fromEntries(Object.entries(authenticatedEngagements || {}).filter(([name, value]) => !["invitationChange", "invitationPreview", "fieldRegistrationAuthority"].includes(name) && typeof value === "function"));
  return {...reviewEditions, ...publications, ...engagementApi, createTeam: teams.createTeam, listTeams: teams.listTeams, team: teams.team, teamMembers: teams.teamMembers, previewInvitation, session, workspace, notifications, createProject, createAccount, invitation, acceptInvitation, revokeInvitation, grants, listInvitations,
    createArtifact, finalizeArtifact, artifacts, presignArtifact, presignAudit, readAudit, downloadChunk, integrationResourceIndex, integrationConnectionCreate:integrationConnections.create, integrationConnectionRevoke:integrationConnections.revoke, effective, lifecycle,canonicalEnabled,
    async recheckIdentity(principal){return (await authenticate(principal,{enroll:false})).canonicalUser;},
    async listProjects(principal) { const auth = await authenticate(principal); const rows = await projects(auth); await commit(auth.ctx); return {projects: rows}; },
    async getProject(principal, projectId) { const auth = await authenticate(principal), scoped = await resourceAccess(auth, "project", projectId); await commit(auth.ctx); return {project: projectProjection(scoped.target, scoped.access)}; },
    async requirementLibrary(principal, projectId, frameworkId, query = {}) {
      if(authenticatedEngagements){
        if(Object.keys(query).some(key=>!["after","engagement_id"].includes(key))||typeof query.engagement_id!=="string")fail(403,"Open the requirement library through an engagement with a separate source entitlement.");
        const auth=await authenticate(principal,{enroll:false}),scoped=await resourceAccess(auth,"engagement",query.engagement_id,"view");if(scoped.target.value.project_id!==projectId)fail(403,"The engagement library belongs to a different project.");await commit(auth.ctx);
        return authenticatedEngagements.engagementRequirementLibrary(principal,query.engagement_id,frameworkId,query.after===undefined?{}:{after:query.after});
      }
      const auth = await authenticate(principal);await resourceAccess(auth, "project", projectId, "view");await commit(auth.ctx);
      if (!requirementLibrary || typeof requirementLibrary.page !== "function") fail(503, "The protected requirement library is not installed.");
      if (Object.keys(query).some(key => key !== "after")) fail(400, "Only the bounded requirement page cursor is accepted.");
      const page = await requirementLibrary.page(frameworkId, {after: query.after});
      // Provider I/O can outlive a grant or lifecycle change. A new authority
      // projection and conditional read transaction guard the returned content.
      const current = await authenticate(principal, {enroll: false}), scoped = await resourceAccess(current, "project", projectId, "view");await commit(current.ctx);ttl(current, scoped);
      return page;
    },
    async listAccounts(principal) { const auth = await authenticate(principal); const rows = await accounts(auth); await commit(auth.ctx); return {accounts: rows}; },
    async unsupported(principal) { await authenticate(principal); fail(501, "This declared ESIA route is not implemented by the scoped backend."); }
  };
}
