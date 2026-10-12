/**
 * uv.lock → CycloneDX components. Like Cargo.lock, a uv workspace records its
 * graph in its own lockfile, so it is read separately and appended to the BOM.
 *
 * Each `[[package]]` becomes a `pkg:pypi` component. Dependency edges come from
 * the entry's `dependencies = [{ name = "…" }, …]` array, resolved against the
 * locked version. Workspace members (an `editable` / `virtual` / `directory`
 * source) are components too, so their edges resolve.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { Component, Dependency } from "./types";

interface UvLockEntry {
    dependencies: string[];
    name: string;
    version: string;
}

/** PEP 503 name normalization, the form PyPI and purl consumers expect. */
const normalizeName = (name: string): string => name.toLowerCase().replaceAll(/[-_.]+/g, "-");

/** `pkg:pypi/&lt;normalized name>@&lt;version>`. */
export const toPypiPurl = (name: string, version: string): string => `pkg:pypi/${encodeURIComponent(normalizeName(name))}@${encodeURIComponent(version)}`;

const parseUvLock = (content: string): UvLockEntry[] => {
    const entries: UvLockEntry[] = [];
    let current: { dependencies: string[]; name?: string; version?: string } | undefined;
    let inDependencies = false;

    const flush = (): void => {
        if (current?.name !== undefined && current.version !== undefined) {
            entries.push({ dependencies: current.dependencies, name: current.name, version: current.version });
        }
    };

    for (const raw of content.split("\n")) {
        const line = raw.trim();

        if (line === "[[package]]") {
            flush();
            current = { dependencies: [] };
            inDependencies = false;

            continue;
        }

        if (current === undefined) {
            continue;
        }

        if (inDependencies) {
            const dep = /^\{\s*name\s*=\s*"([^"]+)"/.exec(line);

            if (dep) {
                current.dependencies.push(dep[1]!);
            } else if (line === "]") {
                inDependencies = false;
            }

            continue;
        }

        if (line === "dependencies = [") {
            inDependencies = true;

            continue;
        }

        const field = /^(name|version)\s*=\s*"([^"]*)"$/.exec(line);

        if (field) {
            const [, key = "", value = ""] = field;

            if (key === "name") {
                current.name = value;
            } else {
                current.version = value;
            }
        }
    }

    flush();

    return entries;
};

/**
 * Read `uv.lock` at `workspaceRoot` and return its components and dependency
 * edges. Both are empty without a lockfile, so a repo without Python gets the
 * same BOM as before.
 */
export const buildPythonSbomParts = (workspaceRoot: string): { components: Component[]; dependencies: Dependency[] } => {
    let content: string;

    try {
        content = readFileSync(join(workspaceRoot, "uv.lock"), "utf8");
    } catch {
        return { components: [], dependencies: [] };
    }

    const entries = parseUvLock(content);
    const versionsByName = new Map<string, string[]>();

    for (const entry of entries) {
        const key = normalizeName(entry.name);

        versionsByName.set(key, [...(versionsByName.get(key) ?? []), entry.version]);
    }

    // uv names a dependency without a version; it resolves to the single locked
    // version. A name locked at several versions is ambiguous, so it gets no edge.
    const resolve = (name: string): string | undefined => {
        const versions = versionsByName.get(normalizeName(name)) ?? [];

        return versions.length === 1 ? toPypiPurl(name, versions[0]!) : undefined;
    };

    const components: Component[] = entries.map((entry) => {
        const purl = toPypiPurl(entry.name, entry.version);

        return { "bom-ref": purl, name: normalizeName(entry.name), purl, type: "library", version: entry.version };
    });

    const dependencies: Dependency[] = entries
        .map((entry) => {
            const purl = toPypiPurl(entry.name, entry.version);
            const dependsOn = [...new Set(entry.dependencies.map((name) => resolve(name)).filter((ref): ref is string => ref !== undefined))].sort();

            return dependsOn.length > 0 ? { dependsOn, ref: purl } : { ref: purl };
        })
        .sort((a, b) => a.ref.localeCompare(b.ref));

    return { components, dependencies };
};
