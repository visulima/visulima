/**
 * Plan every gem edit for a release wave, the counterpart of `gradle-plan.ts`.
 *
 * A gem's version is written where it is declared: its gemspec, or the
 * `VERSION = "…"` line in its version file. Gems that share one version file (one
 * `VERSION` constant for several gemspecs) move together, at one version.
 *
 * Gem versions are plain `[0-9A-Za-z.]` strings. A semver prerelease such as
 * `1.0.0-beta.1` is refused rather than rewritten, because RubyGems would store it
 * under a different version.
 */

import { readFile } from "node:fs/promises";

import { replaceGemLiteral } from "../../util/gemspec";
import { VisReleaseError } from "../errors";
import type { GemProject } from "./gem-projects";

export interface GemPlanRelease {
    name: string;
    newVersion: string;
}

export interface GemPlanOptions {
    /** Content already queued by earlier steps; updated in place. */
    pending: Map<string, string>;
    /** Every discovered gem, released or not. */
    projects: ReadonlyArray<GemProject>;
    releases: ReadonlyArray<GemPlanRelease>;
}

/** Members that move together: the same version declaration (its file and line). */
const groupKey = (project: GemProject): string => `${project.owner}\u0000${project.line}`;

const GEM_VERSION = /^[0-9A-Z]+(?:\.[0-9A-Z]+)*$/i;

const readPending = async (pending: Map<string, string>, path: string): Promise<string> => pending.get(path) ?? readFile(path, "utf8");

/**
 * Apply every gem edit for the wave to `pending`. Returns the paths it changed.
 * Throws `CONFIG_INVALID` when a shared version file would move only part of its group.
 */
export const planGemWorkspace = async (options: GemPlanOptions): Promise<Set<string>> => {
    const { pending, projects, releases } = options;
    const touched = new Set<string>();
    const known = new Set(projects.map((project) => project.name));

    // A release with no discovered gem would reach the changelog and tag steps with its gemspec never bumped.
    for (const release of releases) {
        if (!known.has(release.name)) {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                message: `${release.name} is planned as a gem release, but no gem with that name was discovered. Re-run the release from a fresh context.`,
                packageName: release.name,
            });
        }

        if (!GEM_VERSION.test(release.newVersion)) {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                message: `${release.newVersion} cannot be written as a gem version for ${release.name}. Gem versions are dot-separated alphanumerics (1.2.3, 1.2.3.beta.1); a semver prerelease with "-" is not one.`,
                packageName: release.name,
            });
        }
    }

    const released = new Map(releases.map((release) => [release.name, release.newVersion]));
    const members = new Map<string, GemProject[]>();

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
                message: `Gems share the version declared at ${project.owner}:${project.line}, so they must release together at ${version}. Not released at that version: ${missing.map((member) => member.name).join(", ")}.`,
            });
        }

        const raw = await readPending(pending, project.owner);
        const current = raw.split("\n")[project.line - 1] ?? "";

        if (!/=\s*(["'])[^"'\\]*\1/.test(current)) {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                file: project.owner,
                message: `${project.owner} has no version literal on line ${project.line} to bump for ${project.name}.`,
            });
        }

        pending.set(project.owner, replaceGemLiteral(raw, project.line, version));
        touched.add(project.owner);
    }

    return touched;
};
