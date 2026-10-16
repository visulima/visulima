#!/usr/bin/env node
// Copies the vis install scripts from visulima/vis into `apps/web/public/` so Netlify serves
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
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);
const DESTINATION = path.join(dirname, "..", "public");

// The install scripts live in the visulima/vis repository, next to the package they
// install. Fetch them from a pinned ref so a deploy always gets a known revision.
const VIS_REPO = "visulima/vis";
const VIS_REF = process.env.VIS_REF || "main";
const VIS_PACKAGE_DIR = "packages/tooling/vis";
const rawUrl = (file) => `https://raw.githubusercontent.com/${VIS_REPO}/${VIS_REF}/${VIS_PACKAGE_DIR}/${file}`;

const fetchText = async (file) => {
    const response = await fetch(rawUrl(file));

    if (!response.ok) {
        throw new Error(`[copy-install-scripts] ${file} from ${VIS_REPO}@${VIS_REF}: HTTP ${response.status}`);
    }

    return response.text();
};

if (!existsSync(DESTINATION)) {
    mkdirSync(DESTINATION, { recursive: true });
}

const SCRIPTS = ["install.sh", "install.ps1"];

let visVersion;

try {
    visVersion = JSON.parse(await fetchText("package.json")).version;
} catch (cause) {
    // Use String(cause) so non-Error throwables (string, plain object,
    // …) still print readable output instead of "undefined".
    console.warn(`[copy-install-scripts] Could not read vis package version: ${String(cause)}`);
}

if (!visVersion) {
    visVersion = "unknown";
}

// Banner is content-stable — no `Date.now()` in here. If the banner
// included a per-build timestamp, every deploy would change the SHA256
// and break users who pinned to a known-good hash. Bump visVersion
// (i.e., release a new vis) to invalidate the cache.
const banner = `# vis-install ${visVersion}`;

/**
 * Inserts (or replaces) a one-line version banner near the top of the
 * script. We insert after the shebang / `<#` block comment so the
 * existing flow isn't disturbed. Returns `undefined` when the body
 * has no recognisable insertion anchor — caller treats that as a
 * build-breaking error so we don't silently ship an unstamped script.
 */
const stampVersion = (script, body) => {
    // Strip any prior banner before re-stamping (idempotent re-runs).
    const stripped = body.replace(/^# vis-install [^\n]*\n/m, "");

    if (script === "install.sh") {
        // Insert right after the shebang.
        const result = stripped.replace(/^(#![^\n]*\n)/, `$1${banner}\n`);

        return result.includes(banner) ? result : undefined;
    }

    if (script === "install.ps1") {
        // PowerShell uses `<# ... #>` block comments at the top —
        // insert the banner right after that block.
        const result = stripped.replace(/(#>\s*\n)/, `$1${banner}\n`);

        return result.includes(banner) ? result : undefined;
    }

    return undefined;
};

for (const script of SCRIPTS) {
    const destination = path.join(DESTINATION, script);
    const body = await fetchText(`scripts/${script}`);
    const stamped = stampVersion(script, body);

    if (!stamped) {
        // No shebang / `<# ... #>` block comment to anchor the banner
        // — bail rather than ship a script without the version stamp.
        console.error(`[copy-install-scripts] Could not stamp version banner into ${script}.`);
        console.error(`[copy-install-scripts]   expected a shebang (install.sh) or '<# ... #>' block (install.ps1) near the top.`);
        process.exit(1);
    }

    writeFileSync(destination, stamped);

    // Publish a SHA256 alongside the script so users who want to verify
    // can run e.g. `curl ... | sha256sum -c expected.txt`. The sidecar
    // body matches `sha256sum`'s plain format: `<hex>  <filename>`.
    const hash = createHash("sha256").update(stamped).digest("hex");

    writeFileSync(`${destination}.sha256`, `${hash}  ${script}\n`);

    console.log(`[copy-install-scripts] ${script} → public/${script}  (sha256: ${hash.slice(0, 12)}..., vis ${visVersion})`);
}
