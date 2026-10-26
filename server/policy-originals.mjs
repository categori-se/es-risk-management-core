// Explicit local reads of installed policy originals. No source URL is fetched.
import {open, lstat} from "node:fs/promises";
import {constants} from "node:fs";
import {join} from "node:path";
import {createHash} from "node:crypto";
import {getFramework} from "../src/lib/framework-register.js";

const fail = (message, status = 400) => {throw Object.assign(Error(message), {status});};
export const policyOriginalLimits = Object.freeze({manifestBytes: 64 * 1024 * 1024, originalBytes: 64 * 1024 * 1024});
async function regularBytes(path, limit) {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.nlink !== 1) fail("Policy originals and manifests must be unlinked regular files.", 409);
    if (stat.size < 1 || stat.size > limit) fail("The installed policy source exceeds the bounded reader limit.", 413);
    const buffer = Buffer.alloc(stat.size + 1);let offset = 0;
    while (offset < buffer.length) {
      const {bytesRead} = await handle.read(buffer, offset, buffer.length - offset, offset);
      if (!bytesRead) break;offset += bytesRead;
    }
    if (offset !== stat.size || (await handle.stat()).size !== stat.size) fail("The policy source changed during inspection.", 409);
    return buffer.subarray(0, offset);
  } finally {await handle.close();}
}

export async function readLocalPolicyOriginal({directory, frameworkId, sha256}) {
  const framework = getFramework(frameworkId);
  if (!framework || !/^[a-f0-9]{64}$/.test(sha256)) fail("Select a known framework edition and exact policy SHA256.", 404);
  try {
    for (const path of [directory, join(directory, "sources")]) {
      const stat = await lstat(path);
      if (!stat.isDirectory() || stat.isSymbolicLink()) fail("Policy library directories cannot use linked aliases.", 409);
    }
    const pack = JSON.parse((await regularBytes(join(directory, `${frameworkId}.json`), policyOriginalLimits.manifestBytes)).toString("utf8"));
    if (!pack || typeof pack !== "object" || Array.isArray(pack) || pack.frameworkId !== frameworkId || pack.edition !== framework.edition || pack.schemaVersion !== 1 || !Array.isArray(pack.sources) || pack.sources.length > 100 || pack.sources.some(source => !source || typeof source !== "object" || !/^[a-f0-9]{64}$/.test(source.sha256))) fail("The installed policy manifest does not match the selected edition.", 409);
    const source = pack.sources.find(item => item.sha256 === sha256);
    if (!source) fail("This exact policy hash is not listed in the installed edition manifest. Restore its matching policy library deliberately.", 404);
    const bytes = await regularBytes(join(directory, "sources", `${sha256}.pdf`), policyOriginalLimits.originalBytes);
    if (createHash("sha256").update(bytes).digest("hex") !== sha256) fail("The retained policy original failed SHA256 verification.", 409);
    if (bytes.subarray(0, 5).toString() !== "%PDF-") fail("The retained policy source is not a PDF original.", 409);
    return {bytes, version: {id: `policy:${frameworkId}:${sha256}`, sha256, size: bytes.length, filename: `${frameworkId}-${sha256.slice(0, 12)}.pdf`, mediaType: "application/pdf"},
      policy: {frameworkId, edition: pack.edition, title: String(source.title || framework.name).slice(0, 4000), rights: String(source.rights || "Source retention does not establish redistribution rights.").slice(0, 4000)}};
  } catch (error) {
    if (error.code === "ENOENT") fail("The exact policy original or its manifest is not installed. Restore the policy-library folder; no replacement was fetched.", 404);
    if (error.code === "ELOOP") fail("Policy sources cannot use linked file aliases.", 409);
    if (error instanceof SyntaxError) fail("The installed policy manifest is not valid JSON.", 409);
    throw error;
  }
}
