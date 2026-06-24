/**
 * Default `versionActions` for npm-published packages.
 *
 * Pack → resolve workspace:/catalog: protocols in-place → strip
 * non-publishable fields → publish via `npm publish &lt;tarball>`.
 *
 * Per RFC §11.3: publishing always normalises through the npm CLI
 * (via the active adapter, which delegates as needed) so OIDC + provenance
 * work uniformly across npm/pnpm/yarn/bun.
 */

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { VisReleaseError } from "../../errors";
import type { PackageManifest, WorkspacePackage } from "../../types";
import { rewriteRangeForVersion } from "../apply-release-plan";
import { rewriteCatalogRefs } from "../catalog";
import { cleanPackageJsonForPublish } from "../clean-package-json";
import type { PackageManagerAdapter, PackResult, PublishResult } from "../package-managers/interface";
import { interpolateCommand, resolveCustomCommands } from "../security";
import type { PublishContext } from "./interface";
import { VersionActions } from "./interface";

/**
 * Best-effort enumeration of the pack-set. Reuses the JSON the active PM
 * adapter produced during `pack()` when available — saves a redundant
 * `npm pack --dry-run --json` round-trip for npm + pnpm. Falls back to that
 * round-trip for adapters that surface only stdout text (yarn, bun) or for
 * any unrecognised shape.
 *
 * Returns workspace-relative paths. On total failure (npm CLI absent, JSON
 * parse fails) returns an empty list — guards that depend on the file list
 * (e.g. packSecretScan) will then run with no inputs and pass trivially. Not
 * ideal for the secret-scan gate, but a missing-CLI shouldn't block the
 * publish; the operator should see the underlying npm error first.
 */
const listPackFiles = async (context: PublishContext, packResult: PackResult): Promise<string[]> => {
    const { extractPackFilesFromRaw } = await import("../publish-guards");
    const fromRaw = extractPackFilesFromRaw(packResult.raw);

    if (fromRaw !== undefined) {
        return fromRaw;
    }

    const result = await context.pm.runner.run("npm", ["pack", "--dry-run", "--json"], { cwd: context.pkg.dir, silent: true });

    if (result.exitCode !== 0) {
        return [];
    }

    try {
        return extractPackFilesFromRaw(JSON.parse(result.stdout)) ?? [];
    } catch {
        return [];
    }
};

/** Default timeout for the human-approval wait. */
const DEFAULT_STAGE_TIMEOUT_MS = 30 * 60 * 1000;

/** Default interval between `npm stage view &lt;id>` polls. */
const DEFAULT_STAGE_POLL_INTERVAL_MS = 15 * 1000;

interface ResolvedStageConfig {
    enabled: boolean;
    pollIntervalMs: number;
    timeoutMs: number;
}

/**
 * Normalise `publish.stage` from the user config into a concrete shape the
 * publish flow consumes. Accepts `true` (defaults), `false`/undefined
 * (off), or an object overriding timeout / poll interval.
 */
const resolveStageConfig = (raw: unknown): ResolvedStageConfig => {
    if (raw === true) {
        return { enabled: true, pollIntervalMs: DEFAULT_STAGE_POLL_INTERVAL_MS, timeoutMs: DEFAULT_STAGE_TIMEOUT_MS };
    }

    if (raw && typeof raw === "object") {
        const cfg = raw as { pollIntervalMs?: number; timeoutMs?: number };

        return {
            enabled: true,
            pollIntervalMs: cfg.pollIntervalMs ?? DEFAULT_STAGE_POLL_INTERVAL_MS,
            timeoutMs: cfg.timeoutMs ?? DEFAULT_STAGE_TIMEOUT_MS,
        };
    }

    return { enabled: false, pollIntervalMs: 0, timeoutMs: 0 };
};

export class NpmVersionActions extends VersionActions {
    // fallow-ignore-next-line unused-class-member -- version-action adapter contract member (accessed polymorphically via the adapter interface)
    public readonly id = "npm" as const;

    // fallow-ignore-next-line unused-class-member -- version-action adapter contract member (accessed polymorphically via the adapter interface)
    public async readPublishedVersion(context: { pkg: WorkspacePackage; pm: PackageManagerAdapter }): Promise<string | undefined> {
        try {
            const result = await context.pm.runner.run("npm", ["view", context.pkg.name, "version", "--silent"], { cwd: context.pkg.dir, silent: true });

            if (result.exitCode !== 0) {
                return undefined;
            }

            return result.stdout.trim() || undefined;
        } catch {
            return undefined;
        }
    }

    public async publish(context: PublishContext): Promise<PublishResult> {
        if (context.dryRun) {
            return { output: `[dry-run] would publish ${context.pkg.name}@${context.release.newVersion}`, published: true };
        }

        // Resume path: the tarball is already staged on the registry from
        // a prior wave. Skip pack + publish (re-uploading would either be
        // rejected by npm as a duplicate version or — worse — create a
        // parallel stage) and jump straight to waiting for the existing
        // stage's decision.
        if (context.resumeStageId) {
            const stageConfig = resolveStageConfig(context.workspaceConfig?.publish?.stage);

            if (!stageConfig.enabled) {
                // Stage was disabled between waves. Surface a clear error
                // rather than silently doing the wrong thing.
                throw new VisReleaseError({
                    code: "CONFIG_INVALID",
                    message: `Cannot resume stage ${context.resumeStageId} for ${context.pkg.name}@${context.release.newVersion}: publish.stage is now disabled. Resolve the stage manually via \`vis release stage approve|reject ${context.resumeStageId}\`.`,
                    packageName: context.pkg.name,
                });
            }

            return this.resumeStagedPublish(context, stageConfig);
        }

        // Custom-command path (RFC §19.4 trust gate)
        const customCommands
            = context.perPackageConfig && context.workspaceConfig
                ? resolveCustomCommands(context.pkg.name, context.perPackageConfig, context.workspaceConfig)
                : {};

        // Optional buildCommand (always before publish)
        if (customCommands.buildCommand) {
            const cmd = interpolateCommand(customCommands.buildCommand, {
                name: context.pkg.name,
                version: context.release.newVersion,
            });

            const result = await context.pm.runner.run(process.platform === "win32" ? "cmd" : "sh", process.platform === "win32" ? ["/c", cmd] : ["-c", cmd], {
                cwd: context.pkg.dir,
                silent: false,
            });

            if (result.exitCode !== 0) {
                throw new Error(`buildCommand failed for ${context.pkg.name}: exit ${result.exitCode}`);
            }
        }

        // 1) Compose the manifest that will land in the tarball:
        //    a) bumped version (already in versionedManifestByName)
        //    b) workspace: refs resolved to the new version of each dep
        //    c) catalog: refs rewritten in-place
        //    d) cleaned (scripts / devDeps / tool blocks stripped)
        const baseManifest = context.versionedManifestByName.get(context.pkg.name) ?? context.pkg.manifest;
        const protocolResolved = resolveWorkspaceRefs(baseManifest, context.versionedManifestByName);
        const catalogResolved = rewriteCatalogRefs(protocolResolved, context.catalogs);
        const cleaned = cleanPackageJsonForPublish(catalogResolved, context.cleanPackageJsonConfig);

        // 2) Prepare a temp staging dir with the modified package.json + the
        //    package's source files. Easiest approach: write the manifest in-
        //    place, run pack, then restore. But that breaks idempotency on
        //    failure. Use a swap: write manifest, pack, restore.
        const fs = await import("node:fs/promises");
        const originalManifest = await fs.readFile(context.pkg.manifestPath, "utf8");

        try {
            await fs.writeFile(context.pkg.manifestPath, `${JSON.stringify(cleaned, null, 4)}\n`);

            // Custom publishCommand replaces the default pack-then-publish.
            if (customCommands.publishCommand) {
                const tokens = { name: context.pkg.name, version: context.release.newVersion };
                const cmds = Array.isArray(customCommands.publishCommand) ? customCommands.publishCommand : [customCommands.publishCommand];

                for (const cmd of cmds) {
                    const interpolated = interpolateCommand(cmd, tokens);
                    const result = await context.pm.runner.run(
                        process.platform === "win32" ? "cmd" : "sh",
                        process.platform === "win32" ? ["/c", interpolated] : ["-c", interpolated],
                        { cwd: context.pkg.dir, silent: false },
                    );

                    if (result.exitCode !== 0) {
                        throw new Error(`publishCommand failed for ${context.pkg.name}: exit ${result.exitCode}`);
                    }
                }

                return { output: `[custom] published ${context.pkg.name}@${context.release.newVersion}`, published: true };
            }

            const tempDir = mkdtempSync(join(tmpdir(), "vis-release-pack-"));

            try {
                const packResult = await context.pm.pack({ cwd: context.pkg.dir, destination: tempDir });

                // Pre-publish security gates (RFC §19.4 extension).
                // Run after pack so guards see the same files the registry
                // will receive — catches `.npmignore`/`files` misconfigs.
                const guardsConfig = context.workspaceConfig?.publish?.guards;

                if (guardsConfig && Object.values(guardsConfig).some((v) => v !== undefined && v !== false && v !== "off")) {
                    const { runPublishGuards } = await import("../publish-guards");
                    const packFiles = await listPackFiles(context, packResult);
                    const report = await runPublishGuards({
                        config: guardsConfig,
                        manifest: cleaned,
                        packFiles,
                        pkgDir: context.pkg.dir,
                        runner: context.pm.runner,
                        // Source-tree manifest preserves `scripts` so the
                        // lifecycleScripts gate sees the intent.
                        sourceManifest: context.pkg.manifest,
                    });

                    if (report.blockers.length > 0) {
                        // Guard findings flow into a thrown error that lands in
                        // CI logs. A secret-scan finding can carry a file path
                        // like `/tmp/build-with-API_KEY.txt`; redact through the
                        // shared token regex before serialising.
                        const { redactTokens } = await import("../security");
                        const summary = report.blockers
                            .flatMap((r) =>
                                r.findings.map((f) => `  • [${r.gate}] ${redactTokens(f.message)}${f.hint ? `\n      → ${redactTokens(f.hint)}` : ""}`),
                            )
                            .join("\n");

                        throw new VisReleaseError({
                            code: "PUBLISH_FAILED",
                            message: `Pre-publish guards failed for ${context.pkg.name}@${context.release.newVersion}:\n${summary}`,
                            packageName: context.pkg.name,
                        });
                    }
                }

                // Hash the tarball before handing off to the registry. Surfacing
                // these in PublishResult lets the orchestrator stamp them into
                // the GH release body (publish.releaseAssets.stampHashes).
                const { hashTarball } = await import("../publish-guards");
                const hashes = await hashTarball(packResult.tarball);

                // RFC §11.3 escape hatch: `publishStrategy: "native"` publishes
                // with the project's own package manager (`<pm> publish`) instead
                // of the cross-PM `npm publish <tarball>` LCD path. The on-disk
                // manifest was already resolved (workspace:/catalog: → literals)
                // and cleaned above, so the manager packs the correct
                // package.json. Staging is npm-tarball-only and does not apply.
                if ((context.workspaceConfig?.publish?.publishStrategy ?? "npm-publish-tarball") === "native") {
                    const pmId = context.pm.id;

                    if (context.provenance && pmId === "bun") {
                        process.stderr.write(
                            `[vis release] ⚠ publishStrategy "native": bun has no --provenance/OIDC support; ${context.pkg.name}@${context.release.newVersion} publishes without provenance.\n`,
                        );
                    }

                    if (context.otp && pmId === "yarn") {
                        process.stderr.write(
                            `[vis release] ⚠ publishStrategy "native": \`yarn npm publish\` ignores --otp; configure 2FA via .yarnrc.yml for ${context.pkg.name}.\n`,
                        );
                    }

                    const nativeResult = await context.pm.publishNative({
                        access: "public",
                        cwd: context.pkg.dir,
                        otp: context.otp,
                        provenance: context.provenance,
                        registry: context.registry,
                        tag: context.tag,
                    });

                    return { ...nativeResult, tarball: hashes };
                }

                const stageConfig = resolveStageConfig(context.workspaceConfig?.publish?.stage);

                if (stageConfig.enabled) {
                    // Per RFC §13.6: refuse restricted+OIDC before we hand the
                    // tarball to the registry. The post-decision disambiguation
                    // GET can't authenticate without a static token.
                    const { refuseRestrictedOidc } = await import("../stage-publisher");
                    const access = (context.pkg.manifest.publishConfig as { access?: string } | undefined)?.access;

                    refuseRestrictedOidc(access);
                }

                const publishResult = await context.pm.publish({
                    access: "public",
                    otp: context.otp,
                    provenance: context.provenance,
                    registry: context.registry,
                    stage: stageConfig.enabled,
                    tag: context.tag,
                    tarball: packResult.tarball,
                });

                if (!stageConfig.enabled || !publishResult.stageId) {
                    return { ...publishResult, tarball: hashes };
                }

                // Block on the human-review gate. Rejection / timeout are NOT
                // CI failures — they flow through the orchestrator's skipped[]
                // so downstream tag-creation + GH-release steps simply skip
                // this package while CI stays green.
                const { waitForStageDecision } = await import("../stage-publisher");
                const { stageId } = publishResult;
                const startedAt = Date.now();

                process.stderr.write(
                    `[vis release] ⏳ ${context.pkg.name}@${context.release.newVersion} staged (id ${stageId}). Waiting up to ${Math.round(stageConfig.timeoutMs / 60_000)}m for a maintainer to approve via npmjs.com or \`npm stage approve ${stageId}\`...\n`,
                );

                const decision = await waitForStageDecision({
                    cwd: context.pkg.dir,
                    onProgress: (elapsedMs) => {
                        // Heartbeat every 5 minutes so the CI log doesn't look
                        // hung. Operators watching the live tail get a clear
                        // signal that vis is still waiting on a decision.
                        if (elapsedMs > 0 && elapsedMs % 300_000 < stageConfig.pollIntervalMs) {
                            process.stderr.write(
                                `[vis release] still waiting for ${context.pkg.name} stage decision (${Math.round(elapsedMs / 60_000)}m elapsed)...\n`,
                            );
                        }
                    },
                    packageName: context.pkg.name,
                    pollIntervalMs: stageConfig.pollIntervalMs,
                    runner: context.pm.runner,
                    stageId,
                    timeoutMs: stageConfig.timeoutMs,
                    version: context.release.newVersion,
                });

                if (decision === "approved") {
                    process.stderr.write(
                        `[vis release] ✓ ${context.pkg.name}@${context.release.newVersion} approved + promoted (${Math.round((Date.now() - startedAt) / 1000)}s).\n`,
                    );

                    // Clear stageId — the version is live, the id is consumed.
                    return { ...publishResult, stageId: undefined, tarball: hashes };
                }

                if (decision === "rejected") {
                    // GH-Actions annotation so the reviewer's decision surfaces
                    // in the job summary without failing the run.
                    process.stdout.write(
                        `::warning::Stage rejected for ${context.pkg.name}@${context.release.newVersion} (id ${stageId}). Re-stage by re-running the release once the review feedback is addressed.\n`,
                    );

                    return {
                        alreadyPublished: false,
                        output: `stage-rejected: ${stageId}`,
                        published: false,
                        stageId,
                    };
                }

                // decision === "timeout"
                process.stdout.write(
                    `::warning::Stage timeout for ${context.pkg.name}@${context.release.newVersion} (id ${stageId}) after ${Math.round(stageConfig.timeoutMs / 60_000)}m. Re-run \`vis release publish\` once a maintainer can approve, or run \`vis release stage approve ${stageId}\` manually.\n`,
                );

                return {
                    alreadyPublished: false,
                    output: `stage-timeout: ${stageId}`,
                    published: false,
                    stageId,
                };
            } finally {
                await fs.rm(tempDir, { force: true, recursive: true });
            }
        } finally {
            // Restore the source manifest (even on failure).
            await fs.writeFile(context.pkg.manifestPath, originalManifest);
        }
    }

    /**
     * Resume a previously-staged publish whose tarball is still sitting in
     * npm's holding area. Called from `publish()` when `resumeStageId` is
     * set — typically on `vis release publish --resume` after a wave
     * timed out, or on a re-run after the operator approved on
     * npmjs.com but the workflow restarted before the previous publish
     * could detect it.
     *
     * Three resolution paths:
     *   - **approved between waves** → `npm stage view` 404s, `npm view
     *     &lt;pkg>@&lt;version>` returns the tarball URL → we treat this as a
     *     fresh publish: `published: true`, the orchestrator records the
     *     tag + GH release as if this wave staged it directly.
     *   - **still pending** → poll until decision (same as initial stage)
     *   - **rejected** → same as initial stage, surfaced as a skip
     *
     * Crucially: no pack, no publish, no manifest mutation. The tarball
     * on npm is already final — replaying the pack would produce a
     * different sha (timestamps in archive headers) which a future
     * verification step could flag as tarball-divergence.
     */
    private async resumeStagedPublish(context: PublishContext, stageConfig: ResolvedStageConfig): Promise<PublishResult> {
        const stageId = context.resumeStageId!;
        const startedAt = Date.now();

        process.stderr.write(
            `[vis release] ↻ Resuming wait on staged ${context.pkg.name}@${context.release.newVersion} (id ${stageId}) — tarball already uploaded; not re-publishing.\n`,
        );

        const { waitForStageDecision } = await import("../stage-publisher");

        const decision = await waitForStageDecision({
            cwd: context.pkg.dir,
            onProgress: (elapsedMs) => {
                if (elapsedMs > 0 && elapsedMs % 300_000 < stageConfig.pollIntervalMs) {
                    process.stderr.write(
                        `[vis release] still waiting for ${context.pkg.name} stage decision (resume, ${Math.round(elapsedMs / 60_000)}m elapsed)...\n`,
                    );
                }
            },
            packageName: context.pkg.name,
            pollIntervalMs: stageConfig.pollIntervalMs,
            runner: context.pm.runner,
            stageId,
            timeoutMs: stageConfig.timeoutMs,
            version: context.release.newVersion,
        });

        if (decision === "approved") {
            process.stderr.write(
                `[vis release] ✓ ${context.pkg.name}@${context.release.newVersion} approved + promoted on resume (${Math.round((Date.now() - startedAt) / 1000)}s).\n`,
            );

            // No tarball hashes on the resume path — we never re-packed.
            // releaseAssets.stampHashes will skip this package gracefully
            // (it checks for tarball.path being set).
            return {
                output: `[resumed] published ${context.pkg.name}@${context.release.newVersion}`,
                published: true,
            };
        }

        if (decision === "rejected") {
            process.stdout.write(`::warning::Stage rejected on resume for ${context.pkg.name}@${context.release.newVersion} (id ${stageId}).\n`);

            return {
                alreadyPublished: false,
                output: `stage-rejected: ${stageId}`,
                published: false,
                stageId,
            };
        }

        // decision === "timeout"
        process.stdout.write(
            `::warning::Stage timeout on resume for ${context.pkg.name}@${context.release.newVersion} (id ${stageId}) after ${Math.round(stageConfig.timeoutMs / 60_000)}m.\n`,
        );

        return {
            alreadyPublished: false,
            output: `stage-timeout: ${stageId}`,
            published: false,
            stageId,
        };
    }
}

const DEPENDENCY_KINDS = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"] as const;

/**
 * Resolve `workspace:` refs in a manifest's deps to the literal new version
 * of each workspace dep. Required for the pack step in modes where the
 * package manager doesn't natively rewrite (npm-publish-tarball strategy
 * across all PMs handles this defensively).
 */
const resolveWorkspaceRefs = (manifest: PackageManifest, versionedByName: ReadonlyMap<string, PackageManifest>): PackageManifest => {
    const out: PackageManifest = { ...manifest };

    for (const kind of DEPENDENCY_KINDS) {
        const block = manifest[kind];

        if (!block || typeof block !== "object") {
            continue;
        }

        const next: Record<string, string> = { ...block };

        for (const [depName, range] of Object.entries(block)) {
            if (!range.startsWith("workspace:")) {
                continue;
            }

            const depManifest = versionedByName.get(depName);

            if (!depManifest) {
                // External dep not in this wave — skip.
                continue;
            }

            next[depName] = rewriteRangeForVersion(range.slice("workspace:".length) === "*" ? "*" : range, depManifest.version);

            // Strip the workspace: prefix in the published tarball — consumers
            // (npm install) don't understand it.
            if (next[depName].startsWith("workspace:")) {
                next[depName] = next[depName].slice("workspace:".length);
            }
        }

        out[kind] = next;
    }

    return out;
};
