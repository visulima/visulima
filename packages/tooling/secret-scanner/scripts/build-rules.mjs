/**
 * Pre-build step: converts the vendored `assets/gitleaks.toml` to
 * `assets/gitleaks.json`. The scanner reads the JSON at runtime — the TOML
 * file is the source of truth we resync from upstream gitleaks but is never
 * parsed at runtime, so we don't ship a TOML parser in the Node dependency
 * graph. Run by `pnpm run build:native` and `pnpm run build`.
 */
import { fileURLToPath } from "node:url";

import { readFileSync, writeFileSync } from "@visulima/fs";
import { dirname, resolve } from "@visulima/path";
import { parse as parseTOML } from "smol-toml";

const here = dirname(fileURLToPath(import.meta.url));
const tomlPath = resolve(here, "..", "assets", "gitleaks.toml");
const jsonPath = resolve(here, "..", "assets", "gitleaks.json");

const toml = readFileSync(tomlPath);
const parsed = parseTOML(toml);

writeFileSync(jsonPath, `${JSON.stringify(parsed, undefined, 2)}\n`);

const ruleCount = Array.isArray(parsed?.rules) ? parsed.rules.length : 0;

// eslint-disable-next-line no-console -- build-time progress output
console.log(`secret-scanner: wrote ${jsonPath} (${ruleCount} rules)`);
