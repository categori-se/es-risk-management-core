import {mkdtempSync, rmSync, mkdirSync, lstatSync, realpathSync, existsSync} from "node:fs";
import {join} from "node:path";
import {DatabaseSync} from "node:sqlite";
import {createLocalStorageAccounts} from "./local-storage-accounts.mjs";
import {createLocalWorkspaceStore, localWorkspaceMaxJsonBytes, observeLocalProjectSources} from "./local-workspace-store.mjs";
import {createLocalPublicationStore, validateLocalPublicationRecords} from "./local-publications.mjs";
import {createProjectIdentityDirectory, validateProjectIdentityDescriptor} from "./project-identities.mjs";
import {getFramework} from "../src/lib/framework-register.js";
import {privateStorageDirectory} from "./private-storage-path.mjs";
import {createProjectFileSharing, isSharedFileVersion} from "./project-file-sharing.mjs";
import {createEngagementStore, validateEngagementPackages} from "./engagement-store.mjs";
import {geoJsonEditReceipt} from './geojson-editing.mjs';
import {createProjectLifecycleStore} from './project-lifecycle-store.mjs';

const fail = (message, status = 400) => {throw Object.assign(new Error(message), {status});};
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const descriptor = account => ({id: account.custodyId, name: account.name, organization: account.organization, dataOwner: account.dataOwner});
const sameDescriptor = (left, right) => ["id", "name", "organization", "dataOwner"].every(key => left?.[key] === right?.[key]);
const forbiddenRouting = value => {
  if (!object(value)) return;
  if (["accountId", "storageAccount", "custodyId", "directory", "pathRoot", "workspaceOwner"].some(key => Object.hasOwn(value, key))) fail("Select the storage account using the account control; ownership cannot be set in this record.");
};

/** Local routing and portable custody. Account selection is not multi-user auth. */
export function createAccountWorkspace({directory, defaultStore, resolvePractitionerOwner} = {}) {
  directory = privateStorageDirectory(directory);
  const accounts = createLocalStorageAccounts({directory, defaultStore});
  const scoped = new Map();
  const publicationStores = new Map();
  const engagementStores = new Map();
  const lifecycleStores = new Map();
  let sharingRegistry;
  let identityDirectory;
  const identities = () => identityDirectory ??= createProjectIdentityDirectory({directory});
  const contextFor = (projectId, account) => {
    const result = identities().lookup(account.custodyId, projectId);
    return result ? {identity: result.identity, frameworkIds: result.link.frameworkIds, linkRevision: result.link.revision} : null;
  };
  // A portfolio picker must not initialize an empty lender vault or rehash its
  // originals. These reads expose scope metadata only, never availability.
  function readProjectMetadata(accountId, projectId, {sources = false} = {}) {
    const account=accounts.getAccount(accountId);
    if(projectId!==undefined&&(typeof projectId!=="string"||!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}(?![\s\S])/.test(projectId)))fail("Use an exact project identifier.");
    const base=account.isDefault?directory:join(directory,"accounts",account.id);
    const path=join(base,"workspace.sqlite");
    if(!existsSync(path)){if(projectId!==undefined)fail("Project was not found in this account.",404);return [];}
    if(realpathSync(base)!==base)fail("Read-only account metadata cannot use linked directories.",409);
    for(const suffix of ["","-wal","-shm"]){const file=path+suffix;if(!existsSync(file))continue;const stat=lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1)fail("Read-only account metadata cannot use linked files.",409);}
    const db=new DatabaseSync(path,{readOnly:true});
    try{
      const floor=db.prepare("SELECT value FROM metadata WHERE key='schema_version'").get()?.value;
      if(!["1","2"].includes(floor))fail("Unsupported local project metadata schema.",409);
      const columns="id,json_extract(json,'$.id') AS json_id,json_extract(json,'$.name') AS name,json_extract(json,'$.revision') AS revision,json_extract(json,'$.workspaceId') AS workspaceId"+
        (sources?`,length(CAST(json AS BLOB)) AS source_bytes,CASE WHEN length(CAST(json AS BLOB)) <= ${localWorkspaceMaxJsonBytes} THEN json ELSE NULL END AS source_json`:"");
      const rows=projectId===undefined?db.prepare(`SELECT ${columns} FROM projects ORDER BY rowid LIMIT 1001`).all():[db.prepare(`SELECT ${columns} FROM projects WHERE id=?`).get(projectId)].filter(Boolean);
      if(rows.length>1000)fail("Narrow the source account before listing this volume of project records.",413);
      if(projectId!==undefined&&!rows.length)fail("Project was not found in this account.",404);
      return rows.map(row=>{
        if(row.json_id!==row.id||typeof row.name!=="string"||row.name.length>200||!Number.isSafeInteger(row.revision)||row.revision<1||typeof row.workspaceId!=="string"||!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}(?![\s\S])/.test(row.workspaceId))fail("Project metadata has an invalid identity or revision.",409);
        const claimed=accounts.recordedProjectAccount(row.id);if(claimed!==account.id&&(!account.isDefault||claimed!==null))fail("Project metadata is not registered to this storage account.",409);
        if(sources){
          if(!Number.isSafeInteger(row.source_bytes)||row.source_bytes>localWorkspaceMaxJsonBytes)fail('The project source metadata exceeds its bounded observation limit.',413);
          const retained=JSON.parse(row.source_json);
          if(retained.schemaVersion===2&&floor!=='2')fail('This project requires its committed workspace reader floor.',409);
          return observeLocalProjectSources(retained);
        }
        const projectContext=contextFor(row.id,account);return {id:row.id,name:row.name,revision:row.revision,workspaceId:row.workspaceId,accountId:account.id,...(projectContext?{projectContext}:{})};
      });
    }finally{db.close();}
  }
  const view = (project, account) => {
    const projectContext = contextFor(project.id, account);
    const result = {...project, accountId: account.id, storageAccount: descriptor(account), ...(projectContext ? {projectContext} : {})};
    for (const resource of result.resources || []) for (const version of resource.versions) if (isSharedFileVersion(version)) {
      try {fileSharing().authorizeVersion({accountId: account.custodyId, projectId: project.id, version});version.shareStatus = "active";}
      catch (error) {if (![403, 404, 409].includes(error.status)) throw error;version.availability = "unavailable";version.shareStatus = "unavailable";}
    }
    return result;
  };
  function fileSharing() {
    return sharingRegistry ??= createProjectFileSharing({directory,
      resolveOwner(owner) {
        if (owner.type === "practitioner_project") {
          if (typeof resolvePractitionerOwner !== "function") fail("The practitioner project file owner is unavailable.", 404);
          return resolvePractitionerOwner(owner);
        }
        const account = accounts.getAccountByCustodyId(owner.accountId), store = accounts.getStore(account.id), project = store.getProject(owner.projectId);
        const base = account.isDefault ? directory : join(directory, "accounts", account.id);
        return {project, readVersion: versionId => store.readVersion(project.id, versionId), managedPath(versionId) {
          const version = project.resources.flatMap(resource => resource.versions).find(version => version.id === versionId);
          if (!version) fail("The owning source version was not found.", 404);return join(base, "objects", "sha256", version.sha256);
        }};
      },
      resolveTarget(target) {
        const account = accounts.getAccountByCustodyId(target.accountId), store = accounts.getStore(account.id);
        return {getProject: () => store.getProject(target.projectId), mutate: (revision, command) => store.mutate(target.projectId, revision, command)};
      }});
  }
  const validateContext = value => {
    if (!object(value) || Object.keys(value).some(key => !["identity", "frameworkIds", "linkRevision"].includes(key)) ||
        !Array.isArray(value.frameworkIds) || value.frameworkIds.length > 32 || new Set(value.frameworkIds).size !== value.frameworkIds.length || value.frameworkIds.some(id => !getFramework(id)) ||
        !Number.isSafeInteger(value.linkRevision) || value.linkRevision < 1) fail("Project identity and account-specific framework criteria are invalid.");
    return {identity: validateProjectIdentityDescriptor(value.identity), frameworkIds: [...value.frameworkIds], linkRevision: value.linkRevision};
  };
  const validateContextRestore = (context, projectId, account) => {
    if (!context) return;
    identities().validateRestore(context.identity);
    const existing = contextFor(projectId, account);
    if (existing && (existing.identity.id !== context.identity.id || existing.linkRevision !== context.linkRevision || JSON.stringify(existing.frameworkIds) !== JSON.stringify(context.frameworkIds))) fail("This account review already has a different project identity or criteria revision.", 409);
  };
  const restoreContext = (context, projectId, account) => {
    if (!context) return;
    identities().restore(context.identity);
    identities().restoreLink({accountId: account.custodyId, projectId, identityId: context.identity.id, frameworkIds: context.frameworkIds, revision: context.linkRevision});
  };

  function unwrap(value) {
    if (!object(value)) fail("Choose a valid project package.");
    if (Buffer.byteLength(JSON.stringify(value)) > localWorkspaceMaxJsonBytes) fail("The project package exceeds 48 MiB.", 413);
    if ([5, 6, 7, 9].includes(value.packageVersion)) {
      if (value.packageVersion >= 6 ? value.publicationPackageVersion !== 1 || !Array.isArray(value.publications) : Object.hasOwn(value, "publications") || Object.hasOwn(value, "publicationPackageVersion")) fail("The publication package envelope is invalid.");
      if (value.packageVersion === 7 ? !value.projectContext : value.packageVersion !== 9 && Object.hasOwn(value, "projectContext")) fail("The project identity package envelope is invalid.");
      if (value.packageVersion === 9 ? value.engagementPackageVersion !== 1 || !Array.isArray(value.engagements) : Object.hasOwn(value, "engagements") || Object.hasOwn(value, "engagementPackageVersion")) fail("The engagement package envelope is invalid.");
      if (value.format !== "esia-local-project" || ![1, 2, 3, 4, 8, 10].includes(value.recordPackageVersion) || !object(value.storageAccount)) fail("Unsupported account-bound project package.");
      const owner = value.storageAccount;
      if (typeof owner.id !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(owner.id) ||
          ["name", "organization", "dataOwner"].some(key => typeof owner[key] !== "string" || owner[key].length > (key === "name" ? 200 : 500) || /[\x00-\x1f\x7f]/.test(owner[key]) || owner[key] !== owner[key].trim()) || !owner.name.trim()) fail("The package storage-account identity is invalid.");
      return {owner: {id: owner.id, name: owner.name, organization: owner.organization, dataOwner: owner.dataOwner}, projectContext: value.projectContext ? validateContext(value.projectContext) : null, publications: value.publications ?? [], engagements: value.engagements ?? [], legacy: false, raw: {format: value.format, packageVersion: value.recordPackageVersion, project: value.project, files: value.files, unresolved: value.unresolved}};
    }
    if (![1, 2, 3, 4, 8, 10].includes(value.packageVersion) || ["storageAccount", "recordPackageVersion", "publications", "publicationPackageVersion", "projectContext", "engagements", "engagementPackageVersion"].some(key => Object.hasOwn(value, key))) fail("Unsupported local project package or missing account-bound version.");
    return {owner: null, legacy: true, engagements: [], raw: value};
  }

  function validatePackage(raw, sourceFiles=[]) {
    // Validate the entire graph, report snapshots and bytes before creating an
    // account or assigning a project identity. Failed imports leave no account.
    const staging = join(directory, ".account-validation");
    mkdirSync(staging, {recursive: true, mode: 0o700});
    if (lstatSync(staging).isSymbolicLink() || realpathSync(staging) !== join(realpathSync(directory), ".account-validation")) fail("Package validation needs a private local directory without links.", 409);
    const temporary = mkdtempSync(join(staging, "package-"));
    let store;
    try {
      store = createLocalWorkspaceStore({directory: temporary});const project = store.importProject(raw,{sourceFiles,validateOnly:sourceFiles.length>0});
      if (project.resources.some(resource => resource.versions.some(version => isSharedFileVersion(version) && version.mode !== "registered"))) fail("Shared file imports must retain unresolved registered references.");
      return project;
    }
    finally {store?.close();rmSync(temporary, {recursive: true, force: true});}
  }

  function forAccount(id = "local-default") {
    const account = accounts.getAccount(id);
    if (scoped.has(account.id)) return scoped.get(account.id);
    const store = accounts.getStore(account.id);
    const publicationDirectory = account.isDefault ? directory : join(directory, "accounts", account.id);
    const publications = (create = true) => {
      if (!publicationStores.has(account.id) && (create || existsSync(join(publicationDirectory, "publications.sqlite")))) {
        publicationStores.set(account.id, createLocalPublicationStore({directory: publicationDirectory, accountId: account.custodyId, getProject: id => store.getProject(id)}));
      }
      return publicationStores.get(account.id);
    };
    const engagements = (create = true) => {
      if (!engagementStores.has(account.id) && (create || existsSync(join(publicationDirectory, "engagements.sqlite")))) {
        engagementStores.set(account.id, createEngagementStore({directory: publicationDirectory, accountId: account.custodyId,
          getProject: id => service.getProject(id), getProjectSummary: id => readProjectMetadata(account.id,id)[0], readVersion: (projectId, versionId) => service.readVersion(projectId, versionId)}));
      }
      return engagementStores.get(account.id);
    };
    const lifecycle = () => {
      if (!lifecycleStores.has(account.id)) lifecycleStores.set(account.id, createProjectLifecycleStore({
        directory: publicationDirectory, accountId: account.custodyId,
        getProject: id => {accounts.assertProjectAccount(account.id, id);return service.getProjectSummary(id);},
        getEngagement: id => engagements().get(id),
        getSource: reference => {
          const project = service.observeProjectSources(reference.projectId), resource = project.resources.find(row => row.id === reference.resourceId);
          const version = resource?.versions.find(row => row.id === reference.versionId);
          return version ? {...version, resourceId: resource.id} : null;
        },
        readSource: reference => service.readVersion(reference.projectId, reference.versionId),
        // Existing local account routing serves one computer owner. An actor
        // label records that owner's explicit action; it is not remote identity.
        authorize: ({accountId, projectIds}) => {if (accountId !== account.custodyId) return false;for (const id of projectIds) {accounts.assertProjectAccount(account.id, id);readProjectMetadata(account.id, id);}return true;}
      }));
      return lifecycleStores.get(account.id);
    };
    const service = {
      account,
      publications: () => publications(),
      engagements: () => engagements(),
      lifecycle,
      listWorkItems({after = "", limit = 30, projectId = ""} = {}) {
        if (typeof after !== "string" || after.length > 1000 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) fail("Choose a bounded work page of 1–100 records.");
        if (projectId) readProjectMetadata(account.id,projectId);
        const core = store.listWorkItems({after,limit,projectId});
        const engagement = engagements(false)?.listWorkItems({after,limit,projectId}) || {items:[],hasMore:false};
        const rows = [...core.items,...engagement.items].sort((a,b)=>a.cursor < b.cursor ? -1 : a.cursor > b.cursor ? 1 : 0);
        const checked = new Set();for (const row of rows) if (!checked.has(row.projectId)) {readProjectMetadata(account.id,row.projectId);checked.add(row.projectId);}
        const items = rows.slice(0,limit),hasMore = rows.length > limit || core.hasMore || engagement.hasMore;
        return {format:"esia-local-work-queue",schemaVersion:1,accountId:account.id,asOf:new Date().toISOString().slice(0,10),items,hasMore,nextCursor:hasMore?items.at(-1)?.cursor || null:null};
      },
      listProjects() {return store.listProjects().map(project => {accounts.claimProject(account.id, project.id);return view(project, account);});},
      listFiles(query = {}, {projectIds} = {}) {
        const after = String(query.after || ""), search = String(query.search || "").trim().toLowerCase(), projectId = query.project_id || "", files = [];
        if (search.length > 1000 || after.length > 500) fail("The file search or cursor is too long.");
        if (projectIds !== undefined && (!Array.isArray(projectIds) || projectIds.length > 1000 || projectIds.some(id => typeof id !== 'string' || !id || id.length > 192))) fail("Choose a bounded authorized project set.");
        const projects = service.listProjects().filter(project => projectIds === undefined || projectIds.includes(project.id));
        if (projectId && !projects.some(project => project.id === projectId)) fail("The file collection is unavailable in this account.", 404);
        for (const summary of projects.filter(project => !projectId || project.id === projectId).sort((a, b) => a.id.localeCompare(b.id))) {
          const project = service.getProject(summary.id);
          for (const resource of project.resources) for (const version of (query.earlier === "1" ? resource.versions : resource.versions.slice(-1))) {
            const metadata = version.effectiveMetadata || resource.metadataHistory?.findLast(entry => entry.versionId === version.id)?.metadata || version.intakeMetadata || {title: resource.title, authors: [], tags: []};
            const cursor = `${project.id}/${version.id}`;
            if (after && cursor <= after || search && ![resource.title, version.filename, metadata.title, metadata.publisher, metadata.identifier, ...(metadata.authors || []), ...(metadata.tags || []).map(tag => tag.label)].join(" ").toLowerCase().includes(search)) continue;
            files.push({cursor, projectId: project.id, projectName: project.name, resourceId: resource.id, title: metadata.title || resource.title,
              version: {id: version.id, filename: version.filename, sha256: version.sha256, mediaType: version.mediaType, size: version.size, availability: version.availability, mode: version.mode}, metadata});
          }
        }
        files.sort((a, b) => a.cursor < b.cursor ? -1 : a.cursor > b.cursor ? 1 : 0);
        return {files: files.slice(0, 200), projects: projects.map(project => ({id: project.id, name: project.name})), hasMore: files.length > 200, nextCursor: files.length > 200 ? files[199].cursor : null};
      },
      createProject(value) {
        forbiddenRouting(value);
        const {realWorldProjectId, ...fields} = value;
        if (realWorldProjectId !== undefined) identities().get(realWorldProjectId);
        const project = store.createProject(fields);accounts.claimProject(account.id, project.id);
        if (realWorldProjectId !== undefined) identities().link({accountId: account.custodyId, projectId: project.id, identityId: realWorldProjectId});
        return view(project, account);
      },
      linkProjectContext(id, body) {
        if (!object(body) || Object.keys(body).some(key => key !== "identityId")) fail("Link an account review using its project identity only.");
        store.getProject(id);identities().link({accountId: account.custodyId, projectId: id, identityId: body.identityId});return service.getProject(id);
      },
      setProjectFrameworks(id, body) {
        if (!object(body) || Object.keys(body).some(key => !["expectedRevision", "frameworkIds"].includes(key)) || !Array.isArray(body.frameworkIds) || body.frameworkIds.some(id => !getFramework(id))) fail("Choose known framework editions for this account review.");
        store.getProject(id);identities().setFrameworks({accountId: account.custodyId, projectId: id, expectedRevision: body.expectedRevision, frameworkIds: body.frameworkIds});return service.getProject(id);
      },
      getProject(id) {return view(store.getProject(id), account);},
      getProjectSummary(id) {return view(store.getProjectSummary(id), account);},
      observeProjectSources(id) {
        // Do not use view()/getProject() here: their shared-source availability
        // checks deliberately read originals. Metadata retains identities even
        // after a share is revoked; it never grants upstream content access.
        return observeAccountProjectSources(account.id, id);
      },
      spatialEditContext(id, versionId) {
        accounts.assertProjectAccount(account.id, id);
        return store.spatialEditContext(id, versionId);
      },
      boundedSpatialEditContext(id, versionId, options) {
        accounts.assertProjectAccount(account.id,id);
        return store.boundedSpatialEditContext(id,versionId,options);
      },
      saveGeoJsonEditReceipt(id, revision, command, options) {
        accounts.assertProjectAccount(account.id,id);
        return store.saveGeoJsonEditReceipt(id,revision,command,options);
      },
      saveGeoJsonEdit(id, revision, command) {
        if (command?.type !== 'source-geojson-edit') fail('Use the exact GeoJSON edit command.');
        accounts.assertProjectAccount(account.id, id);
        const project = service.mutate(id, revision, command);
        return {project, receipt:geoJsonEditReceipt(project, command.requestId)};
      },
      mutate(id, revision, command,options) {
        forbiddenRouting(command);
        if (command?.type === 'source-geojson-edit') accounts.assertProjectAccount(account.id, id);
        if (command?.type === "intake" && isSharedFileVersion({externalReference: command.externalReference})) fail("Register shared files through their explicit grant.");
        if (["evidence", "capture", "relink"].includes(command?.type)) {
          const project = store.getProject(id), version = project.resources.flatMap(resource => resource.versions).find(version => version.id === command.versionId);
          if (isSharedFileVersion(version)) {
            if (command.type !== "evidence") fail("Shared references cannot be copied or relinked through ordinary source commands.", 403);
            fileSharing().authorizeVersion({accountId: account.custodyId, projectId: id, version});
          }
        }
        return view(store.mutate(id, revision, command,options), account);
      },
      readVersion(id, versionId) {
        const project = store.getProject(id), version = project.resources.flatMap(resource => resource.versions).find(version => version.id === versionId);
        if (isSharedFileVersion(version)) fileSharing().authorizeVersion({accountId: account.custodyId, projectId: id, version});
        return store.readVersion(id, versionId);
      },
      readVersionBounded(id, versionId, options) {
        const before=observeAccountProjectSources(account.id,id);
        if(before.custodyId!==account.custodyId)fail('The selected account custody changed before its bounded read.',409);
        const result=store.readVersionBounded(id,versionId,options);
        const after=observeAccountProjectSources(account.id,id);
        if(JSON.stringify(after)!==JSON.stringify(before))fail('Source metadata or custody changed during its bounded read.',409);
        return result;
      },
      registerShare(shareId, {projectId, expectedRevision} = {}) {
        store.getProject(projectId);
        const result = fileSharing().registerShare(shareId, {targetAccountId: account.custodyId, targetProjectId: projectId, expectedRevision});
        return {...result, project: view(result.project, account)};
      },
      exportProject(id, options) {
        const raw = store.exportProject(id,options);
        if (raw.project.resources.some(resource => resource.versions.some(version => isSharedFileVersion(version) && version.mode !== "registered"))) fail("Shared file exports must retain unresolved references, not managed copies.", 409);
        const records = publications(false)?.exportProject(id) ?? [];
        const engagementRecords = engagements(false)?.exportProject(id) ?? [];
        const projectContext = contextFor(id, account);
        const result = {...raw, packageVersion: engagementRecords.length ? 9 : projectContext ? 7 : records.length ? 6 : 5, recordPackageVersion: raw.packageVersion, storageAccount: descriptor(account),
          ...(records.length || projectContext || engagementRecords.length ? {publicationPackageVersion: 1, publications: records} : {}), ...(projectContext ? {projectContext} : {}),
          ...(engagementRecords.length ? {engagementPackageVersion: 1, engagements: engagementRecords} : {})};
        if (Buffer.byteLength(JSON.stringify(result)) > localWorkspaceMaxJsonBytes) fail("The project package including publications exceeds 48 MiB.", 413);
        return result;
      },
      importProject(value, {adoptLegacyAccount = false,sourceFiles=[]} = {}) {
        const pack = unwrap(value);
        if (pack.owner && !sameDescriptor(pack.owner, descriptor(account))) fail("This package belongs to another storage account. Restore its owning account instead of importing it here.", 409);
        if (pack.legacy && !account.isDefault && adoptLegacyAccount !== true) fail("This legacy package has no recorded storage account. Explicitly assign it to the selected account before importing.", 409);
        const incoming = validatePackage(pack.raw,sourceFiles);
        if (incoming.resources.some(resource => resource.versions.some(version => isSharedFileVersion(version) && version.mode !== "registered"))) fail("Shared file imports must retain unresolved registered references.");
        if (pack.publications?.length) publications().validateImport(incoming, pack.publications);
        if (pack.engagements.length) engagements().validateImport(incoming, pack.engagements);
        validateContextRestore(pack.projectContext, incoming.id, account);
        accounts.assertProjectAccount(account.id, incoming.id);
        // Reserve custody before the vault write. Another local service process
        // must lose the claim before it can place bytes in a different account.
        // A failed disk write may leave a safe same-account reservation for retry.
        accounts.claimProject(account.id, incoming.id);
        const project = store.importProject(pack.raw,{sourceFiles});
        if (pack.publications?.length) publications().importProject(project.id, pack.publications);
        if (pack.engagements.length) engagements().importProject(project.id, pack.engagements);
        restoreContext(pack.projectContext, project.id, account);
        return view(project, account);
      }
    };
    scoped.set(account.id, service);return service;
  }

  function observeAccountProjectSources(accountId, projectId) {
    if(typeof projectId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}(?![\s\S])/.test(projectId))fail('Select one exact project for a source observation.');
    const account=accounts.getAccount(accountId);
    const observed=readProjectMetadata(account.id,projectId,{sources:true})[0];
    if(!observed)fail('Select an exact project in this storage account.',404);
    const current=readProjectMetadata(account.id,projectId,{sources:true})[0];
    if(JSON.stringify(current)!==JSON.stringify(observed)||accounts.getAccount(account.id).custodyId!==account.custodyId)fail('Source metadata or custody changed during observation.',409);
    return Object.freeze({...observed,accountId:account.id,custodyId:account.custodyId});
  }

  return {
    listAccounts: () => accounts.listAccounts(),
    getAccountMetadata: id => accounts.getAccount(id),
    readProjectSummaries: id => readProjectMetadata(id),
    readProjectSummary: (id,projectId) => readProjectMetadata(id,projectId)[0],
    // No forAccount(): unopened vaults must not traverse/stat their originals.
    observeProjectSources: observeAccountProjectSources,
    createAccount(value) {
      if (!object(value) || Object.keys(value).some(key => !["name", "organization", "dataOwner"].includes(key))) fail("Account creation accepts a name, organization and recorded data owner only.");
      return accounts.createAccount(value);
    },
    forAccount,
    fileSharing,
    configureFileSharing(value) {
      if (!object(value) || Object.keys(value).some(key => key !== "resolvePractitionerOwner") || typeof value.resolvePractitionerOwner !== "function") fail("Configure a server-owned practitioner project resolver.");
      resolvePractitionerOwner = value.resolvePractitionerOwner;
    },
    createProjectIdentity: value => identities().create(value),
    addProjectReference: (identityId, value) => identities().addReference(identityId, value),
    listProjectDirectory() {
      const byCustody = new Map(accounts.listAccounts().map(account => [account.custodyId, account]));
      return {identities: identities().list().map(({links, linkCount, ...identity}) => ({...identity, facets: links.flatMap(link => {
        const account = byCustody.get(link.accountId);if (!account) return [];
        let project;try {project = readProjectMetadata(account.id,link.projectId)[0];} catch (error) {if (error.status === 404) return [];throw error;}
        return [{accountId: account.id, accountName: account.name, projectId: project.id, transactionName: project.name, frameworkIds: link.frameworkIds, linkRevision: link.revision}];
      })}))};
    },
    restorePackage(value,{sourceFiles=[]}={}) {
      const pack = unwrap(value);
      if (!pack.owner) fail("A legacy package has no owning account to restore. Select an account and explicitly assign it.");
      const incoming = validatePackage(pack.raw,sourceFiles);
      if (pack.publications) validateLocalPublicationRecords(pack.publications, {projectId: incoming.id, workspaceId: incoming.workspaceId, accountId: pack.owner.id});
      if (pack.engagements.length) validateEngagementPackages(incoming, pack.engagements, {accountId: pack.owner.id});
      if (pack.projectContext) identities().validateRestore(pack.projectContext.identity);
      let existing;
      try {existing = accounts.getAccountByCustodyId(pack.owner.id);} catch (error) {if (error.status !== 404) throw error;}
      if (existing) accounts.assertProjectAccount(existing.id, incoming.id);
      else accounts.assertProjectAccount(pack.owner.id, incoming.id);
      const account = accounts.restoreAccount(pack.owner);
      const project = forAccount(account.id).importProject(value,{sourceFiles});
      return {account, project};
    },
    close() {sharingRegistry?.close();for (const store of publicationStores.values()) store.close();for (const store of lifecycleStores.values()) store.close();for (const store of engagementStores.values()) store.close();identityDirectory?.close();accounts.close();}
  };
}
