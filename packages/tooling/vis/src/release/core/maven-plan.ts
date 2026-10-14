/**
 * Plan every Maven edit for a release wave, the counterpart of `cargo-plan.ts`
 * and `python-plan.ts`.
 *
 * Per version owner (see `MavenProject.owner`), the members that share it are
 * released together at one version, then the owner is edited once:
 *   - a literal `&lt;version>` in the owner's pom (the module's own, or the parent's
 *     for an inheriting module);
 *   - a `&lt;properties>` entry (for a `${property}` version).
 *
 * Dependents: a `&lt;dependency>` on a released module whose `&lt;version>` is a
 * literal is rewritten to the new version. Maven literals are exact pins, so
 * this differs from Cargo, which only moves a requirement that stops matching.
 * `${property}` versions are left alone; the property moves with its owner.
 *
 * Maven has no lockfile, so nothing else is written.
 */

import { readFile } from "node:fs/promises";

import type { PomSlot } from "../../util/maven-pom";
import { applySlotEdits, dependencyName, isPinned, scanPom } from "../../util/maven-pom";
import { VisReleaseError } from "../errors";
import type { MavenProject } from "./maven-projects";

export interface MavenPlanRelease {
    name: string;
    newVersion: string;
}

export interface MavenPlanOptions {
    /** Content already queued by earlier steps; updated in place. */
    pending: Map<string, string>;
    /** Every discovered Maven module, released or not. */
    projects: ReadonlyArray<MavenProject>;
    releases: ReadonlyArray<MavenPlanRelease>;
}

/** Members that move together: one owner, and one slot in it (its `&lt;version>` or one `&lt;properties>` entry). */
const groupKey = (project: MavenProject): string => `${project.owner}\u0000${project.property === undefined ? "version" : `property:${project.property}`}`;

const readPending = async (pending: Map<string, string>, path: string): Promise<string> => pending.get(path) ?? readFile(path, "utf8");

/** Write `version` into the owner slot the group shares. */
const writeOwnerVersion = (raw: string, project: MavenProject, version: string): string => {
    const scan = scanPom(raw);
    const slot = project.property === undefined ? scan.version : scan.properties.get(project.property);

    if (slot === undefined) {
        const where = project.property === undefined ? "a literal <version>" : `a <properties> entry ${project.property}`;

        throw new VisReleaseError({
            code: "CONFIG_INVALID",
            file: project.owner,
            message: `${project.owner} has no ${where} to bump for ${project.name}.`,
        });
    }

    return applySlotEdits(raw, [{ slot, value: version }]);
};

/**
 * Apply every Maven edit for the wave to `pending`: owner versions (with their
 * groups checked) and dependents' literal dependency versions. Returns the
 * paths it changed.
 * Throws `CONFIG_INVALID` when a group would move only part of itself.
 */
export const planMavenWorkspace = async (options: MavenPlanOptions): Promise<Set<string>> => {
    const { pending, projects, releases } = options;
    const touched = new Set<string>();
    const known = new Set(projects.map((project) => project.name));

    // A release with no discovered module would reach the changelog and tag steps with its pom never bumped.
    for (const release of releases) {
        if (!known.has(release.name)) {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                message: `${release.name} is planned as a Maven release, but no Maven module with that name was discovered. Re-run the release from a fresh context.`,
                packageName: release.name,
            });
        }
    }

    const released = new Map(releases.map((release) => [release.name, release.newVersion]));
    const members = new Map<string, MavenProject[]>();

    for (const project of projects) {
        const key = groupKey(project);

        members.set(key, [...(members.get(key) ?? []), project]);
    }

    // 1. Owner versions. A group is written once, and only when all its members release at one version.
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
                message: `Maven modules share the version at ${project.owner}, so they must release together at ${version}. Not released at that version: ${missing.map((member) => member.name).join(", ")}.`,
            });
        }

        const raw = await readPending(pending, project.owner);

        pending.set(project.owner, writeOwnerVersion(raw, project, version));
        touched.add(project.owner);
    }

    // 2. Dependents: literal dependency versions on a released module follow it.
    for (const project of projects) {
        const raw = await readPending(pending, project.manifestPath);
        const scan = scanPom(raw);
        const edits: { slot: PomSlot; value: string }[] = [];

        for (const dependency of scan.dependencies) {
            const target = dependencyName(scan, dependency);
            const declared = dependency.version;
            const version = target === undefined ? undefined : released.get(target);

            if (version !== undefined && declared !== undefined && isPinned(declared.value) && declared.value !== version) {
                edits.push({ slot: declared, value: version });
            }
        }

        if (edits.length > 0) {
            pending.set(project.manifestPath, applySlotEdits(raw, edits));
            touched.add(project.manifestPath);
        }
    }

    return touched;
};
