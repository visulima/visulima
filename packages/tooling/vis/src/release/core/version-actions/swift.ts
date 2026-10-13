/**
 * `swift` versionActions: a SwiftPM package is released by its Git tag.
 *
 * - **Version.** Read from the tags by the git-tag resolver (see `swift-projects.ts`).
 *   Nothing is written to the manifest.
 * - **Publish.** Nothing is uploaded. The release's tag step creates the tag and
 *   pushes it, and SwiftPM resolves the package from that tag.
 * - **Already-published check.** The tag already exists in the repository. The
 *   check is local: `git rev-parse` runs before the tag step, so a tag that only
 *   exists on the remote is not seen here.
 *
 * POSIX only for now. SwiftPM is not run on Windows, so publish refuses there with
 * CONFIG_INVALID, after the dry run.
 */

import { VisReleaseError } from "../../errors";
import type { PerPackageReleaseConfig, WorkspacePackage } from "../../types";
import { defaultTagFor, renderTagPattern } from "../git";
import type { PackageManagerAdapter, PublishResult } from "../package-managers/interface";
import type { PublishContext } from "./interface";
import { VersionActions } from "./interface";

/** True when the tag already exists. Any failure to ask answers false, so the release tries to create it and reports the real error. */
const tagExists = async (context: PublishContext, tag: string): Promise<boolean> => {
    try {
        const result = await context.pm.runner.run("git", ["rev-parse", "--quiet", "--verify", `refs/tags/${tag}`], {
            cwd: context.pkg.dir,
            silent: true,
        });

        return result.exitCode === 0;
    } catch {
        return false;
    }
};

export class SwiftVersionActions extends VersionActions {
    public readonly id = "swift" as const;

    /** Versions come from the tags through the git-tag resolver, so the registry is not asked. */
    public async readPublishedVersion(_context: {
        perPackageConfig?: PerPackageReleaseConfig;
        pkg: WorkspacePackage;
        pm: PackageManagerAdapter;
    }): Promise<string | undefined> {
        return undefined;
    }

    public async publish(context: PublishContext): Promise<PublishResult> {
        const version = context.release.newVersion;
        const pattern = context.perPackageConfig?.releaseTagPattern ?? context.workspaceConfig?.releaseTagPattern;
        const tag = pattern === undefined ? defaultTagFor(context.pkg.name, version) : renderTagPattern(pattern, { name: context.pkg.name, version });

        if (context.dryRun) {
            return {
                output: `[dry-run / swift] would tag ${tag} for ${context.pkg.name}@${version}`,
                published: true,
            };
        }

        if (process.platform === "win32") {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                message: `${context.pkg.name} cannot be released from Windows yet: SwiftPM is not run on Windows here. Release from a POSIX runner.`,
                packageName: context.pkg.name,
            });
        }

        if (await tagExists(context, tag)) {
            return {
                alreadyPublished: true,
                output: `[swift] tag ${tag} already exists; ${context.pkg.name}@${version} skipped`,
                published: false,
            };
        }

        return {
            output: `[swift] ${context.pkg.name}@${version} is released by tag ${tag}, created with the release`,
            published: true,
        };
    }
}
