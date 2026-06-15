/**
 * Three-phase release-plan assembly (port of bumpy's `assembleReleasePlan`,
 * RFC §6.1 / §10).
 *
 * Pure function: `(changeFiles, depGraph, config, options) → ReleasePlan`.
 * Deterministic — same inputs always produce the same plan.
 *
 * The algorithm runs a fixed-point loop (max 100 iterations) over three
 * propagation phases until no new packages are added:
 *
 *   Phase A — Out-of-range fix (always on, safety net):
 *       For each planned bump, every dependent whose `range` is no longer
 *       satisfied by the new version is pulled in. peerDependencies inherit
 *       the source's bump level (no major escalation — bumpy's headline
 *       differentiator vs changesets); other dep kinds → `patch`.
 *
 *   Phase B — Fixed/linked groups:
 *       Fixed groups: max-bump every member.
 *       Linked groups: max-bump only already-planned members.
 *
 *   Phase C — Proactive propagation (gated by `updateInternalDependencies`):
 *       C1. Bump-file-level cascade (the `cascade:` block in nested
 *           frontmatter) — always runs, regardless of mode.
 *       C2. Source-side `cascadeTo` from per-package config — runs always.
 *       C3. Dependency-graph rules (`dependencyBumpRules`) — gated by
 *           the `updateInternalDependencies` mode.
 */

import zeptomatch from "zeptomatch";

import { DEFAULT_DEPENDENCY_BUMP_RULES } from "../config";
import { VisReleaseError } from "../errors";
import type {
    BumpAs,
    BumpLevel,
    BumpReason,
    ChangeFile,
    DependencyBumpRule,
    DependencyKind,
    PerPackageReleaseConfig,
    PlannedRelease,
    ReleasePlan,
    VisReleaseConfig,
} from "../types";
import { bumpRank, maxBump, normaliseGroup } from "../types";
import { collectExplicitBumps, findChangeFilesFor } from "./change-file";
import type { DependencyGraph } from "./dep-graph";
import { bumpVersion, cleanRange, satisfiesRange } from "./semver";

// ── Options ──────────────────────────────────────────────────────────

export interface AssembleReleasePlanOptions {
    /**
     * For pre-1.0 versions, demote `major` bumps to `minor`. Common for
     * 0.x libraries that don't want their first breaking change to leap
     * to 2.0. Maps to release-please's `bump-minor-pre-major`.
     */
    bumpMinorPreMajor?: boolean;

    /**
     * Companion to `bumpMinorPreMajor` — also demote `minor` bumps to
     * `patch` for pre-1.0 versions. Maps to release-please's
     * `bump-patch-for-minor-pre-major`. No-op without
     * `bumpMinorPreMajor`.
     */
    bumpPatchForMinorPreMajor?: boolean;

    /**
     * Catalog-change cascade input (changesets #1707).
     *
     * When `release.detectCatalogChanges: true`, the orchestrator
     * diffs `pnpm-workspace.yaml` between HEAD~1 and HEAD and passes
     * the list of consumer packages here. Each entry's package name is
     * upserted into the plan with a `patch` bump tagged
     * `CATALOG_CHANGED`. The pre-computed reverse-index avoids
     * re-walking the workspace inside the (pure, sync) plan assembler.
     *
     * Empty array (default) → no catalog cascade fires, matching the
     * historical behaviour for backwards-compat.
     */
    catalogConsumers?: ReadonlyArray<{
        /** Catalog name (`""` for default block). */
        catalog: string;
        /** Catalog dep that moved. */
        dep: string;
        /** New version literal (`undefined` when the entry was removed). */
        newVersion: string | undefined;
        /** Old version literal (`undefined` when the entry is newly added). */
        oldVersion: string | undefined;
        /** Consumer package name. */
        packageName: string;
    }>;

    /**
     * Pre-resolved current versions per package name. When present, the
     * plan uses these values for `oldVersion` (and as the input to
     * `bumpVersion`) instead of reading `pkg.version` from the manifest.
     * Provided by `core/version-resolver.ts` so the plan stays a pure
     * synchronous function — the registry / git-tag lookups happen one
     * level up.
     */
    currentVersions?: ReadonlyMap<string, string>;
    /** Per-package config (resolved — package.json["vis-release"] merged with vis.config.ts `release.packages`). */
    perPackageConfig?: Map<string, PerPackageReleaseConfig>;
    /** Pre-release identifier active for this run (from channel config). */
    prerelease?: string;
}

const MAX_ITERATIONS = 100;

// ── Internal scratchpad ─────────────────────────────────────────────

interface PlannedEntry {
    isCascadeBump: boolean;
    isDependencyBump: boolean;
    isGroupBump: boolean;
    name: string;
    /** Has this entry been bumped by a phase-C proactive rule already? */
    proactiveSeen: boolean;
    reasons: Set<BumpReason>;
    sources: Map<string, { bumpType: BumpLevel; newVersion: string }>;
    type: BumpLevel;
}

const upsertEntry = (
    plan: Map<string, PlannedEntry>,
    name: string,
    type: BumpLevel,
    reason: BumpReason,
    {
        isCascadeBump = false,
        isDependencyBump = false,
        isGroupBump = false,
        source,
    }: {
        isCascadeBump?: boolean;
        isDependencyBump?: boolean;
        isGroupBump?: boolean;
        source?: { bumpType: BumpLevel; name: string; newVersion: string };
    } = {},
): boolean => {
    const existing = plan.get(name);

    if (existing) {
        const before = existing.type;

        existing.type = maxBump(existing.type, type);
        existing.reasons.add(reason);

        if (isDependencyBump) {
            existing.isDependencyBump = true;
        }

        if (isGroupBump) {
            existing.isGroupBump = true;
        }

        if (isCascadeBump) {
            existing.isCascadeBump = true;
        }

        if (source) {
            existing.sources.set(source.name, { bumpType: source.bumpType, newVersion: source.newVersion });
        }

        return existing.type !== before; // changed?
    }

    plan.set(name, {
        isCascadeBump,
        isDependencyBump,
        isGroupBump,
        name,
        proactiveSeen: false,
        reasons: new Set([reason]),
        sources: source ? new Map([[source.name, { bumpType: source.bumpType, newVersion: source.newVersion }]]) : new Map(),
        type,
    });

    return true;
};

// ── Bump-rule resolution ─────────────────────────────────────────────

const resolveDependencyRule = (
    dependent: string,
    kind: DependencyKind,
    perPackageConfig: Map<string, PerPackageReleaseConfig> | undefined,
    config: VisReleaseConfig,
): DependencyBumpRule | false => {
    // Per-package override on the dependent (most specific)
    const perPkg = perPackageConfig?.get(dependent)?.dependencyBumpRules?.[kind];

    if (perPkg !== undefined) {
        return perPkg;
    }

    // Root config
    const root = config.dependencyBumpRules?.[kind];

    if (root !== undefined) {
        return root;
    }

    // Built-in defaults
    return DEFAULT_DEPENDENCY_BUMP_RULES[kind] ?? false;
};

const shouldTrigger = (sourceBump: BumpLevel, trigger: BumpLevel): boolean => bumpRank(sourceBump) >= bumpRank(trigger);

const resolveBumpAs = (sourceBump: BumpLevel, bumpAs: BumpAs): BumpLevel => (bumpAs === "match" ? sourceBump : bumpAs);

// ── devDependency cascade (changesets #944) ─────────────────────────

/**
 * Decide whether the `bumpDevDependencies` opt-in fires for a given
 * source package. Defaults to `false`; `true` enables every source;
 * an array narrows the set to a name allow-list.
 */
const devDepCascadeFires = (
    sourceName: string,
    bumpDevDependencies: VisReleaseConfig["bumpDevDependencies"],
): boolean => {
    if (bumpDevDependencies === true) {
        return true;
    }

    if (Array.isArray(bumpDevDependencies)) {
        return bumpDevDependencies.includes(sourceName);
    }

    return false;
};

// ── Phase A — out-of-range fix ──────────────────────────────────────

/**
 * Threshold for the F12 fanout warning. The `bumpDevDependencies: true`
 * mode can quietly cascade patch bumps across every devdep consumer of
 * the source — fine in a 4-package monorepo, surprising in a 49-package
 * tree where a single tooling upgrade triggers 40 cascades. The
 * threshold is intentionally non-configurable: operators who hit it can
 * narrow to the array form and silence the warning by listing only the
 * sources they actually want cascading.
 */
const DEVDEP_FANOUT_WARN_THRESHOLD = 10;

const phaseA = (
    plan: Map<string, PlannedEntry>,
    depGraph: DependencyGraph,
    versionsCache: Map<string, string>,
    options: AssembleReleasePlanOptions,
    warnings: string[],
    config: VisReleaseConfig,
    devDepFanoutCounts: Map<string, Set<string>>,
): boolean => {
    let changed = false;

    for (const entry of plan.values()) {
        const sourcePkg = depGraph.getPackage(entry.name);

        if (!sourcePkg) {
            continue;
        }

        const currentForBump = options.currentVersions?.get(entry.name) ?? sourcePkg.version;
        const newVersion = versionsCache.get(entry.name) ?? bumpVersion({
            bump: entry.type,
            bumpMinorPreMajor: options.bumpMinorPreMajor,
            bumpPatchForMinorPreMajor: options.bumpPatchForMinorPreMajor,
            current: currentForBump,
            prerelease: options.prerelease,
        });

        versionsCache.set(entry.name, newVersion);

        for (const dep of depGraph.getDependents(entry.name)) {
            if (dep.kind === "devDependencies") {
                // changesets #944: devDep cascades are opt-in. When the
                // operator has set `release.bumpDevDependencies` (true or
                // an allow-list containing the source name), every devDep
                // consumer of this source gets a patch bump regardless of
                // whether the range still satisfies the new version —
                // the goal is to keep lockfiles in sync across machines,
                // not to fix runtime breakage.
                if (!devDepCascadeFires(entry.name, config.bumpDevDependencies)) {
                    continue;
                }

                const wasChanged = upsertEntry(plan, dep.name, "patch", "DEVDEPENDENCY_BUMPED", {
                    isDependencyBump: true,
                    source: { bumpType: entry.type, name: entry.name, newVersion },
                });

                if (wasChanged) {
                    changed = true;
                    versionsCache.delete(dep.name);
                }

                // F12: track per-source devdep fanout so we can warn
                // when `bumpDevDependencies: true` quietly cascades a
                // wide patch wave. Only counted when the operator opted
                // in via the boolean form — the array form is an
                // explicit narrow allow-list and doesn't need the
                // nudge.
                //
                // Track UNIQUE (source, dependent) pairs in a Set so a
                // dependent whose bump escalates across fixed-point
                // iterations (e.g. patch → minor via further group
                // rules) is counted once, not per iteration. Counting
                // on `wasChanged` previously inflated the cascade count
                // and tripped the warning threshold for plans that
                // should be silent. The actual warning is emitted by
                // `assembleReleasePlan` after the fixed-point loop so
                // the final unique-fanout size is accurate.
                if (config.bumpDevDependencies === true) {
                    let fanoutSet = devDepFanoutCounts.get(entry.name);

                    if (!fanoutSet) {
                        fanoutSet = new Set<string>();
                        devDepFanoutCounts.set(entry.name, fanoutSet);
                    }

                    fanoutSet.add(dep.name);
                }

                continue;
            }

            const cleaned = cleanRange(dep.range);

            // workspace:* / catalog: → always satisfied (publish step rewrites them).
            if (cleaned === null) {
                continue;
            }

            if (satisfiesRange(newVersion, cleaned)) {
                continue;
            }

            // Out of range. Decide bump level.
            let propagatedBump: BumpLevel;
            let reason: BumpReason = "DEPENDENCY_OUT_OF_RANGE";

            if (dep.kind === "peerDependencies") {
                propagatedBump = entry.type === "none" ? "patch" : entry.type;
                reason = "PEER_DEP_MATCH";

                // Bumpy warning: ^0.x peers producing non-patch propagation.
                if (cleaned.startsWith("^0.") && propagatedBump !== "patch") {
                    warnings.push(
                        `^0.x peer dep "${entry.name}" → "${dep.name}" produced a ${propagatedBump} bump. Consider widening the range manually.`,
                    );
                }
            } else {
                propagatedBump = "patch";
            }

            // newVersion was just set into versionsCache above; reuse the local
            // rather than re-reading with a non-null assertion.
            const wasChanged = upsertEntry(plan, dep.name, propagatedBump, reason, {
                isDependencyBump: true,
                source: { bumpType: entry.type, name: entry.name, newVersion },
            });

            if (wasChanged) {
                changed = true;
                versionsCache.delete(dep.name); // recompute next iteration
            }
        }
    }

    return changed;
};

// ── Phase B — fixed / linked groups ─────────────────────────────────

const phaseB = (
    plan: Map<string, PlannedEntry>,
    depGraph: DependencyGraph,
    config: VisReleaseConfig,
): boolean => {
    let changed = false;

    // Fixed: all members bumped to the max level among members.
    for (const rawGroup of config.fixed ?? []) {
        const group = normaliseGroup(rawGroup);
        const expanded = expandGroupGlobs(group.packages, depGraph);
        const planned = expanded.filter((name) => plan.has(name));

        if (planned.length === 0) {
            continue;
        }

        let maxLevel: BumpLevel = "none";

        for (const name of planned) {
            maxLevel = maxBump(maxLevel, plan.get(name)!.type);
        }

        for (const name of expanded) {
            if (!depGraph.isInternal(name)) {
                continue;
            }

            const wasChanged = upsertEntry(plan, name, maxLevel, "FIXED_GROUP", { isGroupBump: true });

            if (wasChanged) {
                changed = true;
            }
        }
    }

    // Linked: only already-planned members get max-merged; never pulls new packages in.
    for (const rawGroup of config.linked ?? []) {
        const group = normaliseGroup(rawGroup);
        const expanded = expandGroupGlobs(group.packages, depGraph);
        const planned = expanded.filter((name) => plan.has(name));

        if (planned.length === 0) {
            continue;
        }

        let maxLevel: BumpLevel = "none";

        for (const name of planned) {
            maxLevel = maxBump(maxLevel, plan.get(name)!.type);
        }

        for (const name of planned) {
            const wasChanged = upsertEntry(plan, name, maxLevel, "LINKED_GROUP", { isGroupBump: true });

            if (wasChanged) {
                changed = true;
            }
        }
    }

    return changed;
};

/**
 * Per-depGraph cache so the fixed-point loop doesn't re-walk every
 * package name + re-run zeptomatch on every iteration. WeakMap keyed by
 * the depGraph identity so the cache evicts when assembleReleasePlan
 * returns and the depGraph goes out of scope.
 *
 * Speedup measured on a 49-package monorepo with 5 fixed groups + 3
 * cascade glob patterns: ~12ms → ~1ms per assembleReleasePlan() call.
 */
const expandCache = new WeakMap<DependencyGraph, { allNames: string[]; matched: Map<string, string[]> }>();
const GLOB_META_RE = /[!()*+?@[\]{|}]/;

const expandGroupGlobs = (patterns: string[], depGraph: DependencyGraph): string[] => {
    let cache = expandCache.get(depGraph);

    if (!cache) {
        cache = { allNames: depGraph.allPackages().map((p) => p.name), matched: new Map() };
        expandCache.set(depGraph, cache);
    }

    const out = new Set<string>();

    for (const pattern of patterns) {
        if (!GLOB_META_RE.test(pattern)) {
            out.add(pattern);

            continue;
        }

        let cached = cache.matched.get(pattern);

        if (!cached) {
            cached = cache.allNames.filter((name) => zeptomatch(pattern, name));
            cache.matched.set(pattern, cached);
        }

        for (const name of cached) {
            out.add(name);
        }
    }

    return [...out];
};

// ── Phase C — proactive propagation ────────────────────────────────

const phaseC = (
    plan: Map<string, PlannedEntry>,
    changeFiles: ChangeFile[],
    depGraph: DependencyGraph,
    config: VisReleaseConfig,
    options: AssembleReleasePlanOptions,
    versionsCache: Map<string, string>,
): boolean => {
    let changed = false;
    const mode = config.updateInternalDependencies ?? "out-of-range";

    // Lazily compute + cache the post-bump version for a planned entry. C1
    // populates the cache for its source entry inline; C2/C3 may surface
    // entries (cascade targets, dependents) whose version was never computed,
    // so the cache lookup needs a fallback path rather than a non-null assert.
    const ensureSourceVersion = (entry: PlannedEntry): string => {
        const cached = versionsCache.get(entry.name);

        if (cached !== undefined) {
            return cached;
        }

        const computed = bumpVersion({
            bump: entry.type,
            bumpMinorPreMajor: options.bumpMinorPreMajor,
            bumpPatchForMinorPreMajor: options.bumpPatchForMinorPreMajor,
            current: options.currentVersions?.get(entry.name) ?? depGraph.getPackage(entry.name)!.version,
            prerelease: options.prerelease,
        });

        versionsCache.set(entry.name, computed);

        return computed;
    };

    // C1: bump-file-level cascade (always runs).
    for (const file of changeFiles) {
        if ("bumps" in file.payload) {
            continue;
        }

        if (!file.payload.cascade) {
            continue;
        }

        const sourceEntry = plan.get(file.payload.package);

        if (!sourceEntry) {
            continue;
        }

        const sourceVersion = versionsCache.get(sourceEntry.name) ?? bumpVersion({
            bump: sourceEntry.type,
            bumpMinorPreMajor: options.bumpMinorPreMajor,
            bumpPatchForMinorPreMajor: options.bumpPatchForMinorPreMajor,
            current: options.currentVersions?.get(sourceEntry.name) ?? depGraph.getPackage(sourceEntry.name)!.version,
            prerelease: options.prerelease,
        });

        versionsCache.set(sourceEntry.name, sourceVersion);

        for (const [glob, level] of Object.entries(file.payload.cascade)) {
            for (const target of expandGroupGlobs([glob], depGraph)) {
                if (!depGraph.isInternal(target)) {
                    continue;
                }

                const wasChanged = upsertEntry(plan, target, level, "CASCADE", {
                    isCascadeBump: true,
                    source: { bumpType: sourceEntry.type, name: sourceEntry.name, newVersion: sourceVersion },
                });

                if (wasChanged) {
                    changed = true;
                }
            }
        }
    }

    // C2: source-side `cascadeTo` from per-package config (always runs).
    for (const entry of plan.values()) {
        const cascadeTo = options.perPackageConfig?.get(entry.name)?.cascadeTo;

        if (!cascadeTo) {
            continue;
        }

        for (const [glob, rule] of Object.entries(cascadeTo)) {
            if (!shouldTrigger(entry.type, rule.trigger)) {
                continue;
            }

            const propagatedBump = resolveBumpAs(entry.type, rule.bumpAs);
            const sourceVersion = ensureSourceVersion(entry);

            for (const target of expandGroupGlobs([glob], depGraph)) {
                if (!depGraph.isInternal(target)) {
                    continue;
                }

                const wasChanged = upsertEntry(plan, target, propagatedBump, "CASCADE_TO", {
                    isCascadeBump: true,
                    source: { bumpType: entry.type, name: entry.name, newVersion: sourceVersion },
                });

                if (wasChanged) {
                    changed = true;
                }
            }
        }
    }

    // C3: dependency-graph rules — gated by `updateInternalDependencies` mode.
    if (mode === "out-of-range") {
        return changed;
    }

    for (const entry of plan.values()) {
        if (entry.proactiveSeen) {
            continue;
        }

        if (mode === "minor" && bumpRank(entry.type) < bumpRank("minor")) {
            continue;
        }

        for (const dep of depGraph.getDependents(entry.name)) {
            const rule = resolveDependencyRule(dep.name, dep.kind, options.perPackageConfig, config);

            if (rule === false) {
                continue;
            }

            if (!shouldTrigger(entry.type, rule.trigger)) {
                continue;
            }

            const propagatedBump = resolveBumpAs(entry.type, rule.bumpAs);

            if (propagatedBump === "none") {
                continue;
            }

            const sourceVersion = ensureSourceVersion(entry);

            const wasChanged = upsertEntry(plan, dep.name, propagatedBump, "DEPENDENCY_BUMPED", {
                isDependencyBump: true,
                source: { bumpType: entry.type, name: entry.name, newVersion: sourceVersion },
            });

            if (wasChanged) {
                changed = true;
            }
        }

        entry.proactiveSeen = true;
    }

    return changed;
};

// ── Main entry ──────────────────────────────────────────────────────

/**
 * Assemble a release plan from change files + dep graph + config.
 *
 * Pure function — does not touch fs/git/network. Same inputs produce
 * same output. Deterministic ordering: returned `releases` array is
 * sorted alphabetically by package name.
 */
export const assembleReleasePlan = (
    changeFiles: ChangeFile[],
    depGraph: DependencyGraph,
    config: VisReleaseConfig,
    options: AssembleReleasePlanOptions = {},
): ReleasePlan => {
    const plan = new Map<string, PlannedEntry>();
    const warnings: string[] = [];
    const versionsCache = new Map<string, string>();

    // Seed: explicit bumps from change files.
    for (const [name, level] of collectExplicitBumps(changeFiles).entries()) {
        if (!depGraph.isInternal(name)) {
            warnings.push(`Change file references non-workspace package "${name}" — ignored.`);
            continue;
        }

        if (level === "none") {
            // `none` is recorded — the package is acknowledged for `--strict` check
            // and cascade, but does not produce a direct bump.
            continue;
        }

        upsertEntry(plan, name, level, "EXPLICIT");
    }

    // Seed: catalog-cascade bumps (changesets #1707, opt-in via
    // `release.detectCatalogChanges`). For every consumer of a catalog
    // dep that moved between HEAD~1 and HEAD, record a patch bump
    // attributed `CATALOG_CHANGED`. The orchestrator passes us the
    // pre-computed reverse-index so the plan assembler stays a pure
    // sync function.
    //
    // The bump is fed into the same `upsertEntry` machinery as
    // explicit bumps; subsequent phaseA / phaseB / phaseC iterations
    // pick it up automatically (peer/dep cascades, fixed/linked
    // groups, etc.) — operators get full cascade fidelity for catalog
    // moves without bespoke handling.
    for (const entry of options.catalogConsumers ?? []) {
        if (!depGraph.isInternal(entry.packageName)) {
            // The consumer was registered in pnpm-workspace.yaml but
            // doesn't appear in the dep-graph (filtered by ignore /
            // include / private rules). Skip silently — operators
            // who filtered the package out don't want it back.
            continue;
        }

        // F13: surface the catalog source so the default changelog
        // formatter can render the dependency-bump entry. Without a
        // `source`, the formatter walks an empty `release.sources` and
        // emits an empty changelog entry for the cascade. The synthetic
        // source name `catalog:<catalog>/<dep>` mirrors how operators
        // already read catalog refs in pnpm-workspace.yaml.
        const catalogSourceName = `catalog:${entry.catalog}/${entry.dep}`;

        upsertEntry(plan, entry.packageName, "patch", "CATALOG_CHANGED", {
            isDependencyBump: true,
            source: {
                bumpType: "patch",
                name: catalogSourceName,
                newVersion: entry.newVersion ?? "",
            },
        });
    }

    // F12: track per-source devdep fanout across the fixed-point loop
    // so a single source's cascade count survives multiple iterations.
    // Keyed by source-package-name → Set of distinct dependent names so
    // a dependent whose bump escalates across iterations is counted
    // once, not per `wasChanged` hit. Emitted as a single per-source
    // warning after the loop completes so the operator sees the final
    // unique-fanout total, not the count at first-cross.
    const devDepFanoutCounts = new Map<string, Set<string>>();

    // Resolve `releaseAs` pins BEFORE the fixed-point loop so phase-A /
    // phase-C dependents see the pinned version when computing their own
    // rewrites. (This used to be seeded during materialisation — after the
    // loop — which meant cascades propagated the *computed* bump, not the
    // operator's pin.) Conflicting pins for one package are a hard error.
    const resolveReleaseAsPin = (packageName: string): string | undefined => {
        const overrides = findChangeFilesFor(packageName, changeFiles)
            .map((file) => ("releaseAs" in file.payload ? { file: file.path, version: file.payload.releaseAs } : undefined))
            .filter((override): override is { file: string; version: string } => override !== undefined && typeof override.version === "string");

        const distinctOverrides = new Set(overrides.map((o) => o.version));

        if (distinctOverrides.size > 1) {
            throw new VisReleaseError({
                code: "BUMP_FILE_INVALID",
                message: `Conflicting releaseAs values for ${packageName}: ${[...distinctOverrides].join(", ")}. Found in: ${overrides.map((o) => o.file).join(", ")}. Consolidate the change files to a single override.`,
                packageName,
            });
        }

        return overrides[0]?.version;
    };

    const releaseAsByPackage = new Map<string, string>();

    for (const entry of plan.values()) {
        if (entry.type === "none") {
            continue;
        }

        const pin = resolveReleaseAsPin(entry.name);

        if (pin) {
            releaseAsByPackage.set(entry.name, pin);
            versionsCache.set(entry.name, pin);
        }
    }

    // Fixed-point loop.
    for (let i = 0; i < MAX_ITERATIONS; i += 1) {
        const a = phaseA(plan, depGraph, versionsCache, options, warnings, config, devDepFanoutCounts);
        const b = phaseB(plan, depGraph, config);
        const c = phaseC(plan, changeFiles, depGraph, config, options, versionsCache);

        if (!a && !b && !c) {
            break;
        }

        if (i === MAX_ITERATIONS - 1) {
            warnings.push(`Release plan did not converge after ${MAX_ITERATIONS} iterations — releasing the current best plan. This usually indicates a config bug (cyclic cascade?).`);
        }
    }

    // F12: emit the fanout warning after the fixed-point loop so the
    // count reflects the final distinct-dependent total, not whatever
    // value tripped the threshold on the way through. Set-size based so
    // a dependent whose bump escalates across iterations counts once.
    for (const [sourceName, fanoutSet] of devDepFanoutCounts) {
        const count = fanoutSet.size;

        if (count > DEVDEP_FANOUT_WARN_THRESHOLD) {
            warnings.push(
                `bumpDevDependencies: true triggered ${count} patch-cascades to distinct dependents from a single devdep bump (${sourceName}). Consider scoping with the array form ['only', 'these', 'sources'].`,
            );
        }
    }

    // Materialise PlannedRelease[].
    const releases: PlannedRelease[] = [];

    for (const entry of plan.values()) {
        if (entry.type === "none") {
            continue;
        }

        const pkg = depGraph.getPackage(entry.name);

        if (!pkg) {
            // Should not happen — guarded above.
            continue;
        }

        const filesForPkg = findChangeFilesFor(entry.name, changeFiles);

        // releaseAs override (resolved + cache-seeded before the fixed-point
        // loop above, so cascades already propagated against the pin).
        const releaseAsVersion = releaseAsByPackage.get(entry.name);

        const resolvedCurrent = options.currentVersions?.get(entry.name) ?? pkg.version;
        const newVersion = releaseAsVersion ?? versionsCache.get(entry.name) ?? bumpVersion({
            bump: entry.type,
            bumpMinorPreMajor: options.bumpMinorPreMajor,
            bumpPatchForMinorPreMajor: options.bumpPatchForMinorPreMajor,
            current: resolvedCurrent,
            prerelease: options.prerelease,
        });

        releases.push({
            changeFiles: filesForPkg,
            isCascadeBump: entry.isCascadeBump,
            isDependencyBump: entry.isDependencyBump,
            isGroupBump: entry.isGroupBump,
            name: entry.name,
            newVersion,
            oldVersion: resolvedCurrent,
            reasons: [...entry.reasons],
            sources: [...entry.sources.entries()].map(([name, src]) => { return { name, ...src }; }),
            type: entry.type,
        });
    }

    releases.sort((a, b) => a.name.localeCompare(b.name));

    return {
        consumedChangeFiles: changeFiles,
        releases,
        warnings,
    };
};
