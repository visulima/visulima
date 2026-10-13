/**
 * packages.lock.json → CycloneDX components. NuGet writes the resolved graph at the project
 * root when `RestorePackagesWithLockFile` is set (package-references-in-project-files docs).
 *
 * Layout read here: a top-level `dependencies` object keyed by target framework. Under each
 * framework, a package id maps to an object with a `type` (`Direct`, `Transitive` or
 * `Project`), a `resolved` version for registry packages (absent for `Project`), and a
 * `dependencies` object whose keys are the ids it depends on. The learn.microsoft.com pages
 * fetched for this reader do not show these JSON field names, so the layout is unverified
 * against the docs; the reader keeps to the minimum (`resolved` strings, dependency keys).
 *
 * The same package at the same version under two frameworks is one component with the union
 * of its edges. An edge resolves inside its own framework: a dependency id gets the version
 * that framework locked for it. `Project` entries are the workspace's own projects, not
 * registry components, so they are not emitted; the registry packages they depend on are
 * treated as roots, so packages reached only through a ProjectReference stay in the BOM.
 *
 * Focus mode cannot narrow this graph: a lock file names no workspace project it belongs to,
 * so the whole lock is kept. If the lock has no `Direct` marks and no `Project` edges, every
 * registry package is a root. The lock marks no dev dependencies, so `includeDev` has no
 * effect on this reader.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { LockEntry } from "./lockgraph";
import { buildLockGraph } from "./lockgraph";
import type { Component, Dependency } from "./types";

/** `pkg:nuget/&lt;id>@&lt;version>`. NuGet ids are case-insensitive, so the id is kept as written. */
export const toNuGetPurl = (name: string, version: string): string => `pkg:nuget/${encodeURIComponent(name)}@${encodeURIComponent(version)}`;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const lower = (name: string): string => name.toLowerCase();

interface FrameworkPackage {
    depIds: string[];
    resolved: string | undefined;
    type: string;
}

/** Parse `packages.lock.json` into lock entries, one per id and version across frameworks. Empty for unreadable JSON. */
export const parseNuGetLockEntries = (content: string): LockEntry[] => {
    let parsed: unknown;

    try {
        parsed = JSON.parse(content);
    } catch {
        return [];
    }

    if (!isRecord(parsed) || !isRecord(parsed.dependencies)) {
        return [];
    }

    const frameworks: Map<string, FrameworkPackage>[] = [];

    for (const framework of Object.values(parsed.dependencies)) {
        if (!isRecord(framework)) {
            continue;
        }

        const packages = new Map<string, FrameworkPackage>();

        for (const [id, raw] of Object.entries(framework)) {
            if (!isRecord(raw)) {
                continue;
            }

            packages.set(id, {
                depIds: isRecord(raw.dependencies) ? Object.keys(raw.dependencies) : [],
                resolved: typeof raw.resolved === "string" ? raw.resolved : undefined,
                type: typeof raw.type === "string" ? raw.type : "",
            });
        }

        frameworks.push(packages);
    }

    const roots = new Set<string>();
    let hasDirect = false;

    for (const packages of frameworks) {
        for (const pkg of packages.values()) {
            if (pkg.type === "Direct") {
                hasDirect = true;
            }

            if (pkg.type === "Project") {
                for (const depId of pkg.depIds) {
                    roots.add(lower(depId));
                }
            }
        }
    }

    const entries = new Map<string, LockEntry>();

    for (const packages of frameworks) {
        for (const [id, pkg] of packages) {
            if (pkg.type === "Project" || pkg.resolved === undefined) {
                continue;
            }

            const key = `${lower(id)}\u0000${pkg.resolved}`;
            const entry = entries.get(key) ?? { deps: [], member: false, name: id, version: pkg.resolved };

            entries.set(key, entry);

            if (pkg.type === "Direct") {
                entry.member = true;
            }

            for (const depId of pkg.depIds) {
                const target = packages.get(depId)?.resolved;

                if (target !== undefined) {
                    entry.deps.push({ kind: "main", name: depId, version: target });
                }
            }
        }
    }

    const everyIsRoot = !hasDirect && roots.size === 0;

    return [...entries.values()].map((entry) => {
        return { ...entry, member: everyIsRoot || entry.member || roots.has(lower(entry.name)) };
    });
};

/**
 * Read `packages.lock.json` at `workspaceRoot` and return its components and dependency edges.
 * Both are empty without a lock file.
 */
export const buildNuGetSbomParts = (workspaceRoot: string): { components: Component[]; dependencies: Dependency[] } => {
    let content: string;

    try {
        content = readFileSync(join(workspaceRoot, "packages.lock.json"), "utf8");
    } catch {
        return { components: [], dependencies: [] };
    }

    return buildLockGraph(parseNuGetLockEntries(content), {
        normalize: lower,
        purl: toNuGetPurl,
    });
};
