#!/usr/bin/env node
/**
 * Re-vendor the CycloneDX specification schemas used by the SBOM
 * schema-conformance tests.
 *
 * Usage:
 *   npx tsx scripts/update-cyclonedx-schemas.ts          # refresh current tag
 *   npx tsx scripts/update-cyclonedx-schemas.ts 1.6.1    # pin to a tag
 *   npx tsx scripts/update-cyclonedx-schemas.ts 1.7      # upgrade spec version
 *
 * The script writes four files into `__tests__/sbom/schemas/`:
 *
 *   - `bom-<version>.schema.json`  — main CycloneDX JSON Schema
 *   - `spdx.schema.json`           — SPDX licence-id enum ($ref'd by bom)
 *   - `jsf-0.82.schema.json`       — JSON Signature Format ($ref'd by bom)
 *   - `LICENSE`                    — upstream Apache-2.0 licence text
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
const DEFAULT_TAG = "1.6.1";

/** Major-minor portion of the tag (e.g. `1.6.1` → `1.6`) used in the bom filename. */
const majorMinor = (tag: string): string => {
    const parts = tag.split(".");

    if (parts.length < 2) {
        throw new Error(`Unexpected tag format "${tag}" — expected MAJOR.MINOR or MAJOR.MINOR.PATCH`);
    }

    return `${parts[0]}.${parts[1]}`;
};

const baseUrl = (tag: string): string => `https://raw.githubusercontent.com/CycloneDX/specification/${tag}`;

interface Asset {
    /** Relative filename under `__tests__/sbom/schemas/`. */
    filename: string;
    /** Fully-qualified URL to fetch from. */
    url: string;
}

const buildAssetList = (tag: string): Asset[] => {
    const mm = majorMinor(tag);

    return [
        { filename: `bom-${mm}.schema.json`, url: `${baseUrl(tag)}/schema/bom-${mm}.schema.json` },
        { filename: "spdx.schema.json", url: `${baseUrl(tag)}/schema/spdx.schema.json` },
        { filename: "jsf-0.82.schema.json", url: `${baseUrl(tag)}/schema/jsf-0.82.schema.json` },
        { filename: "LICENSE", url: `${baseUrl(tag)}/LICENSE` },
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
    const tag = process.argv[2] ?? DEFAULT_TAG;

    process.stdout.write(`Fetching CycloneDX spec tag ${tag}…\n`);

    mkdirSync(SCHEMAS_DIR, { recursive: true });

    const assets = buildAssetList(tag);

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
    process.stdout.write("  2. Re-run the sbom test suite: pnpm --filter \"@visulima/vis\" run test\n");
    process.stdout.write("  3. Adjust src/sbom/types.ts if the spec changed enums or added fields\n");
};

main().catch((error: unknown) => {
    process.stderr.write(`${(error as Error).message}\n`);
    process.exit(1);
});
