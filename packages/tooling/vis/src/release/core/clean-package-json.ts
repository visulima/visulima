/**
 * Strip non-publishable fields from `package.json` before tarball pack.
 * Default behaviour matches `@anolilab/semantic-release-clean-package-json`
 * (RFC §20.4). Configurable via `release.publish.cleanPackageJson` —
 * `false` ships unmodified.
 *
 * Pure function. Returns a NEW manifest; never mutates the input.
 */

import { resolveCleanStripList } from "../config";
import type { CleanPackageJsonConfig, PackageManifest } from "../types";

/**
 * Produce a publishable copy of a `package.json`.
 * @param manifest — the source `package.json` contents (un-mutated)
 * @param cfg — strip/keep config; `false` ships untouched, `true`/undefined uses defaults
 */
export const cleanPackageJsonForPublish = (
    manifest: PackageManifest,
    cfg?: boolean | CleanPackageJsonConfig,
): PackageManifest => {
    if (cfg === false) {
        return { ...manifest };
    }

    const stripList = new Set(resolveCleanStripList(cfg));
    const out: PackageManifest = { name: manifest.name, version: manifest.version };

    for (const [key, value] of Object.entries(manifest)) {
        if (stripList.has(key)) {
            continue;
        }

        out[key] = value;
    }

    return out;
};
