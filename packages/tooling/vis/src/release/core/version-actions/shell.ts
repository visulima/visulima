/**
 * `shell` versionActions — generic publish via a configured shell
 * command. Use this for ecosystems vis doesn't have a first-class
 * actions plugin for (crates.io, PyPI, RubyGems, Maven Central,
 * container registries, …).
 *
 * Wire it via per-package config:
 *
 *     release: {
 *         packages: {
 *             "my-crate": {
 *                 ...cargo({ crateDir: "native" }),
 *                 versionActions: "shell",
 *                 publishCommand: "cargo publish --token $CARGO_REGISTRY_TOKEN",
 *                 checkPublished: "cargo search my-crate --limit 1 | awk '{print $3}' | tr -d '\"'",
 *             },
 *         },
 *     }
 *
 * Trust gate: `release.allowCustomCommands` MUST permit the package
 * (workspace-level boolean, an explicit allow-list of package names,
 * or a per-package opt-in — see `release/security.ts`). Without that,
 * the actions resolve to a no-op publish + log a warning. This keeps
 * a malicious change file or compromised dep from leveraging the
 * shell-publish path as an arbitrary-command-execution vector.
 *
 * Interpolation tokens (substituted in both publishCommand /
 * buildCommand / checkPublished):
 *     {{name}}     — package name (e.g. `@scope/foo`)
 *     {{version}}  — new version literal (e.g. `1.2.3`)
 *     {{tag}}      — dist-tag / channel name (`latest`, `alpha`, …)
 *     {{registry}} — registry URL when configured
 *
 * All token values are shell-quoted via `sq()` in security.ts to
 * prevent injection if a package name contains funny characters.
 *
 * Idempotency: `checkPublished` is invoked BEFORE the publish step;
 * when it returns the new version literal, the publish is skipped
 * (already-published path). This is how `vis release publish` stays
 * safe to re-run on partial failures.
 */

import { VisReleaseError } from "../../errors";
import type { WorkspacePackage } from "../../types";
import type { PackageManagerAdapter, PublishResult } from "../package-managers/interface";
import { interpolateCommand, resolveCustomCommands } from "../security";
import type { PublishContext } from "./interface";
import { VersionActions } from "./interface";

const runShell = async (
    runner: PackageManagerAdapter["runner"],
    cwd: string,
    template: string,
    tokens: { name: string; registry?: string; tag?: string; version: string },
): Promise<{ exitCode: number; stderr: string; stdout: string }> => {
    // Interpolate {{name}}, {{version}}, {{tag}}, {{registry}}. The
    // {{tag}}/{{registry}} substitutions land empty when undefined,
    // which is the operator's responsibility to handle in their
    // command (`--tag={{tag}}` becomes `--tag=` and most CLIs error
    // cleanly).
    const cmd = interpolateCommand(template, tokens);
    const isWindows = process.platform === "win32";
    const shell = isWindows ? "cmd" : "sh";
    const shellArgs = isWindows ? ["/c", cmd] : ["-c", cmd];

    return runner.run(shell, shellArgs, { cwd, silent: false });
};

export class ShellPublishActions extends VersionActions {
    // fallow-ignore-next-line unused-class-member -- version-action adapter contract member (accessed polymorphically via the adapter interface)
    public readonly id = "shell" as const;

    // fallow-ignore-next-line unused-class-member -- version-action adapter contract member (accessed polymorphically via the adapter interface)
    public async readPublishedVersion(context: {
        perPackageConfig?: { checkPublished?: string };
        pkg: WorkspacePackage;
        pm: PackageManagerAdapter;
        workspaceConfig?: { allowCustomCommands?: boolean | string[] };
    }): Promise<string | undefined> {
        const perPkg = context.perPackageConfig ?? {};
        const { workspaceConfig } = context;

        if (!workspaceConfig) {
            return undefined;
        }

        // Resolve through the trust gate. If the package isn't
        // allow-listed we silently return undefined — the orchestrator
        // treats unknown published-version as "publish anyway".
        const resolved = resolveCustomCommands(context.pkg.name, perPkg, workspaceConfig);

        if (!resolved.checkPublished) {
            return undefined;
        }

        const result = await runShell(context.pm.runner, context.pkg.dir, resolved.checkPublished, {
            name: context.pkg.name,
            // Pass the current on-disk version so checkPublished can use it
            // if it wants (e.g. `cargo search foo --limit 1` doesn't take
            // version but `npm view foo@1.2.3` does).
            version: context.pkg.version,
        });

        if (result.exitCode !== 0) {
            return undefined;
        }

        const stdout = result.stdout.trim();

        // Tolerate output like `1.2.3` or `"1.2.3"` or `version: 1.2.3`.
        // We pull the first semver-shaped token; everything else is
        // discarded. Returns undefined when no semver is found so the
        // orchestrator falls through to "publish anyway".
        const match = /\b\d+\.\d+\.\d+(?:[-+][\w.+-]+)?\b/.exec(stdout);

        return match?.[0];
    }

    public async publish(context: PublishContext): Promise<PublishResult> {
        if (context.dryRun) {
            return {
                output: `[dry-run / shell] would publish ${context.pkg.name}@${context.release.newVersion}`,
                published: true,
            };
        }

        const { workspaceConfig } = context;
        const perPkg = context.perPackageConfig ?? {};

        if (!workspaceConfig) {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                message: `Shell publish actions for ${context.pkg.name} require a workspace config (release.allowCustomCommands gate).`,
                packageName: context.pkg.name,
            });
        }

        const resolved = resolveCustomCommands(context.pkg.name, perPkg, workspaceConfig);

        // Resolution returns {} when the trust gate denies. We refuse
        // explicitly here so the operator gets a clear message instead
        // of a silent "no-op published" outcome.
        if (!resolved.publishCommand) {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                hint: `Set release.allowCustomCommands (workspace-wide boolean or an allow-list including "${context.pkg.name}") and configure release.packages["${context.pkg.name}"].publishCommand.`,
                message: `Shell publish actions for ${context.pkg.name} require a publishCommand AND the trust gate to permit it.`,
                packageName: context.pkg.name,
            });
        }

        const tokens = {
            name: context.pkg.name,
            registry: context.registry,
            tag: context.tag,
            version: context.release.newVersion,
        };

        // Idempotency: short-circuit when the version is already live.
        // Without this, a re-run after a transient failure (e.g. the
        // registry replied 5xx mid-upload) would either error with
        // "version already published" or — worse — try to overwrite a
        // mutable artifact.
        if (resolved.checkPublished) {
            const checkResult = await runShell(context.pm.runner, context.pkg.dir, resolved.checkPublished, tokens);

            if (checkResult.exitCode === 0) {
                const match = /\b\d+\.\d+\.\d+(?:[-+][\w.+-]+)?\b/.exec(checkResult.stdout.trim());

                if (match?.[0] === context.release.newVersion) {
                    return {
                        alreadyPublished: true,
                        output: `[shell] ${context.pkg.name}@${context.release.newVersion} already on the registry`,
                        published: false,
                    };
                }
            }
        }

        // Optional buildCommand before publish.
        if (resolved.buildCommand) {
            const buildResult = await runShell(context.pm.runner, context.pkg.dir, resolved.buildCommand, tokens);

            if (buildResult.exitCode !== 0) {
                throw new VisReleaseError({
                    code: "PUBLISH_FAILED",
                    message: `buildCommand failed for ${context.pkg.name}: exit ${buildResult.exitCode}. stderr: ${buildResult.stderr.trim().slice(0, 500)}`,
                    packageName: context.pkg.name,
                });
            }
        }

        // The publishCommand may be a string or an array. Arrays run
        // sequentially; any non-zero exit aborts. The trust gate
        // already authorised every entry through resolveCustomCommands.
        const commands = Array.isArray(resolved.publishCommand) ? resolved.publishCommand : [resolved.publishCommand];

        for (const command of commands) {
            const result = await runShell(context.pm.runner, context.pkg.dir, command, tokens);

            if (result.exitCode !== 0) {
                throw new VisReleaseError({
                    code: "PUBLISH_FAILED",
                    hint: "Inspect the publishCommand output above. Common causes: missing auth token, registry unreachable, version already published (re-run safe — `checkPublished` short-circuits subsequent runs).",
                    message: `publishCommand failed for ${context.pkg.name}@${context.release.newVersion}: exit ${result.exitCode}. stderr: ${result.stderr.trim().slice(0, 500)}`,
                    packageName: context.pkg.name,
                });
            }
        }

        return {
            output: `[shell] published ${context.pkg.name}@${context.release.newVersion}`,
            published: true,
        };
    }
}

// Re-export the manifest type so consumers know what fields the
// `pkg` argument carries (helpful when writing custom check commands).
