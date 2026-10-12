/**
 * Plan every Zig edit for a release wave, the counterpart of `gradle-plan.ts`.
 *
 * A Zig package declares its version in its own `build.zig.zon`, so there is no
 * shared declaration to keep in lockstep: each release rewrites its owner file's
 * `.version` string literal and nothing else. Path dependencies are not rewritten.
 * Zig has no lockfile that vis maintains.
 */

import { readFile } from "node:fs/promises";

import { parseZigManifest, ZigManifestError } from "../../util/zig-manifest";
import { VisReleaseError } from "../errors";
import type { ZigProject } from "./zig-projects";

export interface ZigPlanRelease {
    name: string;
    newVersion: string;
}

export interface ZigPlanOptions {
    /** Content already queued by earlier steps; updated in place. */
    pending: Map<string, string>;
    /** Every discovered Zig package, released or not. */
    projects: ReadonlyArray<ZigProject>;
    releases: ReadonlyArray<ZigPlanRelease>;
}

/**
 * Apply every Zig edit for the wave to `pending`. Returns the paths it changed.
 */
export const planZigWorkspace = async (options: ZigPlanOptions): Promise<Set<string>> => {
    const { pending, projects, releases } = options;
    const touched = new Set<string>();

    for (const release of releases) {
        const project = projects.find((candidate) => candidate.name === release.name);

        if (project === undefined) {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                message: `${release.name} is planned as a Zig release, but no Zig package with that name was discovered. Re-run the release from a fresh context.`,
                packageName: release.name,
            });
        }

        if (/["\\\n\r]/.test(release.newVersion)) {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                file: project.owner,
                message: `${release.newVersion} cannot be written as a Zig string literal for ${release.name}.`,
                packageName: release.name,
            });
        }

        const raw = pending.get(project.owner) ?? (await readFile(project.owner, "utf8"));
        // Re-parse the current text: an earlier edit in this wave is already in `pending`.
        let version: ReturnType<typeof parseZigManifest>["version"];

        try {
            version = parseZigManifest(raw, project.owner).version;
        } catch (error) {
            if (error instanceof ZigManifestError) {
                throw new VisReleaseError({ code: "CONFIG_INVALID", file: project.owner, message: error.message, packageName: release.name });
            }

            throw error;
        }

        if (version === undefined) {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                file: project.owner,
                message: `${project.owner} has no .version to bump for ${release.name}.`,
                packageName: release.name,
            });
        }

        pending.set(project.owner, `${raw.slice(0, version.start)}"${release.newVersion}"${raw.slice(version.end)}`);
        touched.add(project.owner);
    }

    return touched;
};
