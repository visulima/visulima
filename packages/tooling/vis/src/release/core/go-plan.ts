/**
 * The Go check that runs in the plan, before any write or tag.
 *
 * Go writes no version file, so there is nothing to rewrite. What the plan must
 * enforce is the module path rule (https://go.dev/ref/mod#major-version-suffixes):
 * a release at major 2 or higher needs a `/vN` path suffix, and a `/vN` module
 * releases only at major N. Refusing here keeps a bad tag from ever being created.
 */

import semver from "semver";

import { VisReleaseError } from "../errors";
import type { GoProject } from "./go-projects";

export interface GoPlanRelease {
    name: string;
    newVersion: string;
}

/** Throws `CONFIG_INVALID` for a release whose major does not match its module path. Writes nothing. */
export const planGoWorkspace = (options: { projects: ReadonlyArray<GoProject>; releases: ReadonlyArray<GoPlanRelease> }): void => {
    const { projects, releases } = options;
    const byName = new Map(projects.map((project) => [project.name, project]));

    for (const release of releases) {
        const project = byName.get(release.name);

        if (project === undefined) {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                message: `${release.name} is planned as a Go release, but no Go module with that name was discovered. Re-run the release from a fresh context.`,
                packageName: release.name,
            });
        }

        const major = semver.major(release.newVersion);

        if (project.suffixMajor === undefined) {
            if (major >= 2) {
                throw new VisReleaseError({
                    code: "CONFIG_INVALID",
                    message: `${release.name} would release ${release.newVersion}. A major version 2 or higher needs a /v${major} module path (for example ${release.name}/v${major}); this module path has no major suffix.`,
                    packageName: release.name,
                });
            }

            continue;
        }

        if (major !== project.suffixMajor) {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                message: `${release.name} ends in /v${project.suffixMajor}, so its releases must be ${project.suffixMajor}.x.y. ${release.newVersion} is major ${major}; a new major needs a new /vN module path.`,
                packageName: release.name,
            });
        }
    }
};
