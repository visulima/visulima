/**
 * Plan every Gradle edit for a release wave, the counterpart of `maven-plan.ts`.
 *
 * Modules that share one version declaration (the same `allprojects` or
 * `subprojects` line in the root script) must release together, at one version.
 * That declaration is then written once. A module's own literal is written in
 * its own script.
 *
 * Dependencies are `project(":x")` references, which carry no version, so
 * nothing else is rewritten. Gradle writes no lockfile that vis maintains.
 */

import { readFile } from "node:fs/promises";

import { replaceGradleLiteral, scanGradleBuild } from "../../util/gradle-build";
import { VisReleaseError } from "../errors";
import type { GradleProject } from "./gradle-projects";

export interface GradlePlanRelease {
    name: string;
    newVersion: string;
}

export interface GradlePlanOptions {
    /** Content already queued by earlier steps; updated in place. */
    pending: Map<string, string>;
    /** Every discovered Gradle module, released or not. */
    projects: ReadonlyArray<GradleProject>;
    releases: ReadonlyArray<GradlePlanRelease>;
}

/** Members that move together: the same version declaration (its script and line). */
const groupKey = (project: GradleProject): string => `${project.owner}\u0000${project.line}`;

const readPending = async (pending: Map<string, string>, path: string): Promise<string> => pending.get(path) ?? readFile(path, "utf8");

/**
 * Apply every Gradle edit for the wave to `pending`. Returns the paths it changed.
 * Throws `CONFIG_INVALID` when a shared declaration would move only part of its group.
 */
export const planGradleWorkspace = async (options: GradlePlanOptions): Promise<Set<string>> => {
    const { pending, projects, releases } = options;
    const touched = new Set<string>();
    const known = new Set(projects.map((project) => project.name));

    // A release with no discovered module would reach the changelog and tag steps with its script never bumped.
    for (const release of releases) {
        if (!known.has(release.name)) {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                message: `${release.name} is planned as a Gradle release, but no Gradle module with that name was discovered. Re-run the release from a fresh context.`,
                packageName: release.name,
            });
        }
    }

    const released = new Map(releases.map((release) => [release.name, release.newVersion]));
    const members = new Map<string, GradleProject[]>();

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
                message: `Gradle modules share the version declared at ${project.owner}:${project.line}, so they must release together at ${version}. Not released at that version: ${missing.map((member) => member.name).join(", ")}.`,
            });
        }

        const raw = await readPending(pending, project.owner);
        // Re-scan the current text: an earlier write in this wave may have moved offsets in the same script.
        const declaration = scanGradleBuild(raw).assignments.find((assignment) => assignment.name === "version" && assignment.line === project.line);

        if (declaration?.literal === undefined) {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                file: project.owner,
                message: `${project.owner} has no version literal on line ${project.line} to bump for ${project.name}.`,
            });
        }

        pending.set(project.owner, replaceGradleLiteral(raw, declaration.literal, version));
        touched.add(project.owner);
    }

    return touched;
};
