/**
 * Plan every Hex edit for a release wave, the counterpart of `gem-plan.ts`.
 *
 * A package's version is written where it is declared: the `version: "…"` literal in
 * its `project/0`, or the `\@version "…"` attribute its `version: \@version` reads. The
 * edit replaces only the literal after the key, so the rest of the line is kept.
 * Each umbrella app has its own `mix.exs`, so no two packages share a declaration.
 *
 * Hex versions are semver. A version that is not one is refused rather than written.
 */

import { readFile } from "node:fs/promises";

import { VisReleaseError } from "../errors";
import type { HexProject } from "./hex-projects";

export interface HexPlanRelease {
    name: string;
    newVersion: string;
}

export interface HexPlanOptions {
    /** Content already queued by earlier steps; updated in place. */
    pending: Map<string, string>;
    /** Every discovered Hex package, released or not. */
    projects: ReadonlyArray<HexProject>;
    releases: ReadonlyArray<HexPlanRelease>;
}

const HEX_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Z.-]+)?(?:\+[0-9A-Z.-]+)?$/i;

const readPending = async (pending: Map<string, string>, path: string): Promise<string> => pending.get(path) ?? readFile(path, "utf8");

/**
 * Apply every Hex edit for the wave to `pending`. Returns the paths it changed.
 * Throws `CONFIG_INVALID` when a release has no discovered package or no literal to bump.
 */
export const planHexWorkspace = async (options: HexPlanOptions): Promise<Set<string>> => {
    const { pending, projects, releases } = options;
    const touched = new Set<string>();
    const known = new Map(projects.map((project) => [project.name, project]));

    // A release with no discovered package would reach the changelog and tag steps with its mix.exs never bumped.
    for (const release of releases) {
        if (!known.has(release.name)) {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                message: `${release.name} is planned as a Hex release, but no Hex package with that name was discovered. Re-run the release from a fresh context.`,
                packageName: release.name,
            });
        }

        if (!HEX_VERSION.test(release.newVersion)) {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                message: `${release.newVersion} cannot be written as a Hex version for ${release.name}. Hex versions are semver (1.2.3, 1.2.3-rc.1).`,
                packageName: release.name,
            });
        }
    }

    for (const release of releases) {
        const project = known.get(release.name)!;
        const raw = await readPending(pending, project.owner);
        const lines = raw.split("\n");
        const index = project.line - 1;
        const current = lines[index] ?? "";
        const pattern = project.kind === "attribute" ? /^(\s*@version[ \t]+)"[^"]*"/ : /(\bversion:[ \t]*)"[^"]*"/;

        if (!pattern.test(current)) {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                file: project.owner,
                message: `${project.owner} has no version literal on line ${project.line} to bump for ${project.name}.`,
            });
        }

        lines[index] = current.replace(pattern, `$1"${release.newVersion}"`);
        pending.set(project.owner, lines.join("\n"));
        touched.add(project.owner);
    }

    return touched;
};
