/**
 * Orchestrator — turns input config into an executed release plan.
 *
 * Used by `releaseVersion()` / `releasePublish()` / `release()` from the
 * programmatic API and by the CLI handlers. Composes:
 *   1. Workspace discovery (via active PM adapter)
 *   2. Change-file reading
 *   3. Branch + channel resolution
 *   4. Release-plan assembly
 *   5. (For version/release) apply-release-plan to disk
 *   6. (For publish/release) per-package versionActions.publish via topo order
 *
 * Pure orchestration — no business logic; that lives in the imported modules.
 */

import { unlink, writeFile } from "node:fs/promises";

import semver from "semver";

import { DEFAULT_CHANGES_DIR, DEFAULT_CONFIG } from "../config";
import { VisReleaseError } from "../errors";
import type {
    PackageManifest,
    PerPackageReleaseConfig,
    ReleasePlan,
    VisReleaseConfig,
    WorkspacePackage,
} from "../types";
import { applyReleasePlan } from "./apply-release-plan";
import { parseCatalogs } from "./catalog";
import { readChangeFiles } from "./change-file-reader";
import { detectCurrentBranch, resolveChannel } from "./channels";
import { DependencyGraph } from "./dep-graph";
import { createAdapter, detectPackageManager } from "./package-managers/detect";
import type { PackageManagerAdapter } from "./package-managers/interface";
import { collectContributors, expandReleaseNoteTemplate } from "./release-note-template";
import { assembleReleasePlan } from "./release-plan";
import { createShellRunner } from "./shell-runner";
import { CargoVersionActions } from "./version-actions/cargo";
import { ContainerActions } from "./version-actions/container";
import type { VersionActions } from "./version-actions/interface";
import { JsrVersionActions } from "./version-actions/jsr";
import { MavenVersionActions } from "./version-actions/maven";
import { NativeAddonVersionActions } from "./version-actions/native-addon";
import { NpmVersionActions } from "./version-actions/npm";
import { PrivateVersionActions } from "./version-actions/private";
import { PythonVersionActions } from "./version-actions/python";
import { ShellPublishActions } from "./version-actions/shell";
import { discoverPackages, resolveVersionActionsId } from "./workspace";

export interface OrchestratorContext {
    branch?: string;
    channel?: { mode: "auto-publish" | "version-pr"; prerelease?: string; tag: string };
    config: VisReleaseConfig;
    cwd: string;
    depGraph: DependencyGraph;

    /**
     * Greenfield / first-time release flag. When set:
     *   - currentVersionResolver is forced to "disk"
     *   - per-package remote tag-collision checks are skipped
     *   - missing prior tags are treated as the bootstrap case, not an error.
     *
     * Equivalent to `nx release --first-release` and release-please's
     * `bootstrap-sha` knob.
     */
    firstRelease: boolean;
    packages: WorkspacePackage[];
    perPackageConfig: Map<string, PerPackageReleaseConfig>;
    plan: ReleasePlan;
    pm: PackageManagerAdapter;

    /**
     * Snapshot of `&lt;changesDir>/pre.json` at the time `buildContext` ran.
     * Pinned here (M9 fix) so `applyContext` doesn't re-read the file —
     * otherwise a concurrent `vis release pre exit` between `buildContext`
     * and `applyContext` could leave the version computed as a prerelease
     * while exit-pending cleanup also fires. Undefined when no pre.json
     * exists.
     */
    preMode?: import("./pre-mode").PreModeFile;
}

export interface BuildContextOptions {
    /** Override branch detection. */
    channel?: string;
    /** Inline config override (merged on top of vis.config.ts's `release` block). */
    config?: VisReleaseConfig;
    /** Workspace root. Default: process.cwd(). */
    cwd?: string;

    /**
     * Treat this run as the first release on a greenfield monorepo (or a
     * freshly-added package). Forces `currentVersionResolver: "disk"`,
     * skips tag-collision checks against the remote, and bypasses any
     * "missing prior tag" failure path. Maps to `nx release --first-release`
     * and release-please's `bootstrap-sha` mechanism.
     */
    firstRelease?: boolean;
    /** Limit to packages matching these globs (post-discovery filter). */
    projects?: string[];

    /**
     * Skip the configured `currentVersionResolver` and force every
     * package to the manifest (disk) version. Set this from read-only
     * command handlers (`vis release plan` / `status` / `doctor`) so
     * they don't fire N parallel `npm view` / `cargo search` / git-tag
     * probes per invocation — those commands don't need a registry-
     * accurate baseline.
     *
     * `version`/`publish`/`ci release` leave this unset so they DO
     * consult the configured resolver for accurate bump computation.
     */
    skipRegistryLookup?: boolean;
}

/**
 * Build the full context: load vis.config.ts → extract release block →
 * merge with inline options → discover packages → parse change files →
 * assemble plan.
 *
 * Reusable across `vis release status` (read-only print), `vis release version`
 * (apply to disk), `vis release publish` (publish), `vis release plan` (json).
 */
export const buildContext = async (
    options: BuildContextOptions = {},
): Promise<OrchestratorContext> => {
    const cwd = options.cwd ?? process.cwd();
    const runner = createShellRunner();
    const pmId = await detectPackageManager(cwd, runner);
    const pm = createAdapter(pmId, runner);

    // Hard-fail if the active PM is below the minimum version (RFC §19.6).
    // Skipped if version detection itself fails (the PM may not be installed
    // — vis can still discover packages from the lockfile / manifest).
    const detectedVersion = await pm.detectVersion(cwd);

    if (detectedVersion && !supportsMinVersion(detectedVersion, pm.minVersion)) {
        throw new VisReleaseError({
            code: "PM_VERSION_TOO_LOW",
            hint: `pnpm install -g ${pm.id}@latest  (or your equivalent)`,
            message: `${pm.id} version ${detectedVersion} is below the required minimum ${pm.minVersion}. Upgrade ${pm.id} to enable release operations.`,
        });
    }

    // Load vis.config.ts → extract `release` block → merge with inline options.
    // Missing config is fine (treat as empty); a present-but-broken config must
    // surface so we don't silently version/publish with the wrong settings.
    let fileConfig: VisReleaseConfig = {};

    try {
        const { loadVisConfig } = await import("../../config/config");
        const visConfig = await loadVisConfig(cwd);

        if (visConfig.release) {
            fileConfig = visConfig.release;
        }
    } catch (error) {
        const { code } = (error as NodeJS.ErrnoException);
        const message = (error as Error).message ?? "";
        const isMissing = code === "ENOENT" || code === "MODULE_NOT_FOUND" || /cannot find module/i.test(message);

        if (!isMissing) {
            throw error;
        }
    }

    const config = mergeConfig(fileConfig, options.config ?? {});

    // Print unstable warning unless suppressed (RFC §21.2).
    if (!config.acknowledgeUnstable && process.env["VIS_RELEASE_SUPPRESS_UNSTABLE"] !== "1") {
        process.stderr.write(
            "[vis release] ⚠ This subsystem is flagged unstable. Set `release.acknowledgeUnstable: true` in vis.config.ts to suppress this warning. (RFC §21.2)\n",
        );
    }

    // Detect branch + channel
    const branch = options.channel ?? (await detectCurrentBranch(cwd, runner));
    const resolved = branch ? resolveChannel(branch, config.channels) : undefined;

    // Discover packages via the active PM adapter. Manifest reads run in
    // parallel (Promise.all + filter) — for a 49-package monorepo this cuts
    // ~150ms of sequential fs latency to ~10ms wall time.
    const fs = await import("node:fs/promises");
    const reader = {
        listPackages: async () => {
            const entries = await pm.listWorkspacePackages(cwd);

            const settled = await Promise.all(entries.map(async (entry) => {
                const manifestPath = `${entry.path}/package.json`;

                try {
                    const content = await fs.readFile(manifestPath, "utf8");
                    const manifest = JSON.parse(content) as PackageManifest;

                    return { manifest, manifestPath };
                } catch {
                    // Safe to swallow: a PM adapter can list a stale workspace
                    // path (lockfile drift, partially-deleted package). Dropping
                    // it from discovery is the right call — releasing against a
                    // missing manifest would fail later anyway.
                    return undefined;
                }
            }));

            return settled.filter((entry): entry is { manifest: PackageManifest; manifestPath: string } => entry !== undefined);
        },
    };

    const { packages, perPackageConfig } = await discoverPackages(reader, config, { cwd });
    const depGraph = new DependencyGraph(packages);

    // Read change files
    const { files: changeFiles } = await readChangeFiles({ changesDir: config.changesDir, cwd });

    // Pre-mode override: `vis release pre enter <tag>` writes a tracked
    // pre.json that pins the prerelease identifier regardless of branch
    // / channel. Channel-derived prerelease still applies when pre.json
    // is absent.
    //
    // Pre-mode tri-state effective-prerelease (C6 fix):
    //   - mode: "pre"          → force `preMode.tag` (changesets parity)
    //   - mode: "exit-pending" → force `undefined` (consolidation = stable
    //                            bump); previously this fell through to
    //                            the channel's prerelease, which on an
    //                            alpha-channel branch produced an alpha
    //                            version AND deleted pre.json — leaving
    //                            no way to retry the consolidation.
    //   - undefined            → fall back to channel-derived prerelease.
    const { readPreMode } = await import("./pre-mode");
    const preMode = await readPreMode(cwd, config.changesDir ?? ".vis/release");
    let effectivePrerelease: string | undefined;

    if (preMode?.mode === "pre") {
        effectivePrerelease = preMode.tag;
    } else if (preMode?.mode === "exit-pending") {
        effectivePrerelease = undefined;
    } else {
        effectivePrerelease = resolved?.prerelease;
    }

    // Resolve current versions via the configured strategy (disk / registry /
    // git-tag). Runs before plan assembly so the plan stays a pure synchronous
    // function — the async lookups live one level up.
    const firstRelease = options.firstRelease === true;
    const { resolveCurrentVersionsForWorkspace } = await import("./version-resolver");
    const { versions: currentVersions, warnings: resolverWarnings } = await resolveCurrentVersionsForWorkspace(
        packages,
        depGraph,
        config,
        perPackageConfig,
        {
            cwd,
            firstRelease,
            pm,
            runner,
            // Read-only handlers (plan/status/doctor/etc.) pass true so
            // they don't fire N parallel registry probes. Default false
            // for the version/publish/ci-release paths that need an
            // accurate baseline.
            skipRegistryLookup: options.skipRegistryLookup === true,
        },
    );

    // Catalog change-detection (changesets #1707, opt-in via
    // `release.detectCatalogChanges`). When enabled, we diff
    // `pnpm-workspace.yaml` at HEAD~1 vs HEAD; consumer packages of
    // any moved catalog entry are fed into the plan as patch bumps
    // tagged CATALOG_CHANGED.
    //
    // Soft-failures (no git repo, no HEAD~1, malformed YAML) surface
    // as plan warnings — we don't want a freshly-cloned greenfield
    // repo to fail the version step over a missing baseline.
    const catalogConsumerEntries: NonNullable<import("./release-plan").AssembleReleasePlanOptions["catalogConsumers"]>[number][] = [];
    const catalogWarnings: string[] = [];

    if (config.detectCatalogChanges === true) {
        try {
            const { detectCatalogChanges, findCatalogConsumers, parseCatalogs: parseCatalogSnapshot } = await import("./catalog-detector");
            const currentYaml = await pm.readCatalogYaml(cwd);
            const currentCatalogs = parseCatalogSnapshot(currentYaml);

            let prevYaml: string | undefined;

            try {
                const result = await runner.run("git", ["show", "HEAD~1:pnpm-workspace.yaml"], { cwd, silent: true });

                if (result.exitCode === 0) {
                    prevYaml = result.stdout;
                }
            } catch {
                // git unreachable / no prior commit — degrade to "no prior
                // snapshot" which surfaces every current catalog entry as
                // an addition. That's not actually useful for cascading
                // (additions don't move existing consumers), but keeping
                // the detector resilient means greenfield repos don't
                // throw here.
            }

            const prevCatalogs = parseCatalogSnapshot(prevYaml);
            const changes = detectCatalogChanges(prevCatalogs, currentCatalogs);

            // Only true bumps (both sides present and version differs)
            // cascade — additions / removals don't affect existing
            // consumers' resolved versions.
            const bumps = changes.filter((c) => c.oldVersion !== undefined && c.newVersion !== undefined);

            if (bumps.length > 0) {
                // Use the CURRENT catalog snapshot to find consumers —
                // we want the dependents of the catalog entry at HEAD
                // (the version that will be published), not the prior
                // wave's snapshot.
                const consumersIndex = findCatalogConsumers(packages, currentCatalogs);

                for (const change of bumps) {
                    const depTable = consumersIndex.get(change.catalog);
                    const consumers = depTable?.get(change.dep) ?? [];

                    for (const consumer of consumers) {
                        catalogConsumerEntries.push({
                            catalog: change.catalog,
                            dep: change.dep,
                            newVersion: change.newVersion,
                            oldVersion: change.oldVersion,
                            packageName: consumer.packageName,
                        });
                    }
                }

                if (catalogConsumerEntries.length > 0) {
                    catalogWarnings.push(
                        `Catalog change-detection: ${bumps.length} catalog dep(s) moved; ${catalogConsumerEntries.length} consumer-package patch bump(s) tagged CATALOG_CHANGED.`,
                    );
                }
            }
        } catch (error) {
            catalogWarnings.push(
                `Catalog change-detection skipped: ${(error as Error).message}.`,
            );
        }
    }

    // Assemble plan
    const plan = assembleReleasePlan(changeFiles, depGraph, config, {
        bumpMinorPreMajor: config.bumpMinorPreMajor,
        bumpPatchForMinorPreMajor: config.bumpPatchForMinorPreMajor,
        catalogConsumers: catalogConsumerEntries,
        currentVersions,
        perPackageConfig,
        prerelease: effectivePrerelease,
    });

    if (catalogWarnings.length > 0) {
        plan.warnings.push(...catalogWarnings);
    }

    // Surface resolver fallbacks as plan warnings — operators want to see
    // "registry 404 → manifest" so they can debug staleness mid-pipeline.
    if (resolverWarnings.length > 0) {
        plan.warnings.push(...resolverWarnings);
    }

    if (firstRelease) {
        plan.warnings.push(
            "First-release mode: currentVersionResolver forced to \"disk\", remote tag-collision checks skipped. Drop --first-release after the initial wave lands.",
        );
    }

    // Surface pre-mode in the plan warnings so downstream handlers
    // / the sticky PR comment can show it to reviewers.
    if (preMode?.mode === "pre") {
        plan.warnings.push(
            `Pre-mode is ACTIVE (tag "${preMode.tag}"); every version produces a prerelease. Exit with \`vis release pre exit\` when ready to ship stable.`,
        );
    }

    if (preMode?.mode === "exit-pending") {
        plan.warnings.push(
            `Pre-mode is EXIT-PENDING (was "${preMode.tag}"); the next \`vis release version\` will consolidate the prerelease and delete pre.json.`,
        );
    }

    // Surface channel-overlap as a plan warning so CLI handlers / sticky-comment
    // formatters print it. First-listed wins, but other matches are suspicious.
    if (resolved?.overlapping && resolved.overlapping.length > 0) {
        plan.warnings.push(
            `Branch "${branch}" matches multiple channel patterns: "${resolved.branch}" (active) plus ${resolved.overlapping.map((p) => `"${p}"`).join(", ")}. Reorder channels in vis.config.ts if this is unintentional.`,
        );
    }

    // Optional project filter (post-plan, so the user sees the full plan but
    // version/publish only acts on the filtered subset).
    if (options.projects && options.projects.length > 0) {
        const { default: zeptomatch } = await import("zeptomatch");
        const globs = options.projects;

        plan.releases = plan.releases.filter((r) => globs.some((g) => r.name === g || zeptomatch(g, r.name)));
    }

    return {
        branch,
        channel: resolved
            ? { mode: resolved.mode, prerelease: resolved.prerelease, tag: resolved.tag }
            : undefined,
        config,
        cwd,
        depGraph,
        firstRelease,
        packages,
        perPackageConfig,
        plan,
        pm,
        // M9: snapshot pre-mode here so applyContext doesn't race with a
        // concurrent `pre exit` between context-build and apply.
        preMode,
    };
};

const mergeConfig = (...sources: VisReleaseConfig[]): VisReleaseConfig => {
    let merged: VisReleaseConfig = { ...DEFAULT_CONFIG };

    for (const source of sources) {
        merged = { ...merged, ...source };
    }

    return merged;
};

/**
 * `&lt;detected> >= &lt;minimum>` — uses semver.gte but tolerant of pre-release
 * suffixes that some PM `--version` outputs include (e.g. "11.5.1-rc.0").
 */
const supportsMinVersion = (detected: string, minimum: string): boolean => {
    const cleaned = semver.coerce(detected)?.version ?? detected;

    try {
        return semver.gte(cleaned, minimum);
    } catch {
        // If we can't parse the version, fail-open (don't block users on
        // exotic PM forks).
        return true;
    }
};

// ── Apply phase ─────────────────────────────────────────────────────

export interface ApplyOptions {
    /** Stage + commit changed files after writing. Default `false`. */
    commit?: boolean;
    /** Override commit message template (defaults from RFC §19.5). */
    commitMessage?: string;
    dryRun?: boolean;
}

export interface ApplyResult {
    changedFiles: string[];
    /** Sha of the release commit, when `commit: true`. */
    commitSha?: string;
    deletedFiles: string[];
    plan: ReleasePlan;
}

/**
 * Apply a release plan to disk: write package.json bumps + prepended
 * CHANGELOGs, delete consumed change files. Honors `dryRun`.
 *
 * Lockfile sync (RFC §14 step 6) runs after the writes complete.
 */

/**
 * Run a configured shell hook command (preVersionCommand / postVersionCommand /
 * prePublishCommand / postPublishCommand). Empty string skips silently.
 * Throws if the command exits non-zero.
 *
 * Cross-platform: uses `cmd /c &lt;cmd>` on Windows, `sh -c &lt;cmd>` elsewhere.
 */
const runHook = async (cwd: string, command: string, label: string): Promise<void> => {
    if (!command || command.trim() === "") {
        return;
    }

    const runner = createShellRunner();
    const isWindows = process.platform === "win32";
    const shell = isWindows ? "cmd" : "sh";
    const shellArgs = isWindows ? ["/c", command] : ["-c", command];

    const result = await runner.run(shell, shellArgs, { cwd, silent: false });

    if (result.exitCode !== 0) {
        throw new Error(`${label} failed (exit ${result.exitCode}): ${command}`);
    }
};

/**
 * Refuse to start a new version or publish wave when the staged-publish
 * registry already records a pending tarball for a package in the
 * current plan. Without this guard, a re-version would obsolete the
 * pending tarball and a re-publish would create a parallel stage —
 * either case lands the registry in a confusing two-tarballs-one-version
 * shape that's painful to unwind.
 *
 * Self-healing: before blocking, every conflict is checked against the
 * registry with `npm view &lt;pkg>@&lt;version> dist.tarball`. If the version
 * is already live, the operator approved the stage out-of-band (e.g.
 * via npmjs.com UI) and the registry entry is silently drained instead
 * of throwing. Without this, an out-of-band approval would force the
 * operator to manually edit staged.json — bad DX.
 *
 * The optional `preloaded` registry argument lets the publish path
 * avoid a second file read.
 */
export interface AssertNoConflictingPendingStagesOptions {
    /**
     * Persist self-heal drains to disk. Defaults to `true` (publish
     * behaviour). The version phase passes `false` so the in-memory
     * drain doesn't produce a write that would be lost on the next CI
     * runner's fresh clone — the publish phase that follows re-runs
     * self-heal and writes durably.
     */
    persistSelfHeal?: boolean;
    /** Optional injected runner (defaults to the real shell runner). */
    runner?: import("./package-managers/interface").CommandRunner;
    /** Skip the npm-view self-heal step (used in tests). */
    skipSelfHeal?: boolean;
}

export const assertNoConflictingPendingStages = async (
    context: OrchestratorContext,
    phase: "publish" | "version",
    preloaded?: import("../types").StagedRegistryFile,
    options: AssertNoConflictingPendingStagesOptions = {},
): Promise<void> => {
    const { findConflictingPendingStages, readStagedRegistry, removePendingStages, writeStagedRegistry } = await import("./staged-registry");
    const changesDir = context.config.changesDir ?? DEFAULT_CHANGES_DIR;
    let registry = preloaded ?? await readStagedRegistry(context.cwd, changesDir);

    if (registry.pending.length === 0) {
        return;
    }

    const planByName = new Map(context.plan.releases.map((r) => [r.name, r.newVersion] as const));
    const planNames = [...planByName.keys()];

    // Same-package conflicts are only a real problem when versions
    // differ. A pending `pkg@1.2.0` against a plan for `pkg@1.2.1` is
    // the orphan-risk case (block). A pending `pkg@1.2.0` against a
    // plan for `pkg@1.2.0` is the resume case (allow — the publish
    // loop's per-package action will see the existing stage and either
    // resolve through `alreadyPublished` or re-stage; either is correct).
    let conflicts = findConflictingPendingStages(registry, planNames).filter(
        (entry) => planByName.get(entry.name) !== entry.version,
    );

    if (conflicts.length === 0) {
        return;
    }

    // Self-heal: out-of-band approvals look like "version is live on the
    // registry but our staged.json still says pending". Run a cheap
    // `npm view` for each conflict; drain anything that's already live.
    // Bounded by the size of `conflicts`, which is in turn bounded by the
    // size of the release plan (single-digit at typical workspace scale).
    let resolved: string[] = [];

    if (!options.skipSelfHeal) {
        const runner = options.runner ?? createShellRunner();

        // Run the `npm view` round-trips concurrently. The check is read-
        // only on the registry and each query is independent. At typical
        // workspace scale (single-digit conflicts) the speedup is small;
        // at pathological scale (50+ stuck stages on a flipped config)
        // it's the difference between a sub-second preflight and a 15-
        // second one.
        const lookups = await Promise.all(
            conflicts.map(async (entry) => {
                const npmView = await runner.run(
                    "npm",
                    ["view", `${entry.name}@${entry.version}`, "dist.tarball", "--silent"],
                    { cwd: context.cwd, silent: true },
                );

                // npm prints the tarball URL on stdout when the version is
                // live. On 404 / non-zero exit, the version isn't
                // published yet → keep the entry as a real conflict.
                return npmView.exitCode === 0 && npmView.stdout.trim().length > 0 ? entry.id : undefined;
            }),
        );

        resolved = lookups.filter((id): id is string => id !== undefined);
    }

    if (resolved.length > 0) {
        registry = removePendingStages(registry, resolved);

        if (options.persistSelfHeal !== false) {
            try {
                await writeStagedRegistry(context.cwd, changesDir, registry);
            } catch {
                // Soft-fail: a write hiccup shouldn't block the release. The
                // entry will be re-resolved on the next wave.
            }
        }

        // Re-check with the same "different version is the orphan-risk
        // case" filter (the resume case stays allowed).
        conflicts = findConflictingPendingStages(registry, planNames).filter(
            (entry) => planByName.get(entry.name) !== entry.version,
        );

        if (conflicts.length === 0) {
            return;
        }
    }

    const summary = conflicts
        .map((entry) => `  • ${entry.name}@${entry.version} — stage ${entry.id} (${entry.reason}, recorded ${entry.stagedAt})`)
        .join("\n");

    const verb = phase === "version" ? "version" : "publish";

    throw new VisReleaseError({
        code: "STAGE_PENDING",
        hint: "Resolve via `vis release stage approve <id>` / `--all` or `vis release stage reject <id>`, commit the updated staged.json, then retry.",
        message: `Refusing to ${verb} — ${conflicts.length} package(s) have a pending stage from a prior wave:\n${summary}`,
    });
};

export const applyContext = async (
    context: OrchestratorContext,
    options: ApplyOptions = {},
): Promise<ApplyResult> => {
    if (context.plan.releases.length === 0) {
        return { changedFiles: [], deletedFiles: [], plan: context.plan };
    }

    // Refuse to re-version a package that still has a pending stage from a
    // prior wave. Otherwise the new version would obsolete the staged
    // tarball — best case, two parallel stages confuse maintainers; worst
    // case, npm publishes them out of semver order. Operator must resolve
    // the prior stage (approve / reject) before re-versioning.
    //
    // persistSelfHeal: false — the version phase can self-heal in memory
    // to decide whether to throw, but committing the drained registry is
    // the publish phase's job (it's the step that actually changes git
    // state). Without this, a version-only workflow would write a drain
    // to disk that the next CI clone would lose anyway.
    await assertNoConflictingPendingStages(context, "version", undefined, { persistSelfHeal: false });

    if (!options.dryRun && context.config.preVersionCommand) {
        await runHook(context.cwd, context.config.preVersionCommand, "preVersionCommand");
    }

    // Group-scoped preVersion commands. Each `fixed`/`linked` group can opt
    // in via `groupPreVersionCommands["group-<index>"]`. Runs after the
    // workspace-level preVersionCommand, before any package mutations.
    if (!options.dryRun && context.config.groupPreVersionCommands) {
        const { normaliseGroup } = await import("../types");
        const allGroups = [...(context.config.fixed ?? []), ...(context.config.linked ?? [])]
            .map((g) => normaliseGroup(g));
        const { default: zeptomatch } = await import("zeptomatch");

        for (const [groupKey, command] of Object.entries(context.config.groupPreVersionCommands)) {
            const groupIndex = Number.parseInt(groupKey.replace(/^group-/, ""), 10);
            const group = allGroups[groupIndex];

            if (!group) {
                continue;
            }

            // Only run if the group has at least one package being released this wave.
            // Group entries can be literal names OR glob patterns — match both.
            const groupTouched = context.plan.releases.some((r) =>
                group.packages.some((memberPattern) => r.name === memberPattern || zeptomatch(memberPattern, r.name)),
            );

            if (!groupTouched) {
                continue;
            }

            await runHook(context.cwd, command, `groupPreVersionCommand[${groupKey}]`);
        }
    }

    const fs = await import("node:fs/promises");
    const { readFileSync } = await import("node:fs");
    const { resolveFormatter } = await import("./changelog/resolve");
    const { resolveGroupChangelogRouting } = await import("./changelog/workspace");
    const formatter = await resolveFormatter(context.config.changelog, context.cwd);
    const date = new Date().toISOString().slice(0, 10);

    // Build the group-changelog routing once. Fixed/linked groups that
    // opt in via `changelog.mode: "shared"` get a single
    // `GROUP-CHANGELOG.md` (changesets #1059); other packages fall back
    // to the default per-package routing.
    const groupRouting = resolveGroupChangelogRouting(context.config, context.packages, context.cwd);

    const applied = await applyReleasePlan(context.plan, context.depGraph, {
        changelogPath: (pkg) => groupRouting.get(pkg.name) ?? `${pkg.dir}/CHANGELOG.md`,
        readChangelog: (path) => {
            try {
                return readFileSync(path, "utf8");
            } catch {
                return undefined;
            }
        },
        readManifest: (path) => {
            try {
                return readFileSync(path, "utf8");
            } catch {
                return undefined;
            }
        },
        renderChangelogEntry: (release) => formatter({
            changeFiles: release.changeFiles,
            date,
            release,
            target: "changelog",
        }),
    });

    // Apply extra-files rules per release. Workspace + per-package
    // configurations both flow through `applyExtraFilesForRelease`; the
    // resulting writes are appended to the applied set so the existing
    // commit + dry-run code paths pick them up automatically.
    const extraFileWarnings: string[] = [];

    {
        const { applyExtraFilesForRelease } = await import("./extra-files");

        const extraResults = await Promise.all(
            context.plan.releases.map(async (release) => {
                const pkg = context.depGraph.getPackage(release.name);

                if (!pkg) {
                    return { warnings: [], writes: [] };
                }

                const perPkgRules = context.perPackageConfig.get(release.name)?.extraFiles ?? [];
                const workspaceRules = context.config.publish?.extraFiles ?? [];

                if (perPkgRules.length === 0 && workspaceRules.length === 0) {
                    return { warnings: [], writes: [] };
                }

                return applyExtraFilesForRelease(
                    context.cwd,
                    pkg.dir,
                    release.newVersion,
                    release.name,
                    workspaceRules,
                    perPkgRules,
                );
            }),
        );

        for (const result of extraResults) {
            for (const write of result.writes) {
                applied.writes.push({ content: write.content, path: write.path });
            }

            extraFileWarnings.push(...result.warnings);
        }

        // Surface warnings through plan.warnings so they bubble up to
        // CI logs alongside the other release warnings.
        if (extraFileWarnings.length > 0) {
            context.plan.warnings.push(...extraFileWarnings);
        }
    }

    if (options.dryRun) {
        return {
            changedFiles: applied.writes.map((w) => w.path),
            deletedFiles: applied.deletions,
            plan: context.plan,
        };
    }

    // Writes + deletions in parallel — all targets are independent files.
    // For a 49-package release wave (98 writes + N deletions), parallel
    // saves the bulk of the wall-time vs sequential awaits.
    await Promise.all([
        ...applied.writes.map((write) => writeFile(write.path, write.content)),
        ...applied.deletions.map(async (path) => {
            try {
                await unlink(path);
            } catch {
                // ignore — file may have already been removed
            }
        }),
    ]);

    // Lockfile sync (RFC §19/§14)
    try {
        await context.pm.installLockfileOnly({ cwd: context.cwd, silent: true });
    } catch {
        // Soft-fail: not all CI environments have the pm available, and we'd
        // rather ship the version commit than block on lockfile noise.
    }

    let commitSha: string | undefined;

    if (options.commit) {
        const { stageAndCommit } = await import("./git");
        const runner = createShellRunner();
        const message = options.commitMessage ?? buildDefaultCommitMessage(context);

        // Lockfile paths to also stage (best-effort; some PMs don't have one yet).
        const lockfileCandidates = ["pnpm-lock.yaml", "package-lock.json", "yarn.lock", "bun.lock", "bun.lockb"];
        const path = await import("node:path");
        const lockfilesPresent: string[] = [];

        for (const name of lockfileCandidates) {
            try {
                await fs.access(path.join(context.cwd, name));
                lockfilesPresent.push(path.join(context.cwd, name));
            } catch {
                // not present
            }
        }

        // Include consumed change-file paths so `git add` stages their
        // deletions — otherwise the worktree stays dirty and the change files
        // never actually leave the repo.
        const allFiles = [
            ...applied.writes.map((w) => w.path),
            ...applied.deletions,
            ...lockfilesPresent,
        ];

        commitSha = await stageAndCommit(
            { cwd: context.cwd, runner },
            allFiles,
            message,
            { author: context.config.gitUser },
        );
    }

    // Workspace-level changelog is intentionally NOT written here — the
    // wave entry is appended from `publishContext` against the actually-
    // published set (`result.published[]`) instead of the optimistic plan
    // (C5 fix). Otherwise a stage rejected at the gate would leave an
    // orphan wave entry in CHANGELOG.md. Per-package CHANGELOG.md sections
    // are still written above as part of the version commit; their orphan-
    // risk is a documented operator workflow note — the `stage reject` post-
    // action prints an edit hint.

    if (!options.dryRun && context.config.postVersionCommand) {
        await runHook(context.cwd, context.config.postVersionCommand, "postVersionCommand");
    }

    // Pre-mode exit consolidation: when the file is in `exit-pending`
    // mode, this version run is the consolidation step — delete the
    // file so the next wave is a regular stable bump.
    //
    // M9 fix: use the pinned `context.preMode` snapshot from
    // `buildContext` instead of re-reading pre.json here. Otherwise a
    // concurrent `vis release pre exit` between the two reads could
    // leave the version computed as prerelease (snapshot says
    // `undefined`) while this block fires the exit-pending cleanup
    // (re-read sees `exit-pending`) — or vice versa.
    if (!options.dryRun && context.preMode?.mode === "exit-pending") {
        const { deletePreMode, preModeFilePath } = await import("./pre-mode");
        const changesDir = context.config.changesDir ?? ".vis/release";
        const removed = await deletePreMode(context.cwd, changesDir);

        if (removed) {
            context.plan.warnings.push(
                `Pre-mode exited: \`${preModeFilePath(context.cwd, changesDir)}\` was deleted. Commit the deletion so the registry stays consistent across CI runs.`,
            );
        }
    }

    return {
        changedFiles: applied.writes.map((w) => w.path),
        commitSha,
        deletedFiles: applied.deletions,
        plan: context.plan,
    };
};

const buildDefaultCommitMessage = (context: OrchestratorContext): string => {
    const channel = context.channel?.tag ?? context.branch ?? "main";
    const { releases } = context.plan;
    const summary = releases.length <= 3
        ? releases.map((r) => `${r.name}@${r.newVersion}`).join(", ")
        : `version ${releases.length} packages`;

    const details = releases.map((r) => `- ${r.name}: ${r.oldVersion} → ${r.newVersion}`).join("\n");

    return `release(${channel}): ${summary} [skip ci]\n\n${details}`;
};

// ── Publish phase ──────────────────────────────────────────────────

export interface PublishContextOptions {
    dryRun?: boolean;
    /** Skip `git push --tags` after publish. */
    noPush?: boolean;
    /** Skip local tag creation entirely. */
    noTag?: boolean;
    otp?: string;

    /**
     * Test-only override: use this `VersionActions` instance for every
     * package in the wave instead of resolving from `versionActions` config.
     * Production callers should leave this unset.
     */
    publishActionsOverride?: VersionActions;
    /** Resume from previous run's state file. */
    resume?: boolean;
    tag?: string;
}

export interface PublishContextResult {
    failed: { name: string; reason: string }[];
    published: {
        name: string;
        /** Set when `publish.stage: true` — the npm stage id awaiting approval. */
        stageId?: string;
        /** Tarball hashes when publish.releaseAssets.stampHashes / uploadTarball are wanted. */
        tarball?: { path: string; sha256: string; sha512: string; size: number };
        /** Forge release URL — populated by `createRemoteReleases` for per-package releases. */
        url?: string;
        version: string;
    }[];
    skipped: { name: string; reason: string }[];
    /** Tags created locally (not yet pushed). */
    tags: string[];
    /** Whether tags were successfully pushed to the remote. */
    tagsPushed: boolean;
}

/**
 * Publish each release in the plan via its resolved versionActions.
 * Topological order is honored so dependencies publish before dependents.
 */
export const publishContext = async (
    context: OrchestratorContext,
    options: PublishContextOptions = {},
): Promise<PublishContextResult> => {
    const result: PublishContextResult = { failed: [], published: [], skipped: [], tags: [], tagsPushed: false };
    const runner = createShellRunner();

    if (context.plan.releases.length === 0) {
        return result;
    }

    // In-flight version-PR check (RFC §19.1) — refuse to publish locally
    // if an open release PR exists, to catch the cross-machine race where
    // a developer runs `vis release publish` while CI is mid-release-PR cycle.
    if (!options.dryRun && context.channel?.mode === "version-pr") {
        const { createRemoteClient, detectRemoteProvider } = await import("./remote/detect");
        const provider = await detectRemoteProvider(context.cwd, runner, context.config.provider);
        const client = createRemoteClient(provider, { githubHost: context.config.githubHost, gitlabHost: context.config.gitlabHost, httpProxy: context.config.httpProxy });
        const repo = await client.detectRepoSlug(context.cwd, runner);
        const branch = context.config.versionPr?.branch ?? "vis-release/version-packages";

        if (repo) {
            try {
                // gh CLI: list open PRs from the version-PR branch.
                const list = await runner.run(
                    "gh",
                    ["pr", "list", "--head", branch, "--state", "open", "--json", "number"],
                    { cwd: context.cwd, silent: true },
                );

                if (list.exitCode === 0 && list.stdout.trim() && list.stdout.trim() !== "[]") {
                    const parsed = JSON.parse(list.stdout) as { number: number }[];

                    if (parsed[0]) {
                        result.failed.push({
                            name: "_preflight",
                            reason: `Open release PR #${parsed[0].number} exists. Merge or close it before publishing locally. (Override: --no-push then \`git push --tags\` manually.)`,
                        });

                        return result;
                    }
                }
            } catch {
                // gh not available — skip the check (fail-open).
            }
        }
    }

    if (!options.dryRun && context.config.prePublishCommand) {
        try {
            await runHook(context.cwd, context.config.prePublishCommand, "prePublishCommand");
        } catch (error) {
            result.failed.push({ name: "_prePublishCommand", reason: (error as Error).message });

            return result;
        }
    }

    // Process-level lock (RFC §19.1) — prevents two `vis release publish`
    // invocations on the same machine from racing. Acquired here; released
    // in the finally block at the end of this function.
    const changesDirForLock = context.config.changesDir ?? DEFAULT_CHANGES_DIR;
    const { acquireLock, releaseLock } = await import("./state");
    let lockAcquired = false;

    if (!options.dryRun) {
        try {
            await acquireLock(context.cwd, changesDirForLock);
            lockAcquired = true;
        } catch (error) {
            result.failed.push({ name: "_lock", reason: (error as Error).message });

            return result;
        }
    }

    try {
    // Resume support: read state file, skip already-published packages.
        const { clearState, filterPlanByState, newState, readState, writeState } = await import("./state");
        const { readStagedRegistry, removePendingStages, upsertPendingStages, writeStagedRegistry } = await import("./staged-registry");
        const changesDir = context.config.changesDir ?? DEFAULT_CHANGES_DIR;
        let state = options.resume ? await readState(context.cwd, changesDir) : undefined;
        let stagedRegistry = await readStagedRegistry(context.cwd, changesDir);

        // Guard the publish phase too — `vis release publish` can run on its
        // own (no preceding `version` step in CI), so the version-phase guard
        // isn't enough. Pending stages on the same package mean the operator
        // must resolve them first or the new publish will create a parallel
        // tarball. Throws `STAGE_PENDING`; the CLI handler catches it and
        // prints the hint.
        await assertNoConflictingPendingStages(context, "publish", stagedRegistry, { runner });

        // Re-read in case the guard's self-heal mutated the registry — the
        // mutated copy is what we want for downstream upsert/remove work.
        stagedRegistry = await readStagedRegistry(context.cwd, changesDir);

        // Snapshot the registry as it stands BEFORE the publish loop. Used
        // at the end of the wave to compute the delta for the commit
        // message ("record N" vs "drain N" vs "update").
        const priorRegistrySnapshot = { ...stagedRegistry, pending: [...stagedRegistry.pending] };

        let { releases } = context.plan;

        if (state) {
            releases = filterPlanByState(releases, state);
        } else {
            state = newState(context.channel?.tag, context.plan.releases);

            if (!options.dryRun) {
                await writeState(context.cwd, changesDir, state);
            }
        }

        // Build catalog for catalog: rewriting (only relevant for pnpm; harmless otherwise)
        const catalogYaml = await context.pm.readCatalogYaml(context.cwd);
        const catalogs = parseCatalogs(catalogYaml);

        // Topo-sort the (possibly resume-filtered) release subset
        const order = context.depGraph.topologicalSort(releases.map((r) => r.name));

        // O(1) lookup by name in the publish loop (was O(n²) via Array.find)
        const releaseByName = new Map(releases.map((r) => [r.name, r] as const));

        // Build name → versioned manifest map for protocol resolution
        const versionedManifestByName = new Map<string, PackageManifest>();

        for (const release of context.plan.releases) {
            const pkg = context.depGraph.getPackage(release.name);

            if (pkg) {
                versionedManifestByName.set(release.name, { ...pkg.manifest, version: release.newVersion });
            }
        }

        for (const name of order) {
            const release = releaseByName.get(name);

            if (!release) {
            // Should never happen — the topo sort runs over the same names
            // we put into releaseByName. If it does, surface it via the
            // result.skipped channel so downstream tooling can spot the bug.
                result.skipped.push({ name, reason: "topo-sort returned a name not in the release plan (internal bug)" });
                continue;
            }

            const pkg = context.depGraph.getPackage(name);

            if (!pkg) {
                continue;
            }

            const perPkg = context.perPackageConfig.get(name) ?? {};
            const actionsId = resolveVersionActionsId(pkg, perPkg);
            const actions = options.publishActionsOverride ?? createVersionActions(actionsId);

            const tag = options.tag ?? context.channel?.tag;

            // Resume the existing stage when staged.json already holds an
            // entry for this exact (name, version). The action's publish
            // method short-circuits pack+publish and resumes the wait —
            // re-uploading would either be rejected by npm or create a
            // parallel stage.
            const existingStage = stagedRegistry.pending.find(
                (entry) => entry.name === name && entry.version === release.newVersion,
            );

            try {
                const out = await actions.publish({
                    catalogs,
                    cleanPackageJsonConfig: context.config.publish?.cleanPackageJson,
                    dryRun: options.dryRun,
                    otp: options.otp,
                    perPackageConfig: perPkg,
                    pkg,
                    pm: context.pm,
                    provenance: shouldProvenance(context),
                    registry: perPkg.registry,
                    release,
                    resumeStageId: existingStage?.id,
                    tag,
                    versionedManifestByName,
                    workspaceConfig: context.config,
                });

                // Drain any stale pending-stage entries for this exact
                // (package, version) regardless of outcome. Covers two paths:
                //   - approved in this run (npm.ts clears out.stageId, but the
                //     entry we wrote in a prior wave is still in staged.json)
                //   - already-published (operator approved a timed-out stage
                //     out-of-band via npmjs.com UI; we never see a stageId
                //     here, just a "version is now live" signal)
                if (out.published || out.alreadyPublished) {
                    const idsToDrop = stagedRegistry.pending
                        .filter((entry) => entry.name === name && entry.version === release.newVersion)
                        .map((entry) => entry.id);

                    if (idsToDrop.length > 0) {
                        stagedRegistry = removePendingStages(stagedRegistry, idsToDrop);
                    }
                }

                if (out.published) {
                    result.published.push({ name, stageId: out.stageId, tarball: out.tarball, version: release.newVersion });
                    state.published.push(`${name}@${release.newVersion}`);
                } else if (out.alreadyPublished) {
                    result.skipped.push({ name, reason: "already-published" });
                    // Treat as published for resume purposes — re-running won't try again.
                    state.published.push(`${name}@${release.newVersion}`);
                } else {
                    result.skipped.push({ name, reason: out.output ?? "skipped" });

                    // Rejected / timed-out stages flow through here. Record
                    // them in the persistent registry so the operator can
                    // come back later (workflow re-run, `stage approve --all`,
                    // npmjs.com UI) without losing the id.
                    if (out.stageId) {
                        const reason = (out.output ?? "").startsWith("stage-rejected")
                            ? "rejected"
                            : "timeout";

                        stagedRegistry = upsertPendingStages(stagedRegistry, [{
                            id: out.stageId,
                            name,
                            reason,
                            stagedAt: new Date().toISOString(),
                            tag: tag ?? "latest",
                            version: release.newVersion,
                        }]);
                    }
                }

                if (!options.dryRun) {
                    await writeState(context.cwd, changesDir, state);
                }
            } catch (error) {
                result.failed.push({ name, reason: (error as Error).message });
            }
        }

        // Create + push tags for successfully-published releases (RFC §14 / §19.1).
        if (!options.dryRun && !options.noTag && result.published.length > 0) {
            const { createOrUpdateFloatingTag, createTag, defaultTagFor, pushTags, renderTagPattern } = await import("./git");
            const rootTagPattern = context.config.releaseTagPattern;

            const channelName = context.channel?.tag;
            const floatingMajorEnabled = context.config.floatingMajorTag === true;
            // Floating major tags must NOT move across prerelease channels —
            // an unstable `v1` pointer would yank consumers from a stable
            // major into a half-finished release. Skipped when the active
            // channel resolved to a prerelease identifier.
            const isPrerelease = Boolean(context.channel?.prerelease) || Boolean(context.preMode);

            for (const { name, version } of result.published) {
                const perPkgPattern = context.perPackageConfig.get(name)?.releaseTagPattern;
                const pattern = perPkgPattern ?? rootTagPattern;
                const tag = pattern ? renderTagPattern(pattern, { channel: channelName, name, version }) : defaultTagFor(name, version);

                try {
                    await createTag(
                        { cwd: context.cwd, runner },
                        tag,
                        `Release ${name}@${version}`,
                        // First-release bootstraps a brand-new tag history —
                        // there's no remote to consult, and a left-over orphan
                        // would simply be re-published this wave. Skip the
                        // remote pre-check so the very first run on a fresh
                        // repo doesn't error.
                        { signing: context.config.signing, skipRemoteCheck: context.firstRelease },
                    );
                    result.tags.push(tag);
                } catch (error) {
                    // Don't fail the whole batch on a single tag collision —
                    // it usually means an idempotent re-run is hitting an
                    // already-tagged version. Surface as a skip with reason.
                    // Under `--first-release` we additionally suppress the
                    // TAG_COLLISION surface: a freshly-cloned greenfield repo
                    // can't legitimately produce colliding tags, so this is
                    // always the "re-run with dangling state" recovery path.
                    if (context.firstRelease && error instanceof VisReleaseError && error.code === "TAG_COLLISION") {
                        result.skipped.push({ name: tag, reason: "tag-creation: tag already exists (first-release — skipped)" });
                    } else {
                        result.skipped.push({ name: tag, reason: `tag-creation: ${(error as Error).message}` });
                    }
                }

                // Floating major tag (`<safe-name>-v<major>`) —
                // semantic-release #1515 parity. Force-update so the
                // pointer always tracks the latest patch / minor under the
                // current major.
                //
                // Conditions to emit:
                //   - `release.floatingMajorTag === true`
                //   - active channel is NOT a prerelease (incl. pre-mode)
                //   - the resolved tag pattern doesn't already contain
                //     `{major}` (the pattern is already serving that role)
                //   - the package is NOT private and does NOT set
                //     `skipNpmPublish` (no published artifact for a
                //     consumer to pin against — a floating tag would
                //     just clutter the tag history)
                //
                // Errors are soft-fail: a floating-tag hiccup must not
                // prevent the rest of the wave from publishing.
                const pkgForFloat = context.depGraph.getPackage(name);
                const perPkgForFloat = context.perPackageConfig.get(name);
                const isPrivate = pkgForFloat?.manifest?.private === true;
                const skipNpmPublish = perPkgForFloat?.skipNpmPublish === true;

                if (
                    floatingMajorEnabled
                    && !isPrerelease
                    && !pattern?.includes("{major}")
                    && !isPrivate
                    && !skipNpmPublish
                ) {
                    const major = version.split(/[-+]/, 1)[0]!.split(".")[0];

                    if (major !== undefined && major !== "") {
                        // F2 fix (audit): include the full scope in the
                        // floating tag so cross-scope collisions are
                        // impossible.
                        //
                        // Before (first attempt): `${unscopedName}-v${major}`
                        // — two packages with the same unscoped name from
                        // different scopes (e.g. `@acme/cli` + `@vendor/cli`)
                        // both wrote `cli-v1`, reintroducing the cross-
                        // package retarget bug.
                        //
                        // After: `${safeName}-v${major}` where `safeName`
                        // strips the leading `@` and replaces `/` with `-`
                        // (e.g. `@acme/cli` → `acme-cli-v1`,
                        // `@vendor/cli` → `vendor-cli-v1`). Collision-free
                        // across scopes; benign for unscoped packages
                        // (`cli` → `cli-v1`).
                        const safeName = name.replace(/^@/, "").replaceAll("/", "-");

                        // Guard against an empty `safeName` (e.g.
                        // `name === ""` — pathological but possible from
                        // a malformed manifest). A `-v1`-prefixed tag
                        // would conflict with everything; skip cleanly.
                        if (safeName !== "") {
                            const floatTag = `${safeName}-v${major}`;

                            try {
                                await createOrUpdateFloatingTag(
                                    { cwd: context.cwd, runner },
                                    floatTag,
                                    {
                                        push: !options.noPush,
                                        signing: context.config.signing,
                                    },
                                );
                                // Recorded in result.tags so the operator
                                // sees it on the summary line.
                                result.tags.push(floatTag);
                            } catch (error) {
                                result.skipped.push({
                                    name: floatTag,
                                    reason: `floating-major-tag: ${(error as Error).message}`,
                                });
                            }
                        }
                    }
                }
            }

            if (!options.noPush && result.tags.length > 0) {
                try {
                    await pushTags({ cwd: context.cwd, runner });
                    result.tagsPushed = true;
                } catch (error) {
                    // Soft-fail on the tag push itself (the publish already
                    // succeeded), but surface a failed entry so the CLI exits
                    // non-zero and prints the TAG_PUSH_FAILED hint. The user
                    // can re-run with --resume to retry the push.
                    result.tagsPushed = false;
                    result.failed.push({
                        name: "_pushTags",
                        reason: `git push --tags failed: ${(error as Error).message}. Retry with: git push --tags`,
                    });
                }
            }

            // Persist final tag state.
            state.tagged = [...result.tags];
            state.pushed = result.tagsPushed;

            if (!options.dryRun) {
                await writeState(context.cwd, changesDir, state);
            }

            // Successful end-state: clear state file. We treat a successful
            // publish as "done" even if `git push --tags` failed — tag pushing
            // can be retried independently with `git push --tags` and shouldn't
            // hold the state file open. The publish itself succeeded.
            if (result.failed.length === 0 && result.published.length > 0 && !options.dryRun) {
                await clearState(context.cwd, changesDir);
            }
        }

        // Persist + commit the pending-stage registry. Runs on every publish
        // wave (success, partial, all-skipped) so the tracked file always
        // reflects what's live on npm. The `[skip ci]` tag prevents this
        // chore commit from triggering another release cycle.
        //
        // Commit message reflects the delta direction so the git log reads
        // sensibly without having to diff the file: "record" for net-new
        // pending entries, "drain" for net-removed entries, "update" for
        // mixed waves.
        if (!options.dryRun) {
            const previous = priorRegistrySnapshot.pending.length;
            const next = stagedRegistry.pending.length;
            const write = await writeStagedRegistry(context.cwd, changesDir, stagedRegistry);

            if (write.changed) {
                const { stageAndCommitFile } = await import("./git");
                let message: string;

                if (write.removed) {
                    message = "chore(release): clear pending stage registry [skip ci]";
                } else if (next > previous) {
                    const added = next - previous;

                    message = `chore(release): record ${added} new pending stage${added === 1 ? "" : "s"} [skip ci]`;
                } else if (next < previous) {
                    const removed = previous - next;

                    message = `chore(release): drain ${removed} resolved stage${removed === 1 ? "" : "s"} [skip ci]`;
                } else {
                    // Same count but different content (e.g. a stage was
                    // drained and a new one staged in the same wave).
                    message = `chore(release): update pending stage registry (${next} pending) [skip ci]`;
                }

                try {
                    await stageAndCommitFile(
                        { cwd: context.cwd, runner },
                        write.path,
                        message,
                        {
                            author: context.config.gitUser,
                            push: !options.noPush,
                            sign: context.config.gitSignCommits === true,
                        },
                    );
                } catch (error) {
                    // Don't fail the whole publish for a registry-commit
                    // hiccup — the file is on disk; the next run will pick it
                    // up and retry the commit. Log to stderr only; we don't
                    // pollute `result.skipped[]` with infrastructure noise.
                    process.stderr.write(
                        `[vis release] Warning: could not commit ${write.path}: ${(error as Error).message}\n`,
                    );
                }
            }
        }

        // Workspace-level changelog wave entry (C5 fix). Written from the
        // publish phase — AFTER tag-push — using `result.published[]` so a
        // stage rejected at the gate never produces an orphan wave entry.
        // Skipped on dry-run, when config disables it, or when no package
        // actually published.
        if (
            !options.dryRun
            && result.published.length > 0
            && context.config.workspaceChangelog !== false
        ) {
            const wsRaw = context.config.workspaceChangelog;
            const wsConfig = typeof wsRaw === "object" ? wsRaw : undefined;
            // Default: only render workspace-level when explicitly opted-in OR when aggregateRelease is enabled.
            const aggregate = typeof context.config.aggregateRelease === "object"
                ? context.config.aggregateRelease.enabled
                : context.config.aggregateRelease === true;

            if (wsConfig !== undefined || aggregate) {
                try {
                    const { writeWorkspaceChangelogWave } = await import("./changelog/workspace");

                    // Project the published set back into PlannedRelease
                    // shape using the plan as the source of metadata
                    // (changeFiles, oldVersion, kind, etc.). Only releases
                    // that actually shipped this wave are included.
                    const publishedNames = new Set(result.published.map((p) => p.name));
                    const publishedReleases = context.plan.releases.filter((r) => publishedNames.has(r.name));

                    const waveEntryPath = await writeWorkspaceChangelogWave(
                        {
                            changelogConfig: context.config.changelog,
                            cwd: context.cwd,
                            workspaceChangelog: context.config.workspaceChangelog,
                        },
                        publishedReleases,
                    );

                    if (waveEntryPath) {
                        try {
                            const { stageAndCommitFile } = await import("./git");

                            await stageAndCommitFile(
                                { cwd: context.cwd, runner },
                                waveEntryPath,
                                "chore(release): record wave [skip ci]",
                                {
                                    author: context.config.gitUser,
                                    push: !options.noPush,
                                    sign: context.config.gitSignCommits === true,
                                },
                            );
                        } catch (error) {
                            // Soft-fail: the workspace CHANGELOG.md is on
                            // disk; the next wave will pick up the staged
                            // file and commit it together with the next
                            // entry. Don't fail the whole publish for a
                            // commit hiccup.
                            process.stderr.write(
                                `[vis release] Warning: could not commit workspace CHANGELOG.md: ${(error as Error).message}\n`,
                            );
                        }
                    }
                } catch (error) {
                    // Soft-fail: workspace changelog is documentation, not
                    // a release blocker.
                    process.stderr.write(
                        `[vis release] Warning: could not write workspace CHANGELOG.md wave entry: ${(error as Error).message}\n`,
                    );
                }
            }
        }

        // Create GH releases (or aggregated release) for every successful publish.
        // Post-publish lifecycle: forge releases + PR walker + chat
        // notifications. All three run within the same guard (the publish
        // actually shipped + tags reached the remote) but `noRelease`
        // only suppresses the forge-release write — successWalk + chat
        // notifications still fire even when the operator opts out of
        // GH/GitLab release pages (e.g. teams managing release notes in
        // a separate doc site still want PR comments + Slack pings).
        //
        // F3 fix (audit): `noRelease` previously gated this whole block,
        // which silently disabled both successWalk and notifications.
        // Now the inner block is split so each lifecycle step can be
        // configured independently.
        if (!options.dryRun && result.published.length > 0 && result.tagsPushed) {
            if (context.config.publish?.noRelease !== true) {
                await createRemoteReleases(context, result, runner);
            }

            // Walk every referenced PR / issue and post a "released in X.Y.Z"
            // sticky comment + `released` label (semantic-release parity).
            // Runs after createRemoteReleases so each entry has its release
            // URL populated. Soft-fails everything to plan.warnings — the
            // publish already succeeded, so a forge hiccup here shouldn't
            // roll it back.
            //
            // C-4 fix: dedupe against `state.walked` so a `--resume` after a
            // partial failure doesn't re-walk PRs whose comments + labels
            // already landed on run 1. Sticky-comment markers provide
            // forge-side idempotency, but skipping the walk entirely saves
            // the rate-limited API calls (relevant for waves touching many
            // PRs).
            try {
                const { walkSuccessfulRelease } = await import("./success-walk");
                const { createRemoteClient, detectRemoteProvider } = await import("./remote/detect");
                const { resolveFormatter } = await import("./changelog/resolve");
                const provider = await detectRemoteProvider(context.cwd, runner, context.config.provider);
                const client = createRemoteClient(provider, { githubHost: context.config.githubHost, gitlabHost: context.config.gitlabHost, httpProxy: context.config.httpProxy });
                const repo = await client.detectRepoSlug(context.cwd, runner);
                const formatter = await resolveFormatter(context.config.changelog, context.cwd);

                // Dedupe against BOTH `state.walked` (per-run dedupe — kept
                // for `--resume` semantics on the originating runner) AND
                // `stagedRegistry.recentlyWalked` (cross-runner dedupe — the
                // committed `.vis/release/staged.json` survives a fresh CI
                // runner checkout, so a re-fired workflow on a different
                // machine doesn't re-walk the PRs).
                const { recordRecentlyWalked } = await import("./staged-registry");
                const alreadyWalked = new Set([
                    ...(state.walked ?? []),
                    ...(stagedRegistry.recentlyWalked ?? []).map((entry) => entry.key),
                ]);
                const walkable = {
                    ...result,
                    published: result.published.filter((p) => !alreadyWalked.has(`${p.name}@${p.version}`)),
                };

                if (walkable.published.length > 0) {
                    const walkResult = await walkSuccessfulRelease(context, walkable, runner, {
                        client,
                        formatter,
                        repo,
                    });

                    // Record successful walks so a later --resume doesn't repeat
                    // them. We optimistically mark the WHOLE walkable set as
                    // walked even if individual refs failed — the soft-fail
                    // logic inside walkSuccessfulRelease already turned those
                    // into warnings, so re-walking would just hit the same
                    // forge issues.
                    const walkedKeys = walkable.published.map((p) => `${p.name}@${p.version}`);

                    state.walked = [
                        ...(state.walked ?? []),
                        ...walkedKeys,
                    ];
                    await writeState(context.cwd, changesDir, state);

                    // Cross-runner persistence — append to the tracked
                    // registry too. The follow-up registry write + commit
                    // sits after the notifications block so one commit
                    // captures both walked + notified deltas.
                    stagedRegistry = recordRecentlyWalked(stagedRegistry, walkedKeys);

                    if (walkResult.warnings.length > 0) {
                        context.plan.warnings.push(...walkResult.warnings);
                    }
                }
            } catch (error) {
                // Top-level safety net — any orchestration error in the walk
                // setup itself (provider detect crash, formatter resolution)
                // shouldn't fail the publish.
                context.plan.warnings.push(
                    `successWalk: could not run post-release walk: ${(error as Error).message}`,
                );
            }

            // Fan out post-release notifications (slack / discord / webhook /
            // plugins). Runs LAST in the post-publish sequence because chat
            // pings should reflect the FINAL state — tags pushed, GH releases
            // created, PRs walked + labelled — not an in-progress snapshot.
            // Per-channel failures are isolated; the publish itself is
            // already complete and immutable at this point.
            if (context.config.notifications) {
                try {
                    const { dispatchNotifications } = await import("./notifications/interface");
                    const { createRemoteClient, detectRemoteProvider } = await import("./remote/detect");
                    const provider = await detectRemoteProvider(context.cwd, runner, context.config.provider);
                    const client = createRemoteClient(provider, { githubHost: context.config.githubHost, gitlabHost: context.config.gitlabHost, httpProxy: context.config.httpProxy });
                    const repo = await client.detectRepoSlug(context.cwd, runner);

                    // Pull root package.json#name when available so chat
                    // messages carry the workspace identity even when the
                    // git remote slug isn't enough context.
                    let monorepoName: string | undefined;

                    try {
                        const rootManifestPath = `${context.cwd}/package.json`;
                        const fs2 = await import("node:fs/promises");
                        const rootManifest = JSON.parse(await fs2.readFile(rootManifestPath, "utf8")) as { name?: string };

                        monorepoName = rootManifest.name;
                    } catch {
                        // root manifest missing or unreadable — fine, we just
                        // omit the field.
                    }

                    // C-4 fix: dedupe notifications against state.notified so
                    // a `--resume` after a partial failure doesn't re-fire
                    // Slack/Discord pings for releases that already shipped
                    // + notified on run 1. Unlike successWalk's sticky
                    // markers, chat webhooks have NO server-side idempotency
                    // — a re-send produces a duplicate message.
                    //
                    // Cross-runner extension: also dedupe against
                    // `stagedRegistry.recentlyNotified`, which is committed
                    // to the worktree and therefore survives a fresh CI
                    // runner clone. `state.notified` alone is per-run + per-
                    // machine — a re-fired workflow on a different runner
                    // would otherwise re-fire the chat pings.
                    const alreadyNotified = new Set([
                        ...(state.notified ?? []),
                        ...(stagedRegistry.recentlyNotified ?? []).map((entry) => entry.key),
                    ]);
                    const notifiable = result.published.filter((p) => !alreadyNotified.has(`${p.name}@${p.version}`));

                    // When everything in this wave was already notified on a
                    // prior run, skip the dispatcher entirely (chat webhooks
                    // have no server-side idempotency, so a re-send would
                    // duplicate). Crucially, do NOT return here — the
                    // cross-runner persistence + post-publish hook below still
                    // need to run, and the function must return `result`.
                    if (notifiable.length > 0) {
                        const notificationResult = await dispatchNotifications(
                            context.config.notifications,
                            {
                                channel: context.channel?.tag,
                                completedAt: new Date().toISOString(),
                                ...(monorepoName === undefined ? {} : { monorepoName }),
                                published: notifiable.map((p) => {
                                    return {
                                        name: p.name,
                                        tag: context.channel?.tag,
                                        ...(p.url === undefined ? {} : { url: p.url }),
                                        version: p.version,
                                    };
                                }),
                                ...(repo === undefined ? {} : { repo }),
                                skipped: result.skipped.map((s) => { return { name: s.name, reason: s.reason }; }),
                            },
                            { warn: (m) => context.plan.warnings.push(m) },
                        );

                        // Mark the dispatched-this-run set as notified ONLY when
                        // at least one channel succeeded — that way a total
                        // dispatch failure (all channels down) can retry next
                        // wave instead of being silently skipped forever. The
                        // sticky-marker / webhook-rate-limit guards keep the
                        // retry from being too noisy.
                        if (notificationResult.succeeded.length > 0) {
                            const notifiedKeys = notifiable.map((p) => `${p.name}@${p.version}`);

                            state.notified = [
                                ...(state.notified ?? []),
                                ...notifiedKeys,
                            ];
                            await writeState(context.cwd, changesDir, state);

                            // Cross-runner persistence — same rationale as the
                            // walked path above. Mutates the in-memory registry;
                            // the trailing write + commit below captures it.
                            const { recordRecentlyNotified } = await import("./staged-registry");

                            stagedRegistry = recordRecentlyNotified(stagedRegistry, notifiedKeys);
                        }

                        // B-2: surface the dispatch outcome explicitly so
                        // `vis release plan` and CI tails can show "notified
                        // 2/3 channels" instead of guessing from absent
                        // failure entries. Skipped when all channels succeed
                        // AND no failures occurred (the silent success case).
                        if (notificationResult.failed.length > 0 || notificationResult.succeeded.length > 0) {
                            const total = notificationResult.succeeded.length + notificationResult.failed.length;

                            if (notificationResult.failed.length > 0) {
                                context.plan.warnings.push(
                                    `[notifications] dispatched ${notificationResult.succeeded.length}/${total} channels${notificationResult.succeeded.length > 0 ? ` (succeeded: ${notificationResult.succeeded.join(", ")})` : ""}; ${notificationResult.failed.length} failed.`,
                                );

                                for (const failure of notificationResult.failed) {
                                    context.plan.warnings.push(
                                        `[notifications:${failure.id}] ${failure.error}`,
                                    );
                                }
                            }
                        }
                    }
                } catch (error) {
                    // Top-level safety net for the dispatcher itself
                    // (config materialisation crash, dynamic-import failure).
                    context.plan.warnings.push(
                        `notifications: dispatch failed: ${(error as Error).message}`,
                    );
                }
            }

            // Cross-runner persistence — commit staged.json IF either
            // recentlyNotified or recentlyWalked grew during this wave.
            // The initial write at the end of the publish loop only
            // captured the pending-stage delta; the walk + notify steps
            // run AFTER that point, so a second write picks up their
            // contributions.
            //
            // Soft-failed for the same reason the first commit is:
            // staged.json being on disk is enough to recover next wave,
            // even if the commit itself hiccupped.
            if (!options.dryRun) {
                try {
                    const followUpWrite = await writeStagedRegistry(context.cwd, changesDir, stagedRegistry);

                    if (followUpWrite.changed) {
                        const { stageAndCommitFile } = await import("./git");

                        try {
                            await stageAndCommitFile(
                                { cwd: context.cwd, runner },
                                followUpWrite.path,
                                "chore(release): record cross-runner notify/walk dedupe [skip ci]",
                                {
                                    author: context.config.gitUser,
                                    push: !options.noPush,
                                    sign: context.config.gitSignCommits === true,
                                },
                            );
                        } catch (error) {
                            process.stderr.write(
                                `[vis release] Warning: could not commit ${followUpWrite.path} (notify/walk dedupe): ${(error as Error).message}\n`,
                            );
                        }
                    }
                } catch (error) {
                    // Don't fail the whole publish for a registry-write
                    // hiccup — the cross-runner dedupe degrades gracefully
                    // back to `state.notified` / `state.walked` (per-run
                    // only) on the next wave.
                    process.stderr.write(
                        `[vis release] Warning: could not update cross-runner dedupe registry: ${(error as Error).message}\n`,
                    );
                }
            }
        }

        if (!options.dryRun && context.config.postPublishCommand) {
            try {
                await runHook(context.cwd, context.config.postPublishCommand, "postPublishCommand");
            } catch (error) {
            // Don't fail the whole release for a post-hook bug; surface it.
                result.failed.push({ name: "_postPublishCommand", reason: (error as Error).message });
            }
        }

        return result;
    } finally {
        if (lockAcquired) {
            await releaseLock(context.cwd, changesDirForLock);
        }
    }
};

/**
 * Compose the "Related releases" Markdown block from a list of previous
 * forge releases. Exported for unit testing — the orchestrator inlines
 * the same logic inside `createRemoteReleases`. Returns an empty string
 * when `recent` is empty so callers can append/prepend unconditionally.
 */
export const composeRelatedReleasesBlock = (
    recent: ReadonlyArray<{ name: string; tag: string; url: string }>,
): string => {
    if (recent.length === 0) {
        return "";
    }

    const lines = recent.map((entry) => `- [${entry.name}](${entry.url})`);

    return `## Related releases\n\n${lines.join("\n")}`;
};

/**
 * Wrap a per-package release body with operator-supplied header / footer
 * text (release-please #1274 parity). Tokens supported in both fields:
 *   - `{name}` — package name
 *   - `{version}` — new version
 *   - `{previousVersion}` — previous version
 *   - `{date}` — `YYYY-MM-DD` of the release wave
 *   - `{repo}` — `owner/repo` slug
 *   - `{contributors}` — bullet-list of authors collected from the
 *     entire wave's change-file `author:` frontmatter (release-please
 *     #292). Wave-scoped — every per-package release sees the same set,
 *     so cascade / dependency-only bumps still credit the upstream
 *     author. Empty string when no change file in the wave declared an
 *     author. Block-only; keep on its own line.
 *
 * Header / footer parts are dropped entirely if they interpolate to
 * whitespace-only (e.g. a header of `"{contributors}"` when the wave
 * has no `author:` frontmatter), so the rendered body never gains
 * leading or trailing blank lines from a missing token. Trailing
 * whitespace inside a kept part (e.g. `"## Contributors\n\n"` when
 * `{contributors}` is empty) is stripped to avoid stacked blank lines.
 *
 * Not invoked in aggregate-release mode — that path builds its own
 * body and exposes `aggregateRelease.title` for templating instead.
 *
 * Exported for unit testing.
 */
export const applyReleaseNoteTemplate = (
    body: string,
    template: { footer?: string; header?: string } | undefined,
    tokens: { contributors?: string; date: string; name: string; previousVersion: string; repo: string; version: string },
): string => {
    if (!template || (!template.header && !template.footer)) {
        return body;
    }

    // F20 fix (audit): replaced the sequential `.replaceAll()` chain
    // with a single-pass token interpolation via
    // `expandReleaseNoteTemplate`. The new helper resolves each match
    // against the token table independently, so a token's substituted
    // value can never be re-interpolated by a later pass — eliminates
    // the latent footgun where a future token value containing another
    // token literal would have been re-substituted.
    const interpolate = (text: string): string => {
        const raw = expandReleaseNoteTemplate(text, {
            contributors: tokens.contributors ?? "",
            date: tokens.date,
            name: tokens.name,
            previousVersion: tokens.previousVersion,
            repo: tokens.repo,
            version: tokens.version,
        });

        // Collapse 3+ consecutive newlines (left behind when an empty
        // token sat between two `\n`s in the operator template) and
        // strip trailing whitespace — the `\n\n` part-joiner below
        // re-introduces the separator. Without this, an all-empty
        // header re-injects the leading blank line the original guard
        // tried to prevent (audit V1/S-2).
        return raw.replaceAll(/\n{3,}/g, "\n\n").replace(/\s+$/, "");
    };

    const parts: string[] = [];

    if (template.header) {
        const out = interpolate(template.header);

        if (out.length > 0) {
            parts.push(out);
        }
    }

    parts.push(body);

    if (template.footer) {
        const out = interpolate(template.footer);

        if (out.length > 0) {
            parts.push(out);
        }
    }

    return parts.join("\n\n");
};

/**
 * Extract `internalAuthors` from the github-formatter changelog config
 * so `collectContributors` can hide the same bot handles the
 * CHANGELOG.md hides. Returns `undefined` for any other formatter shape
 * (operators who use a custom formatter must filter handles themselves).
 *
 * Exported for unit testing.
 */
export const extractInternalAuthors = (
    changelog: VisReleaseConfig["changelog"],
): ReadonlyArray<string> | undefined => {
    if (!Array.isArray(changelog)) {
        return undefined;
    }

    const [name, options] = changelog;

    // Runtime guard against malformed user config (e.g. `["github"]` or
    // `["github", null]`) that the static tuple type can't catch.
    // eslint-disable-next-line sonarjs/different-types-comparison -- options is statically non-null but untrusted config may violate it
    if (name !== "github" || typeof options !== "object" || options === null) {
        return undefined;
    }

    const { internalAuthors } = (options as { internalAuthors?: unknown });

    if (!Array.isArray(internalAuthors)) {
        return undefined;
    }

    return internalAuthors.filter((entry): entry is string => typeof entry === "string");
};

/**
 * Create per-package GH releases (or one aggregated release if `aggregateRelease`
 * is on). Failures are non-fatal — the publish itself already succeeded.
 */
const createRemoteReleases = async (
    context: OrchestratorContext,
    result: PublishContextResult,
    runner: ReturnType<typeof createShellRunner>,
): Promise<void> => {
    const { createRemoteClient, detectRemoteProvider } = await import("./remote/detect");
    const provider = await detectRemoteProvider(context.cwd, runner, context.config.provider);
    const client = createRemoteClient(provider, { githubHost: context.config.githubHost, gitlabHost: context.config.gitlabHost, httpProxy: context.config.httpProxy });
    const repo = await client.detectRepoSlug(context.cwd, runner);

    if (!repo) {
        return;
    }

    const aggregateConfig = typeof context.config.aggregateRelease === "object"
        ? context.config.aggregateRelease
        : { enabled: context.config.aggregateRelease === true };

    const draftRelease = context.config.publish?.draftRelease === true;
    const discussionCategory = context.config.publish?.discussionCategory;
    const addReleases = context.config.publish?.addReleases;

    if (aggregateConfig.enabled) {
        const date = new Date().toISOString().slice(0, 10);
        const titleTemplate = aggregateConfig.title ?? "Release {date}";
        const title = titleTemplate.replaceAll("{date}", date);
        const tag = `release-${date}`;
        const body = result.published
            .map((p) => `- \`${p.name}\` → ${p.version}`)
            .join("\n");

        try {
            const created = await client.createRelease(runner, {
                body,
                cwd: context.cwd,
                discussionCategory,
                draft: draftRelease,
                repo,
                tag,
                title,
            });

            // M-2 fix: aggregate-release mode previously left every
            // `result.published[].url` undefined, which made successWalk's
            // template substitution emit `... is available on [GitHub
            // release]().` Stamp the SAME aggregate-release URL on every
            // published entry so downstream consumers (successWalk,
            // notifications) get a meaningful link.
            if (created?.url) {
                for (const item of result.published) {
                    item.url = created.url;
                }
            }
        } catch {
            // soft-fail
        }

        return;
    }

    // Per-package releases. Match the tag pattern used by the publish phase
    // so the GitHub release points at the actual git tag we created.
    const { defaultTagFor, renderTagPattern } = await import("./git");
    const rootTagPattern = context.config.releaseTagPattern;
    const channelName = context.channel?.tag;
    const releaseAssets = context.config.publish?.releaseAssets ?? {};

    // Wave-scoped tokens hoisted out of the per-package loop:
    //   - `date`: previously recomputed per iteration, which gave
    //     packages on either side of UTC midnight different `{date}`
    //     stamps within the same wave (audit V4).
    //   - `contributors`: previously collected from per-package
    //     `planned.changeFiles`, which dropped attribution on
    //     cascade / dependency-only bumps (audit V3) and split the
    //     contributor list across two releases on `--resume` after a
    //     partial publish failure (audit S-4). Sourced from the plan's
    //     `consumedChangeFiles` for true wave scope per release-please
    //     #292 semantics (audit S-8).
    const date = new Date().toISOString().slice(0, 10);
    const internalAuthors = extractInternalAuthors(context.config.changelog);
    const waveContributors = collectContributors(
        context.plan.consumedChangeFiles ?? [],
        { internalAuthors },
    );

    for (const item of result.published) {
        const perPkgPattern = context.perPackageConfig.get(item.name)?.releaseTagPattern;
        const pattern = perPkgPattern ?? rootTagPattern;
        const tag = pattern
            ? renderTagPattern(pattern, { channel: channelName, name: item.name, version: item.version })
            : defaultTagFor(item.name, item.version);
        const isPrerelease = item.version.includes("-");

        let body = `Release of ${item.name}@${item.version}.`;

        if (item.stageId) {
            // Staged publishes are invisible to `npm install` until approved.
            // Flag this in the release body so consumers don't conclude the
            // npm version exists when they hit a 404 trying to install it.
            body = `${body}\n\n> ⏳ **Staged — not yet installable.** Approve via \`vis release stage approve ${item.stageId}\` or the npmjs.com web UI.`;
        }

        if (releaseAssets.stampHashes && item.tarball) {
            // Stamp tarball hashes into the release body so consumers can
            // verify the registry tarball matches the audited build.
            body = `${body}\n\n### Tarball integrity\n\n- size: \`${item.tarball.size}\` bytes\n- sha256: \`${item.tarball.sha256}\`\n- sha512: \`${item.tarball.sha512}\``;
        }

        if (addReleases !== undefined && addReleases !== false) {
            // Semantic-release/github parity: link the immediately
            // previous N releases of THIS package. Tag pattern is the
            // same one we used to mint the current tag — `@scope/pkg@`
            // for the default `{name}@{version}`, derived empirically
            // from the resolved tag value (everything up to and
            // including the LAST `@` before the version).
            try {
                const lastAt = tag.lastIndexOf("@");
                const tagPrefix = lastAt > 0 ? tag.slice(0, lastAt + 1) : "";
                const recent = await client.listRecentReleases(runner, {
                    cwd: context.cwd,
                    excludeTag: tag,
                    limit: 5,
                    repo,
                    tagPrefix,
                });
                const block = composeRelatedReleasesBlock(recent);

                if (block) {
                    body = addReleases === "top" ? `${block}\n\n${body}` : `${body}\n\n${block}`;
                }
            } catch {
                // Soft-fail: a forge hiccup listing prior releases
                // shouldn't block the actually-completed publish.
            }
        }

        // releaseNoteTemplate (release-please #1274 parity): wrap the
        // composed body with operator-supplied header / footer. The
        // tokens cover the common case ("link to the migration guide",
        // "thank a sponsor") without requiring a custom formatter. Skipped
        // implicitly when the template is absent.
        const { releaseNoteTemplate } = context.config;

        if (releaseNoteTemplate) {
            const planned = context.plan.releases.find((r) => r.name === item.name);
            const previousVersion = planned?.oldVersion ?? "";

            body = applyReleaseNoteTemplate(body, releaseNoteTemplate, {
                contributors: waveContributors,
                date,
                name: item.name,
                previousVersion,
                repo,
                version: item.version,
            });
        }

        const assets: string[] = [];

        if (releaseAssets.uploadTarball && item.tarball) {
            assets.push(item.tarball.path);
        }

        try {
            const created = await client.createRelease(runner, {
                assets: assets.length > 0 ? assets : undefined,
                body,
                cwd: context.cwd,
                discussionCategory,
                draft: draftRelease,
                prerelease: isPrerelease,
                repo,
                tag,
                title: `${item.name} v${item.version}`,
            });

            // Record the release URL so the success-walk can put a link in
            // the sticky comment body. Only set when the adapter returns
            // one (GitLab may omit URL; custom adapters may too).
            if (created?.url) {
                item.url = created.url;
            }
        } catch (error) {
            // Soft-fail: publish already succeeded, but surface the failure
            // so an operator can re-run remote-release creation or fix the
            // forge-side issue (auth, rate limit, missing tag).
            // eslint-disable-next-line no-console
            console.warn(`createRelease failed for ${item.name}@${item.version} (tag ${tag}): ${(error as Error).message}`);
        }
    }
};

const createVersionActions = (id: string): VersionActions => {
    switch (id) {
        case "cargo": {
            return new CargoVersionActions();
        }
        case "container": {
            return new ContainerActions();
        }
        case "jsr": {
            return new JsrVersionActions();
        }
        case "maven": {
            return new MavenVersionActions();
        }
        case "native-addon": {
            return new NativeAddonVersionActions();
        }
        case "private": {
            return new PrivateVersionActions();
        }
        case "python": {
            return new PythonVersionActions();
        }
        case "shell": {
            return new ShellPublishActions();
        }
        default: {
            return new NpmVersionActions();
        }
    }
};

const shouldProvenance = (context: OrchestratorContext): boolean => {
    const args = context.config.publish?.publishArgs ?? [];

    return args.includes("--provenance") && context.pm.id !== "bun";
};
