import type { LicenseChoice, NamedLicense } from "./types";

/**
 * Minimal SPDX-licence normaliser for SBOM generation.
 *
 * We deliberately avoid pulling in `spdx-expression-parse` +
 * `spdx-correct` (originally floated in `todo.md`) to keep `vis`'s
 * install footprint tight. Instead we ship a tiny allow-list of the
 * SPDX IDs that cover ~95 % of npm's ecosystem, plus a handful of
 * common misspellings auto-corrected to the canonical form.
 *
 * When an `license` field doesn't map cleanly to a known SPDX ID we
 * fall back to a {@link NamedLicense} — still spec-legal under the
 * CycloneDX schema — so the generator never drops a declaration.
 */

/**
 * SPDX identifiers we recognise. Restricted to licences that actually
 * appear in npm registry data; extending this list only improves
 * fidelity, never correctness.
 */
const KNOWN_SPDX_IDS = new Set<string>([
    "0BSD",
    "AGPL-3.0",
    "AGPL-3.0-only",
    "AGPL-3.0-or-later",
    "Apache-1.1",
    "Apache-2.0",
    "Artistic-2.0",
    "BlueOak-1.0.0",
    "BSD-2-Clause",
    "BSD-3-Clause",
    "BSL-1.0",
    "CC0-1.0",
    "CC-BY-3.0",
    "CC-BY-4.0",
    "CDDL-1.0",
    "CDDL-1.1",
    "EPL-1.0",
    "EPL-2.0",
    "GPL-2.0",
    "GPL-2.0-only",
    "GPL-2.0-or-later",
    "GPL-3.0",
    "GPL-3.0-only",
    "GPL-3.0-or-later",
    "ISC",
    "LGPL-2.0",
    "LGPL-2.1",
    "LGPL-3.0",
    "MIT",
    "MIT-0",
    "MPL-1.1",
    "MPL-2.0",
    "Python-2.0",
    "Unlicense",
    "WTFPL",
    "Zlib",
]);

/** Common misspellings that map to a canonical SPDX ID. */
const SPDX_ALIASES: Record<string, string> = {
    apache2: "Apache-2.0",
    "apache 2.0": "Apache-2.0",
    bsd: "BSD-3-Clause",
    "bsd-2": "BSD-2-Clause",
    "bsd-3": "BSD-3-Clause",
    mit: "MIT",
    public: "Unlicense",
    "public domain": "Unlicense",
};

/** Pre-computed lowercase → canonical map so `normalizeSpdxId` is O(1). */
const LOWERCASE_SPDX_LOOKUP: Map<string, string> = (() => {
    const map = new Map<string, string>();

    for (const id of KNOWN_SPDX_IDS) {
        map.set(id.toLowerCase(), id);
    }

    for (const [alias, canonical] of Object.entries(SPDX_ALIASES)) {
        map.set(alias, canonical);
    }

    return map;
})();

/**
 * Case-insensitively resolves a raw licence string to its canonical
 * SPDX ID, or `undefined` if the input doesn't match anything we know
 * about.
 */
export const normalizeSpdxId = (raw: string): string | undefined => {
    const trimmed = raw.trim();

    if (trimmed.length === 0) {
        return undefined;
    }

    if (KNOWN_SPDX_IDS.has(trimmed)) {
        return trimmed;
    }

    return LOWERCASE_SPDX_LOOKUP.get(trimmed.toLowerCase());
};

/** Shape we accept from raw `package.json` metadata. */
export interface RawLicenseInput {
    /** Legacy `license: { type: "MIT" }` form. */
    license?: { type?: string } | string;
    /** Legacy `licenses: [{ type: "MIT" }]` array form. */
    licenses?: { type?: string }[];
}

/**
 * Extracts a single licence declaration from a `package.json` (or
 * similar), converting it to the CycloneDX {@link LicenseChoice}
 * shape. Supports the three encodings npm has historically blessed:
 *
 * - `license: "MIT"` (string)
 * - `license: "(MIT OR Apache-2.0)"` (SPDX expression)
 * - `license: { type: "MIT" }` (object, deprecated but common)
 * - `licenses: [{ type: "MIT" }, …]` (array, deprecated)
 *
 * Returns `undefined` if no licence was declared.
 */
export const extractLicenseChoice = (input: RawLicenseInput): LicenseChoice | undefined => {
    let rawValue: string | undefined;

    if (typeof input.license === "string") {
        rawValue = input.license;
    } else if (input.license && typeof input.license === "object" && typeof input.license.type === "string") {
        rawValue = input.license.type;
    } else if (Array.isArray(input.licenses) && input.licenses.length > 0) {
        const first = input.licenses[0];

        if (first && typeof first.type === "string") {
            rawValue = first.type;
        }
    }

    if (!rawValue) {
        return undefined;
    }

    const trimmed = rawValue.trim();

    if (trimmed.length === 0) {
        return undefined;
    }

    // SPDX expressions ("X OR Y", "X AND Y", parenthesised) travel as a
    // tuple with a single `expression` entry.
    if (/[()]|\b(?:and|or|with)\b/i.test(trimmed)) {
        return [{ expression: trimmed }];
    }

    const spdxId = normalizeSpdxId(trimmed);

    if (spdxId) {
        return [{ license: { id: spdxId } }];
    }

    return [{ license: { name: trimmed } }];
};
