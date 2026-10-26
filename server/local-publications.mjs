import {DatabaseSync} from "node:sqlite";
import {createHash, randomUUID} from "node:crypto";
import {lstatSync} from "node:fs";
import {join} from "node:path";
import {isDeepStrictEqual} from "node:util";
import {normalizePublicationContent} from "../src/lib/publication-records.js";

const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const fail = (message, status = 400) => {throw Object.assign(new Error(message), {status});};
const identifier = value => {if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}(?![\s\S])/.test(value)) fail("Publication identity is invalid."); return value;};
const timestamp = value => typeof value === "string" && /^\d{4}-\d\d-\d\dT/.test(value) && Number.isFinite(Date.parse(value));
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const revision = value => Number.isSafeInteger(value) && value > 0;
const permissions = ["view", "edit", "manage_access"];
const maxRecordBytes = 16 * 1024 * 1024;

export function validateLocalPublicationRecords(value, {projectId, workspaceId, accountId}) {
  if (!Array.isArray(value) || value.length > 100 || Buffer.byteLength(JSON.stringify(value)) > maxRecordBytes) fail("Project publications exceed their portable record limit.", 413);
  const ids = new Set();
  const claim = value => {identifier(value);if (ids.has(value)) fail("Publication record IDs must be unique.");ids.add(value);return value;};
  return value.map(raw => {
    if (!object(raw) || raw.projectId !== projectId || raw.workspaceId !== workspaceId || raw.accountId !== accountId || !revision(raw.revision) ||
        !timestamp(raw.createdAt) || !timestamp(raw.updatedAt) || typeof raw.createdBy !== "string" || raw.createdBy.length > 200 ||
        !Array.isArray(raw.editions) || raw.editions.length > 100 || raw.sharing?.visibility !== "private" || raw.sharing?.editionId !== null) fail("Publication records must retain their local account/project scope and private state.");
    const id = claim(raw.id), content = normalizePublicationContent(raw.content);
    const editions = raw.editions.map(edition => {
      if (!object(edition) || edition.publicationId !== id || edition.projectId !== projectId || edition.workspaceId !== workspaceId || edition.accountId !== accountId || !timestamp(edition.issuedAt) || typeof edition.issuedBy !== "string" || edition.issuedBy.length > 200 ||
          !revision(edition.sourceRevision) || edition.sourceRevision >= raw.revision) fail("Publication edition provenance is invalid.");
      const editionContent = normalizePublicationContent(edition.content);
      if (edition.sha256 !== hash(editionContent)) fail("Publication edition content failed its SHA256 check.");
      return {id: claim(edition.id), publicationId: id, projectId, workspaceId, accountId, issuedAt: edition.issuedAt, issuedBy: edition.issuedBy, sourceRevision: edition.sourceRevision, sha256: edition.sha256, content: editionContent};
    });
    return {id, projectId, workspaceId, accountId, revision: raw.revision, content, createdAt: raw.createdAt, updatedAt: raw.updatedAt,
      createdBy: raw.createdBy, sharing: {visibility: "private", editionId: null, sharedAt: null}, editions};
  });
}

/** One OS owner, per-account database. Sharing requires the hosted authority. */
export function createLocalPublicationStore({directory, accountId, getProject}) {
  for (const name of ["publications.sqlite", "publications.sqlite-wal", "publications.sqlite-shm"]) {
    try {const stat = lstatSync(join(directory, name));if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) fail("Publication storage cannot use shared file links.", 409);}
    catch (error) {if (error.code !== "ENOENT") throw error;}
  }
  const db = new DatabaseSync(join(directory, "publications.sqlite"));
  const schema = db.prepare("PRAGMA user_version").get().user_version;
  if (schema !== 0 && schema !== 1) {db.close();fail("Unsupported local publication database schema.", 409);}
  db.exec("PRAGMA user_version=1;");
  db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS publications (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, json TEXT NOT NULL);");
  const read = id => {
    const row = db.prepare("SELECT json FROM publications WHERE id=?").get(identifier(id));
    if (!row) fail("Publication is unavailable in this account.", 404);
    const value = JSON.parse(row.json);getProject(value.projectId);return value;
  };
  const records = projectId => db.prepare("SELECT json FROM publications WHERE project_id=? ORDER BY rowid DESC").all(projectId).map(row => JSON.parse(row.json));
  const projection = value => ({...value, permissions: [...permissions], editions: value.editions.map(({content, ...edition}) => edition)});
  const save = value => {
    const total = records(value.projectId).filter(item => item.id !== value.id);total.push(value);
    if (total.length > 100 || Buffer.byteLength(JSON.stringify(total)) > maxRecordBytes) fail("Project publications exceed their 16 MiB portable record limit.", 413);
    db.prepare("INSERT INTO publications (id,project_id,json) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET json=excluded.json").run(value.id, value.projectId, JSON.stringify(value));
    return projection(value);
  };
  const transaction = work => {db.exec("BEGIN IMMEDIATE");try {const value = work();db.exec("COMMIT");return value;} catch (error) {db.exec("ROLLBACK");throw error;}};
  const expected = (value, body) => {if (body.expectedRevision !== value.revision) fail("This publication changed. Refresh it before saving; retain your draft for review.", 409);};
  const service = {
    list(projectId) {getProject(identifier(projectId));return {publications: records(projectId).map(projection)};},
    get(id) {return {publication: projection(read(id))};},
    create(body) {
      if (Object.keys(body).some(key => !["projectId", "content"].includes(key))) fail("Publication creation accepts a project and authored content only.");
      const project = getProject(identifier(body.projectId)), content = normalizePublicationContent(body.content), stamp = new Date().toISOString();
      return transaction(() => ({publication: save({id: randomUUID(), projectId: project.id, workspaceId: project.workspaceId, accountId,
        revision: 1, content, createdBy: "local-owner", createdAt: stamp, updatedAt: stamp,
        sharing: {visibility: "private", editionId: null, sharedAt: null}, editions: []})}));
    },
    update(id, body) {
      if (Object.keys(body).some(key => !["expectedRevision", "content"].includes(key))) fail("Publication edits cannot change custody or sharing.");
      const content = normalizePublicationContent(body.content);
      return transaction(() => {const value = read(id);expected(value, body);return {publication: save({...value, content, revision: value.revision + 1, updatedAt: new Date().toISOString()})};});
    },
    issue(id, body) {
      if (Object.keys(body).some(key => key !== "expectedRevision")) fail("Issue the saved publication revision explicitly.");
      return transaction(() => {
        const value = read(id);expected(value, body);
        if (value.editions.length >= 100) fail("This publication has reached its 100-edition limit.", 413);
        if (!value.content.body.trim()) fail("Add publication text before issuing an edition.");
        const issuedAt = new Date().toISOString(), edition = {id: randomUUID(), publicationId: value.id, projectId: value.projectId, workspaceId: value.workspaceId, accountId, issuedAt, issuedBy: "local-owner",
          sourceRevision: value.revision, content: structuredClone(value.content), sha256: hash(value.content)};
        value.editions.push(edition);value.revision++;value.updatedAt = issuedAt;
        return {publication: save(value), edition};
      });
    },
    edition(id, editionId) {
      const edition = read(id).editions.find(item => item.id === identifier(editionId));
      if (!edition) fail("Publication edition is unavailable.", 404);
      if (edition.sha256 !== hash(normalizePublicationContent(edition.content))) fail("Publication edition failed its content integrity check.", 409);
      return {edition};
    },
    share(id) {read(id);fail("Local authoring does not create hosted access grants or internet links. Connect the authenticated publication service to share.", 501);},
    exportProject(projectId) {getProject(projectId);return records(projectId);},
    validateImport(project, value) {
      const incoming = validateLocalPublicationRecords(value, {projectId: project.id, workspaceId: project.workspaceId, accountId});
      for (const item of incoming) {
        const prior = db.prepare("SELECT json FROM publications WHERE id=?").get(item.id);
        if (prior && !isDeepStrictEqual(JSON.parse(prior.json), item)) fail("An imported publication ID already contains different records.", 409);
      }
      return incoming;
    },
    importProject(projectId, value) {
      const project = getProject(projectId), incoming = service.validateImport(project, value);
      return transaction(() => {
        for (const item of incoming) {
          const prior = db.prepare("SELECT json FROM publications WHERE id=?").get(item.id);
          if (prior && !isDeepStrictEqual(JSON.parse(prior.json), item)) fail("An imported publication ID already contains different records.", 409);
        }
        for (const item of incoming) save(item);
        return incoming.length;
      });
    },
    close() {db.close();}
  };
  return service;
}
