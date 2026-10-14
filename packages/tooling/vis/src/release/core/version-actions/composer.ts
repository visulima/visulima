/**
 * `composer` versionActions: a Composer package is released by its git tag.
 *
 * - **Version write.** None. composer.json has no version field. The version is the
 *   highest `vX.Y.Z` tag, read at discovery (`composer-projects.ts`).
 * - **Publish.** There is no upload. Packagist reads the tag from the repository. This
 *   action checks that the tag is free and reports the package as published. The
 *   orchestrator then creates and pushes the tag once every publish has succeeded.
 * - **Already-published check.** The tag already exists locally: the release is skipped
 *   (`alreadyPublished`), and no second tag is created. The check is local only; the
 *   Packagist API is not queried, because Packagist reads the same tag and lags behind it.
 *
 * POSIX only for now. Git tagging itself is portable, but this path is not tested on
 * Windows, so publish refuses there with `CONFIG_INVALID` after the dry run.
 */

import { VisReleaseError } from "../../errors";
import type { PerPackageReleaseConfig, WorkspacePackage } from "../../types";
import { renderTagPattern, tagExists } from "../git";
import type { PackageManagerAdapter, PublishResult } from "../package-managers/interface";
import type { PublishContext } from "./interface";
import { VersionActions } from "./interface";

/** The tag a Composer release is published as: the package's `releaseTagPattern`, or `v{version}`. */
export const composerTagFor = (perPackageConfig: PerPackageReleaseConfig | undefined, name: string, version: string): string =>
    renderTagPattern(perPackageConfig?.releaseTagPattern ?? "v{version}", { name, version });

export class ComposerVersionActions extends VersionActions {
    public readonly id = "composer" as const;

    /** Not used: the local tag check in `publish` decides. Undefined keeps the version on the manifest. */
    public async readPublishedVersion(_context: {
        perPackageConfig?: PerPackageReleaseConfig;
        pkg: WorkspacePackage;
        pm: PackageManagerAdapter;
    }): Promise<string | undefined> {
        return undefined;
    }

    public async publish(context: PublishContext): Promise<PublishResult> {
        const { name } = context.pkg;
        const version = context.release.newVersion;
        const tag = composerTagFor(context.perPackageConfig, name, version);

        if (context.dryRun) {
            return { output: `[dry-run / composer] would tag ${tag} for ${name}@${version}`, published: true };
        }

        if (process.platform === "win32") {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                message: `${name} cannot be released from Windows yet: the Composer tag path is not tested there. Release from a POSIX runner.`,
                packageName: name,
            });
        }

        const git = await context.pm.runner.run("git", ["--version"], { cwd: context.pkg.dir, silent: true });

        if (git.exitCode !== 0) {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                message: `${name} needs git on PATH to release its tag, and git --version failed.`,
                packageName: name,
            });
        }

        // The same probe `createTag` uses for its TAG_COLLISION check, so the two cannot disagree.
        if (await tagExists({ cwd: context.pkg.dir, runner: context.pm.runner }, tag)) {
            return { alreadyPublished: true, output: `[composer] ${name}@${version} is already tagged ${tag}; skipped`, published: false };
        }

        return { output: `[composer] ${name}@${version} released by tag ${tag}`, published: true };
    }
}
