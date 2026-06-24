/**
 * `currentVersionResolver` — pluggable source of truth for the `oldVersion`
 * field of a planned release (nx parity).
 *
 * Different teams have different canonical sources for "the version this
 * package is on right now":
 *
 *   - `"disk"` — `package.json#version` on the working tree (the historical
 *     vis behaviour; default).
 *   - `"registry"` — the latest version live on the package registry. Routed
 *     through the package's own `versionActions.readPublishedVersion()`, so
 *     npm, cargo, PyPI, Maven Central, etc. all work without per-resolver
 *     plumbing.
 *   - `"git-tag"` — the version embedded in the most recent git tag matching
 *     the package's `releaseTagPattern`. Useful for monorepos where the
 *     tag history is the authoritative "what shipped" log.
 *
 * Every non-`disk` mode falls back to the manifest version when its primary
 * source fails (404 on a fresh registry name, no tag matching the pattern
 * yet, etc.). Falls back with a warning rather than throwing so a fresh
 * repo doesn't have to special-case the bootstrap path — `--first-release`
 * is the explicit opt-in for that shortcut and lives in the orchestrator.
 *
 * Pure with respect to its inputs: same package + same registry/git state
 * always returns the same value. Side-effects are confined to the runner
 * (used by the registry / git-tag modes).
 */

import semver from "semver";

import type { PerPackageReleaseConfig, VisReleaseConfig, WorkspacePackage } from "../types";
import type { DependencyGraph } from "./dep-graph";
import type { CommandRunner, PackageManagerAdapter } from "./package-managers/interface";
import { createVersionActions } from "./version-actions/registry";
import { resolveVersionActionsId } from "./workspace";

export type CurrentVersionResolverMode = "disk" | "git-tag" | "registry";

export interface ResolveCurrentVersionOptions {
    /** Workspace cwd — used by the git-tag resolver. */
    cwd: string;
    /** Per-package config (used by the git-tag resolver for releaseTagPattern overrides). */
    perPackageConfig?: PerPackageReleaseConfig;
    /** Package-manager adapter — passed through to `versionActions.readPublishedVersion()`. */
    pm: PackageManagerAdapter;
    /** Runner used for registry queries and `git tag --list`. */
    runner: CommandRunner;

    /**
     * Skip the registry / git-tag probes entirely and fall back to the
     * manifest version. Set by read-only command handlers (`release add`,
     * `release doctor`, `release plan`, `release pre status`, …) that
     * have no need to consult an upstream source and would otherwise
     * trigger one network request per package per invocation.
     *
     * When `true`, the resolver behaves exactly as if every package had
     * `currentVersionResolver: "disk"` configured. No warning is emitted
     * because the operator did not opt in to a non-disk resolver for
     * this invocation — they opted in for `version` / `publish` / `ci
     * release` and we're skipping the lookup deliberately here.
     */
    skipRegistryLookup?: boolean;
    /** Workspace-level config. Read for `releaseTagPattern` defaults. */
    workspaceConfig?: VisReleaseConfig;
}

/**
 * Tiny in-flight concurrency cap. Bounds N to keep `crates.io` (1 rps
 * unauthenticated) and PyPI (per-IP rate limits) from rejecting us when
 * the workspace has 40+ packages and every one resolves through the
 * registry. Inlined rather than depending on `p-limit` to keep
 * `@visulima/vis` dependency-light.
 *
 * The returned function takes an async thunk; the limiter never
 * rejects, so unhandled errors propagate from the thunk as-is.
 */
const pLimit = (n: number): (<T>(thunk: () => Promise<T>) => Promise<T>) => {
    let active = 0;
    const queue: (() => void)[] = [];

    const next = (): void => {
        if (active >= n) {
            return;
        }

        const job = queue.shift();

        if (job) {
            active += 1;
            job();
        }
    };

    return async <T>(thunk: () => Promise<T>): Promise<T> =>
        new Promise<T>((resolve, reject) => {
            const onSettled = (): void => {
                active -= 1;
                next();
            };

            const run = (): void => {
                // eslint-disable-next-line promise/catch-or-return -- rejection handled by the reject handler passed to then()
                thunk().then(resolve, reject).finally(onSettled);
            };

            queue.push(run);
            next();
        });
};

/**
 * Default concurrency cap for `resolveCurrentVersionsForWorkspace`.
 * Exported so tests can assert the cap is actually being applied — the
 * value itself is a heuristic balance: low enough that crates.io's 1
 * rps quota stays courteous, high enough that a 40-package workspace
 * doesn't serialise the whole resolver.
 */
export const REGISTRY_LOOKUP_CONCURRENCY = 4;

/**
 * Per-process memoisation of registry / git-tag lookups. Keyed on
 * `${pkg.name}@${mode}@${pkg.version}` so that:
 *
 *   1. Two `buildContext` calls in the same process (e.g. a test
 *      harness that builds + applies + publishes back-to-back) do not
 *      re-probe the registry.
 *   2. The manifest version is included in the key so a `version` apply
 *      that mutates `pkg.json` mid-process invalidates the entry —
 *      otherwise the `publish` follow-up would resolve the OLD value.
 *   3. The mode is part of the key so a per-package override switching
 *      between `registry` and `git-tag` doesn't share an entry.
 *
 * The map holds the `Promise` rather than its resolved value so
 * concurrent callers join the same in-flight request (de-duplication on
 * top of the rate-limit cap).
 */
const lookupMemo = new Map<string, Promise<ResolveCurrentVersionResult>>();

/**
 * Reset the memoisation cache. Test-only — production code never needs
 * to call this because the process lifetime IS the cache lifetime.
 */
// eslint-disable-next-line no-underscore-dangle, @typescript-eslint/naming-convention -- test-only export seam
export const __resetLookupMemoForTests = (): void => {
    lookupMemo.clear();
};

/**
 * Discriminated result so callers (release-plan, tests) can surface
 * "fell back to manifest" as a plan warning without re-deriving the
 * reason from message strings.
 */
export interface ResolveCurrentVersionResult {
    /** Human-readable note when a fallback happened (used for plan warnings). */
    fallbackReason?: string;
    /** The mode that produced the result — `"disk"` when a fallback occurred. */
    resolvedFrom: CurrentVersionResolverMode;
    /** The resolved version. */
    version: string;
}

/**
 * Compile a `releaseTagPattern` into a strict regex with a capturing
 * group around the `{version}` token. The configured pattern is the
 * source of truth for both tag *writing* (via `renderTagPattern`) and
 * tag *reading* (here) — using the same pattern for both directions
 * avoids the historical footgun where the strict matcher was a tight
 * `{name}@{version}` regex and the fallback was a literal
 * `${pkg.name}@` prefix that ignored the operator's delimiter choice
 * (e.g. `v{version}` or `{name}-v{version}`).
 *
 * Every token is replaced with its regex equivalent; every other
 * character is escaped so the pattern is matched literally. Returns an
 * anchored regex (`^…$`) — partial-tag matches are never valid.
 *
 * Supported tokens:
 *   - `{name}` / `{unscopedName}` — package name (full or stripped of
 *     scope); replaced with the regex-escaped literal so a scoped name
 *     like `@scope/foo` is matched verbatim.
 *   - `{version}` — capturing semver group (`MAJOR.MINOR.PATCH` with
 *     optional `-prerelease` and `+build` suffixes).
 *   - `{major}` / `{minor}` / `{patch}` / `{date}` / `{channel}` —
 *     wildcards matching one or more non-slash characters.
 */
export const compileReleaseTagRegex = (pattern: string, pkg: { name: string }): RegExp => {
    const escape = (s: string): string => s.replaceAll(/[$()*+.?[\\\]^{|}]/g, String.raw`\$&`);
    let reSource = "^";
    let lastIndex = 0;
    const tokenRe = /\{(name|unscopedName|version|major|minor|patch|date|channel)\}/g;
    let tokenMatch: RegExpExecArray | null;

    // eslint-disable-next-line no-cond-assign
    while ((tokenMatch = tokenRe.exec(pattern)) !== null) {
        reSource += escape(pattern.slice(lastIndex, tokenMatch.index));
        const key = tokenMatch[1]!;

        switch (key) {
            case "name": {
                reSource += escape(pkg.name);

                break;
            }
            case "unscopedName": {
                reSource += escape(pkg.name.replace(/^@[^/]+\//, ""));

                break;
            }
            case "version": {
                // semver capture — major.minor.patch with optional pre/build segments
                reSource += String.raw`(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)`;

                break;
            }
            default: {
                // major/minor/patch/date/channel — one-or-more non-/ chars
                reSource += "[^/]+";
            }
        }

        lastIndex = tokenMatch.index + tokenMatch[0].length;
    }

    reSource += `${escape(pattern.slice(lastIndex))}$`;

    return new RegExp(reSource);
};

/**
 * Resolve the "current" version of a single package via the requested mode.
 *
 * The non-`disk` modes are best-effort: when the registry returns nothing
 * (404, no published versions yet) or no matching git tag exists, the
 * resolver falls back to the manifest and notes the reason so the caller
 * can surface a plan warning.
 *
 * Implementations of `readPublishedVersion()` already swallow registry
 * 404s and return `undefined`, so this function never needs to catch
 * thrown errors from them. A thrown error here propagates — that's a
 * real bug, not a soft 404.
 */
export const resolveCurrentVersion = async (
    pkg: WorkspacePackage,
    mode: CurrentVersionResolverMode,
    _depGraph: DependencyGraph,
    options: ResolveCurrentVersionOptions,
): Promise<ResolveCurrentVersionResult> => {
    if (mode === "disk") {
        return { resolvedFrom: "disk", version: pkg.version };
    }

    if (mode === "registry") {
        const actionsId = resolveVersionActionsId(pkg, options.perPackageConfig ?? {});
        const actions = createVersionActions(actionsId);

        const published = await actions.readPublishedVersion({ pkg, pm: options.pm, workspaceConfig: options.workspaceConfig });

        if (published && semver.valid(published)) {
            return { resolvedFrom: "registry", version: published };
        }

        return {
            fallbackReason:
                published === undefined
                    ? `registry returned no version for ${pkg.name} (likely a 404 / not-yet-published); falling back to manifest version ${pkg.version}.`
                    : `registry returned an invalid semver "${published}" for ${pkg.name}; falling back to manifest version ${pkg.version}.`,
            resolvedFrom: "disk",
            version: pkg.version,
        };
    }

    // git-tag mode
    const pattern = options.perPackageConfig?.releaseTagPattern ?? options.workspaceConfig?.releaseTagPattern ?? "{name}@{version}";

    // Compile the pattern to a globbed `--list` filter so we don't have to
    // pull every tag in the repo and post-filter in process. The substitution
    // replaces tokens with their literal counterparts where known (`{name}`,
    // `{unscopedName}`) and a `*` glob for everything else — `{version}`,
    // `{major}`, etc. all become wildcards because we don't yet know the value.
    const listGlob = pattern.replaceAll(/\{(name|unscopedName|version|major|minor|patch|date|channel)\}/g, (_match, key: string) => {
        if (key === "name") {
            return pkg.name;
        }

        if (key === "unscopedName") {
            return pkg.name.replace(/^@[^/]+\//, "");
        }

        return "*";
    });

    const listResult = await options.runner.run("git", ["tag", "--list", listGlob, "--sort=-v:refname"], { cwd: options.cwd, silent: true });

    if (listResult.exitCode !== 0) {
        return {
            fallbackReason: `git tag --list ${listGlob} failed (exit ${listResult.exitCode}); falling back to manifest version ${pkg.version}.`,
            resolvedFrom: "disk",
            version: pkg.version,
        };
    }

    const tags = listResult.stdout
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

    if (tags.length === 0) {
        return {
            fallbackReason: `no git tag matched pattern "${pattern}" for ${pkg.name}; falling back to manifest version ${pkg.version}. (Pass --first-release to bootstrap.)`,
            resolvedFrom: "disk",
            version: pkg.version,
        };
    }

    // Compile the configured pattern to a strict matcher: literal
    // characters are regex-escaped, the `{version}` token becomes a
    // capturing semver group, every other supported token becomes a
    // bounded wildcard. This is the SAME pattern the operator
    // configured for tag *writing*, so a `releaseTagPattern: "v{version}"`
    // is correctly turned into `^v(<semver>)$` for tag *reading* — no
    // literal `${pkg.name}@` fallback that would ignore the operator's
    // delimiter choice.
    const tagRe = compileReleaseTagRegex(pattern, pkg);
    const candidates: string[] = [];

    for (const tag of tags) {
        const match = tagRe.exec(tag);

        if (match?.[1] && semver.valid(match[1])) {
            candidates.push(match[1]);
        }
    }

    if (candidates.length === 0) {
        return {
            fallbackReason: `git tag pattern "${pattern}" matched tags but none yielded a valid semver for ${pkg.name}; falling back to manifest version ${pkg.version}.`,
            resolvedFrom: "disk",
            version: pkg.version,
        };
    }

    // semver.rcompare = "reverse-compare", so the first element is the highest.
    candidates.sort(semver.rcompare);

    return { resolvedFrom: "git-tag", version: candidates[0]! };
};

/**
 * Resolve `currentVersionResolver` for a given package by precedence:
 *   1. per-package override (`packages.&lt;name>.currentVersionResolver`)
 *   2. workspace-level (`release.currentVersionResolver`)
 *   3. default `"disk"`.
 *
 * When `firstRelease` is set, the resolver is forced to `"disk"` regardless
 * of config — the bootstrap path can't query a registry/tag history that
 * doesn't exist yet.
 */
export const resolveModeForPackage = (
    workspaceConfig: VisReleaseConfig | undefined,
    perPackageConfig: PerPackageReleaseConfig | undefined,
    firstRelease: boolean,
): CurrentVersionResolverMode => {
    if (firstRelease) {
        return "disk";
    }

    return perPackageConfig?.currentVersionResolver ?? workspaceConfig?.currentVersionResolver ?? "disk";
};

/**
 * Build a name → resolved-version map for every package being released
 * this wave. Pre-computed so `assembleReleasePlan` stays a pure synchronous
 * function (the resolver itself is async because of the registry / git-tag
 * paths).
 *
 * Falls back per-package via {@link resolveCurrentVersion} — the returned
 * map is always complete (every input package has a value), even when the
 * primary source fails for one of them.
 */
export const resolveCurrentVersionsForWorkspace = async (
    packages: ReadonlyArray<WorkspacePackage>,
    depGraph: DependencyGraph,
    workspaceConfig: VisReleaseConfig | undefined,
    perPackageConfigMap: Map<string, PerPackageReleaseConfig>,
    options: Omit<ResolveCurrentVersionOptions, "perPackageConfig" | "workspaceConfig"> & { firstRelease: boolean },
): Promise<{ versions: Map<string, string>; warnings: string[] }> => {
    const versions = new Map<string, string>();
    const warnings: string[] = [];

    // Cap concurrency to avoid hammering rate-limited registries (crates.io
    // is documented at ~1 rps unauth; PyPI rate-limits too). For a 49-pkg
    // monorepo the unbounded `Promise.all` historically fired 49 parallel
    // probes per `buildContext` invocation — and `buildContext` runs on
    // every read-only command (`release add`, `release doctor`, …).
    const limit = pLimit(REGISTRY_LOOKUP_CONCURRENCY);

    // Resolve in parallel with a concurrency cap. Every package's lookup
    // is independent; the in-flight cap is the only coupling.
    const results = await Promise.all(
        packages.map(async (pkg) =>
            limit(async () => {
                const perPkg = perPackageConfigMap.get(pkg.name);
                const configuredMode = resolveModeForPackage(workspaceConfig, perPkg, options.firstRelease);

                // `skipRegistryLookup` short-circuits to disk for every
                // package regardless of configured mode — used by read-only
                // command paths that have no need for the upstream value.
                // No warning is emitted: the operator did not opt into
                // a non-disk resolver for this invocation, the resolver
                // entry-point opted out for them.
                const mode: CurrentVersionResolverMode = options.skipRegistryLookup ? "disk" : configuredMode;

                // Memoise on `name@mode@manifest-version`. The manifest
                // version is in the key so a `version`-apply that mutates
                // `pkg.json` mid-process invalidates the entry for the
                // follow-up `publish`.
                const memoKey = `${pkg.name}@${mode}@${pkg.version}`;
                const cached = lookupMemo.get(memoKey);

                if (cached) {
                    return { mode, pkg, result: await cached };
                }

                const promise = resolveCurrentVersion(pkg, mode, depGraph, {
                    ...options,
                    perPackageConfig: perPkg,
                    workspaceConfig,
                });

                lookupMemo.set(memoKey, promise);

                // If the lookup rejects, evict the entry so the next caller
                // re-attempts rather than re-failing on a cached rejection.
                promise.catch(() => {
                    if (lookupMemo.get(memoKey) === promise) {
                        lookupMemo.delete(memoKey);
                    }
                });

                return { mode, pkg, result: await promise };
            }),
        ),
    );

    for (const { mode, pkg, result } of results) {
        versions.set(pkg.name, result.version);

        if (result.fallbackReason && mode !== "disk") {
            warnings.push(`currentVersionResolver (${mode}): ${result.fallbackReason}`);
        }
    }

    return { versions, warnings };
};

// Renders a tag for a given package@version (re-exported for tests). Not a
// resolver concern per se but lives here so the test harness can compose
// "tag exists for X@Y" without depending on git.ts directly.

export { defaultTagFor, renderTagPattern } from "./git";
