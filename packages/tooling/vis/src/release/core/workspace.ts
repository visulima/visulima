/**
 * Workspace package discovery (RFC §6.1).
 *
 * Pure logic over a `PackageJsonReader` adapter — caller injects how
 * to enumerate package.json files (via fs glob, Nx project graph, pnpm
 * workspace listing, etc.). Returned `WorkspacePackage[]` is the input
 * to `DependencyGraph` and the release plan.
 */

import { realpathSync } from "node:fs";
import { resolve as resolvePath, sep as pathSep } from "node:path";

import zeptomatch from "zeptomatch";

import { VisReleaseError } from "../errors";
import type { PackageManifest, PerPackageReleaseConfig, VisReleaseConfig, WorkspacePackage } from "../types";
import { assertValidPackageName } from "./security";

export interface PackageJsonReader {
    /**
     * Enumerate every workspace package's `package.json` path + parsed manifest.
     * Caller decides discovery strategy (Nx, pnpm-workspace.yaml, package.json#workspaces glob, etc.).
     */
    listPackages: () => Promise<{ manifest: PackageManifest; manifestPath: string }[]>;
}

/**
 * Discover workspace packages and apply `release.ignore` / `release.include`
 * filters. Resolves per-package config (root `release.packages[&lt;name>]`
 * merged with `package.json["vis-release"]`).
 *
 * Throws `DUPLICATE_PACKAGE_NAME` if two packages declare the same name.
 */
export interface DiscoverPackagesOptions {
    /** Workspace root. When provided, every discovered manifestPath must resolve inside it. */
    cwd?: string;
}

export const discoverPackages = async (
    reader: PackageJsonReader,
    config: VisReleaseConfig,
    options: DiscoverPackagesOptions = {},
): Promise<{ packages: WorkspacePackage[]; perPackageConfig: Map<string, PerPackageReleaseConfig> }> => {
    const entries = await reader.listPackages();
    const packages: WorkspacePackage[] = [];
    const perPackageConfig = new Map<string, PerPackageReleaseConfig>();
    const seen = new Map<string, string>();

    // Canonicalize through symlinks so the workspace-containment check below
    // compares like with like. On macOS `os.tmpdir()` returns `/var/folders/…`
    // while discovery adapters hand back the realpath `/private/var/folders/…`
    // (and similar `/tmp` → realpath cases on Linux), which made an in-workspace
    // manifest look "outside" the workspace.
    //
    // `realpathSync.native` additionally expands Windows 8.3 short names
    // (`RUNNER~1` → `runneradmin`) and normalizes drive-letter case, which the
    // JS `realpathSync` does not — without it a short-form cwd never matched a
    // long-form manifest path on `windows-latest`. Both require the path to
    // exist, so fall back through plain `realpathSync` and then a bare resolve.
    const canonicalize = (p: string): string => {
        const resolved = resolvePath(p);

        try {
            return realpathSync.native(resolved);
        } catch {
            try {
                return realpathSync(resolved);
            } catch {
                return resolved;
            }
        }
    };

    const cwdResolved = options.cwd === undefined ? undefined : canonicalize(options.cwd);

    // RFC §12.4: platform packages live under a native-addon parent's `npm/`
    // directory and are published by the parent's `native-addon` versionActions
    // — never as standalone packages. Collect each native-addon parent's
    // `npm/` prefix so we can exclude anything beneath it from discovery.
    // Without this, with `defaultManaged: true` the platform packages would be
    // discovered as ordinary npm packages and double-published.
    const toPosix = (p: string): string => p.replaceAll("\\", "/");
    const nativeAddonNpmPrefixes: string[] = [];

    for (const { manifest, manifestPath } of entries) {
        const merged = mergePerPackageConfig(typeof manifest.name === "string" ? manifest.name : "", manifest, config);
        const isNativeAddon = manifest.napi !== undefined || merged.versionActions === "native-addon";

        if (isNativeAddon) {
            const parentDir = toPosix(manifestPath.replace(/[/\\]package\.json$/i, ""));

            nativeAddonNpmPrefixes.push(`${parentDir}/npm/`);
        }
    }

    for (const { manifest, manifestPath } of entries) {
        if (typeof manifest.name !== "string" || manifest.name === "") {
            // Anonymous package (e.g. apps/web with no name) — skip silently.
            continue;
        }

        // Skip native-addon platform packages — managed by the parent (§12.4).
        const entryDirPosix = toPosix(manifestPath.replace(/[/\\]package\.json$/i, ""));

        if (nativeAddonNpmPrefixes.some((prefix) => entryDirPosix.startsWith(prefix))) {
            continue;
        }

        // Reject names that could escape shell interpolation in `npm view` /
        // `npm publish`. Validation is at the discovery boundary so every
        // downstream consumer can trust `pkg.name` is shell-safe.
        assertValidPackageName(manifest.name);

        if (seen.has(manifest.name)) {
            throw new VisReleaseError({
                code: "DUPLICATE_PACKAGE_NAME",
                message: `Duplicate package name "${manifest.name}" — at ${seen.get(manifest.name)} and ${manifestPath}.`,
                packageName: manifest.name,
            });
        }

        seen.set(manifest.name, manifestPath);

        // Defense-in-depth: a buggy adapter could yield a manifestPath outside
        // the workspace, which would let downstream writes (cleanPackageJson,
        // version-bump) escape `cwd`. Catch it here.
        if (cwdResolved !== undefined) {
            const manifestResolved = canonicalize(manifestPath);
            const cwdWithSep = cwdResolved.endsWith(pathSep) ? cwdResolved : `${cwdResolved}${pathSep}`;

            // NTFS is case-insensitive; compare case-folded on Windows so a
            // residual drive-letter / casing difference never reads as "outside".
            const fold = (value: string): string => (pathSep === "\\" ? value.toLowerCase() : value);
            const manifestFolded = fold(manifestResolved);

            if (manifestFolded !== fold(cwdResolved) && !manifestFolded.startsWith(fold(cwdWithSep))) {
                throw new VisReleaseError({
                    code: "CONFIG_INVALID",
                    message: `Package manifest is outside the workspace: ${manifestPath} (workspace: ${cwdResolved}).`,
                    packageName: manifest.name,
                });
            }
        }

        const merged = mergePerPackageConfig(manifest.name, manifest, config);

        // Apply ignore / include filters.
        if (!isPackageManaged(manifest.name, manifest, merged, config)) {
            continue;
        }

        const dir = manifestPath.replace(/[/\\]package\.json$/i, "");

        packages.push({
            dir,
            manifest,
            manifestPath,
            name: manifest.name,
            private: manifest.private === true,
            version: typeof manifest.version === "string" ? manifest.version : "0.0.0",
        });

        perPackageConfig.set(manifest.name, merged);
    }

    return { packages, perPackageConfig };
};

/**
 * Per-package config resolution: package.json["vis-release"] wins over
 * the root config's `packages[&lt;name>]` block (matches bumpy's precedence).
 */
export const mergePerPackageConfig = (
    name: string,
    manifest: PackageManifest,
    config: VisReleaseConfig,
): PerPackageReleaseConfig => {
    const fromRoot = config.packages?.[name] ?? {};
    const fromPkg = manifest["vis-release"] ?? {};

    return { ...fromRoot, ...fromPkg };
};

/**
 * Decide whether a package should be managed by the release subsystem.
 *
 * Resolution order (explicit per-package config beats workspace globs):
 * 1. Explicit `managed: false` excludes.
 * 2. Explicit `managed: true` includes (wins over `ignore`).
 * 3. `release.ignore` glob excludes.
 * 4. `release.include` glob includes.
 * 5. `private: true` with no `privatePackages.version` rule excludes.
 * 6. Otherwise respect `defaultManaged` (default `false`).
 */
export const isPackageManaged = (
    name: string,
    manifest: PackageManifest,
    perPkg: PerPackageReleaseConfig,
    config: VisReleaseConfig,
): boolean => {
    if (perPkg.managed === false) {
        return false;
    }

    if (perPkg.managed === true) {
        return true;
    }

    if (matchesAny(name, config.ignore ?? [])) {
        return false;
    }

    if (matchesAny(name, config.include ?? [])) {
        return true;
    }

    if (manifest.private === true && !(config.privatePackages?.version ?? false)) {
        return false;
    }

    return config.defaultManaged ?? false;
};

const matchesAny = (name: string, patterns: string[]): boolean => patterns.some((pattern) => zeptomatch(pattern, name));

/**
 * Auto-detect which `versionActions` plugin a package needs.
 *
 * Resolution order:
 *   1. Explicit per-package config
 *   2. `napi` field present → `native-addon`
 *   3. `private: true` → `private`
 *   4. Default → `npm`
 */
export const resolveVersionActionsId = (pkg: WorkspacePackage, perPkg: PerPackageReleaseConfig): string => {
    if (perPkg.versionActions !== undefined) {
        return perPkg.versionActions;
    }

    if (pkg.manifest.napi !== undefined) {
        return "native-addon";
    }

    if (pkg.private) {
        return "private";
    }

    return "npm";
};
