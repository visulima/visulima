/**
 * `dart` versionActions: Dart packages published to pub.dev with `dart pub publish`.
 *
 * - **Version write.** Done by `planDartWorkspace`, not here. The version is the
 *   `version:` literal in the package's own `pubspec.yaml`.
 * - **Already-published check.** `https://pub.dev/api/packages/&lt;name>` is read with
 *   the repository spec v2 Accept header. A version already in its `versions` list
 *   is skipped. A failed lookup means not published, and the publish reports the
 *   real error.
 * - **Publish.** Runs `dart pub publish --force` through the package manager's argv
 *   runner, with no shell, in the package directory. `--force` skips the interactive
 *   confirmation. Credentials are the ones the Dart SDK already holds (`dart pub
 *   token add https://pub.dev`, or OIDC in automated publishing). vis never passes a
 *   token in argv.
 *
 * POSIX only: the Windows path is not verified, so publish refuses on win32.
 */

import { VisReleaseError } from "../../errors";
import type { PerPackageReleaseConfig, WorkspacePackage } from "../../types";
import type { PackageManagerAdapter, PublishResult } from "../package-managers/interface";
import { safeFetchVersionMetadata } from "./fetch";
import type { PublishContext } from "./interface";
import { VersionActions } from "./interface";

/** The pub.dev package API, the one place vis reads a Dart package's published versions. */
export const pubDevMetadataUrl = (name: string): string => `https://pub.dev/api/packages/${encodeURIComponent(name)}`;

/** True when pub.dev already lists `version`. Any failure to ask answers false, so the publish decides. */
const alreadyListed = async (context: PublishContext): Promise<boolean> => {
    try {
        const response = await safeFetchVersionMetadata(pubDevMetadataUrl(context.pkg.name), {
            headers: { Accept: "application/vnd.pub.v2+json" },
            httpProxy: context.workspaceConfig?.httpProxy,
        });

        if (!response.ok) {
            return false;
        }

        const body = JSON.parse(await response.text()) as { versions?: { version?: unknown }[] };

        return Array.isArray(body.versions) && body.versions.some((entry) => entry.version === context.release.newVersion);
    } catch {
        return false;
    }
};

export class DartVersionActions extends VersionActions {
    public readonly id = "dart" as const;

    /** Not used for the publish decision: the `alreadyListed` check in `publish` is. Returning undefined keeps the version resolver on the manifest. */
    public async readPublishedVersion(_context: {
        perPackageConfig?: PerPackageReleaseConfig;
        pkg: WorkspacePackage;
        pm: PackageManagerAdapter;
    }): Promise<string | undefined> {
        return undefined;
    }

    public async publish(context: PublishContext): Promise<PublishResult> {
        const { dir, name } = context.pkg;
        const version = context.release.newVersion;

        if (context.dryRun) {
            return {
                output: `[dry-run / dart] would run dart pub publish --force in ${dir} for ${name}@${version}`,
                published: true,
            };
        }

        if (process.platform === "win32") {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                message: `${name} cannot be published from Windows yet: the Dart path is only verified on POSIX. Publish from a POSIX runner.`,
                packageName: name,
            });
        }

        try {
            const probe = await context.pm.runner.run("dart", ["--version"], { cwd: dir, silent: true });

            if (probe.exitCode !== 0) {
                throw new Error(`exit ${probe.exitCode}`);
            }
        } catch {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                message: `${name} needs the Dart SDK to publish, and "dart" is not on PATH. Install the Dart SDK on the runner.`,
                packageName: name,
            });
        }

        if (await alreadyListed(context)) {
            return {
                alreadyPublished: true,
                output: `[dart] ${name}@${version} is already on pub.dev; skipped`,
                published: false,
            };
        }

        const result = await context.pm.runner.run("dart", ["pub", "publish", "--force"], { cwd: dir, silent: false });

        if (result.exitCode !== 0) {
            throw new VisReleaseError({
                code: "PUBLISH_FAILED",
                hint: `Failing command: dart pub publish --force in ${dir}\nCheck the output above. Authenticate with "dart pub token add https://pub.dev" on this runner, or configure automated publishing (OIDC) for the pub.dev package. Errors stop the upload; warnings do not.`,
                message: `dart pub publish failed for ${name}@${version}: exit ${result.exitCode}. stderr: ${result.stderr.trim().slice(0, 500)}`,
                packageName: name,
            });
        }

        return {
            output: `[dart] published ${name}@${version} to pub.dev`,
            published: true,
        };
    }
}
