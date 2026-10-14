/**
 * `gradle` versionActions: Gradle builds, published with the project's `publish` task.
 *
 * - **Version write.** Done by `planGradleWorkspace`, not here. The version is a
 *   string literal in the module's build script or the root script's allprojects /
 *   subprojects block.
 * - **Already-published check.** The module's `group:artifact` is looked up in
 *   Maven Central's `maven-metadata.xml` (or `mavenMetadataUrl`, the same override
 *   the maven actions take). A version already listed is skipped, so a rerun does
 *   not fail on a repository conflict. A network error does not skip: the publish
 *   step then reports the real failure.
 * - **Publish.** Runs `&lt;root>/gradlew :&lt;path>:publish` through the package
 *   manager's argv runner, with no shell. The module must apply a publishing plugin
 *   (`maven-publish`) with a repository configured; vis does not add one.
 *
 * POSIX only for now. Publish runs `./gradlew`, and on Windows the `.bat` wrapper
 * needs a shell that the argv runner does not provide, so publish refuses with a
 * clear error instead of a spawn failure.
 */

import { access } from "node:fs/promises";
import { join } from "node:path";

import { VisReleaseError } from "../../errors";
import type { PerPackageReleaseConfig, WorkspacePackage } from "../../types";
import { findGradleRoot } from "../gradle-projects";
import type { PackageManagerAdapter, PublishResult } from "../package-managers/interface";
import { safeFetchVersionMetadata } from "./fetch";
import type { PublishContext } from "./interface";
import { VersionActions } from "./interface";
import { mavenCentralMetadataUrl, parseMavenMetadataVersions } from "./maven";

/** The `group:artifact` a Gradle release is named by, split into its two Maven coordinates. */
const coordinatesOf = (name: string): { artifactId: string; groupId: string } | undefined => {
    const separator = name.indexOf(":");

    return separator === -1 ? undefined : { artifactId: name.slice(separator + 1), groupId: name.slice(0, separator) };
};

/** True when the repository already lists `version`. Any failure to ask answers false, so the publish decides. */
const alreadyListed = async (context: PublishContext): Promise<boolean> => {
    const perPkg = context.perPackageConfig ?? {};
    const coordinates = coordinatesOf(context.pkg.name);

    if (perPkg.mavenMetadataUrl === "" || coordinates === undefined) {
        return false;
    }

    const url = perPkg.mavenMetadataUrl ?? mavenCentralMetadataUrl(coordinates.groupId, coordinates.artifactId);

    try {
        const response = await safeFetchVersionMetadata(url, {
            headers: { Accept: "text/xml,application/xml;q=0.9,*/*;q=0.8" },
            httpProxy: context.workspaceConfig?.httpProxy,
        });

        return response.ok && parseMavenMetadataVersions(await response.text()).includes(context.release.newVersion);
    } catch {
        return false;
    }
};

export class GradleVersionActions extends VersionActions {
    public readonly id = "gradle" as const;

    /** Not used for the publish decision: the `alreadyPublished` check in `publish` is. Returning undefined keeps the version resolver on the manifest. */
    public async readPublishedVersion(_context: {
        perPackageConfig?: PerPackageReleaseConfig;
        pkg: WorkspacePackage;
        pm: PackageManagerAdapter;
    }): Promise<string | undefined> {
        return undefined;
    }

    public async publish(context: PublishContext): Promise<PublishResult> {
        const root = await findGradleRoot(context.pkg.dir);

        if (root === undefined) {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                file: context.pkg.manifestPath,
                message: `${context.pkg.name} has no Gradle build root (no gradlew or settings.gradle above ${context.pkg.dir}).`,
                packageName: context.pkg.name,
            });
        }

        const relative = context.pkg.dir === root ? "" : context.pkg.dir.slice(root.length + 1).split("\\").join("/");
        const taskPath = relative === "" ? ":publish" : `:${relative.replaceAll("/", ":")}:publish`;

        if (context.dryRun) {
            return {
                output: `[dry-run / gradle] would run ${join(root, "gradlew")} ${taskPath} for ${context.pkg.name}@${context.release.newVersion}`,
                published: true,
            };
        }

        if (process.platform === "win32") {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                message: `${context.pkg.name} cannot be published from Windows yet: vis runs ./gradlew without a shell, and gradlew.bat needs one. Publish from a POSIX runner.`,
                packageName: context.pkg.name,
            });
        }

        const wrapper = join(root, "gradlew");

        try {
            await access(wrapper);
        } catch {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                message: `${context.pkg.name} needs ${wrapper} to publish, and the build root has none. Add the Gradle wrapper (gradle wrapper) at the root.`,
                packageName: context.pkg.name,
            });
        }

        if (await alreadyListed(context)) {
            return {
                alreadyPublished: true,
                output: `[gradle] ${context.pkg.name}@${context.release.newVersion} is already on the repository; skipped`,
                published: false,
            };
        }

        const result = await context.pm.runner.run(wrapper, [taskPath], { cwd: root, silent: false });

        if (result.exitCode !== 0) {
            throw new VisReleaseError({
                code: "PUBLISH_FAILED",
                hint: `Failing task: ${taskPath} in ${root}\nCheck the Gradle output above. The module needs a publishing plugin and repository (for example maven-publish). Credentials come from your Gradle properties or environment.`,
                message: `gradle ${taskPath} failed for ${context.pkg.name}@${context.release.newVersion}: exit ${result.exitCode}. stderr: ${result.stderr.trim().slice(0, 500)}`,
                packageName: context.pkg.name,
            });
        }

        return {
            output: `[gradle] published ${context.pkg.name}@${context.release.newVersion} (${taskPath})`,
            published: true,
        };
    }
}
