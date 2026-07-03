#!/usr/bin/env node
/**
 * Re-vendor the CycloneDX specification schemas used by the SBOM
 * schema-conformance tests.
 *
 * Usage:
 *   npx tsx scripts/update-cyclonedx-schemas.ts          # refresh current tag
 *   npx tsx scripts/update-cyclonedx-schemas.ts 1.7      # pin to a tag
 *   npx tsx scripts/update-cyclonedx-schemas.ts 1.8      # upgrade spec version
 *
 * The script writes five files into `__tests__/sbom/schemas/`:
 *
 *   - `bom-<version>.schema.json`         — main CycloneDX JSON Schema
 *   - `spdx.schema.json`                  — SPDX licence-id enum ($ref'd by bom)
 *   - `jsf-0.82.schema.json`              — JSON Signature Format ($ref'd by bom)
 *   - `cryptography-defs.schema.json`     — CBOM algorithm families ($ref'd by bom; 1.7+)
 *   - `LICENSE`                           — upstream Apache-2.0 licence text
 *
 * The upstream CycloneDX specification is published by OWASP under the
 * Apache-2.0 licence. Vendoring the LICENSE file alongside the schemas
 * satisfies the "redistribute with the licence" clause (§4.1).
 *
 * After running, also update:
 *   - `__tests__/sbom/schemas/README.md` (Tag + Direct URLs section)
 *   - `__tests__/sbom/validator.ts` (bomSchema import path, if filename
 *      changed due to a major version bump)
 *   - `src/sbom/types.ts` (type shapes, if the spec changed enums)
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMAS_DIR = resolve(__dirname, "../__tests__/sbom/schemas");

/** Default CycloneDX spec tag when no argument is provided. */
const DEFAULT_TAG = "1.7";

/** Accepts `MAJOR.MINOR` or `MAJOR.MINOR.PATCH`, each component a non-empty run of digits. */
const TAG_PATTERN = /^(\d+)\.(\d+)(?:\.\d+)?$/;

/**
 * Parses a tag string and returns the `MAJOR.MINOR` portion used in the bom
 * schema filename. Throws a clear error if the tag doesn't match the
 * expected numeric pattern — keeps user-supplied tags from flowing into
 * filesystem paths or URL construction without validation.
 */
const majorMinor = (tag: string): string => {
    const match = TAG_PATTERN.exec(tag);

    if (!match) {
        throw new Error(`Invalid tag "${tag}" — expected MAJOR.MINOR or MAJOR.MINOR.PATCH with numeric components (e.g. 1.7 or 1.7.1)`);
    }

    return `${match[1]}.${match[2]}`;
};

/**
 * Resolves the spec tag from `process.argv`, accepting either a bare
 * positional argument or a `--tag <value>` / `--tag=<value>` flag. Unknown
 * flags are rejected with a usage hint. The returned `mm` (`MAJOR.MINOR`)
 * is validated here so downstream URL/filename construction is safe.
 */
const parseTagArg = (argv: readonly string[]): { mm: string; tag: string } => {
    let tag: string | undefined;

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index]!;

        if (arg === "--tag") {
            const next = argv[index + 1];

            if (next === undefined || next.startsWith("--")) {
                throw new Error('Flag "--tag" requires a value. Usage: update-cyclonedx-schemas [--tag <value> | <tag>]');
            }

            tag = next;
            index += 1;
        } else if (arg.startsWith("--tag=")) {
            const value = arg.slice("--tag=".length);

            if (value === "") {
                throw new Error('Flag "--tag=" requires a value. Usage: update-cyclonedx-schemas [--tag <value> | <tag>]');
            }

            tag = value;
        } else if (arg.startsWith("--")) {
            throw new Error(`Unknown flag "${arg}". Usage: update-cyclonedx-schemas [--tag <value> | <tag>]`);
        } else if (tag === undefined) {
            tag = arg;
        } else {
            throw new Error(`Unexpected extra argument "${arg}". Usage: update-cyclonedx-schemas [--tag <value> | <tag>]`);
        }
    }

    const resolved = tag ?? DEFAULT_TAG;

    return { mm: majorMinor(resolved), tag: resolved };
};

interface Asset {
    /** Relative filename under `__tests__/sbom/schemas/`. */
    filename: string;
    /** Fully-qualified URL to fetch from. */
    url: string;
}

const buildAssetList = (tag: string, mm: string): Asset[] => {
    const base = `https://raw.githubusercontent.com/CycloneDX/specification/${tag}`;

    return [
        { filename: `bom-${mm}.schema.json`, url: `${base}/schema/bom-${mm}.schema.json` },
        { filename: "spdx.schema.json", url: `${base}/schema/spdx.schema.json` },
        { filename: "jsf-0.82.schema.json", url: `${base}/schema/jsf-0.82.schema.json` },
        { filename: "cryptography-defs.schema.json", url: `${base}/schema/cryptography-defs.schema.json` },
        { filename: "LICENSE", url: `${base}/LICENSE` },
    ];
};

const download = async (url: string): Promise<string> => {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`GET ${url} → ${response.status} ${response.statusText}`);
    }

    return response.text();
};

const validateJson = (filename: string, body: string): void => {
    if (!filename.endsWith(".json")) {
        return;
    }

    try {
        JSON.parse(body);
    } catch (error) {
        throw new Error(`Downloaded ${filename} is not valid JSON: ${(error as Error).message}`);
    }
};

const main = async (): Promise<void> => {
    const { mm, tag } = parseTagArg(process.argv.slice(2));

    process.stdout.write(`Fetching CycloneDX spec tag ${tag}…\n`);

    mkdirSync(SCHEMAS_DIR, { recursive: true });

    const assets = buildAssetList(tag, mm);

    for (const { filename, url } of assets) {
        process.stdout.write(`  ${filename}  ← ${url}\n`);

        // eslint-disable-next-line no-await-in-loop -- sequential writes keep stdout readable; asset count is small
        const body = await download(url);

        validateJson(filename, body);
        writeFileSync(resolve(SCHEMAS_DIR, filename), body);
    }

    process.stdout.write(`\nDone. ${assets.length} files written to ${SCHEMAS_DIR}\n`);
    process.stdout.write("\nNext steps:\n");
    process.stdout.write("  1. Update the tag + Direct URLs in __tests__/sbom/schemas/README.md\n");
    process.stdout.write('  2. Re-run the sbom test suite: pnpm --filter "@visulima/vis" run test\n');
    process.stdout.write("  3. Adjust src/sbom/types.ts if the spec changed enums or added fields\n");
};

main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);

    process.stderr.write(`${message}\n`);
    process.exit(1);
});
