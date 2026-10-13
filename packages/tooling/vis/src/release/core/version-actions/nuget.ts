/**
 * `nuget` versionActions: NuGet packages, built with `dotnet pack` and pushed with
 * `dotnet nuget push`.
 *
 * - **Version write.** Done by `planNuGetWorkspace`, not here.
 * - **Already-published check.** `https://api.nuget.org/v3-flatcontainer/&lt;id>/index.json`
 *   lists every version as `{ "versions": [...] }`. A version already listed (compared
 *   lowercased, without `+metadata`) is skipped. A failed lookup does not skip: the push
 *   then reports the real error.
 * - **Publish.** `dotnet pack &lt;project> -c Release -o &lt;temp dir>`, then
 *   `dotnet nuget push &lt;that one .nupkg> --source &lt;nuget.org> --api-key &lt;key>`, each
 *   through the package manager's argv runner with no shell. `dotnet nuget push` has no
 *   environment input for the key, so the key is on its argv. vis never prints argv, and
 *   it redacts the key from every error it builds. The temp directory is removed after.
 *
 * POSIX only for now: publish refuses on win32 with `CONFIG_INVALID`, after the dry run.
 */

import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { VisReleaseError } from "../../errors";
import type { PerPackageReleaseConfig, WorkspacePackage } from "../../types";
import type { PackageManagerAdapter, PublishResult } from "../package-managers/interface";
import { safeFetchVersionMetadata } from "./fetch";
import type { PublishContext } from "./interface";
import { VersionActions } from "./interface";

/** The NuGet source packages are pushed to. Stated in the docs examples for `dotnet nuget push`. */
const PUSH_SOURCE = "https://api.nuget.org/v3/index.json";
const FLAT_CONTAINER = "https://api.nuget.org/v3-flatcontainer";
/** The environment variable that holds the API key. The key itself is never named in a message. */
const KEY_VARIABLE = "NUGET_API_KEY";

/** The version as NuGet lists it: lowercased, without build metadata. */
const normalize = (version: string): string => version.split("+")[0]!.toLowerCase();

/** True when the flat container already lists `version` for `id`. Any failure to ask answers false, so the push decides. */
const alreadyListed = async (id: string, version: string, context: PublishContext): Promise<boolean> => {
    try {
        const response = await safeFetchVersionMetadata(`${FLAT_CONTAINER}/${encodeURIComponent(id)}/index.json`, {
            headers: { Accept: "application/json" },
            httpProxy: context.workspaceConfig?.httpProxy,
        });

        if (!response.ok) {
            return false;
        }

        const body = (await response.json());
        const versions = typeof body === "object" && body !== null && Array.isArray((body as { versions?: unknown }).versions) ? (body as { versions: unknown[] }).versions : [];

        return versions.some((entry) => typeof entry === "string" && normalize(entry) === normalize(version));
    } catch {
        return false;
    }
};

const redact = (text: string, secret: string): string => text.split(secret).join("***").trim().slice(0, 500);

export class NuGetVersionActions extends VersionActions {
    public readonly id = "nuget" as const;

    /** Not used for the publish decision: the `alreadyListed` check in `publish` is. Returning undefined keeps the version resolver on the manifest. */
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
        const project = context.pkg.manifestPath;
        const cwd = context.pkg.dir;

        if (context.dryRun) {
            return {
                output: `[dry-run / nuget] would run dotnet pack ${basename(project)} -c Release, then dotnet nuget push the package to ${PUSH_SOURCE} for ${name}@${version}`,
                published: true,
            };
        }

        if (process.platform === "win32") {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                message: `${name} cannot be published from Windows yet: the NuGet path is only verified on POSIX. Publish from a POSIX runner.`,
                packageName: name,
            });
        }

        const hasDotnet = await context.pm.runner
            .run("dotnet", ["--version"], { cwd, silent: true })
            .then((result) => result.exitCode === 0)
            .catch(() => false);

        if (!hasDotnet) {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                message: `${name} needs the dotnet CLI on PATH to publish, and "dotnet --version" failed. Install the .NET SDK on the runner.`,
                packageName: name,
            });
        }

        if (await alreadyListed(name, version, context)) {
            return {
                alreadyPublished: true,
                output: `[nuget] ${name}@${version} is already on nuget.org; skipped`,
                published: false,
            };
        }

        const key = process.env[KEY_VARIABLE];

        if (key === undefined || key === "") {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                message: `${name} needs the API key in the ${KEY_VARIABLE} environment variable to push to nuget.org. Set it on the runner; vis never logs it.`,
                packageName: name,
            });
        }

        const outputDir = await mkdtemp(join(tmpdir(), "vis-nuget-"));

        try {
            const packed = await context.pm.runner.run("dotnet", ["pack", project, "-c", "Release", "-o", outputDir], { cwd, silent: false });

            if (packed.exitCode !== 0) {
                throw new VisReleaseError({
                    code: "PUBLISH_FAILED",
                    hint: `Failing step: dotnet pack ${basename(project)}\nFix the build or packaging error above.`,
                    message: `dotnet pack failed for ${name}@${version}: exit ${packed.exitCode}. stderr: ${redact(packed.stderr, key)}`,
                    packageName: name,
                });
            }

            const entries = await readdir(outputDir);
            const packages = entries.filter((file) => file.endsWith(".nupkg") && !file.endsWith(".symbols.nupkg"));

            if (packages.length !== 1) {
                throw new VisReleaseError({
                    code: "PUBLISH_FAILED",
                    hint: `dotnet pack wrote ${packages.length} packages to a temporary directory. vis pushes exactly one per project.`,
                    message: `expected one .nupkg for ${name}@${version}, found ${packages.length}`,
                    packageName: name,
                });
            }

            const pushed = await context.pm.runner.run("dotnet", ["nuget", "push", join(outputDir, packages[0] as string), "--source", PUSH_SOURCE, "--api-key", key], { cwd, silent: false });

            if (pushed.exitCode !== 0) {
                throw new VisReleaseError({
                    code: "PUBLISH_FAILED",
                    hint: `Failing step: dotnet nuget push\nCheck the output above. A version nuget.org already has is refused; the key comes from ${KEY_VARIABLE}.`,
                    message: `dotnet nuget push failed for ${name}@${version}: exit ${pushed.exitCode}. stderr: ${redact(pushed.stderr, key)}`,
                    packageName: name,
                });
            }
        } finally {
            await rm(outputDir, { force: true, recursive: true });
        }

        return {
            output: `[nuget] published ${name}@${version} to nuget.org`,
            published: true,
        };
    }
}
