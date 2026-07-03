/**
 * Per-version metadata lookup for installed packages.
 *
 * An SBOM needs each `name@version` component to declare its own
 * licence, description, and author — not the top-level project's.
 * Different versions of the same package can ship different licence
 * texts (common during a licence migration, e.g. `foo@4` is MIT but
 * `foo@5` is Apache-2.0), so we resolve the metadata against the
 * specific on-disk install tree rather than the lockfile or a single
 * hoisted copy.
 *
 * The helper is best-effort: we try common install-tree layouts in
 * order and return `undefined` the moment we fail to find a match. A
 * missing metadata doesn't block SBOM generation — the component is
 * just emitted without licence/author/description decoration.
 */

import { readdirSync } from "node:fs";

import { readJsonSync } from "@visulima/fs";
import { join } from "@visulima/path";

import type { RawLicenseInput } from "./license";

/** Subset of `package.json` surfaced onto installed-package components. */
export interface InstalledPackageMetadata extends RawLicenseInput {
    author?: string | { email?: string; name?: string; url?: string };
    bugs?: string | { url?: string };
    description?: string;
    homepage?: string;
    name?: string;
    repository?: string | { type?: string; url?: string };
    version?: string;
}

const readJsonSafe = (path: string): InstalledPackageMetadata | undefined => {
    try {
        return readJsonSync(path) as InstalledPackageMetadata;
    } catch {
        return undefined;
    }
};

/**
 * Validate that an npm package name can't escape the workspace root.
 *
 * npm package names and versions can't legally contain `/` / `\`
 * (except the scope-delimiter `/` in `@scope/name`) or `..`. A
 * lockfile carrying such strings is either corrupt or hostile; in
 * either case we refuse to interpolate it into a filesystem path
 * lest we escape `workspaceRoot`. Both forward and back slashes
 * must be checked because `join` on Windows treats `\` as a
 * separator too.
 */
const isSafePackageName = (name: string): boolean => {
    if (name.length === 0 || name.includes("..") || name.startsWith(".") || name.includes("\0") || name.includes("\\")) {
        return false;
    }

    if (name.startsWith("@")) {
        // Scoped: exactly one `/` permitted, between the scope and the name.
        const slashIndex = name.indexOf("/");

        return slashIndex > 1 && !name.includes("/", slashIndex + 1);
    }

    return !name.includes("/");
};

const isSafeVersion = (version: string): boolean =>
    version.length > 0 && !version.includes("/") && !version.includes("\\") && !version.includes("..") && !version.includes("\0");

/**
 * Read package metadata from pnpm's virtual store.
 *
 * pnpm's virtual store encodes `name@version` into the directory
 * name. For packages with resolved peer deps, a suffix is appended —
 * e.g. `foo@1.0.0_react@18.0.0`. We try the exact dir first (cheap),
 * then scan `.pnpm/` for a directory matching `foo@1.0.0` or
 * `foo@1.0.0_*`.
 */
const readPnpmVirtualStore = (workspaceRoot: string, name: string, version: string): InstalledPackageMetadata | undefined => {
    const encodedName = name.replaceAll("/", "+");
    const exactDir = `${encodedName}@${version}`;
    const pnpmRoot = join(workspaceRoot, "node_modules", ".pnpm");

    // Fast path: no peer disambiguation.
    const exact = readJsonSafe(join(pnpmRoot, exactDir, "node_modules", name, "package.json"));

    if (exact) {
        return exact;
    }

    // Slow path: scan `.pnpm` for `foo@1.0.0_*` peer-disambiguated dirs.
    let directories: string[];

    try {
        directories = readdirSync(pnpmRoot);
    } catch {
        return undefined;
    }

    const prefix = `${exactDir}_`;

    for (const directory of directories) {
        if (!directory.startsWith(prefix)) {
            continue;
        }

        const metadata = readJsonSafe(join(pnpmRoot, directory, "node_modules", name, "package.json"));

        if (metadata) {
            return metadata;
        }
    }

    return undefined;
};

const readHoistedCopy = (workspaceRoot: string, name: string, version: string): InstalledPackageMetadata | undefined => {
    const metadata = readJsonSafe(join(workspaceRoot, "node_modules", name, "package.json"));

    // The hoisted copy might be a different version of the same package —
    // only trust it if the version matches.
    return metadata?.version === version ? metadata : undefined;
};

/**
 * Looks up the installed `package.json` for a specific `name@version`.
 * Tries pnpm's virtual store first (exact match by construction), then
 * falls back to the hoisted `node_modules/&lt;name>/package.json` if its
 * version matches.
 *
 * Returns `undefined` if nothing on disk matches the requested version,
 * **or if `name`/`version` contains characters that could be used for
 * path traversal**. A malicious lockfile carrying e.g.
 * `version: "../../../etc"` would otherwise escape `workspaceRoot`
 * because `join` collapses `..` segments.
 */
export const readInstalledPackageMetadata = (workspaceRoot: string, name: string, version: string): InstalledPackageMetadata | undefined => {
    if (!isSafePackageName(name) || !isSafeVersion(version)) {
        return undefined;
    }

    return readPnpmVirtualStore(workspaceRoot, name, version) ?? readHoistedCopy(workspaceRoot, name, version);
};
