import {realpathSync} from "node:fs";
import {dirname, basename, resolve, join, sep} from "node:path";
import {fileURLToPath} from "node:url";
const applicationRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
function physical(path) {
  try {return realpathSync(path);} catch (error) {const parent = dirname(path);if (error.code !== "ENOENT" || parent === path) throw error;return join(physical(parent), basename(path));}
}
export function privateStorageDirectory(value) {
  const directory = physical(resolve(value));
  for (const root of [join(applicationRoot, "src"), join(applicationRoot, "dist")]) {
    const boundary = physical(root);
    if (directory === boundary || directory.startsWith(boundary + sep)) throw Object.assign(new Error("Keep live research and project stores outside Framework source and build output."), {status: 400});
  }
  return directory;
}
