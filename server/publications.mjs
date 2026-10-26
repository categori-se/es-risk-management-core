import {createHash, randomBytes, timingSafeEqual} from "node:crypto";
import {assertCollaborationResource, createWorkspaceParticipation} from "@categori/workspace-contracts";
import {normalizePublicationContent, publicationVisibilities} from "../src/lib/publication-records.js";
import {record} from "./access-store.mjs";

const hash = value => createHash("sha256").update(value).digest("hex");
const contentHash = content => hash(JSON.stringify(content));
const emptySharing = () => ({visibility: "private", editionId: null, sharedAt: null, tokenHash: null});

// Authored text is stored separately from source-file custody. Notebook grants do
// not grant access to the parent project or to its documents.
export function createPublicationOperations({authenticate, resourceAccess, entitlement, get, commit, update, store, teams, iso, newId, id, fail}) {
  function projection(row, access) {
    const v = row.value;
    return {id: v.publication_id, projectId: v.project_id, workspaceId: v.workspace_id, accountId: v.account_id,
      createdAt: v.created_at, updatedAt: v.updated_at, createdBy: v.created_by, revision: row.revision,
      content: structuredClone(v.content), sharing: {visibility: v.sharing.visibility, editionId: v.sharing.editionId, sharedAt: v.sharing.sharedAt},
      permissions: [...access.allowed_actions], editions: structuredClone(v.editions)};
  }
  const revision = (row, expected) => {
    if (!Number.isSafeInteger(expected) || expected < 1) fail(400, "An expected publication revision is required.");
    if (row.revision !== expected) fail(409, "The publication changed. Reopen it before saving.");
  };
  async function scope(principal, publicationId, action = "view") {
    const auth = await authenticate(principal);
    const scoped = await resourceAccess(auth, "notebook", id(publicationId), action);
    if (scoped.target.value.object_type !== "publication") fail(404, "Publication not available.");
    return {auth, ...scoped};
  }
  async function editionFor(ctx, target, editionId) {
    const row = await get(ctx, `PUBLICATION_EDITION#${id(editionId)}`, "PROFILE"), v = row?.value, p = target.value;
    if (!v || v.object_type !== "publication_edition" || v.id !== editionId || v.publicationId !== p.publication_id ||
        v.projectId !== p.project_id || v.workspaceId !== p.workspace_id || v.accountId !== p.account_id ||
        !p.editions.some(edition => edition.id === editionId && edition.sha256 === v.sha256) || contentHash(normalizePublicationContent(v.content)) !== v.sha256)
      fail(404, "Publication edition not available.");
    return v;
  }
  async function createPublication(principal, body) {
    const auth = await authenticate(principal), projectScope = await resourceAccess(auth, "project", id(body.projectId), "edit"), {target: project} = projectScope;
    await entitlement(auth, project.value.workspace_id, "storage_writes");
    const content = normalizePublicationContent(body.content), publicationId = `publication_${newId()}`, at = iso();
    const resource = assertCollaborationResource({schema_version: 1, resource_type: "notebook", resource_id: publicationId, project_id: project.value.project_id,
      workspace_id: project.value.workspace_id, owner_id: auth.userId, creator_id: auth.userId,
      access_policy: {inheritance: "restricted", allow_public_links: false}});
    const target = record(`NOTEBOOK#${publicationId}`, "PROFILE", {object_type: "publication", publication_id: publicationId,
      project_id: project.value.project_id, workspace_id: project.value.workspace_id, account_id: project.value.account_id,
      owner_user_id: auth.userId, resource, status: "active", content, editions: [], sharing: emptySharing(),
      created_by: auth.userId, created_at: at, updated_at: at});
    const writes = [target, record(project.pk, `PUBLICATION#${publicationId}`, {resource_id: publicationId}),
      record(`USER#${auth.userId}`, `RESOURCE#notebook#${publicationId}`, {resource_id: publicationId})];
    if (projectScope.access.mode !== "member") {
      // A project-only editor can own newly authored text without joining the
      // workspace. Eligibility is exact to this notebook and cannot extend a
      // finite project edit horizon or grant access to any source document.
      const participation = createWorkspaceParticipation({participationId: `guest_${newId()}`, workspaceId: project.value.workspace_id,
        userId: auth.userId, mode: "guest", resourceScopes: [{resource_type: "notebook", resource_id: publicationId}],
        expiresAt: projectScope.authorityUntil === null ? null : new Date(projectScope.authorityUntil).toISOString()});
      writes.push(record(`WORKSPACE#${project.value.workspace_id}`, `GUEST#notebook#${publicationId}#${auth.userId}`, {identity: participation}));
    }
    await commit(auth.ctx, writes);
    return {publication: projection(target, {allowed_actions: ["view", "comment", "review", "edit", "manage_access"]})};
  }
  async function listPublications(principal, query = {}) {
    const auth = await authenticate(principal);
    let hints;
    if (query.project_id) {
      const {target} = await resourceAccess(auth, "project", id(query.project_id), "view");
      hints = await store.list(target.pk, "PUBLICATION#");
    } else hints = [...await store.list(`USER#${auth.userId}`, "RESOURCE#notebook#"), ...await teams.resourceHints(auth, "notebook")];
    const candidates = [...new Set(hints.map(row => row.value.resource_id))].sort(), publications = [];
    const after = query.after === undefined ? null : id(query.after), remaining = candidates.filter(candidate => after === null || candidate > after);
    let processed = 0, last = null;
    // One final authority fence covers the complete private response. A complex
    // grant graph shortens the page before the 100-condition transaction limit.
    for (const publicationId of remaining.slice(0, 20)) {
      try {
        const {auth: current, target, access} = await scope(principal, publicationId);
        if (!query.project_id || target.value.project_id === query.project_id) {
          const merged = new Map(auth.ctx.reads);
          for (const [key, value] of current.ctx.reads) {
            if (merged.has(key) && merged.get(key).row?.revision !== value.row?.revision) fail(409, "Publication authority changed. Retry the list.");
            merged.set(key, value);
          }
          if (merged.size > 100) {
            if (!processed) fail(413, "Publication authority exceeds one list transaction. Open the exact article.");
            break;
          }
          auth.ctx.reads = merged;
          for (const [key, value] of current.ctx.providerPrincipals) auth.ctx.providerPrincipals.set(key, value);
          publications.push(projection(target, access));
        }
      } catch (error) {if (![403, 404].includes(error.statusCode)) throw error;}
      processed++; last = publicationId;
    }
    await commit(auth.ctx);
    return {publications, hasMore: remaining.length > processed, nextCursor: remaining.length > processed ? last : null};
  }
  async function getPublication(principal, publicationId) {
    const {auth, target, access} = await scope(principal, publicationId);
    await commit(auth.ctx); return {publication: projection(target, access)};
  }
  async function savePublication(principal, publicationId, body) {
    const {auth, target, access} = await scope(principal, publicationId, "edit");
    revision(target, body.expectedRevision); await entitlement(auth, target.value.workspace_id, "storage_writes");
    const changed = update(target, {...target.value, content: normalizePublicationContent(body.content), updated_at: iso()});
    await commit(auth.ctx, [changed]); return {publication: projection(changed, access)};
  }
  async function issuePublication(principal, publicationId, body) {
    const {auth, target, access} = await scope(principal, publicationId, "edit");
    revision(target, body.expectedRevision); await entitlement(auth, target.value.workspace_id, "storage_writes");
    if (target.value.editions.length >= 100) fail(413, "A publication may retain at most 100 editions.");
    const content = normalizePublicationContent(target.value.content);
    if (!content.body.trim()) fail(400, "Add publication text before issuing an edition.");
    const edition = {id: `publication_edition_${newId()}`, publicationId, projectId: target.value.project_id,
      workspaceId: target.value.workspace_id, accountId: target.value.account_id, issuedAt: iso(), issuedBy: auth.userId,
      sourceRevision: target.revision, content, sha256: contentHash(content)};
    const summary = Object.fromEntries(["id", "issuedAt", "issuedBy", "sourceRevision", "sha256"].map(key => [key, edition[key]]));
    const changed = update(target, {...target.value, editions: [...target.value.editions, summary], updated_at: edition.issuedAt});
    await commit(auth.ctx, [record(`PUBLICATION_EDITION#${edition.id}`, "PROFILE", {object_type: "publication_edition", ...edition}), changed]);
    return {publication: projection(changed, access), edition};
  }
  async function getPublicationEdition(principal, publicationId, editionId) {
    const {auth, target} = await scope(principal, publicationId), {object_type, ...edition} = await editionFor(auth.ctx, target, editionId);
    await commit(auth.ctx); return {edition};
  }
  async function sharePublication(principal, publicationId, body) {
    const {auth, target, access} = await scope(principal, publicationId, "manage_access");
    revision(target, body.expectedRevision);
    if (!publicationVisibilities.includes(body.visibility)) fail(400, "Choose private, unlisted or public visibility.");
    let token, sharing = emptySharing();
    if (body.visibility !== "private") {
      const edition = await editionFor(auth.ctx, target, body.editionId);
      if (body.visibility === "unlisted") token = randomBytes(32).toString("base64url");
      sharing = {visibility: body.visibility, editionId: edition.id, sharedAt: iso(), tokenHash: token ? hash(token) : null};
    }
    const changed = update(target, {...target.value, sharing, updated_at: iso()}), values = [changed];
    const hint = await get(auth.ctx, "PUBLICATION_CATALOG", `PUBLICATION#${publicationId}`);
    if (body.visibility === "public" || hint) values.push(record("PUBLICATION_CATALOG", `PUBLICATION#${publicationId}`,
      {publication_id: publicationId, visible: body.visibility === "public"}, (hint?.revision || 0) + 1));
    await commit(auth.ctx, values); return {publication: projection(changed, access), ...(token ? {token} : {})};
  }

  async function publicPublicationRead(body, {catalog = false, conditionReads = null} = {}) {
    const publicationId = id(body.publicationId), reads = new Map();
    const read = async (pk, sk = "PROFILE") => {
      const key = JSON.stringify([pk, sk]);
      if (!reads.has(key)) reads.set(key, {pk, sk, row: await store.get(pk, sk)});
      return reads.get(key).row;
    };
    const target = await read(`NOTEBOOK#${publicationId}`), p = target?.value, unavailable = () => fail(404, "Publication not available.");
    if (!p || p.object_type !== "publication" || p.status !== "active" || p.publication_id !== publicationId ||
        !["public", "unlisted"].includes(p.sharing?.visibility) || (catalog && p.sharing.visibility !== "public")) unavailable();
    if (p.sharing.visibility === "unlisted") {
      if (typeof body.token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(body.token) || typeof p.sharing.tokenHash !== "string" ||
          !/^[a-f0-9]{64}$/.test(p.sharing.tokenHash) || !timingSafeEqual(Buffer.from(hash(body.token)), Buffer.from(p.sharing.tokenHash))) unavailable();
    }
    const project = (await read(`PROJECT#${p.project_id}`))?.value, workspace = (await read(`WORKSPACE#${p.workspace_id}`))?.value,
      account = (await read(`ACCOUNT#${p.account_id}`))?.value;
    if (project?.status !== "active" || project.project_id !== p.project_id || project.workspace_id !== p.workspace_id || project.account_id !== p.account_id ||
        workspace?.identity?.status !== "active" || workspace.identity.workspace_id !== p.workspace_id || workspace.account_id !== p.account_id ||
        account?.status !== "active" || account.account_id !== p.account_id || account.workspace_id !== p.workspace_id) unavailable();
    const e = (await read(`PUBLICATION_EDITION#${id(p.sharing.editionId)}`))?.value;
    if (!e || e.object_type !== "publication_edition" || e.id !== p.sharing.editionId || e.publicationId !== publicationId ||
        e.projectId !== p.project_id || e.workspaceId !== p.workspace_id || e.accountId !== p.account_id ||
        !p.editions.some(item => item.id === e.id && item.sha256 === e.sha256)) unavailable();
    let content;
    try {content = normalizePublicationContent(e.content);} catch {unavailable();}
    if (contentHash(content) !== e.sha256) unavailable();
    // Even anonymous reads fence the exact active release and lifecycle rows.
    // A withdrawal during an awaited store read fails the conditional transaction.
    if (conditionReads) {
      for (const [key, value] of reads) {
        if (conditionReads.has(key) && conditionReads.get(key).row?.revision !== value.row?.revision) fail(409, "Publication authority changed. Retry the catalog.");
        conditionReads.set(key, value);
      }
    } else await store.transact([...reads.values()].map(({pk, sk, row}) => ({pk, sk, expected: row?.revision ?? null})));
    return {publication: {id: publicationId, editionId: e.id, content, issuedAt: e.issuedAt, visibility: p.sharing.visibility, sha256: e.sha256}};
  }
  async function publicationCatalog(query = {}) {
    const publications = [], conditionReads = new Map(), hints = await store.list("PUBLICATION_CATALOG", "PUBLICATION#"), after = query.after === undefined ? null : id(query.after);
    const remaining = hints.filter(row => row.value.visible && (after === null || row.value.publication_id > after)).sort((a, b) => a.value.publication_id.localeCompare(b.value.publication_id));
    for (const hint of remaining.slice(0, 20)) {
      try {publications.push((await publicPublicationRead({publicationId: hint.value.publication_id}, {catalog: true, conditionReads})).publication);}
      catch (error) {if (![403, 404, 409].includes(error.statusCode)) throw error;}
    }
    if (conditionReads.size) await store.transact([...conditionReads.values()].map(({pk, sk, row}) => ({pk, sk, expected: row?.revision ?? null})));
    return {publications, hasMore: remaining.length > 20, nextCursor: remaining.length > 20 ? remaining[19].value.publication_id : null};
  }
  return {createPublication, listPublications, getPublication, savePublication, issuePublication, getPublicationEdition,
    sharePublication, publicPublicationRead, publicationCatalog};
}
