// Copy the freshly-built `vis` CLI binary out of the Cargo workspace target dir
// into the package root as `vis-native-cli[.exe]`, where the launcher
// (`bin/vis.mjs`) looks for a local dev build. Cross-platform; used by the
// `build:native:cli[:debug]` scripts. CI ships the per-target binary inside the
// `@visulima/vis-binding-<target>` packages instead — this is dev-only.

import { copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const profile = process.argv[2] === "debug" ? "debug" : "release";
const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const exe = process.platform === "win32" ? ".exe" : "";

const source = join(packageRoot, "native", "target", profile, `vis${exe}`);
const destination = join(packageRoot, `vis-native-cli${exe}`);

if (!existsSync(source)) {
    console.error(`copy-cli-binary: built binary not found at ${source}`);
    process.exit(1);
}

copyFileSync(source, destination);
console.log(`copy-cli-binary: ${source} -> ${destination}`);
