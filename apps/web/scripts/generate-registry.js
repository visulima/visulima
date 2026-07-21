#!/usr/bin/env node
// Builds the @visulima/tui-kit shadcn registry from source and bundles every
// item into the web app so the `/r/$name` route can serve it at:
//
//   https://visulima.com/r/<name>.json      (a component / lib item)
//   https://visulima.com/r/registry.json    (the index)
//
// The registry build reads tui-kit's *source* (not its dist), so this works in a
// fresh checkout without tui-kit having been built first. registryDependency
// URLs default to the production host, which is exactly what a published item
// needs.
//
// Run before `vite build` / `vite dev` so the served registry always matches the
// component source on the branch being deployed.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(dirname, "..", "..", "..");
const TUI_KIT = path.join(ROOT, "packages", "terminal", "tui-kit");
const REGISTRY_DIR = path.join(TUI_KIT, "dist", "r");
const OUT = path.join(dirname, "..", "src", "data", "registry-data.json");

// Regenerate the registry payloads from tui-kit source (idempotent).
execFileSync("node", [path.join(TUI_KIT, "scripts", "build-registry.mjs")], { stdio: "inherit" });

if (!existsSync(REGISTRY_DIR)) {
    console.error(`Registry build produced no output at ${REGISTRY_DIR}`);
    process.exit(1);
}

const items = {};
let index;

for (const file of readdirSync(REGISTRY_DIR)) {
    if (!file.endsWith(".json")) {
        continue;
    }

    const content = JSON.parse(readFileSync(path.join(REGISTRY_DIR, file), "utf8"));
    const name = file.replace(/\.json$/, "");

    if (name === "registry") {
        index = content;
    } else {
        items[name] = content;
    }
}

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify({ index: index ?? null, items })}\n`);

console.log(`Bundled ${Object.keys(items).length} registry items -> ${path.relative(ROOT, OUT)}`);
