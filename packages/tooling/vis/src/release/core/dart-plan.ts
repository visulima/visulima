/**
 * Plan every Dart edit for a release wave, the counterpart of `zig-plan.ts`.
 *
 * Each Dart package declares its own version in its own `pubspec.yaml`, so there is
 * no shared declaration to keep in step. Each release rewrites its owner's version
 * literal, after checking that the literal is still the one discovery read.
 * Dependencies are name keys, which carry no version, so nothing else is rewritten.
 */

import { readFile } from "node:fs/promises";

import { DartPubspecError, replaceDartVersion } from "../../util/dart-pubspec";
import { VisReleaseError } from "../errors";
import type { DartProject } from "./dart-projects";

export interface DartPlanRelease {
    name: string;
    newVersion: string;
}

export interface DartPlanOptions {
    /** Content already queued by earlier steps; updated in place. */
    pending: Map<string, string>;
    /** Every discovered Dart package, released or not. */
    projects: ReadonlyArray<DartProject>;
    releases: ReadonlyArray<DartPlanRelease>;
}

const readPending = async (pending: Map<string, string>, path: string): Promise<string> => pending.get(path) ?? readFile(path, "utf8");

/**
 * Apply every Dart edit for the wave to `pending`. Returns the paths it changed.
 * Throws `CONFIG_INVALID` when a release has no discovered package or its literal moved.
 */
export const planDartWorkspace = async (options: DartPlanOptions): Promise<Set<string>> => {
    const { pending, projects, releases } = options;
    const touched = new Set<string>();

    for (const release of releases) {
        const project = projects.find((candidate) => candidate.name === release.name);

        if (project === undefined) {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                message: `${release.name} is planned as a Dart release, but no Dart package with that name was discovered. Re-run the release from a fresh context.`,
                packageName: release.name,
            });
        }

        const raw = await readPending(pending, project.owner);
        let next: string;

        try {
            next = replaceDartVersion(raw, project.package.version, release.newVersion);
        } catch (error) {
            if (error instanceof DartPubspecError) {
                throw new VisReleaseError({ code: "CONFIG_INVALID", file: project.owner, message: `${project.owner}: ${error.message}.`, packageName: release.name });
            }

            throw error;
        }

        pending.set(project.owner, next);
        touched.add(project.owner);
    }

    return touched;
};
