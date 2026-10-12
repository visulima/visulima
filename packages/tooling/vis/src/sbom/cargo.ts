/**
 * Cargo.lock → CycloneDX components. The JS path builds its graph from npm
 * lockfiles; a Rust workspace records its graph in `Cargo.lock`, so it is
 * read separately and appended to the same BOM.
 *
 * Packages with a `source` (crates.io, git, other registries) are components
 * with a `pkg:cargo` purl. Workspace members have no `source` and become
 * components too, so their edges resolve.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { Component, Dependency } from "./types";

interface CargoLockEntry {
    dependencies: string[];
    name: string;
    source?: string;
    version: string;
}

/** `pkg:cargo/&lt;name>@&lt;version>`. Crate names are already URL-safe. */
export const toCargoPurl = (name: string, version: string): string => `pkg:cargo/${encodeURIComponent(name)}@${encodeURIComponent(version)}`;

const parseLock = (content: string): CargoLockEntry[] => {
    const entries: CargoLockEntry[] = [];
    let current: Partial<CargoLockEntry> & { dependencies: string[] } | undefined;
    let inDependencies = false;

    const flush = (): void => {
        if (current?.name !== undefined && current.version !== undefined) {
            entries.push({ dependencies: current.dependencies, name: current.name, source: current.source, version: current.version });
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
            const quoted = /^"([^"]+)",?$/.exec(line);

            if (quoted) {
                current.dependencies.push(quoted[1]!);
            } else if (line === "]") {
                inDependencies = false;
            }

            continue;
        }

        const field = /^(name|version|source)\s*=\s*"([^"]*)"$/.exec(line);

        if (field) {
            const [, key = "", value = ""] = field;

            if (key === "name" || key === "version" || key === "source") {
                current[key] = value;
            }
        } else if (line === "dependencies = [") {
            inDependencies = true;
        }
    }

    flush();

    return entries;
};

/**
 * Read `Cargo.lock` at `workspaceRoot` and return its components and dependency
 * edges. Both are empty when there is no lockfile, so a repo without Rust code
 * gets the same BOM as before.
 */
export const buildCargoSbomParts = (workspaceRoot: string): { components: Component[]; dependencies: Dependency[] } => {
    let content: string;

    try {
        content = readFileSync(join(workspaceRoot, "Cargo.lock"), "utf8");
    } catch {
        return { components: [], dependencies: [] };
    }

    const entries = parseLock(content);
    const versionsByName = new Map<string, string[]>();

    for (const entry of entries) {
        versionsByName.set(entry.name, [...(versionsByName.get(entry.name) ?? []), entry.version]);
    }

    // A dependency is "name" when only one version is locked, and "name version"
    // (optionally followed by a source) when several are.
    const resolve = (spec: string): string | undefined => {
        const [name, version] = spec.split(" ");

        if (name === undefined) {
            return undefined;
        }

        const versions = versionsByName.get(name) ?? [];

        if (version !== undefined && versions.includes(version)) {
            return toCargoPurl(name, version);
        }

        return versions.length === 1 ? toCargoPurl(name, versions[0]!) : undefined;
    };

    const components: Component[] = entries.map((entry) => {
        const purl = toCargoPurl(entry.name, entry.version);

        return { "bom-ref": purl, name: entry.name, purl, type: "library", version: entry.version };
    });

    const dependencies: Dependency[] = entries
        .map((entry) => {
            const purl = toCargoPurl(entry.name, entry.version);
            const dependsOn = [...new Set(entry.dependencies.map((spec) => resolve(spec)).filter((ref): ref is string => ref !== undefined))].sort();

            return dependsOn.length > 0 ? { dependsOn, ref: purl } : { ref: purl };
        })
        .sort((a, b) => a.ref.localeCompare(b.ref));

    return { components, dependencies };
};
