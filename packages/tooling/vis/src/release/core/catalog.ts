/**
 * Parse pnpm-workspace.yaml catalogs and rewrite `catalog:` refs in
 * package.json dependency blocks (RFC §11.2).
 *
 * Used by the publish pipeline when `protocolResolution === "in-place"`
 * or when the active pack manager isn't pnpm (since only `pnpm pack`
 * understands `catalog:` natively — npm/yarn/bun produce broken tarballs
 * if the rewrite isn't done up-front).
 *
 * Pure functions. fs reads happen in the caller; this module receives
 * already-parsed YAML content.
 */

import { parse as parseYaml } from "yaml";

import { VisReleaseError } from "../errors";
import type { DependencyKind, PackageManifest } from "../types";

const DEPENDENCY_KINDS: ReadonlyArray<DependencyKind> = [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
];

/**
 * Parsed `pnpm-workspace.yaml` catalogs.
 *   - `default` is the top-level `catalog:` block (referenced as `catalog:` in deps).
 *   - `named` is the `catalogs:` map (referenced as `catalog:&lt;name&gt;`).
 */
export interface Catalogs {
    default: Record<string, string>;
    named: Record<string, Record<string, string>>;
}

const EMPTY_CATALOGS: Catalogs = { default: {}, named: {} };

export const parseCatalogs = (yamlContent: string | undefined): Catalogs => {
    if (!yamlContent) {
        return EMPTY_CATALOGS;
    }

    let raw: unknown;

    try {
        raw = parseYaml(yamlContent, { schema: "core", strict: true });
    } catch (error) {
        throw new VisReleaseError({
            cause: error,
            code: "CONFIG_INVALID",
            message: `Failed to parse pnpm-workspace.yaml: ${(error as Error).message}`,
        });
    }

    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
        return EMPTY_CATALOGS;
    }

    const obj = raw as Record<string, unknown>;
    const out: Catalogs = { default: {}, named: {} };

    if (typeof obj["catalog"] === "object" && obj["catalog"] !== null && !Array.isArray(obj["catalog"])) {
        for (const [name, version] of Object.entries(obj["catalog"] as Record<string, unknown>)) {
            if (typeof version === "string") {
                out.default[name] = version;
            }
        }
    }

    if (typeof obj["catalogs"] === "object" && obj["catalogs"] !== null && !Array.isArray(obj["catalogs"])) {
        for (const [catalogName, entries] of Object.entries(obj["catalogs"] as Record<string, unknown>)) {
            if (typeof entries !== "object" || entries === null || Array.isArray(entries)) {
                continue;
            }

            const block: Record<string, string> = {};

            for (const [pkg, version] of Object.entries(entries as Record<string, unknown>)) {
                if (typeof version === "string") {
                    block[pkg] = version;
                }
            }

            out.named[catalogName] = block;
        }
    }

    return out;
};

/**
 * Resolve a single `catalog:`/`catalog:&lt;name&gt;` ref to its concrete version.
 * Returns the original ref unchanged when the package name isn't found
 * (callers should treat that as a hard error during publish; we return as-is
 * so the publish step can surface a clear `NATIVE_ADDON_VERSION_MISMATCH`-
 * style error rather than a silent broken tarball).
 */
export const resolveCatalogRef = (
    ref: string,
    packageName: string,
    catalogs: Catalogs,
): string | undefined => {
    if (!ref.startsWith("catalog:")) {
        return ref;
    }

    const catalogName = ref.slice("catalog:".length);

    const block = catalogName === "" ? catalogs.default : catalogs.named[catalogName];

    if (!block) {
        return undefined;
    }

    return block[packageName];
};

/**
 * Rewrite every `catalog:`/`catalog:&lt;name&gt;` reference in a manifest's
 * dependency blocks to its resolved literal version. Returns a NEW
 * manifest object; never mutates the input.
 *
 * Throws `VisReleaseError("CONFIG_INVALID")` on the first unresolvable ref.
 */
export const rewriteCatalogRefs = (
    manifest: PackageManifest,
    catalogs: Catalogs,
): PackageManifest => {
    const out: PackageManifest = { ...manifest };

    for (const kind of DEPENDENCY_KINDS) {
        const block = manifest[kind];

        if (!block || typeof block !== "object") {
            continue;
        }

        const next: Record<string, string> = { ...(block) };

        for (const [name, range] of Object.entries(block)) {
            if (!range.startsWith("catalog:")) {
                continue;
            }

            const resolved = resolveCatalogRef(range, name, catalogs);

            if (resolved === undefined) {
                throw new VisReleaseError({
                    code: "CONFIG_INVALID",
                    message: `Cannot resolve "${range}" for dependency "${name}" in package "${manifest.name}". Add it to pnpm-workspace.yaml's "catalog" or "catalogs" block.`,
                    packageName: manifest.name,
                });
            }

            next[name] = resolved;
        }

        out[kind] = next;
    }

    return out;
};
