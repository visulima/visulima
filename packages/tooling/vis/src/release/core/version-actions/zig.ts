/**
 * `zig` versionActions: Zig packages have no registry, so publishing is the git tag.
 *
 * - **Version write.** Done by `planZigWorkspace`, not here. The version is the
 *   `.version` string literal in the package's `build.zig.zon`.
 * - **Published check.** "The tag already exists." The tag is computed the way the
 *   release's tag step computes it (`releaseTagPattern`, else `&lt;name>@&lt;version>`).
 *   A local tag is an existing release, so the publish is skipped. Nothing is
 *   uploaded, so the check is not a registry lookup and no network call is made.
 * - **Publish.** Returns `published: true`. The release's tag step then creates the
 *   tag after this returns. No command runs here: there is no upload to run.
 *
 * POSIX only for now. The tag step runs under git on whatever runner the release
 * uses, and that path is untested on Windows, so publish refuses there with a clear
 * error, after the dry run, the same as the Gradle action.
 */

import { VisReleaseError } from "../../errors";
import type { PerPackageReleaseConfig, VisReleaseConfig, WorkspacePackage } from "../../types";
import { defaultTagFor, renderTagPattern, tagExists } from "../git";
import type { PackageManagerAdapter, PublishResult } from "../package-managers/interface";
import type { PublishContext } from "./interface";
import { VersionActions } from "./interface";

/** The git tag the release tag step creates for this package, rendered with the same inputs. */
export const zigReleaseTag = (
    name: string,
    version: string,
    options: { channel?: string; perPackageConfig?: PerPackageReleaseConfig; workspaceConfig?: VisReleaseConfig },
): string => {
    const pattern = options.perPackageConfig?.releaseTagPattern ?? options.workspaceConfig?.releaseTagPattern;

    return pattern ? renderTagPattern(pattern, { channel: options.channel, name, version }) : defaultTagFor(name, version);
};

export class ZigVersionActions extends VersionActions {
    public readonly id = "zig" as const;

    /** Not used for the publish decision: the tag check in `publish` is. Returning undefined keeps the version resolver on the manifest. */
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
        const tag = zigReleaseTag(name, version, {
            channel: context.tag,
            perPackageConfig: context.perPackageConfig,
            workspaceConfig: context.workspaceConfig,
        });

        if (context.dryRun) {
            return {
                output: `[dry-run / zig] would tag ${tag} for ${name}@${version}; nothing is uploaded`,
                published: true,
            };
        }

        if (process.platform === "win32") {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                message: `${name} cannot be released from Windows yet: the Zig path is only verified on POSIX. Release from a POSIX runner.`,
                packageName: name,
            });
        }

        if (await tagExists({ cwd: context.pkg.dir, runner: context.pm.runner }, tag)) {
            return {
                alreadyPublished: true,
                output: `[zig] tag ${tag} already exists for ${name}@${version}; skipped`,
                published: false,
            };
        }

        return {
            output: `[zig] ${name}@${version} has no registry; tag ${tag} is created by the release`,
            published: true,
        };
    }
}
