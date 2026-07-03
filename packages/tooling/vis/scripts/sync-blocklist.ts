#!/usr/bin/env node
/**
 * Discover new typosquats on npm and add them to data/typosquats.json.
 *
 * Reads both data/typosquats.json (auto-generated, written by this script) and
 * data/typosquats-manual.json (hand-curated). Manual entries are treated as
 * already-known so they are never re-discovered or duplicated. Only the auto
 * file is written.
 *
 * Usage:
 *   npx tsx scripts/sync-blocklist.ts              # all packages in JSON
 *   npx tsx scripts/sync-blocklist.ts react vue     # specific packages
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { generateVariants } from "../src/typosquats";
import type { Blocklist } from "../src/typosquats";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = resolve(__dirname, "../data/typosquats.json");
const MANUAL_FILE = resolve(__dirname, "../data/typosquats-manual.json");
const CONCURRENCY = 20;
const REQUEST_TIMEOUT_MS = 10_000;

const readBlocklist = (path: string, { optional = false }: { optional?: boolean } = {}): Blocklist => {
    try {
        return JSON.parse(readFileSync(path, "utf8")) as Blocklist;
    } catch (error) {
        if (optional && (error as NodeJS.ErrnoException).code === "ENOENT") {
            return {};
        }

        throw new Error(`Failed to read blocklist from ${path}: ${error instanceof Error ? error.message : String(error)}`);
    }
};

const writeBlocklist = (data: Blocklist): void => {
    const sorted: Blocklist = {};

    for (const key of Object.keys(data).sort()) {
        sorted[key] = [...new Set(data[key])].sort();
    }

    writeFileSync(DATA_FILE, JSON.stringify(sorted, null, 2) + "\n");
};

const packageExists = async (name: string): Promise<boolean> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const url = `https://registry.npmjs.org/${encodeURIComponent(name).replace("%40", "@")}`;

        return (await fetch(url, { method: "HEAD", signal: controller.signal })).ok;
    } catch {
        return false;
    } finally {
        clearTimeout(timeout);
    }
};

const pooled = async <T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> => {
    const results: R[] = [];
    let idx = 0;

    const worker = async (): Promise<void> => {
        while (idx < items.length) {
            const i = idx++;

            results[i] = await fn(items[i]);
        }
    };

    await Promise.all(Array.from({ length: concurrency }, () => worker()));

    return results;
};

const packages = process.argv.slice(2);
const data = readBlocklist(DATA_FILE);
const manual = readBlocklist(MANUAL_FILE, { optional: true });
const targets = packages.length > 0 ? packages : [...new Set([...Object.keys(data), ...Object.keys(manual)])];
const allKnown = new Set([...Object.values(data).flat(), ...Object.values(manual).flat()]);

console.log(`\n  Generating typosquat variants for ${String(targets.length)} packages...\n`);

// Deduplicate candidates across all target packages
const seen = new Set<string>();
const candidates: { original: string; variant: string }[] = [];

for (const pkg of targets) {
    for (const v of generateVariants(pkg)) {
        if (allKnown.has(v) || targets.includes(v) || seen.has(v)) {
            continue;
        }

        seen.add(v);
        candidates.push({ original: pkg, variant: v });
    }
}

console.log(`  ${String(candidates.length)} new variants to check on npm\n`);

let checked = 0;
const results = await pooled(candidates, CONCURRENCY, async (item) => {
    const exists = await packageExists(item.variant);

    checked++;

    if (checked % 100 === 0) {
        process.stdout.write(`  Checked ${String(checked)}/${String(candidates.length)}\r`);
    }

    return { ...item, exists };
});

const found = results.filter((r) => r.exists);

console.log(`\n  Found ${String(found.length)} new typosquat candidates that exist on npm\n`);

if (found.length === 0) {
    console.log("  Nothing new to add.\n");
    process.exit(0);
}

for (const { original, variant } of found) {
    if (!data[original]) {
        data[original] = [];
    }

    data[original].push(variant);
    console.log(`    + ${variant}  (typosquat of ${original})`);
}

writeBlocklist(data);
console.log(`\n  Updated data/typosquats.json (${String(Object.values(data).flat().length)} total entries)\n`);
