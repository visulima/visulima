/**
 * `gem` versionActions: RubyGems gems, published with `gem build` and `gem push`.
 *
 * - **Version write.** Done by `planGemWorkspace`, not here. The version is the
 *   `spec.version` literal in the gemspec, or the `VERSION` literal in the version file.
 * - **Already-published check.** `https://rubygems.org/api/v1/versions/&lt;name>.json`
 *   lists every version as an array of objects with a `number` field. A version already
 *   listed is skipped. A failed lookup does not skip: the push then reports the error.
 * - **Publish.** `gem build &lt;gemspec>` (it writes `&lt;name>-&lt;version>.gem`), then
 *   `gem push &lt;file>`, each through the package manager's argv runner with no shell.
 *   The API key comes from `GEM_HOST_API_KEY` in the environment, never from argv.
 *   The built file is removed afterwards so the working tree stays clean.
 *
 * POSIX only for now. The `gem` command is a Ruby launcher, and its Windows
 * `gem.bat` is not verified, so publish refuses on win32 with a clear error.
 */

import { rm } from "node:fs/promises";
import { basename, join } from "node:path";

import { VisReleaseError } from "../../errors";
import type { PerPackageReleaseConfig, WorkspacePackage } from "../../types";
import type { PackageManagerAdapter, PublishResult } from "../package-managers/interface";
import { safeFetchVersionMetadata } from "./fetch";
import type { PublishContext } from "./interface";
import { VersionActions } from "./interface";

const REGISTRY = "https://rubygems.org";

/** True when RubyGems already lists `version`. Any failure to ask answers false, so the push decides. */
const alreadyListed = async (name: string, version: string, context: PublishContext): Promise<boolean> => {
    const url = `${REGISTRY}/api/v1/versions/${encodeURIComponent(name)}.json`;

    try {
        const response = await safeFetchVersionMetadata(url, {
            headers: { Accept: "application/json" },
            httpProxy: context.workspaceConfig?.httpProxy,
        });

        if (!response.ok) {
            return false;
        }

        const body: unknown = await response.json();

        return Array.isArray(body) && body.some((entry) => typeof entry === "object" && entry !== null && (entry as { number?: unknown }).number === version);
    } catch {
        return false;
    }
};

/** True when the `gem` launcher runs. A missing binary makes the runner throw, which is the same answer. */
const hasGem = async (context: PublishContext, cwd: string): Promise<boolean> => {
    try {
        const result = await context.pm.runner.run("gem", ["--version"], { cwd, silent: true });

        return result.exitCode === 0;
    } catch {
        return false;
    }
};

export class GemVersionActions extends VersionActions {
    public readonly id = "gem" as const;

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
        const gemspec = basename(context.pkg.manifestPath);
        const artifact = `${name}-${version}.gem`;
        const cwd = context.pkg.dir;

        if (context.dryRun) {
            return {
                output: `[dry-run / gem] would run gem build ${gemspec} and gem push ${artifact} for ${name}@${version}`,
                published: true,
            };
        }

        if (process.platform === "win32") {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                message: `${name} cannot be published from Windows yet: the gem path is only verified on POSIX. Publish from a POSIX runner.`,
                packageName: name,
            });
        }

        if (!(await hasGem(context, cwd))) {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                message: `${name} needs the gem command on PATH to publish, and "gem --version" failed. Install Ruby (which ships RubyGems) on the runner.`,
                packageName: name,
            });
        }

        if (await alreadyListed(name, version, context)) {
            return {
                alreadyPublished: true,
                output: `[gem] ${name}@${version} is already on RubyGems; skipped`,
                published: false,
            };
        }

        // No --output: gem build names the file from the gemspec itself, so a gemspec whose version differs from vis's view fails at push instead of publishing the wrong one.
        const built = await context.pm.runner.run("gem", ["build", gemspec], { cwd, silent: false });

        if (built.exitCode !== 0) {
            throw new VisReleaseError({
                code: "PUBLISH_FAILED",
                hint: `Failing step: gem build ${gemspec} in ${cwd}\nFix the gemspec validation error above.`,
                message: `gem build failed for ${name}@${version}: exit ${built.exitCode}. stderr: ${built.stderr.trim().slice(0, 500)}`,
                packageName: name,
            });
        }

        try {
            const pushed = await context.pm.runner.run("gem", ["push", artifact], { cwd, silent: false });

            if (pushed.exitCode !== 0) {
                throw new VisReleaseError({
                    code: "PUBLISH_FAILED",
                    hint: `Failing step: gem push ${artifact}\nCheck the output above. Credentials come from GEM_HOST_API_KEY in the environment; a gem push to an existing version is refused by RubyGems.`,
                    message: `gem push failed for ${name}@${version}: exit ${pushed.exitCode}. stderr: ${pushed.stderr.trim().slice(0, 500)}`,
                    packageName: name,
                });
            }
        } finally {
            await rm(join(cwd, artifact), { force: true });
        }

        return {
            output: `[gem] published ${name}@${version} (${artifact})`,
            published: true,
        };
    }
}
