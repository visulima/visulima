import { isAccessibleSync, readJsonSync } from "@visulima/fs";
import { join, relative } from "@visulima/path";

import { readPnpmWorkspacePatterns, resolveWorkspacePatterns } from "../config/workspace";

/**
 * One concrete declaration of a dependency at a single (package × depType × name) coordinate.
 *
 * Used by every cross-package dep-policy lint (workspace-protocol, banned-deps,
 * version-drift, redefine-root, json-deps, pin/ban CLI). The iterator yields these
 * flat — consumers filter, group, or aggregate as they need.
 */
export interface DepInstance {
    /** Dep name as written in package.json. Includes scope (`@scope/foo`). */
    depName: string;
    /** Which `*Dependencies` block (or `pnpm.overrides` etc.) the dep lives in. */
    depType: DepType;

    /**
     * True when `depName` matches a workspace package's `name` field.
     *
     * Workspace-protocol lint cares about this; version-drift lint usually skips these
     * (internal pins are owned by the workspace, not the registry).
     */
    isInternal: boolean;
    /** Workspace-relative directory of the package declaring the dep. `.` for the root. */
    packageDir: string;
    /** Absolute path to the declaring package.json. */
    packageJsonPath: string;
    /** `name` field of the declaring package.json. May be `undefined` for the root. */
    packageName: string | undefined;
    /** Verbatim version string as written in package.json (e.g. `^17.0.0`, `catalog:`, `workspace:*`). */
    specifier: string;
}

export type DepType = "dependencies" | "devDependencies" | "optionalDependencies" | "overrides" | "peerDependencies" | "pnpm.overrides" | "resolutions";

const ALL_DEP_TYPES: DepType[] = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies", "overrides", "resolutions", "pnpm.overrides"];

export interface IterateDepsOptions {
    /**
     * Restrict to specific dep blocks. Defaults to all known blocks.
     */
    depTypes?: DepType[];
    /** Include internal/workspace deps in the output. Default `true` — lints decide what to drop. */
    includeInternal?: boolean;
}

const getNested = (object: Record<string, unknown>, dotPath: string): Record<string, string> | undefined => {
    const parts = dotPath.split(".");
    let current: unknown = object;

    for (const part of parts) {
        if (typeof current !== "object" || current === null) {
            return undefined;
        }

        current = (current as Record<string, unknown>)[part];
    }

    return typeof current === "object" && current !== null ? (current as Record<string, string>) : undefined;
};

/** Resolve every workspace-package directory (including the root). */
const collectWorkspaceDirectories = (workspaceRoot: string): string[] => {
    const rootPkgPath = join(workspaceRoot, "package.json");

    if (!isAccessibleSync(rootPkgPath)) {
        return ["."];
    }

    const rootPkg = readJsonSync(rootPkgPath) as {
        workspaces?: string[] | { packages?: string[] };
    };

    const workspacesField = rootPkg.workspaces;
    let directories: string[] = [];

    if (workspacesField) {
        const patterns = Array.isArray(workspacesField) ? workspacesField : workspacesField.packages;

        if (patterns) {
            directories = resolveWorkspacePatterns(workspaceRoot, patterns);
        }
    }

    if (directories.length === 0) {
        const pnpmPatterns = readPnpmWorkspacePatterns(workspaceRoot);

        if (pnpmPatterns) {
            directories = resolveWorkspacePatterns(workspaceRoot, pnpmPatterns);
        }
    }

    return [".", ...directories];
};

const readPkg = (pkgPath: string): Record<string, unknown> | undefined => {
    if (!isAccessibleSync(pkgPath)) {
        return undefined;
    }

    try {
        return readJsonSync(pkgPath) as Record<string, unknown>;
    } catch {
        // Malformed JSON — let the caller decide whether to surface a warning.
        return undefined;
    }
};

/**
 * Set of every `name` field declared by a package in the workspace (root included).
 *
 * Used to classify a dep as internal (lives in the workspace) vs external (comes from
 * the registry). Workspace-protocol enforcement keys off this set.
 */
export const collectWorkspacePackageNames = (workspaceRoot: string): Set<string> => {
    const names = new Set<string>();
    const directories = collectWorkspaceDirectories(workspaceRoot);

    for (const directory of directories) {
        const pkg = readPkg(join(workspaceRoot, directory, "package.json"));

        if (pkg && typeof pkg.name === "string") {
            names.add(pkg.name);
        }
    }

    return names;
};

/**
 * Yield every dep-instance across the workspace.
 *
 * Discovers packages from `workspaces:` (npm/yarn/bun) or `pnpm-workspace.yaml`,
 * reads each package.json, and emits one record per (package × depType × name).
 *
 * Catalog refs (`catalog:`, `catalog:react18`), workspace refs (`workspace:*`), and
 * `file:` / `link:` are emitted verbatim — downstream lints decide how to interpret.
 */
export const iterateWorkspaceDeps = (workspaceRoot: string, options: IterateDepsOptions = {}): DepInstance[] => {
    const includeInternal = options.includeInternal ?? true;
    const depTypes = options.depTypes ?? ALL_DEP_TYPES;
    const directories = collectWorkspaceDirectories(workspaceRoot);
    const internalNames = collectWorkspacePackageNames(workspaceRoot);
    const out: DepInstance[] = [];

    for (const directory of directories) {
        const packageJsonPath = join(workspaceRoot, directory, "package.json");
        const pkg = readPkg(packageJsonPath);

        if (!pkg) {
            continue;
        }

        const packageName = typeof pkg.name === "string" ? pkg.name : undefined;
        const packageDir = directory === "." ? "." : relative(workspaceRoot, join(workspaceRoot, directory));

        for (const depType of depTypes) {
            const block: Record<string, string> | undefined = depType.includes(".")
                ? getNested(pkg, depType)
                : (pkg[depType] as Record<string, string> | undefined);

            if (!block || typeof block !== "object") {
                continue;
            }

            for (const [depName, specifier] of Object.entries(block)) {
                if (typeof specifier !== "string") {
                    continue;
                }

                const isInternal = internalNames.has(depName);

                if (!includeInternal && isInternal) {
                    continue;
                }

                out.push({
                    depName,
                    depType,
                    isInternal,
                    packageDir,
                    packageJsonPath,
                    packageName,
                    specifier,
                });
            }
        }
    }

    return out;
};

/** Group instances by `depName`. Convenience for drift detection. */
export const groupInstancesByDep = (instances: DepInstance[]): Map<string, DepInstance[]> => {
    const out = new Map<string, DepInstance[]>();

    for (const instance of instances) {
        const list = out.get(instance.depName);

        if (list) {
            list.push(instance);
        } else {
            out.set(instance.depName, [instance]);
        }
    }

    return out;
};
