import {DatabaseSync} from "node:sqlite";
import {randomUUID} from "node:crypto";
import {lstatSync, mkdirSync, readdirSync, realpathSync} from "node:fs";
import {join, resolve} from "node:path";
import {createLocalWorkspaceStore} from "./local-workspace-store.mjs";

export const defaultLocalStorageAccountId = "local-default";
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const projectIdPattern = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}$/;
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const fail = (status, message) => {throw Object.assign(new Error(message), {status});};

function accountId(value) {
  if (value !== defaultLocalStorageAccountId && (typeof value !== "string" || !uuid.test(value))) {
    fail(400, "Storage account identifier is invalid.");
  }
  return value;
}

function custodyId(value) {
  if (typeof value !== "string" || !uuid.test(value)) fail(400, "Storage custody identifier is invalid.");
  return value;
}

function projectId(value) {
  if (typeof value !== "string" || !projectIdPattern.test(value)) fail(400, "Project identifier is invalid.");
  return value;
}

function descriptiveText(value, label, {required = false, maximum = 500} = {}) {
  if (value === undefined && !required) return "";
  if (typeof value !== "string" || value.length > maximum || /[\x00-\x1f\x7f]/.test(value) || required && !value.trim()) {
    fail(400, `${label} must be ${required ? "non-empty " : ""}text of at most ${maximum} characters.`);
  }
  return value.trim();
}

function privateDirectory(directory) {
  try {
    try {
      const stat = lstatSync(directory);
      if (stat.isSymbolicLink() || !stat.isDirectory()) fail(409, "An account storage directory must be a private directory, not a link or file.");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      mkdirSync(directory, {mode: 0o700});
    }
  } catch (error) {
    if (error.status) throw error;
    fail(500, "The local storage account directory could not be opened.");
  }
}

function privateFile(path) {
  try {
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) {
      fail(409, "Account storage files must be regular files without shared links.");
    }
  } catch (error) {
    if (error.code === "ENOENT") return;
    if (error.status) throw error;
    fail(500, "A local storage account file could not be checked.");
  }
}

function managedStoreDirectory(directory) {
  for (const filename of ["workspace.sqlite", "workspace.sqlite-wal", "workspace.sqlite-shm"]) privateFile(join(directory, filename));
  const objects = join(directory, "objects"), originals = join(objects, "sha256");
  privateDirectory(objects);
  privateDirectory(originals);
  // This catches accidental aliases already present when a vault is opened.
  // It does not claim protection against the OS owner changing files at runtime.
  let names;
  try {names = readdirSync(originals);}
  catch {fail(500, "The local storage account originals could not be checked.");}
  for (const name of names) privateFile(join(originals, name));
}

const view = record => ({id: record.id, custodyId: record.custody_id, name: record.name, organization: record.organization,
  dataOwner: record.data_owner, createdAt: record.created_at, isDefault: record.is_default === 1});

/** Local custody partitions, not users, authorization grants or hosted tenants.
 * The default account retains the pre-existing root. New accounts get fixed,
 * generated subdirectories and separate stores; object hashes never dedupe
 * across accounts. File locations remain a concern of each individual store. */
export function createLocalStorageAccounts({directory, defaultStore} = {}) {
  if (typeof directory !== "string" || !directory.trim() || directory.includes("\0")) fail(400, "A private storage directory is required.");
  if (defaultStore !== undefined && (!object(defaultStore) || typeof defaultStore.close !== "function" || typeof defaultStore.listProjects !== "function")) {
    fail(400, "The existing local workspace store is invalid.");
  }
  let root, db;
  try {
    mkdirSync(resolve(directory), {recursive: true, mode: 0o700});
    root = realpathSync(resolve(directory));
    for (const filename of ["storage-accounts.sqlite", "storage-accounts.sqlite-wal", "storage-accounts.sqlite-shm"]) privateFile(join(root, filename));
    db = new DatabaseSync(join(root, "storage-accounts.sqlite"));
    db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
    db.exec("BEGIN IMMEDIATE;");
    try {
      db.exec(`CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS accounts (
          id TEXT PRIMARY KEY, custody_id TEXT NOT NULL UNIQUE, name TEXT NOT NULL, organization TEXT NOT NULL,
          data_owner TEXT NOT NULL, created_at TEXT NOT NULL,
          is_default INTEGER NOT NULL CHECK (is_default IN (0, 1))
        );
        CREATE UNIQUE INDEX IF NOT EXISTS one_default_account ON accounts(is_default) WHERE is_default = 1;
        CREATE TABLE IF NOT EXISTS project_accounts (
          project_id TEXT PRIMARY KEY,
          account_id TEXT NOT NULL REFERENCES accounts(id)
        );`);
      const schema = db.prepare("SELECT value FROM metadata WHERE key = 'schema_version'").get();
      if (schema && schema.value !== "1") fail(409, "Unsupported local storage account registry schema.");
      // Preserve a registry created by the first local prototype before portable
      // custody identity was added; neither its stores nor existing IDs move.
      if (!db.prepare("PRAGMA table_info(accounts)").all().some(column => column.name === "custody_id")) {
        db.exec("ALTER TABLE accounts ADD COLUMN custody_id TEXT;");
        for (const account of db.prepare("SELECT id FROM accounts").all()) {
          db.prepare("UPDATE accounts SET custody_id = ? WHERE id = ?").run(account.id === defaultLocalStorageAccountId ? randomUUID() : account.id, account.id);
        }
      }
      db.exec("CREATE UNIQUE INDEX IF NOT EXISTS account_custody_identity ON accounts(custody_id);");
      db.prepare("INSERT OR IGNORE INTO metadata (key, value) VALUES ('schema_version', '1')").run();
      db.prepare("INSERT OR IGNORE INTO accounts (id, custody_id, name, organization, data_owner, created_at, is_default) VALUES (?, ?, ?, '', '', ?, 1)")
        .run(defaultLocalStorageAccountId, randomUUID(), "Existing local workspace", new Date().toISOString());
      db.exec("COMMIT;");
    } catch (error) {db.exec("ROLLBACK;"); throw error;}
  } catch (error) {
    try {db?.close();} catch {}
    if (error.status) throw error;
    fail(500, "The local storage account registry could not be opened.");
  }
  let closed = false;
  let defaultProjectsSeeded = false;
  const stores = new Map(defaultStore ? [[defaultLocalStorageAccountId, defaultStore]] : []);
  const assertOpen = () => {if (closed) fail(409, "The local storage account registry is closed.");};
  const read = id => {
    assertOpen();
    accountId(id);
    const record = db.prepare("SELECT * FROM accounts WHERE id = ?").get(id);
    if (!record) fail(404, "Storage account was not found.");
    return record;
  };

  const insertAccount = (id, name, organization, dataOwner) => {
    db.prepare("INSERT INTO accounts (id, custody_id, name, organization, data_owner, created_at, is_default) VALUES (?, ?, ?, ?, ?, ?, 0)")
      .run(id, id, name, organization, dataOwner, new Date().toISOString());
    return view(read(id));
  };
  const seedDefaultProjects = () => {
    if (defaultProjectsSeeded) return;
    const projects = accounts.getStore().listProjects();
    db.exec("BEGIN IMMEDIATE;");
    try {
      for (const project of projects) {
        projectId(project.id);
        const claimed = db.prepare("SELECT account_id FROM project_accounts WHERE project_id = ?").get(project.id);
        if (claimed && claimed.account_id !== defaultLocalStorageAccountId) fail(409, "An existing project is assigned to another storage account.");
        db.prepare("INSERT OR IGNORE INTO project_accounts (project_id, account_id) VALUES (?, ?)").run(project.id, defaultLocalStorageAccountId);
      }
      db.exec("COMMIT;");
      defaultProjectsSeeded = true;
    } catch (error) {db.exec("ROLLBACK;"); throw error;}
  };
  const accounts = {
    listAccounts() {
      assertOpen();
      return db.prepare("SELECT * FROM accounts ORDER BY is_default DESC, rowid ASC").all().map(view);
    },
    createAccount(input = {}) {
      assertOpen();
      if (!object(input) || Object.keys(input).some(key => !["name", "organization", "dataOwner"].includes(key))) {
        fail(400, "A storage account accepts only its name, organization and data owner.");
      }
      const name = descriptiveText(input.name, "Storage account name", {required: true, maximum: 200});
      const organization = descriptiveText(input.organization, "Organization");
      const dataOwner = descriptiveText(input.dataOwner, "Data owner");
      return insertAccount(randomUUID(), name, organization, dataOwner);
    },
    getAccount(id) {return view(read(id));},
    recordedProjectAccount(targetProjectId) {
      assertOpen();projectId(targetProjectId);
      return db.prepare("SELECT account_id FROM project_accounts WHERE project_id=?").get(targetProjectId)?.account_id??null;
    },
    getAccountByCustodyId(id) {
      assertOpen();
      custodyId(id);
      const record = db.prepare("SELECT * FROM accounts WHERE custody_id = ?").get(id);
      if (!record) fail(404, "Storage account was not found.");
      return view(record);
    },
    restoreAccount(identity) {
      assertOpen();
      if (!object(identity) || Object.keys(identity).some(key => !["id", "name", "organization", "dataOwner"].includes(key))) {
        fail(400, "A restored account requires its custody identity and descriptive metadata.");
      }
      const id = custodyId(identity.id);
      const name = descriptiveText(identity.name, "Storage account name", {required: true, maximum: 200});
      const organization = descriptiveText(identity.organization, "Organization");
      const dataOwner = descriptiveText(identity.dataOwner, "Data owner");
      const existing = db.prepare("SELECT * FROM accounts WHERE custody_id = ? OR id = ?").get(id, id);
      if (existing) {
        if (existing.custody_id !== id || existing.name !== name || existing.organization !== organization || existing.data_owner !== dataOwner) {
          fail(409, "The storage custody identity already exists with different account metadata.");
        }
        return view(existing);
      }
      return insertAccount(id, name, organization, dataOwner);
    },
    getStore(id = defaultLocalStorageAccountId) {
      const account = read(id);
      if (!stores.has(account.id)) {
        let accountDirectory = root;
        if (!account.is_default) {
          const accountsDirectory = join(root, "accounts");
          privateDirectory(accountsDirectory);
          accountDirectory = join(accountsDirectory, account.id);
          privateDirectory(accountDirectory);
          managedStoreDirectory(accountDirectory);
        }
        let store;
        try {store = createLocalWorkspaceStore({directory: accountDirectory});}
        catch {fail(500, "The local storage account could not be opened.");}
        stores.set(account.id, store);
      }
      return stores.get(account.id);
    },
    assertProjectAccount(id, targetProjectId) {
      assertOpen();
      // Restore preflight may check a future UUID before creating its account.
      // This operation never reserves the incoming project or creates a vault.
      accountId(id);
      projectId(targetProjectId);
      seedDefaultProjects();
      const claimed = db.prepare("SELECT account_id FROM project_accounts WHERE project_id = ?").get(targetProjectId);
      if (claimed && claimed.account_id !== id) fail(409, "This project belongs to another storage account.");
      return true;
    },
    claimProject(id, targetProjectId) {
      read(id);
      accounts.assertProjectAccount(id, targetProjectId);
      db.prepare("INSERT OR IGNORE INTO project_accounts (project_id, account_id) VALUES (?, ?)").run(targetProjectId, id);
      // Another local process can claim between the preflight and insertion.
      // Check the persisted winner instead of accepting INSERT OR IGNORE alone.
      if (db.prepare("SELECT account_id FROM project_accounts WHERE project_id = ?").get(targetProjectId).account_id !== id) {
        fail(409, "This project belongs to another storage account.");
      }
      return {projectId: targetProjectId, accountId: id};
    },
    close() {
      if (closed) return;
      closed = true;
      let failure = false;
      for (const store of new Set(stores.values())) {
        try {store.close();} catch {failure = true;}
      }
      try {db.close();} catch {failure = true;}
      stores.clear();
      if (failure) fail(500, "A local storage account could not be closed cleanly.");
    }
  };
  return accounts;
}
