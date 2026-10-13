/**
 * `go` versionActions: a Go module is released by its git tag.
 *
 * - **Version write.** None. Go has no version field. The version is the highest tag
 *   for the module, read at discovery (`go-projects.ts`).
 * - **Publish.** There is no upload. Go module proxies fetch from the tag. This action
 *   checks that the tag is free and reports the module as published. The orchestrator
 *   then creates and pushes the tag once every publish has succeeded, so the tag is
 *   created exactly once.
 * - **Already-published check.** The tag already exists locally: the release is skipped
 *   (`alreadyPublished`), and no second tag is created. The check is local only; the
 *   proxy (proxy.golang.org) is not queried.
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

/** The tag a Go release is published as: the package's `releaseTagPattern`, or `v{version}`. */
export const goTagFor = (perPackageConfig: PerPackageReleaseConfig | undefined, name: string, version: string): string =>
    renderTagPattern(perPackageConfig?.releaseTagPattern ?? "v{version}", { name, version });

export class GoVersionActions extends VersionActions {
    public readonly id = "go" as const;

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
        const tag = goTagFor(context.perPackageConfig, name, version);

        if (context.dryRun) {
            return { output: `[dry-run / go] would tag ${tag} for ${name}@${version}`, published: true };
        }

        if (process.platform === "win32") {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                message: `${name} cannot be released from Windows yet: the Go tag path is not tested there. Release from a POSIX runner.`,
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
            return { alreadyPublished: true, output: `[go] ${name}@${version} is already tagged ${tag}; skipped`, published: false };
        }

        return { output: `[go] ${name}@${version} released by tag ${tag}`, published: true };
    }
}
