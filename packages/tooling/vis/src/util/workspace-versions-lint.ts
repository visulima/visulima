import { readJsonSync, writeJsonSync } from "@visulima/fs";

import { isNewer, parseVersion } from "./catalog";
import { resolveIndentForExistingFile } from "./editorconfig";
import type { DepInstance, DepType } from "./workspace-deps";

/**
 * One workspace package declares a dep at a different version than the rest.
 *
 * Computed per-instance (a cluster of N drifting packages produces N-1 issues —
 * the canonical instance is left clean). The `fix` field is what `--fix` will
 * write; for `resolve: "catalog"` it's `catalog:` (or `catalog:&lt;name>`), for
 * `highest`/`lowest` it's the chosen specifier from a sibling.
 */
export interface WorkspaceVersionDriftIssue {
    /** What the canonical specifier came from — a sibling package name, or "catalog". */
    canonicalSource: string;
    depName: string;
    depType: DepType;
    fix: string;
    packageDir: string;
    packageJsonPath: string;
    packageName: string | undefined;
    specifier: string;
}

export type WorkspaceVersionsResolveStrategy = "catalog" | "highest" | "lowest";

export interface WorkspaceVersionsLintOptions {
    /**
     * Catalogs map keyed by catalog name → (depName → specifier). Required when
     * `resolve` is "catalog"; ignored otherwise. Pass the result of `readCatalogs`.
     */
    catalogs?: Map<string, Map<string, string>>;
    /** Restrict the check to a single dep. */
    dep?: string;
    /** Dep names skipped entirely (exact match). */
    ignoreDeps?: string[];

    /**
     * Per-dep canonical specifiers that override `resolve`. Useful for one-off
     * CLI checks (`vis lint --pin react@^18.2.0`) — every instance whose
     * specifier doesn't match becomes an issue, even if only one package
     * declares the dep.
     */
    pinned?: Map<string, string>;

    /**
     * Resolution strategy.
     * - `highest` (default): pick the highest semver among siblings.
     * - `lowest`: pick the lowest.
     * - `catalog`: rewrite to `catalog:` (or `catalog:&lt;name>`) for any dep
     *   already pinned in a workspace catalog.
     */
    resolve?: WorkspaceVersionsResolveStrategy;
}

const VERSION_DEP_TYPES = new Set<DepType>(["dependencies", "devDependencies", "peerDependencies"]);

const isCatalogReference = (specifier: string): boolean => specifier.startsWith("catalog:");

const isWorkspaceReference = (specifier: string): boolean => specifier.startsWith("workspace:");

/**
 * `catalog:` → "default"; `catalog:peer` → "peer". Returns undefined for
 * non-catalog specifiers.
 */
const catalogNameOf = (specifier: string): string | undefined => {
    if (!specifier.startsWith("catalog:")) {
        return undefined;
    }

    const rest = specifier.slice("catalog:".length);

    return rest === "" ? "default" : rest;
};

/**
 * Find the catalog that already pins `depName`. Default catalog wins ties;
 * named catalogs are scanned alphabetically so the result is reproducible
 * across machines (Map iteration would otherwise be insertion-order, which
 * depends on YAML parse order).
 */
const findCatalogPinning = (catalogs: Map<string, Map<string, string>>, depName: string): string | undefined => {
    if (catalogs.get("default")?.has(depName)) {
        return "default";
    }

    const namedCatalogs = [...catalogs.keys()].filter((name) => name !== "default").sort();

    for (const name of namedCatalogs) {
        if (catalogs.get(name)?.has(depName)) {
            return name;
        }
    }

    return undefined;
};

const buildCatalogSpecifier = (catalogName: string): string => (catalogName === "default" ? "catalog:" : `catalog:${catalogName}`);

const pickCanonicalBySemver = (instances: DepInstance[], direction: "highest" | "lowest"): { canonical: DepInstance; canonicalSource: string } | undefined => {
    // Sort by packageName so versions that compare equal (e.g. `^17.0.0` vs
    // `~17.0.0`) tie-break to the alphabetically-first package — reproducible
    // across machines regardless of workspace traversal order.
    const sorted = [...instances].sort((a, b) => (a.packageName ?? a.packageDir).localeCompare(b.packageName ?? b.packageDir));
    let chosen: DepInstance | undefined;

    for (const instance of sorted) {
        const parsed = parseVersion(instance.specifier);

        if (!parsed) {
            continue;
        }

        if (!chosen) {
            chosen = instance;

            continue;
        }

        const chosenParsed = parseVersion(chosen.specifier);

        if (!chosenParsed) {
            chosen = instance;

            continue;
        }

        const parsedIsHigher = isNewer(chosenParsed, parsed);
        const parsedIsLower = isNewer(parsed, chosenParsed);

        if ((direction === "highest" && parsedIsHigher) || (direction === "lowest" && parsedIsLower)) {
            chosen = instance;
        }
    }

    if (!chosen) {
        return undefined;
    }

    return { canonical: chosen, canonicalSource: chosen.packageName ?? chosen.packageDir };
};

/**
 * Find every external dep declared at inconsistent versions across the workspace.
 *
 * Strategy `highest`/`lowest`: among declared specifiers, pick one as canonical;
 * report each non-matching instance.
 *
 * Strategy `catalog`: if a catalog already pins the dep, every direct version
 * specifier is reported (canonical is `catalog:`).
 *
 * Internal deps and `workspace:`/`catalog:` references are skipped on the
 * version-drift axis — those are owned by other lints (workspace-protocol
 * checks the protocol; redefine-root checks duplication).
 */
export const lintWorkspaceVersions = (instances: DepInstance[], options: WorkspaceVersionsLintOptions = {}): WorkspaceVersionDriftIssue[] => {
    const resolve = options.resolve ?? "highest";
    const ignored = new Set(options.ignoreDeps);
    const issues: WorkspaceVersionDriftIssue[] = [];

    const eligible = instances.filter((instance) => {
        if (instance.isInternal) {
            return false;
        }

        if (!VERSION_DEP_TYPES.has(instance.depType)) {
            return false;
        }

        if (isWorkspaceReference(instance.specifier)) {
            return false;
        }

        if (options.dep !== undefined && instance.depName !== options.dep) {
            return false;
        }

        return !ignored.has(instance.depName);
    });

    const grouped = new Map<string, DepInstance[]>();

    for (const instance of eligible) {
        const list = grouped.get(instance.depName);

        if (list) {
            list.push(instance);
        } else {
            grouped.set(instance.depName, [instance]);
        }
    }

    for (const [depName, group] of grouped) {
        const pinnedSpecifier = options.pinned?.get(depName);

        if (pinnedSpecifier !== undefined) {
            for (const instance of group) {
                if (instance.specifier === pinnedSpecifier) {
                    continue;
                }

                issues.push({
                    canonicalSource: "cli:--pin",
                    depName,
                    depType: instance.depType,
                    fix: pinnedSpecifier,
                    packageDir: instance.packageDir,
                    packageJsonPath: instance.packageJsonPath,
                    packageName: instance.packageName,
                    specifier: instance.specifier,
                });
            }

            continue;
        }

        if (resolve === "catalog") {
            const { catalogs } = options;

            if (!catalogs) {
                continue;
            }

            const catalogName = findCatalogPinning(catalogs, depName);

            if (!catalogName) {
                continue;
            }

            const canonicalSpecifier = buildCatalogSpecifier(catalogName);

            for (const instance of group) {
                if (catalogNameOf(instance.specifier) === catalogName) {
                    continue;
                }

                issues.push({
                    canonicalSource: `catalog:${catalogName}`,
                    depName,
                    depType: instance.depType,
                    fix: canonicalSpecifier,
                    packageDir: instance.packageDir,
                    packageJsonPath: instance.packageJsonPath,
                    packageName: instance.packageName,
                    specifier: instance.specifier,
                });
            }

            continue;
        }

        const versionedInstances = group.filter((instance) => !isCatalogReference(instance.specifier));

        if (versionedInstances.length < 2) {
            continue;
        }

        const distinct = new Set(versionedInstances.map((instance) => instance.specifier));

        if (distinct.size <= 1) {
            continue;
        }

        const picked = pickCanonicalBySemver(versionedInstances, resolve);

        if (!picked) {
            continue;
        }

        const canonicalSpecifier = picked.canonical.specifier;

        for (const instance of versionedInstances) {
            if (instance.specifier === canonicalSpecifier) {
                continue;
            }

            issues.push({
                canonicalSource: picked.canonicalSource,
                depName,
                depType: instance.depType,
                fix: canonicalSpecifier,
                packageDir: instance.packageDir,
                packageJsonPath: instance.packageJsonPath,
                packageName: instance.packageName,
                specifier: instance.specifier,
            });
        }
    }

    return issues;
};

export interface ApplyWorkspaceVersionsFixesOptions {
    /** Disable `.editorconfig` indent discovery; falls back to file-content sniffing. */
    useEditorconfig?: boolean;
}

/**
 * Apply every issue to its package.json, grouped per-file so each file is
 * written at most once. Indent is sourced from `.editorconfig` first
 * (unless `useEditorconfig` is false), then sniffed from the existing file.
 *
 * Note: `--resolve catalog` only rewrites the *consumer* package.jsons. The
 * catalog itself must be set up first (see item 7 in the syncpack roadmap —
 * `vis lint --resolve catalog --propose-min N`).
 */
export const applyWorkspaceVersionsFixes = (issues: WorkspaceVersionDriftIssue[], options: ApplyWorkspaceVersionsFixesOptions = {}): string[] => {
    const { useEditorconfig } = options;
    const byFile = new Map<string, WorkspaceVersionDriftIssue[]>();

    for (const issue of issues) {
        const list = byFile.get(issue.packageJsonPath);

        if (list) {
            list.push(issue);
        } else {
            byFile.set(issue.packageJsonPath, [issue]);
        }
    }

    const written: string[] = [];

    for (const [filePath, fileIssues] of byFile) {
        const pkg = readJsonSync(filePath) as Record<string, unknown>;

        for (const issue of fileIssues) {
            const block = pkg[issue.depType];

            if (typeof block === "object" && block !== null) {
                (block as Record<string, string>)[issue.depName] = issue.fix;
            }
        }

        writeJsonSync(filePath, pkg, { indent: resolveIndentForExistingFile(filePath, { useEditorconfig }), overwrite: true });
        written.push(filePath);
    }

    return written;
};
