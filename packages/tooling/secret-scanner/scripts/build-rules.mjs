import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { readFileSync, writeFileSync } from "@visulima/fs";
import { dirname, resolve } from "@visulima/path";
import { parse as parseTOML } from "smol-toml";

const here = dirname(fileURLToPath(import.meta.url));
const assetsDir = resolve(here, "..", "assets");

// Convert a single TOML ruleset to JSON alongside it.
const convert = (tomlPath, jsonPath) => {
    const parsed = parseTOML(readFileSync(tomlPath));

    writeFileSync(jsonPath, `${JSON.stringify(parsed, undefined, 2)}\n`);

    const ruleCount = Array.isArray(parsed?.rules) ? parsed.rules.length : 0;

    // eslint-disable-next-line no-console -- build-time progress output
    console.log(`secret-scanner: wrote ${jsonPath} (${ruleCount} rules)`);
};

// Bundled gitleaks ruleset — the runtime's default config source.
convert(resolve(assetsDir, "gitleaks.toml"), resolve(assetsDir, "gitleaks.json"));

// Named presets (e.g. `weak-passwords`) live under assets/presets/*.toml and get the
// same treatment so the runtime only ever reads JSON.
const presetsDir = resolve(assetsDir, "presets");

for (const entry of readdirSync(presetsDir)) {
    if (!entry.endsWith(".toml")) {
        continue;
    }

    const name = entry.replace(/\.toml$/, "");

    convert(resolve(presetsDir, entry), resolve(presetsDir, `${name}.json`));
}
