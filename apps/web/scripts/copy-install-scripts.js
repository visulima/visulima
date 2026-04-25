#!/usr/bin/env node
// Copies the vis install scripts into `apps/web/public/` so Netlify serves
// them directly at:
//
//   https://visulima.com/install.sh
//   https://visulima.com/install.ps1
//   https://visulima.com/install.sh.sha256   ← SHA256 sidecar
//   https://visulima.com/install.ps1.sha256
//
// We also stamp the @visulima/vis package version into a comment header
// at the top of each script so users can tell at a glance which release
// they're running. The body itself is untouched, so the SHA256 hash
// changes only when the script content (or the version) changes.
//
// Run before `vite build` / `vite dev` so the files are always in sync
// with whatever is on the branch being deployed. That way a bad commit
// doesn't silently break every new user's bootstrap — the install script
// is versioned atomically with the rest of the site.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const ROOT = path.resolve(dirname, "..", "..", "..");
const SOURCE = path.join(ROOT, "packages", "tooling", "vis", "scripts");
const DESTINATION = path.join(dirname, "..", "public");
const VIS_PACKAGE_JSON = path.join(ROOT, "packages", "tooling", "vis", "package.json");

const SCRIPTS = ["install.sh", "install.ps1"];

if (!existsSync(DESTINATION)) {
    mkdirSync(DESTINATION, { recursive: true });
}

const missing = SCRIPTS.filter((script) => !existsSync(path.join(SOURCE, script)));

if (missing.length > 0) {
    // Fail hard: a missing install script means visulima.com/<script>
    // 404s silently. Better to break the build than to ship a broken
    // cold-start flow.
    console.error(`[copy-install-scripts] Missing source file(s): ${missing.join(", ")}`);
    console.error(`[copy-install-scripts]   expected under ${SOURCE}`);
    process.exit(1);
}

let visVersion = "0.0.0";

try {
    visVersion = JSON.parse(readFileSync(VIS_PACKAGE_JSON, "utf8")).version;
} catch (cause) {
    console.warn(`[copy-install-scripts] Could not read vis package version: ${cause.message}`);
}

const stampedAt = new Date().toISOString();

/**
 * Inserts (or replaces) a one-line version banner near the top of the
 * script. We insert after the shebang / `<#` block comment so the
 * existing flow isn't disturbed.
 */
const stampVersion = (script, body) => {
    const banner = `# vis-install ${visVersion} (built ${stampedAt})`;
    const psBanner = `# vis-install ${visVersion} (built ${stampedAt})`;

    if (script === "install.sh") {
        // Strip any prior banner before re-stamping.
        const stripped = body.replace(/^# vis-install [^\n]*\n/m, "");
        // Insert right after the shebang.
        return stripped.replace(/^(#![^\n]*\n)/, `$1${banner}\n`);
    }

    if (script === "install.ps1") {
        // PowerShell uses `<# ... #>` block comments at the top.
        // Insert the banner right after that block.
        const stripped = body.replace(/^# vis-install [^\n]*\n/m, "");

        return stripped.replace(/(#>\s*\n)/, `$1${psBanner}\n`);
    }

    return body;
};

for (const script of SCRIPTS) {
    const source = path.join(SOURCE, script);
    const destination = path.join(DESTINATION, script);
    const body = readFileSync(source, "utf8");
    const stamped = stampVersion(script, body);

    writeFileSync(destination, stamped);

    // Publish a SHA256 alongside the script so users who want to verify
    // can run e.g. `curl ... | sha256sum -c expected.txt`. The sidecar
    // body matches `sha256sum`'s plain format: `<hex>  <filename>`.
    const hash = createHash("sha256").update(stamped).digest("hex");

    writeFileSync(`${destination}.sha256`, `${hash}  ${script}\n`);

    console.log(`[copy-install-scripts] ${script} → public/${script}  (sha256: ${hash.slice(0, 12)}…, vis ${visVersion})`);
}
