/**
 * gradle.lockfile → CycloneDX components. Gradle's dependency locking writes one
 * `gradle.lockfile` per project directory (the root and each subproject), each line
 * `group:artifact:version=configuration[, configuration…]`, plus `empty=…` lines for
 * configurations with nothing to lock. The file lists every resolved coordinate, transitive
 * ones included, but records no edges, so the components are a flat list (see flat.ts).
 *
 * Build scripts are not read for versions. A project without a lockfile contributes nothing,
 * and its dependencies are not in the BOM.
 *
 * An entry locked only into test configurations (names containing "test") is dev-like, and is
 * included only when `includeDev` is set.
 *
 * Format per https://docs.gradle.org/current/userguide/dependency_locking.html
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { resolveGradleProjectDirectories } from "../config/gradle-projects";
import { toMavenPurl } from "./maven";
import type { Component, Dependency } from "./types";

export interface GradleLockEntry {
    artifact: string;
    configurations: string[];
    group: string;
    version: string;
}

/** Each lockfile line that names a coordinate. `empty=` and comment lines name none. */
export const parseGradleLockEntries = (content: string): GradleLockEntry[] => {
    const entries: GradleLockEntry[] = [];

    for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();

        if (trimmed.length === 0 || trimmed.startsWith("#")) {
            continue;
        }

        const eq = trimmed.indexOf("=");
        const parts = (eq === -1 ? trimmed : trimmed.slice(0, eq)).split(":");

        if (parts.length < 3 || !parts[0] || !parts[1] || !parts[2]) {
            continue;
        }

        const configurations = eq === -1 ? [] : trimmed.slice(eq + 1).split(",").map((name) => name.trim()).filter((name) => name.length > 0);

        entries.push({ artifact: parts[1], configurations, group: parts[0], version: parts[2] });
    }

    return entries;
};

/** The lockfile of the root and of each Gradle subproject that has one, in workspace order. */
export const readGradleLockEntries = (workspaceRoot: string): GradleLockEntry[] => {
    const directories = ["", ...resolveGradleProjectDirectories(workspaceRoot, [])];
    const entries: GradleLockEntry[] = [];

    for (const directory of directories) {
        const path = join(workspaceRoot, directory, "gradle.lockfile");

        if (!existsSync(path)) {
            continue;
        }

        try {
            entries.push(...parseGradleLockEntries(readFileSync(path, "utf8")));
        } catch {
            // An unreadable lockfile contributes nothing, the same as a missing one.
        }
    }

    return entries;
};

/** An entry is dev-like when every configuration it is locked into is a test configuration. */
const isDevOnly = (entry: GradleLockEntry): boolean => entry.configurations.length > 0 && entry.configurations.every((name) => /test/i.test(name));

/** Flat components for the locked coordinates, one per purl. */
export const buildGradleSbomParts = (workspaceRoot: string, options: { includeDev?: boolean } = {}): { components: Component[]; dependencies: Dependency[] } => {
    const includeDev = options.includeDev ?? false;
    const byRef = new Map<string, { dev: boolean; entry: GradleLockEntry }>();

    for (const entry of readGradleLockEntries(workspaceRoot)) {
        const ref = toMavenPurl(entry.group, entry.artifact, entry.version);
        const existing = byRef.get(ref);
        const dev = isDevOnly(entry);

        // A coordinate locked as runtime in one project and as test in another is runtime.
        byRef.set(ref, { dev: (existing?.dev ?? true) && dev, entry });
    }

    const refs = [...byRef.keys()].filter((ref) => includeDev || !byRef.get(ref)!.dev).sort();

    const components: Component[] = refs.map((ref) => {
        const { dev, entry } = byRef.get(ref)!;

        return {
            "bom-ref": ref,
            group: entry.group,
            name: entry.artifact,
            purl: ref,
            scope: dev ? "optional" : "required",
            type: "library",
            version: entry.version,
        };
    });

    return {
        components,
        dependencies: refs.map((ref) => {
            return { ref };
        }),
    };
};
