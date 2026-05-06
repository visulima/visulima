import type { DepInstance, DepType } from "../util/workspace-deps";

/**
 * One occurrence of a non-root package re-declaring a dep that already
 * exists in the workspace root.
 *
 * The point: in pnpm/yarn workspaces the root is the canonical home for
 * shared dev tools (eslint, prettier, vitest, typescript). Children
 * pinning the same dep again invites version drift and slows installs
 * with no upside.
 */
export interface RedefineRootIssue {
    /** Spec the child has — what we'd remove. */
    childSpecifier: string;
    depName: string;
    depType: DepType;
    packageDir: string;
    packageJsonPath: string;
    packageName: string | undefined;
    /** Block the dep lives in on the root (`dependencies`, `devDependencies`, ...). */
    rootDepType: DepType;
    /** Spec the root has — what would resolve after removal. */
    rootSpecifier: string;
}

export interface RedefineRootLintOptions {
    /**
     * Dep blocks to compare across child ↔ root. Defaults to the four
     * registry blocks; `pnpm.overrides`/`overrides`/`resolutions` are excluded
     * by default since those are *intentionally* root-only.
     */
    depTypes?: DepType[];
    /** Dep names to ignore (exact match). */
    ignoreDeps?: string[];
}

const DEFAULT_DEP_TYPES: DepType[] = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];

/**
 * Find every non-root dep that duplicates a dep already in root.
 *
 * Cross-block matches count: a child's `devDependencies.eslint` shadows
 * root's `dependencies.eslint` just as effectively as a same-block hit.
 * The root's actual block is reported back in `rootDepType` for context.
 */
export const lintRedefineRoot = (instances: DepInstance[], options: RedefineRootLintOptions = {}): RedefineRootIssue[] => {
    const depTypes = new Set<DepType>(options.depTypes ?? DEFAULT_DEP_TYPES);
    const ignore = new Set(options.ignoreDeps);

    // First pass: build the root's dep → (specifier, depType) map.
    const rootDeps = new Map<string, { depType: DepType; specifier: string }>();

    for (const instance of instances) {
        if (instance.packageDir !== "." || !depTypes.has(instance.depType)) {
            continue;
        }

        rootDeps.set(instance.depName, { depType: instance.depType, specifier: instance.specifier });
    }

    if (rootDeps.size === 0) {
        return [];
    }

    const issues: RedefineRootIssue[] = [];

    for (const instance of instances) {
        if (instance.packageDir === ".") {
            continue;
        }

        if (!depTypes.has(instance.depType)) {
            continue;
        }

        if (ignore.has(instance.depName)) {
            continue;
        }

        const rootHit = rootDeps.get(instance.depName);

        if (!rootHit) {
            continue;
        }

        issues.push({
            childSpecifier: instance.specifier,
            depName: instance.depName,
            depType: instance.depType,
            packageDir: instance.packageDir,
            packageJsonPath: instance.packageJsonPath,
            packageName: instance.packageName,
            rootDepType: rootHit.depType,
            rootSpecifier: rootHit.specifier,
        });
    }

    return issues;
};
