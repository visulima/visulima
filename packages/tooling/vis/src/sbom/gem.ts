/**
 * Gemfile.lock → CycloneDX components. Bundler records the resolved graph in the
 * lockfile, so it is read separately and appended to the BOM, like uv.lock.
 *
 * Layout (checked against `bundle lock` output): a section header starts at column 0
 * (`PATH`, `GEM`, `GIT`, `PLATFORMS`, `DEPENDENCIES`, …). Under `PATH` and `GEM`
 * (and `GIT`) a `specs:` list holds `    name (version)` at four spaces, and each
 * dependency of that spec sits under it at six spaces, with a constraint like
 * `(>= 2.0)` that is not a version.
 *
 * Gems under `PATH` are this repository's own gems, the workspace members, so the
 * walk starts from them. Edges are resolved by name: a name locked at more than one
 * version (for example per platform) has no edge, rather than a guessed one.
 * Bundler does not record dependency groups, so every edge is `main`; `includeDev`
 * has no effect on this reader.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { LockEntry } from "./lockgraph";
import { buildLockGraph } from "./lockgraph";
import type { Component, Dependency } from "./types";

/** `pkg:gem/&lt;name>@&lt;version>`. Gem names are already URL-safe. */
export const toGemPurl = (name: string, version: string): string => `pkg:gem/${encodeURIComponent(name)}@${encodeURIComponent(version)}`;

const SPEC = /^ {4}(\S+) \(([^()]+)\)\s*$/;
const DEPENDENCY = /^ {6}(\S+)(?: \(.*\))?\s*$/;

export const parseGemfileLockEntries = (content: string): LockEntry[] => {
    const entries = new Map<string, LockEntry>();
    let section: string | undefined;
    let remote: string | undefined;
    let current: LockEntry | undefined;

    for (const raw of content.split(/\r?\n/)) {
        if (raw.length > 0 && !raw.startsWith(" ")) {
            section = raw.trim();
            remote = undefined;
            current = undefined;

            continue;
        }

        if (section !== "PATH" && section !== "GEM" && section !== "GIT") {
            continue;
        }

        const remoteMatch = /^ {2}remote: (.+)$/.exec(raw);

        if (remoteMatch?.[1] !== undefined) {
            remote = remoteMatch[1].trim();

            continue;
        }

        const spec = SPEC.exec(raw);

        if (spec?.[1] !== undefined && spec[2] !== undefined) {
            // Bundler's version is everything before the first "-"; a platform variant (`1.16.0-arm64-darwin`) follows it.
            const name = spec[1];
            const version = spec[2].split("-")[0] ?? spec[2];
            const source = section === "GIT" && remote !== undefined ? `git:${remote}` : undefined;
            const key = `${name}\u0000${version}\u0000${source ?? ""}`;

            // Platform variants of one gem share a name and version, so they are one component with the union of their dependencies.
            current = entries.get(key) ?? { deps: [], member: section === "PATH", name, source, version };
            entries.set(key, current);

            continue;
        }

        const dependency = DEPENDENCY.exec(raw);

        if (dependency?.[1] !== undefined && current !== undefined) {
            current.deps.push({ kind: "main", name: dependency[1] });
        }
    }

    return [...entries.values()];
};

/**
 * Read `Gemfile.lock` at `workspaceRoot` and return its components and dependency edges,
 * restricted to what the workspace's own gems reach. Both are empty without a lockfile.
 */
export const buildGemSbomParts = (workspaceRoot: string, options: { focusNames?: ReadonlyArray<string>; includeDev?: boolean } = {}): { components: Component[]; dependencies: Dependency[] } => {
    let content: string;

    try {
        content = readFileSync(join(workspaceRoot, "Gemfile.lock"), "utf8");
    } catch {
        return { components: [], dependencies: [] };
    }

    return buildLockGraph(parseGemfileLockEntries(content), {
        focusNames: options.focusNames,
        includeDev: options.includeDev,
        normalize: (name) => name,
        purl: toGemPurl,
    });
};
