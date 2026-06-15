/**
 * pnpm-workspace catalog change-detection (changesets #1707).
 *
 * `pnpm-workspace.yaml` carries shared dependency versions under
 * `catalog:` (the default block) and `catalogs:` (named blocks). When
 * an operator bumps a version inside one of those blocks, every
 * consumer package that references it via `"some-dep": "catalog:"` or
 * `"some-dep": "catalog:&lt;name>"` effectively pulls the new version on
 * its next `pnpm install`. Without explicit detection, vis sees no
 * change to the consumer's `package.json` and therefore doesn't
 * include it in the release plan — so the consumer's published
 * `package.json` ends up shipping a stale version range relative to
 * what users would actually install.
 *
 * This module is the missing detection layer:
 *
 *   1. `parseCatalogs` reads pnpm-workspace.yaml into a normalised
 *      `Map&lt;catalogName, Record&lt;depName, version>>` shape (the existing
 *      `catalog.ts` returns a slightly different shape; we wrap it here
 *      for the diffing API).
 *
 *   2. `findCatalogConsumers` walks the workspace and answers "for each
 *      catalog dep, which packages use it?". The result is the index
 *      release-plan.ts cross-references when it sees a catalog change.
 *
 *   3. `detectCatalogChanges` diffs two catalog snapshots (typically
 *      "the version pnpm-workspace.yaml had at HEAD~1" vs "the version
 *      it has now") to produce the list of catalog deps that moved.
 *
 * The actual release-plan side of the integration lives in
 * `release-plan.ts`; this module is pure data + pure functions, no
 * fs / git. Opt-in via `release.detectCatalogChanges: true` in
 * `vis.config.ts`.
 */

import type { WorkspacePackage } from "../types";
import { parseCatalogs as parseCatalogsRaw } from "./catalog";

/**
 * Catalog dep → version, keyed by catalog name. The default `catalog:`
 * block is keyed under the empty string; named blocks (`catalogs.dev`,
 * etc.) use the operator-supplied name verbatim.
 */
export type CatalogSnapshot = Map<string, Record<string, string>>;

/**
 * Parse pnpm-workspace.yaml into the diff-friendly `Map` shape used by
 * `detectCatalogChanges`. Falls back to the existing `parseCatalogs`
 * for the actual YAML parse — that helper already enforces strict-mode
 * + handles malformed input — and remaps its output into the keyed-by-
 * name shape we want.
 */
export const parseCatalogs = (workspaceYaml: string | undefined): CatalogSnapshot => {
    const raw = parseCatalogsRaw(workspaceYaml);
    const out: CatalogSnapshot = new Map();

    // Default block always present (even if empty) — caller can
    // distinguish "absent" from "present but empty" via the inner
    // Record's size if needed.
    if (Object.keys(raw.default).length > 0) {
        out.set("", { ...raw.default });
    }

    for (const [name, block] of Object.entries(raw.named)) {
        out.set(name, { ...block });
    }

    return out;
};

/** A catalog ref that appears in a workspace package. */
export interface CatalogRef {
    /** Catalog name (`""` for the default `catalog:` block). */
    catalog: string;
    /** Dependency name (the catalog key, e.g. `"react"`). */
    dep: string;
    /** Which dep kind the ref lives in (dependencies / devDependencies / …). */
    kind: "dependencies" | "devDependencies" | "optionalDependencies" | "peerDependencies";
    /** Workspace package referencing the catalog. */
    packageName: string;
}

const DEPENDENCY_KINDS = [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
] as const satisfies ReadonlyArray<CatalogRef["kind"]>;

/**
 * Extract every `catalog:` / `catalog:&lt;name>` reference from a single
 * workspace package's dependency blocks. Returns one entry per
 * (dep, kind) pair — a package referencing `react` in both
 * `dependencies` and `peerDependencies` yields two entries so a
 * consumer can decide whether to cascade based on the kind.
 */
export const extractCatalogRefs = (pkg: WorkspacePackage): CatalogRef[] => {
    const refs: CatalogRef[] = [];

    for (const kind of DEPENDENCY_KINDS) {
        const block = pkg.manifest[kind];

        if (!block || typeof block !== "object") {
            continue;
        }

        for (const [dep, range] of Object.entries(block)) {
            if (typeof range !== "string" || !range.startsWith("catalog:")) {
                continue;
            }

            const catalogName = range.slice("catalog:".length);

            refs.push({ catalog: catalogName, dep, kind, packageName: pkg.name });
        }
    }

    return refs;
};

/**
 * Build the reverse index: for each catalog dep, which workspace
 * packages reference it (and from which dep kinds)?
 *
 * The result is a nested map so the release-plan can answer questions
 * like "the `react` entry in the default catalog moved — which
 * packages depend on it via runtime deps vs devDeps?" without re-
 * walking the workspace.
 *
 * Outer key: catalog name (`""` for default).
 * Middle key: dep name.
 * Inner value: array of `{ packageName, kind }` for each consumer.
 */
export interface CatalogConsumerEntry {
    kind: CatalogRef["kind"];
    packageName: string;
}

export const findCatalogConsumers = (
    packages: ReadonlyArray<WorkspacePackage>,
    catalogs: CatalogSnapshot,
): Map<string, Map<string, CatalogConsumerEntry[]>> => {
    const out = new Map<string, Map<string, CatalogConsumerEntry[]>>();

    // Seed the outer map with every catalog block present in the
    // workspace YAML — even when no consumer references a particular
    // block, the empty inner map makes the result easier to consume
    // (no special-case for "first dep into a previously-untouched
    // catalog").
    for (const catalogName of catalogs.keys()) {
        out.set(catalogName, new Map());
    }

    for (const pkg of packages) {
        for (const ref of extractCatalogRefs(pkg)) {
            // Only record refs that point at a catalog block we know
            // about — a `catalog:typo` that doesn't exist in the
            // workspace YAML would surface as a publish-time error
            // elsewhere; the detector shouldn't silently invent
            // consumers for it.
            if (!catalogs.has(ref.catalog)) {
                continue;
            }

            let depTable = out.get(ref.catalog);

            if (!depTable) {
                depTable = new Map();
                out.set(ref.catalog, depTable);
            }

            const existing = depTable.get(ref.dep);

            if (existing) {
                existing.push({ kind: ref.kind, packageName: ref.packageName });
            } else {
                depTable.set(ref.dep, [{ kind: ref.kind, packageName: ref.packageName }]);
            }
        }
    }

    return out;
};

/** A single catalog version change between two snapshots. */
export interface CatalogChange {
    /** Catalog name (`""` for default). */
    catalog: string;
    /** Dep name whose version moved. */
    dep: string;
    /** Version present in `next` (undefined when the entry was removed). */
    newVersion: string | undefined;
    /** Version present in `prev` (undefined when the entry is newly added). */
    oldVersion: string | undefined;
}

/**
 * Diff two catalog snapshots and return every entry whose version
 * changed (including additions and removals). Pure function — no
 * ordering guarantees beyond "catalogs iterated in `next.keys()`
 * order, deps within a catalog iterated alphabetically for
 * determinism".
 *
 * Additions / removals: included with the missing side set to
 * `undefined`. Callers that only care about version bumps (the
 * release-plan cascade path) can filter on `oldVersion !== undefined
 * &amp;& newVersion !== undefined`.
 */
export const detectCatalogChanges = (
    prev: CatalogSnapshot,
    next: CatalogSnapshot,
): CatalogChange[] => {
    // F25: fast bail — when neither snapshot carries any catalog block,
    // there's nothing to diff. The workspace never used catalogs (most
    // repos) and walking an empty diff every `buildContext` invocation
    // wastes the orchestrator's wall-time. The Map size check is O(1);
    // skipping both the `next` walk + the "entirely-removed" walk
    // dominates the savings on cold runs.
    if (prev.size === 0 && next.size === 0) {
        return [];
    }

    const changes: CatalogChange[] = [];
    const seenCatalogs = new Set<string>();

    // Walk `next` first so additions come out before removals — matches
    // the natural "what's in the new state?" reading order.
    for (const [catalogName, nextBlock] of next) {
        seenCatalogs.add(catalogName);

        const prevBlock = prev.get(catalogName) ?? {};

        // Deterministic ordering inside a catalog (avoids relying on
        // the parser's iteration order which can vary across YAML
        // backends).
        const allDeps = new Set([...Object.keys(prevBlock), ...Object.keys(nextBlock)]);
        const sortedDeps = [...allDeps].sort();

        for (const dep of sortedDeps) {
            const oldVersion = prevBlock[dep];
            const newVersion = nextBlock[dep];

            if (oldVersion === newVersion) {
                continue;
            }

            changes.push({ catalog: catalogName, dep, newVersion, oldVersion });
        }
    }

    // Catalogs entirely removed in `next`. Each remaining dep surfaces
    // as a "removed" change (newVersion undefined).
    for (const [catalogName, prevBlock] of prev) {
        if (seenCatalogs.has(catalogName)) {
            continue;
        }

        const sortedDeps = Object.keys(prevBlock).sort();

        for (const dep of sortedDeps) {
            changes.push({
                catalog: catalogName,
                dep,
                newVersion: undefined,
                oldVersion: prevBlock[dep],
            });
        }
    }

    return changes;
};
