// The service reads authority by exact primary key. Indexes are navigation hints only.
import {isDeepStrictEqual} from 'node:util';
export class AccessConflict extends Error {
  constructor() { super("Access records changed; reload and retry."); this.statusCode = 409; }
}

const keyOf = ({pk, sk}) => JSON.stringify([pk, sk]);
export const record = (pk, sk, value, revision = 1) => ({pk, sk, revision, value});
const exactId = value => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}$/.test(value);
export function assertDocumentSourceScope(row) {
  const value = row?.value;
  if (row?.sk !== "SOURCE_SCOPE" || row.revision !== 1 || value?.object_type !== "document_source_scope" || value.schema_version !== 1 ||
      ![value.document_id, value.project_id, value.workspace_id, value.account_id].every(exactId) || row.pk !== `DOCUMENT#${value.document_id}`) throw new AccessConflict();
  return value;
}
export function assertProjectSourceAuthority(row, scope) {
  const value = row?.value;
  if (row?.sk !== "SOURCE_AUTHORITY_SET" || !Number.isSafeInteger(row.revision) || row.revision < 1 || value?.object_type !== "project_source_authority_set" ||
      value.coverage_version !== 1 || value.generation !== row.revision || ![value.project_id, value.workspace_id, value.account_id].every(exactId) ||
      row.pk !== `PROJECT#${value.project_id}` || scope && ["project_id", "workspace_id", "account_id"].some(field => value[field] !== scope[field])) throw new AccessConflict();
  return value;
}

// Every covered writer must advance the one project marker. An immutable scope
// row, read by the store itself and checked in the same transaction, prevents a
// caller from presenting another project's marker or disguising a covered
// document as a legacy document. Legacy rows stay usable without compaction.
export async function prepareDocumentAuthorityTransaction(input, {get}) {
  if (!Array.isArray(input) || input.length > 100) throw new Error("Invalid transaction size");
  const operations = [...input], byKey = new Map(operations.map(operation => [keyOf(operation), operation]));
  const appendScopeCondition = (pk, current) => {
    const key = keyOf({pk, sk: "SOURCE_SCOPE"}), supplied = byKey.get(key);
    if (supplied) {
      if (supplied.expected !== (current?.revision ?? null)) throw new AccessConflict();
      return supplied;
    }
    const condition = {pk, sk: "SOURCE_SCOPE", expected: current?.revision ?? null};
    operations.push(condition); byKey.set(key, condition); return condition;
  };
  const documents = new Set();
  for (const operation of input) {
    if (!operation.put && !operation.delete) continue;
    if (/^DOCUMENT#/.test(operation.pk) && (operation.sk === "PROFILE" || operation.sk === "SOURCE_SCOPE" || operation.sk === "GRANT_SET" || operation.sk.startsWith("GRANT#"))) documents.add(operation.pk);
    if (/^WORKSPACE#/.test(operation.pk) && /^GUEST#document#[^#]+#[^#]+$/.test(operation.sk)) documents.add(`DOCUMENT#${operation.sk.split("#")[2]}`);
    if (/^PROJECT#/.test(operation.pk) && operation.sk === "SOURCE_AUTHORITY_SET") {
      if (!operation.put || operation.delete) throw new AccessConflict();
      const value = assertProjectSourceAuthority(operation.put), revision = operation.expected === null ? 1 : operation.expected + 1;
      if (operation.put.revision !== revision || !(operation.expected === null || Number.isSafeInteger(operation.expected) && operation.expected > 0)) throw new AccessConflict();
      const previous = await get(operation.pk, operation.sk);
      if (previous) assertProjectSourceAuthority(previous, value);
      else {
        const project = byKey.get(keyOf({pk: operation.pk, sk: "PROFILE"}));
        if (operation.expected !== null || !project?.put || project.expected !== null || project.put.value.source_authority_version !== 1 ||
            ["project_id", "workspace_id", "account_id"].some(field => project.put.value[field] !== value[field])) throw new AccessConflict();
      }
    }
  }
  for (const pk of documents) {
    const existing = await get(pk, "SOURCE_SCOPE"), declared = byKey.get(keyOf({pk, sk: "SOURCE_SCOPE"})), profile = byKey.get(keyOf({pk, sk: "PROFILE"}));
    let scope;
    if (existing) {
      scope = assertDocumentSourceScope(existing);
      if (declared?.put || declared?.delete) throw new AccessConflict();
      appendScopeCondition(pk, existing);
    } else if (declared?.put) {
      scope = assertDocumentSourceScope(declared.put);
      if (declared.expected !== null || declared.delete || !profile?.put || profile.expected !== null || profile.put.revision !== 1) throw new AccessConflict();
    } else {
      if (declared?.delete) throw new AccessConflict();
      appendScopeCondition(pk, null);
      if (profile?.put && profile.expected === null && exactId(profile.put.value?.project_id)) {
        const marker = await get(`PROJECT#${profile.put.value.project_id}`, "SOURCE_AUTHORITY_SET");
        if (marker) { assertProjectSourceAuthority(marker); throw new AccessConflict(); }
      }
      continue;
    }
    if (profile?.put && (["project_id", "workspace_id", "account_id"].some(field => profile.put.value[field] !== scope[field]) ||
        profile.put.value.artifact_id !== scope.document_id || profile.put.value.document_id !== scope.document_id ||
        profile.put.value.resource?.resource_type !== "document" || profile.put.value.resource.resource_id !== scope.document_id ||
        profile.put.value.resource.project_id !== scope.project_id || profile.put.value.resource.workspace_id !== scope.workspace_id)) throw new AccessConflict();
    for (const operation of input.filter(operation => (operation.put || operation.delete) && operation.sk.startsWith(`GUEST#document#${scope.document_id}#`))) {
      if (operation.pk !== `WORKSPACE#${scope.workspace_id}`) throw new AccessConflict();
    }
    const marker = byKey.get(keyOf({pk: `PROJECT#${scope.project_id}`, sk: "SOURCE_AUTHORITY_SET"}));
    if (!marker?.put || marker.delete) throw new AccessConflict();
    assertProjectSourceAuthority(marker.put, scope);
  }
  if (operations.length > 100) throw Object.assign(new Error("Document authority checks exceed the transaction limit."), {statusCode: 413});
  return operations;
}
export function assertGrantSetTransaction(operations) {
  const resources = new Set(operations.filter(operation => /^(PROJECT|DOCUMENT|NOTEBOOK|ENGAGEMENT)#/.test(operation.pk) && operation.sk.startsWith("GRANT#") && (operation.put || operation.delete)).map(operation => operation.pk));
  for (const pk of resources) {
    const marker = operations.find(operation => operation.pk === pk && operation.sk === "GRANT_SET");
    const revision = marker?.expected === null ? 1 : marker?.expected + 1;
    if (!marker?.put || marker.delete || marker.put.revision !== revision || marker.put.value?.object_type !== "resource_grant_set" || marker.put.value.generation !== revision) throw new AccessConflict();
  }
}
export function assertTeamSetTransaction(operations) {
  if (!Array.isArray(operations) || operations.length > 100) throw new Error("Invalid transaction size");
  const keys = new Set(), markers = new Map();
  for (const operation of operations) {
    const key = keyOf(operation);
    if (keys.has(key)) throw new Error("Duplicate transaction key");
    keys.add(key);
    if (operation.put && (operation.put.pk !== operation.pk || operation.put.sk !== operation.sk)) throw new TypeError("Transaction row keys must match their condition keys");
    if (!operation.put && !operation.delete) continue;
    if (operation.pk.startsWith("TEAM#") && operation.sk.startsWith("MEMBER#")) markers.set(operation.pk, ["MEMBER_SET", "team_member_set"]);
    if (operation.pk.startsWith("WORKSPACE#") && operation.sk.startsWith("TEAM#")) markers.set(operation.pk, ["TEAM_SET", "workspace_team_set"]);
  }
  for (const [pk, [sk, objectType]] of markers) {
    const marker = operations.find(operation => operation.pk === pk && operation.sk === sk);
    const revision = marker?.expected === null ? 1 : marker?.expected + 1;
    if (!marker?.put || marker.delete || !(marker.expected === null || Number.isSafeInteger(marker.expected) && marker.expected > 0) ||
        !Number.isSafeInteger(revision) || marker.put.revision !== revision || marker.put.value?.object_type !== objectType || marker.put.value.generation !== revision) throw new AccessConflict();
  }
}
export function assertAppendOnlyAuditOperation(operation) {
  if (operation.put && (operation.put.pk !== operation.pk || operation.put.sk !== operation.sk)) throw new TypeError("Transaction row keys must match their condition keys");
  if (operation.pk.startsWith("ENGAGEMENT_REVISION#") || operation.pk.startsWith("ENGAGEMENT_ISSUED#")) {
    if (!operation.put && !operation.delete) return;
    const type = operation.pk.startsWith("ENGAGEMENT_REVISION#") ? "engagement_revision" : "engagement_issued_rendition";
    if (!/^ENGAGEMENT_(REVISION|ISSUED)#[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(operation.pk) ||
        operation.sk !== "PROFILE" || operation.expected !== null || !operation.put || operation.delete ||
        operation.put.revision !== 1 || operation.put.value?.object_type !== type) throw new AccessConflict();
    return;
  }
  if (operation.pk.startsWith("PUBLICATION_EDITION#")) {
    if (!operation.put && !operation.delete) return;
    if (operation.expected !== null || !operation.put || operation.delete || operation.put.revision !== 1 || operation.put.value?.object_type !== "publication_edition") throw new AccessConflict();
    return;
  }
  if (operation.pk.startsWith("REVIEW_EDITION#")) {
    if (!operation.put && !operation.delete) return;
    if (operation.expected !== null || !operation.put || operation.delete || operation.put.revision !== 1 || operation.put.value?.object_type !== "review_edition") throw new AccessConflict();
    return;
  }
  if (!operation.pk.startsWith("AUDIT#")) return;
  if (!operation.put && !operation.delete) return;
  if (operation.expected !== null || !operation.put || operation.delete || operation.put.revision !== 1 || operation.put.value?.object_type !== "audit_event") throw new AccessConflict();
}

export function createMemoryAccessStore(initial = []) {
  const rows = new Map(initial.map(row => [keyOf(row), structuredClone(row)]));
  return {
    async get(pk, sk) { return structuredClone(rows.get(keyOf({pk, sk})) || null); },
    async list(pk, prefix = "") {
      return [...rows.values()].filter(row => row.pk === pk && row.sk.startsWith(prefix))
        .sort((a, b) => a.sk.localeCompare(b.sk)).map(row => structuredClone(row));
    },
    async listPage(pk, prefix = "", {after = null, limit = 40} = {}) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 101 || after !== null && (typeof after !== "string" || !after.startsWith(prefix))) throw new TypeError("Invalid navigation page");
      const matches = [...rows.values()].filter(row => row.pk === pk && row.sk.startsWith(prefix) && (after === null || row.sk > after))
        .sort((a, b) => a.sk < b.sk ? -1 : a.sk > b.sk ? 1 : 0);
      const page = matches.slice(0, limit);
      return {rows: structuredClone(page), nextAfter: matches.length > limit ? page.at(-1).sk : null};
    },
    async transact(operations) {
      if (!Array.isArray(operations) || operations.length > 100) throw new Error("Invalid transaction size");
      assertTeamSetTransaction(operations);
      assertGrantSetTransaction(operations);
      operations = await prepareDocumentAuthorityTransaction(operations, {get: async (pk, sk) => structuredClone(rows.get(keyOf({pk, sk})) || null)});
      assertTeamSetTransaction(operations);
      assertGrantSetTransaction(operations);
      const keys = new Set();
      for (const operation of operations) {
        assertAppendOnlyAuditOperation(operation);
        const key = keyOf(operation);
        if (keys.has(key)) throw new Error("Duplicate transaction key");
        keys.add(key);
        const current = rows.get(key);
        if (operation.expected === null ? Boolean(current) : current?.revision !== operation.expected) throw new AccessConflict();
        if (Object.hasOwn(operation, 'expectedValue') && !isDeepStrictEqual(current?.value, operation.expectedValue)) throw new AccessConflict();
      }
      for (const operation of operations) {
        if (operation.put) rows.set(keyOf(operation), structuredClone(operation.put));
        else if (operation.delete) rows.delete(keyOf(operation));
      }
    }
  };
}
