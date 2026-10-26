// The vault contains encrypted records only. Passphrases and derived keys are
// held in this closure and are never written to browser storage.
import {assertFieldDeviceLease, validateFieldDeviceLease, fieldDevicePolicySha256} from "./field-device-policy.js";
const VAULT_ID = "field-vault";
const ITERATIONS = 210000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function bytesToBase64(bytes) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
}

function base64ToBytes(value) {
  return Uint8Array.from(atob(value), character => character.charCodeAt(0));
}

export async function sha256Bytes(bytes, crypto = globalThis.crypto) {
  if (!crypto?.subtle) throw Error("This browser needs a secure connection for file integrity and encrypted drafts.");
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("");
}

function conflict() {
  return Object.assign(Error("This device draft changed in another tab. Reopen its latest saved version before editing; your unsaved work remains in this tab."), {code: "DRAFT_CONFLICT"});
}

/** Small IndexedDB adapter, also replaceable by an in-memory adapter in tests. */
export function createIndexedDBDraftStorage({indexedDB = globalThis.indexedDB, dbName = "esia-encrypted-field-drafts-v1"} = {}) {
  let opening;
  function database() {
    if (!indexedDB) return Promise.reject(Error("IndexedDB is unavailable. Device drafts cannot be saved in this browser."));
    opening ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore("settings", {keyPath: "id"});
        db.createObjectStore("drafts", {keyPath: "id"});
      };
      request.onerror = () => reject(request.error || Error("The device draft vault could not be opened."));
      request.onblocked = () => reject(Error("Close older E&S Review tabs to open the device draft vault."));
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
    });
    return opening;
  }
  async function transaction(name, mode, perform) {
    const db = await database();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(name, mode);
      let result, failure;
      const set = value => {result = value;};
      const fail = error => {failure = error; tx.abort();};
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(failure || tx.error || Error("The device draft could not be saved."));
      tx.onabort = () => reject(failure || tx.error || Error("The device draft operation was interrupted."));
      perform(tx.objectStore(name), set, fail);
    });
  }
  return {
    readVault: () => transaction("settings", "readonly", (store, set) => {store.get(VAULT_ID).onsuccess = event => set(event.target.result);}),
    createVault: value => transaction("settings", "readwrite", (store, set) => {
      store.get(VAULT_ID).onsuccess = event => {
        if (event.target.result) set(event.target.result);
        else {store.add({...value, id: VAULT_ID}); set(value);}
      };
    }),
    listRecords: () => transaction("drafts", "readonly", (store, set) => {store.getAll().onsuccess = event => set(event.target.result);}),
    readRecord: id => transaction("drafts", "readonly", (store, set) => {store.get(id).onsuccess = event => set(event.target.result);}),
    putRecord: (record, expectedRevision) => transaction("drafts", "readwrite", (store, set, fail) => {
      store.get(record.id).onsuccess = event => {
        if ((event.target.result?.revision || 0) !== expectedRevision) return fail(conflict());
        store.put(record); set(record);
      };
    }),
    deleteRecord: (id, expectedRevision) => transaction("drafts", "readwrite", (store, set, fail) => {
      store.get(id).onsuccess = event => {
        if (expectedRevision !== undefined && event.target.result?.revision !== expectedRevision) return fail(conflict());
        store.delete(id); set(true);
      };
    }),
    async close() {if (opening) (await opening).close();}
  };
}

export function createFieldDraftStore({storage, indexedDB, crypto = globalThis.crypto, dbName, devicePolicyContext, now = Date.now} = {}) {
  storage ??= createIndexedDBDraftStorage({indexedDB, dbName});
  let key = null, session = 0;
  let policyContext = devicePolicyContext ? structuredClone(devicePolicyContext) : null, policySha256 = null;
  async function checkPolicy(context,record) {
    if(!context)return;
    return validateFieldDeviceLease(context.policy,context.lease,{scope:context.scope,now,crypto,sensitivity:record?.sensitivity,includesOriginals:Boolean(record?.attachments?.length)});
  }
  async function protectDraft(draft,{writing=false}={}) {
    const bound=draft.devicePolicyContext,matched=policyContext?.policy!==undefined&&draft.projectId===policyContext.scope?.projectId&&draft.record?.links?.context?.engagementId===policyContext.scope?.engagementId&&(!bound?.scope||bound.scope.accountId===policyContext.scope.accountId);
    if(writing&&policyContext?.policy!==undefined&&!matched)throw Object.assign(Error("This draft belongs to another device-policy scope. Open the owning mission before saving."),{code:"FIELD_DEVICE_POLICY"});
    const selected=matched?policyContext:bound;
    if(selected?.policy!==undefined){await checkPolicy(selected,draft.record);return {...draft,devicePolicyContext:structuredClone(selected)};}
    if(bound?.policy!==undefined){await checkPolicy(bound,draft.record);return draft;}
    return draft;
  }
  function assertCurrentPolicy() {
    if(policyContext?.policy!==undefined)try{assertFieldDeviceLease(policyContext.policy,policyContext.lease,{scope:policyContext.scope,now,policySha256});}catch(error){key=null;session++;throw error;}
  }
  function requireCrypto() {
    if (!crypto?.subtle || !crypto?.getRandomValues) throw Error("Encrypted device drafts require Web Crypto on a secure connection (HTTPS or localhost).");
  }
  function requireKey() {
    assertCurrentPolicy();
    if (!key) throw Error("Unlock the device draft vault first.");
    return key;
  }
  function requireSession(activeKey, token) {
    assertCurrentPolicy();
    if (!key || key !== activeKey || token !== session) throw Error("The device vault was locked during this operation. Unlock and reopen saved drafts to continue.");
  }
  async function derive(passphrase, salt) {
    const material = await crypto.subtle.importKey("raw", encoder.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({name: "PBKDF2", salt: base64ToBytes(salt), iterations: ITERATIONS, hash: "SHA-256"}, material, {name: "AES-GCM", length: 256}, false, ["encrypt", "decrypt"]);
  }
  async function encrypt(value, activeKey, associated = "esia-field-vault-v1") {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({name: "AES-GCM", iv, additionalData: encoder.encode(associated)}, activeKey, encoder.encode(JSON.stringify(value)));
    return {iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(ciphertext))};
  }
  async function decrypt(value, activeKey, associated = "esia-field-vault-v1") {
    const bytes = await crypto.subtle.decrypt({name: "AES-GCM", iv: base64ToBytes(value.iv), additionalData: encoder.encode(associated)}, activeKey, base64ToBytes(value.ciphertext));
    return JSON.parse(decoder.decode(bytes));
  }
  return {
    async configureDevicePolicy(context) {
      policyContext=context?structuredClone(context):null;policySha256=null;session++;
      try{await checkPolicy(policyContext);policySha256=policyContext?.policy===undefined?null:await fieldDevicePolicySha256(policyContext.policy,{crypto});}
      catch(error){key=null;throw error;}
      return true;
    },
    async isInitialized() {requireCrypto(); return Boolean(await storage.readVault());},
    async unlock(passphrase) {
      requireCrypto();
      const token = ++session;key = null;
      if(policyContext?.policy!==undefined){await checkPolicy(policyContext);policySha256=await fieldDevicePolicySha256(policyContext.policy,{crypto});}else policySha256=null;
      if (typeof passphrase !== "string" || !passphrase || passphrase.length > 1024) throw Error("Enter the vault passphrase (up to 1,024 characters).");
      let vault = await storage.readVault();
      if (!vault) {
        if (passphrase.length < 10) throw Error("Choose a passphrase of at least 10 characters. It cannot be recovered if forgotten.");
        const salt = bytesToBase64(crypto.getRandomValues(new Uint8Array(16)));
        const candidate = await derive(passphrase, salt);
        vault = await storage.createVault({version: 1, salt, iterations: ITERATIONS, verification: await encrypt({purpose: "esia-field-vault-v1"}, candidate)});
      }
      if (vault.version !== 1 || vault.iterations !== ITERATIONS) throw Error("This draft vault version is not supported.");
      const candidate = await derive(passphrase, vault.salt);
      try {
        const verification = await decrypt(vault.verification, candidate);
        if (verification.purpose !== "esia-field-vault-v1") throw Error("Invalid vault.");
      } catch {throw Error("The passphrase did not unlock this vault, or its encrypted verification is damaged. Existing drafts have been retained.");}
      if (token !== session) throw Error("The vault was locked before unlocking finished. Unlock again to continue.");
      key = candidate;
      return true;
    },
    lock() {session++; key = null;},
    isUnlocked: () => {try{assertCurrentPolicy();return Boolean(key);}catch{return false;}},
    async list() {
      const activeKey = requireKey(), token = session;
      const rows = await storage.listRecords();
      requireSession(activeKey, token);
      const records = await Promise.all(rows.map(async row => {
        const draft=await decrypt(row,activeKey,`${row.id}:${row.revision}`);
        try{return await protectDraft(draft);}catch(error){if(error.code!=="FIELD_DEVICE_POLICY")throw error;return {id:row.id,revision:row.revision,record:{captureId:row.id,title:"Policy-locked field record",kind:"note"},history:[],repositoryReceipt:null,devicePolicyLocked:true};}
      }));
      requireSession(activeKey, token);
      return records;
    },
    async get(id) {
      const activeKey = requireKey(), token = session, row = await storage.readRecord(id);
      requireSession(activeKey, token);
      const record = row ? await protectDraft(await decrypt(row, activeKey, `${row.id}:${row.revision}`)) : null;
      requireSession(activeKey, token);
      return record;
    },
    async put(draft) {
      const activeKey = requireKey(), token = session;
      if (!draft?.id || draft.id !== draft.record?.captureId) throw Error("The field draft needs a stable capture identifier.");
      const expectedRevision = draft.revision || 0;
      const saved = {...structuredClone(await protectDraft(draft,{writing:true})), revision: expectedRevision + 1, savedAt: new Date().toISOString()};
      const envelope = {id: saved.id, revision: saved.revision, ...await encrypt(saved, activeKey, `${saved.id}:${saved.revision}`)};
      requireSession(activeKey, token);
      await storage.putRecord(envelope, expectedRevision);
      requireSession(activeKey, token);
      return saved;
    },
    async delete(id, expectedRevision) {requireKey(); return storage.deleteRecord(id, expectedRevision);},
    async close() {session++; key = null; await storage.close?.();}
  };
}
