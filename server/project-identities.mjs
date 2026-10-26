import {DatabaseSync} from "node:sqlite";
import {randomUUID} from "node:crypto";
import {lstatSync, mkdirSync} from "node:fs";
import {join} from "node:path";
import {isIP} from "node:net";
import {isDeepStrictEqual} from "node:util";
import {cleanSourceUrl, isPublicAddress} from "./source-intake.mjs";

const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const fail = (message, status = 400) => {throw Object.assign(new Error(message), {status});};
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}(?![\s\S])/;
const opaquePattern = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}(?![\s\S])/;
const uuid = value => typeof value === "string" && uuidPattern.test(value) ? value : fail("Use an exact canonical project/account identifier.");
const opaque = value => typeof value === "string" && opaquePattern.test(value) ? value : fail("Use an exact project/framework identifier.");
const keys = (value, allowed) => {if (!object(value) || Object.keys(value).some(key => !allowed.includes(key))) fail("The project directory record contains unsupported fields.");};
function text(value, maximum, required = false) {
  if (value === undefined && !required) return "";
  if (typeof value !== "string" || value.length > maximum || /[\x00-\x1f\x7f]/.test(value) || required && !value.trim()) fail("Project directory text is missing, too long or contains control characters.");
  return value.trim();
}
function timestamp(value) {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z(?![\s\S])/.test(value) ||
      !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) fail("Project directory timestamps must be exact ISO UTC dates.");
  return value;
}
function publicUrl(value) {
  const source = text(value, 4000, true);let clean;
  try {clean = cleanSourceUrl(source);} catch {fail("Use a complete credential-free public HTTP(S) reference URL.");}
  if (clean.removed) fail("Public references cannot contain credentials or signed download parameters.");
  const url = new URL(clean.url), hostname = url.hostname.replace(/^\[|\]$/g, "").replace(/\.+$/, "").toLowerCase();
  if (hostname === "localhost" || /\.(?:localhost|local|internal|lan|home)$/.test(hostname) ||
      (isIP(hostname) ? !isPublicAddress(hostname) : !hostname.includes("."))) fail("Public references cannot name local hosts or private/reserved address literals.");
  return clean.url;
}
function referenceFields(value) {
  const result = {title: text(value.title, 500, true), url: publicUrl(value.url), publisher: text(value.publisher, 500), locator: text(value.locator, 2000)};
  if (value.sha256 !== undefined && value.sha256 !== "") {
    if (typeof value.sha256 !== "string" || !/^[a-f0-9]{64}(?![\s\S])/.test(value.sha256)) fail("A public-reference SHA256 must contain exactly 64 lowercase hexadecimal characters.");
    result.sha256 = value.sha256;
  }
  return result;
}
function frameworks(value = []) {
  if (!Array.isArray(value) || value.length > 32) fail("Select at most 32 unique framework editions.");
  const normalized = value.map(opaque);
  if (new Set(normalized).size !== normalized.length) fail("Framework edition IDs must be unique.");
  return normalized;
}
function linkRecord(value) {
  keys(value, ["accountId", "projectId", "identityId", "frameworkIds", "revision"]);
  if (!Number.isSafeInteger(value.revision) || value.revision < 1) fail("A project-context link revision is required.");
  return {accountId: uuid(value.accountId), projectId: opaque(value.projectId), identityId: uuid(value.identityId), frameworkIds: frameworks(value.frameworkIds), revision: value.revision};
}

/** Public metadata only: this record carries no local file paths or access grant. */
export function validateProjectIdentityDescriptor(value) {
  keys(value, ["id", "name", "createdAt", "publicReferences"]);
  const result = {id: uuid(value.id), name: text(value.name, 200, true), createdAt: timestamp(value.createdAt), publicReferences: []};
  if (value.publicReferences !== undefined && (!Array.isArray(value.publicReferences) || value.publicReferences.length > 100)) fail("A project identity may retain at most 100 public references.", 413);
  const ids = new Set();
  result.publicReferences = (value.publicReferences ?? []).map(reference => {
    keys(reference, ["id", "title", "url", "publisher", "locator", "sha256", "createdAt"]);
    const id = uuid(reference.id);
    if (ids.has(id)) fail("Public reference IDs must be unique.");ids.add(id);
    return {id, ...referenceFields(reference), createdAt: timestamp(reference.createdAt)};
  });
  return result;
}
export const validateProjectIdentity = validateProjectIdentityDescriptor;

/** Explicit real-world identity links; names never merge projects or grant files. */
export function createProjectIdentityDirectory({directory}) {
  try {
    mkdirSync(directory, {recursive: true, mode: 0o700});
    const parent = lstatSync(directory);if (!parent.isDirectory() || parent.isSymbolicLink()) fail("The project directory must use a private regular directory.", 409);
    for (const filename of ["project-identities.sqlite", "project-identities.sqlite-wal", "project-identities.sqlite-shm"]) {
      try {const stat = lstatSync(join(directory, filename));if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) fail("Project directory storage cannot use linked files.", 409);}
      catch (error) {if (error.code !== "ENOENT") throw error;}
    }
  } catch (error) {if (error.status) throw error;fail("The project identity directory could not be opened.", 500);}
  const db = new DatabaseSync(join(directory, "project-identities.sqlite"));
  try {
    const schema = db.prepare("PRAGMA user_version").get().user_version;
    if (![0, 1].includes(schema)) fail("Unsupported project identity directory schema.", 409);
    db.exec("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS project_identities (id TEXT PRIMARY KEY,json TEXT NOT NULL); CREATE TABLE IF NOT EXISTS project_identity_links (account_id TEXT NOT NULL,project_id TEXT NOT NULL,identity_id TEXT NOT NULL REFERENCES project_identities(id),json TEXT NOT NULL,PRIMARY KEY(account_id,project_id)); PRAGMA user_version=1;");
  } catch (error) {db.close();throw error;}
  const transaction = work => {db.exec("BEGIN IMMEDIATE");try {const value = work();db.exec("COMMIT");return value;} catch (error) {db.exec("ROLLBACK");throw error;}};
  const identity = id => {
    const row = db.prepare("SELECT json FROM project_identities WHERE id=?").get(uuid(id));
    if (!row) fail("Real-world project identity was not found.", 404);return JSON.parse(row.json);
  };
  const readLink = (accountId, projectId) => {
    const row = db.prepare("SELECT json FROM project_identity_links WHERE account_id=? AND project_id=?").get(uuid(accountId), opaque(projectId));
    return row ? JSON.parse(row.json) : null;
  };
  const links = id => db.prepare("SELECT json FROM project_identity_links WHERE identity_id=? ORDER BY account_id,project_id").all(id).map(row => JSON.parse(row.json));
  const projection = value => {const rows = links(value.id);return {...value, links: rows, linkCount: rows.length};};
  const writeIdentity = value => db.prepare("INSERT INTO project_identities(id,json) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET json=excluded.json").run(value.id, JSON.stringify(value));
  const writeLink = value => db.prepare("INSERT INTO project_identity_links(account_id,project_id,identity_id,json) VALUES (?,?,?,?) ON CONFLICT(account_id,project_id) DO UPDATE SET identity_id=excluded.identity_id,json=excluded.json").run(value.accountId, value.projectId, value.identityId, JSON.stringify(value));
  function validateRestore(value) {
    const incoming = validateProjectIdentityDescriptor(value), previous = db.prepare("SELECT json FROM project_identities WHERE id=?").get(incoming.id);
    const old = previous ? JSON.parse(previous.json) : null;
    if (old && ["id", "name", "createdAt"].some(key => old[key] !== incoming[key])) fail("This real-world project ID already has different identity metadata.", 409);
    const mergedReferenceCount = new Set([...(old?.publicReferences ?? []), ...incoming.publicReferences].map(reference => reference.id)).size;
    if (mergedReferenceCount > 100) fail("A restored project identity exceeds 100 public references.", 413);
    const saved = db.prepare("SELECT json FROM project_identities").all().map(row => JSON.parse(row.json));
    for (const reference of incoming.publicReferences) {
      for (const owner of saved) {
        const prior = owner.publicReferences.find(item => item.id === reference.id);
        if (prior && (owner.id !== incoming.id || !isDeepStrictEqual(prior, reference))) fail("This public reference ID already has different metadata or project identity.", 409);
      }
    }
    return incoming;
  }
  const service = {
    list() {return db.prepare("SELECT json FROM project_identities ORDER BY rowid").all().map(row => projection(JSON.parse(row.json)));},
    get(id) {return projection(identity(id));},
    create(value) {
      keys(value, ["name"]);const name = text(value.name, 200, true);
      return transaction(() => {const result = {id: randomUUID(), name, createdAt: new Date().toISOString(), publicReferences: []};writeIdentity(result);return projection(result);});
    },
    lookup(accountId, projectId) {const link = readLink(accountId, projectId);return link ? {identity: identity(link.identityId), link} : null;},
    link(value) {
      keys(value, ["accountId", "projectId", "identityId"]);const incoming = linkRecord({...value, frameworkIds: [], revision: 1});
      return transaction(() => {
        identity(incoming.identityId);const old = readLink(incoming.accountId, incoming.projectId);
        if (old) {if (old.identityId !== incoming.identityId) fail("This account project is already linked to a different real-world identity.", 409);return old;}
        writeLink(incoming);return incoming;
      });
    },
    restoreLink(value) {
      const incoming = linkRecord(value);
      return transaction(() => {identity(incoming.identityId);const old = readLink(incoming.accountId, incoming.projectId);
        if (old && !isDeepStrictEqual(old, incoming)) fail("The imported project-context link conflicts with saved account criteria.", 409);
        if (!old) writeLink(incoming);return old ?? incoming;});
    },
    setFrameworks(value) {
      keys(value, ["accountId", "projectId", "expectedRevision", "frameworkIds"]);const accountId = uuid(value.accountId), projectId = opaque(value.projectId), frameworkIds = frameworks(value.frameworkIds);
      if (!Number.isSafeInteger(value.expectedRevision) || value.expectedRevision < 1) fail("An expected project-context revision is required.");
      return transaction(() => {const old = readLink(accountId, projectId);if (!old) fail("Link the project to a real-world identity before setting account criteria.", 404);
        if (old.revision !== value.expectedRevision) fail("The project criteria changed. Refresh before saving.", 409);
        if (isDeepStrictEqual(old.frameworkIds, frameworkIds)) return old;
        const changed = {...old, frameworkIds, revision: old.revision + 1};writeLink(changed);return changed;});
    },
    addReference(identityId, value) {
      keys(value, ["title", "url", "publisher", "locator", "sha256"]);const fields = referenceFields(value);
      return transaction(() => {const old = identity(identityId);if (old.publicReferences.length >= 100) fail("A project identity may retain at most 100 public references.", 413);
        const reference = {id: randomUUID(), ...fields, createdAt: new Date().toISOString()};
        writeIdentity({...old, publicReferences: [...old.publicReferences, reference]});return reference;});
    },
    validateRestore,
    restore(value) {
      return transaction(() => {const incoming = validateRestore(value), previous = db.prepare("SELECT json FROM project_identities WHERE id=?").get(incoming.id), old = previous ? JSON.parse(previous.json) : null;
        const references = old ? [...old.publicReferences, ...incoming.publicReferences.filter(reference => !old.publicReferences.some(prior => prior.id === reference.id))] : incoming.publicReferences;
        if (references.length > 100) fail("A restored project identity exceeds 100 public references.", 413);
        const combined = {...incoming, publicReferences: references};writeIdentity(combined);return projection(combined);});
    },
    close() {db.close();}
  };
  return service;
}
