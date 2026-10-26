import {execFileSync} from "node:child_process";
import {mkdtempSync, writeFileSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";

/** Poppler tools seek reliably in a bounded private file. Some devices stall
 * when a large PDF is written through a synchronous subprocess stdin pipe. */
export function runPdfTool(command, args, options, {execute = execFileSync, temporaryRoot = tmpdir()} = {}) {
  const {maxInputBytes = 16 * 1024 * 1024, ...boundedOptions} = options;
  if (!Number.isSafeInteger(maxInputBytes) || maxInputBytes < 1 || maxInputBytes > 64 * 1024 * 1024 ||
      !["pdfinfo", "pdftoppm"].includes(command) || args.at(-1) !== "-" || !(options.input instanceof Uint8Array) || options.input.length > maxInputBytes) {
    throw new TypeError("A bounded PDF operation is required.");
  }
  const directory = mkdtempSync(join(temporaryRoot, "esia-pdf-"));
  try {
    const path = join(directory, "source.pdf");
    writeFileSync(path, options.input, {mode: 0o600, flag: "wx"});
    const {input, ...execution} = boundedOptions;
    return execute(command, [...args.slice(0, -1), path], {...execution, stdio: ["ignore", "pipe", "pipe"]});
  } finally {rmSync(directory, {recursive: true, force: true});}
}
