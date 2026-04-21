#!/usr/bin/env node
// Copies the vis install scripts into `apps/web/public/` so Netlify serves
// them directly at:
//
//   https://visulima.dev/install.sh
//   https://visulima.dev/install.ps1
//
// Run before `vite build` / `vite dev` so the files are always in sync
// with whatever is on the branch being deployed. That way a bad commit
// doesn't silently break every new user's bootstrap — the install script
// is versioned atomically with the rest of the site.

import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const ROOT = path.resolve(dirname, "..", "..", "..");
const SOURCE = path.join(ROOT, "packages", "tooling", "vis", "scripts");
const DESTINATION = path.join(dirname, "..", "public");

const SCRIPTS = ["install.sh", "install.ps1"];

if (!existsSync(DESTINATION)) {
    mkdirSync(DESTINATION, { recursive: true });
}

for (const script of SCRIPTS) {
    const source = path.join(SOURCE, script);
    const destination = path.join(DESTINATION, script);

    if (!existsSync(source)) {
        console.warn(`[copy-install-scripts] Skipping ${script} — not found at ${source}`);
        continue;
    }

    copyFileSync(source, destination);
    console.log(`[copy-install-scripts] ${script} → public/${script}`);
}
