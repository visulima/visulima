/**
 * Plan every NuGet edit for a release wave, the counterpart of `gradle-plan.ts`.
 *
 * A project's version is written where it is declared: its own `&lt;Version>` in the
 * project file, or the shared `Directory.Build.props`. Projects that inherit one props
 * declaration move together, at one version, and the props file is written once.
 * `ProjectReference` edges carry no version, so nothing else is rewritten. NuGet's
 * lock file is not edited (see the docs: it is opt-in and vis does not maintain it).
 */

import { readFile } from "node:fs/promises";

import { NuGetReadError, replaceNuGetPropertyOnLine } from "../../util/nuget-project";
import { VisReleaseError } from "../errors";
import type { NuGetProject } from "./nuget-projects";

export interface NuGetPlanRelease {
    name: string;
    newVersion: string;
}

export interface NuGetPlanOptions {
    /** Content already queued by earlier steps; updated in place. */
    pending: Map<string, string>;
    /** Every discovered NuGet project, released or not. */
    projects: ReadonlyArray<NuGetProject>;
    releases: ReadonlyArray<NuGetPlanRelease>;
}

/** Members that move together: the same version declaration (its file and line). */
const groupKey = (project: NuGetProject): string => `${project.owner}\u0000${project.line}`;

/**
 * Apply every NuGet edit for the wave to `pending`. Returns the paths it changed.
 * Throws `CONFIG_INVALID` when a shared props declaration would move only part of its group.
 */
export const planNuGetWorkspace = async (options: NuGetPlanOptions): Promise<Set<string>> => {
    const { pending, projects, releases } = options;
    const touched = new Set<string>();
    const known = new Set(projects.map((project) => project.name));

    for (const release of releases) {
        if (!known.has(release.name)) {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                message: `${release.name} is planned as a NuGet release, but no NuGet project with that name was discovered. Re-run the release from a fresh context.`,
                packageName: release.name,
            });
        }
    }

    const released = new Map(releases.map((release) => [release.name, release.newVersion]));
    const members = new Map<string, NuGetProject[]>();

    for (const project of projects) {
        const key = groupKey(project);

        members.set(key, [...(members.get(key) ?? []), project]);
    }

    const done = new Set<string>();

    for (const project of projects) {
        const version = released.get(project.name);
        const key = groupKey(project);

        if (version === undefined || done.has(key)) {
            continue;
        }

        done.add(key);

        const group = members.get(key) ?? [];
        const missing = group.filter((member) => released.get(member.name) !== version);

        if (missing.length > 0) {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                file: project.owner,
                message: `NuGet projects share the version declared at ${project.owner}:${project.line}, so they must release together at ${version}. Not released at that version: ${missing.map((member) => member.name).join(", ")}.`,
            });
        }

        const raw = pending.get(project.owner) ?? (await readFile(project.owner, "utf8"));

        try {
            pending.set(project.owner, replaceNuGetPropertyOnLine(raw, project.owner, "Version", project.line, version));
        } catch (error) {
            if (error instanceof NuGetReadError) {
                throw new VisReleaseError({ code: "CONFIG_INVALID", file: error.file, message: error.message });
            }

            throw error;
        }

        touched.add(project.owner);
    }

    return touched;
};
