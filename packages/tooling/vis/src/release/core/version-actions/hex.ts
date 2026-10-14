/**
 * `hex` versionActions: Hex packages, published with `mix hex.publish --yes`.
 *
 * - **Version write.** Done by `planHexWorkspace`, not here. The version is the
 *   `version:` literal in `project/0`, or the `@version` attribute.
 * - **Already-published check.** `https://hex.pm/api/packages/&lt;name>` returns the
 *   package, with a `releases` array whose items have a `version` field. A version
 *   already listed is skipped. A failed lookup (a 404 for an unknown package too) does
 *   not skip: the publish then reports the real error.
 * - **Publish.** `mix hex.publish --yes` in the package directory, through the package
 *   manager's argv runner with no shell. The API key comes from `HEX_API_KEY` in the
 *   environment, never from argv. Hex builds and checks the package before it uploads.
 *
 * POSIX only for now. `mix` is not verified on Windows, so publish refuses on win32
 * with a clear error instead of a spawn failure.
 */

import { basename } from "node:path";

import { VisReleaseError } from "../../errors";
import type { PerPackageReleaseConfig, WorkspacePackage } from "../../types";
import type { PackageManagerAdapter, PublishResult } from "../package-managers/interface";
import { safeFetchVersionMetadata } from "./fetch";
import type { PublishContext } from "./interface";
import { VersionActions } from "./interface";

const REGISTRY = "https://hex.pm";

/** True when Hex already lists `version` for the package. Any failure to ask answers false, so the publish decides. */
const alreadyListed = async (name: string, version: string, context: PublishContext): Promise<boolean> => {
    const url = `${REGISTRY}/api/packages/${encodeURIComponent(name)}`;

    try {
        const response = await safeFetchVersionMetadata(url, {
            headers: { Accept: "application/json" },
            httpProxy: context.workspaceConfig?.httpProxy,
        });

        if (!response.ok) {
            return false;
        }

        const body: unknown = await response.json();
        const releases = typeof body === "object" && body !== null ? (body as { releases?: unknown }).releases : undefined;

        return (
            Array.isArray(releases) && releases.some((release) => typeof release === "object" && release !== null && (release as { version?: unknown }).version === version)
        );
    } catch {
        return false;
    }
};

/** True when `mix help` runs. A missing binary makes the runner throw, which is the same answer. */
const hasMix = async (context: PublishContext, cwd: string): Promise<boolean> => {
    try {
        const result = await context.pm.runner.run("mix", ["help"], { cwd, silent: true });

        return result.exitCode === 0;
    } catch {
        return false;
    }
};

export class HexVersionActions extends VersionActions {
    public readonly id = "hex" as const;

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
        const cwd = context.pkg.dir;

        if (context.dryRun) {
            return {
                output: `[dry-run / hex] would run mix hex.publish --yes in ${basename(cwd)} for ${name}@${version}`,
                published: true,
            };
        }

        if (process.platform === "win32") {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                message: `${name} cannot be published from Windows yet: the mix path is only verified on POSIX. Publish from a POSIX runner.`,
                packageName: name,
            });
        }

        if (!(await hasMix(context, cwd))) {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                message: `${name} needs the mix command on PATH to publish, and "mix help" failed. Install Elixir (which ships Mix) on the runner.`,
                packageName: name,
            });
        }

        if (await alreadyListed(name, version, context)) {
            return {
                alreadyPublished: true,
                output: `[hex] ${name}@${version} is already on hex.pm; skipped`,
                published: false,
            };
        }

        const result = await context.pm.runner.run("mix", ["hex.publish", "--yes"], { cwd, silent: false });

        if (result.exitCode !== 0) {
            throw new VisReleaseError({
                code: "PUBLISH_FAILED",
                hint: `Failing step: mix hex.publish --yes in ${cwd}\nCheck the output above. Credentials come from HEX_API_KEY in the environment; Hex refuses to replace an existing version.`,
                message: `mix hex.publish failed for ${name}@${version}: exit ${result.exitCode}. stderr: ${result.stderr.trim().slice(0, 500)}`,
                packageName: name,
            });
        }

        return {
            output: `[hex] published ${name}@${version}`,
            published: true,
        };
    }
}
