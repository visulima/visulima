/**
 * Cargo.lock → CycloneDX components. A Rust workspace records its graph in its own
 * lockfile, so it is read separately and appended to the BOM.
 *
 * Workspace members are the entries with no `source`. Their `dev-dependencies` are
 * read from each member's manifest, because the lockfile merges them with the normal
 * dependencies. Registry packages carry only normal dependencies, so their edges are
 * used as they are.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { parse as parseToml } from "smol-toml";
import zeptomatch from "zeptomatch";

import type { LockDep, LockEntry } from "./lockgraph";
import { buildLockGraph } from "./lockgraph";
import type { Component, Dependency } from "./types";

/** `pkg:cargo/&lt;name>@&lt;version>`. Crate names are already URL-safe. */
export const toCargoPurl = (name: string, version: string): string => `pkg:cargo/${encodeURIComponent(name)}@${encodeURIComponent(version)}`;

const normalizeCrate = (name: string): string => name;

/**
 * A `Cargo.lock` dependency is `"name"`, `"name version"`, or
 * `"name version (source)"`. The version appears only when several versions of the
 * crate are locked, and the source only when those versions share a name.
 */
const parseDependency = (spec: string): LockDep | undefined => {
    const name = spec.split(" ")[0];

    if (name === undefined || name === "") {
        return undefined;
    }

    const version = /^\S+\s+(\d[^\s(]*)/.exec(spec)?.[1];
    const source = /\(([^)]+)\)/.exec(spec)?.[1];

    return { kind: "main", name, source, version };
};

const parseLock = (content: string): LockEntry[] => {
    const entries: LockEntry[] = [];
    let current: { deps: LockDep[]; name?: string; source?: string; version?: string } | undefined;
    let inDependencies = false;

    const flush = (): void => {
        if (current?.name !== undefined && current.version !== undefined) {
            entries.push({ deps: current.deps, member: current.source === undefined, name: current.name, source: current.source, version: current.version });
        }
    };

    for (const raw of content.split("\n")) {
        const line = raw.trim();

        if (line === "[[package]]") {
            flush();
            current = { deps: [] };
            inDependencies = false;

            continue;
        }

        if (current === undefined) {
            continue;
        }

        if (inDependencies) {
            const quoted = /^"([^"]+)",?$/.exec(line);

            if (quoted) {
                const dep = parseDependency(quoted[1]!);

                if (dep !== undefined) {
                    current.deps.push(dep);
                }
            } else if (line === "]") {
                inDependencies = false;
            }

            continue;
        }

        if (line === "dependencies = [") {
            inDependencies = true;

            continue;
        }

        const field = /^(name|version|source)\s*=\s*"([^"]*)"$/.exec(line);

        if (field) {
            const [, key = "", value = ""] = field;

            if (key === "name") {
                current.name = value;
            } else if (key === "version") {
                current.version = value;
            } else {
                current.source = value;
            }
        }
    }

    flush();

    return entries;
};

interface CargoManifestShape {
    "build-dependencies"?: Record<string, unknown>;
    dependencies?: Record<string, unknown>;
    "dev-dependencies"?: Record<string, unknown>;
    package?: { name?: unknown };
    target?: Record<string, { "build-dependencies"?: Record<string, unknown>; dependencies?: Record<string, unknown> }>;
    workspace?: { exclude?: unknown; members?: unknown };
}

/** The real crate a dependency entry names: `package = "x"` renames the key. */
const realName = (key: string, spec: unknown): string => {
    const renamed = typeof spec === "object" && spec !== null ? (spec as { package?: unknown }).package : undefined;

    return typeof renamed === "string" ? renamed : key;
};

/** Directories listed in `[workspace].members`, read synchronously. `**` is not expanded. */
const memberDirectories = (workspaceRoot: string, root: CargoManifestShape): string[] => {
    const members = Array.isArray(root.workspace?.members) ? root.workspace.members.filter((m): m is string => typeof m === "string") : [];
    const excludes = Array.isArray(root.workspace?.exclude) ? root.workspace.exclude.filter((e): e is string => typeof e === "string") : [];
    const found = new Set<string>();

    for (const pattern of members) {
        let current = [workspaceRoot];

        for (const segment of pattern.split("/").filter((part) => part !== "" && part !== ".")) {
            const next: string[] = [];

            for (const base of current) {
                if (!/[*?[{]/.test(segment)) {
                    next.push(join(base, segment));

                    continue;
                }

                let entries: string[];

                try {
                    entries = readdirSync(base);
                } catch {
                    entries = [];
                }

                for (const entry of entries) {
                    const path = join(base, entry);

                    if (zeptomatch(segment, entry) && statSync(path).isDirectory()) {
                        next.push(path);
                    }
                }
            }

            current = next;
        }

        for (const dir of current) {
            const rel = dir.slice(workspaceRoot.length + 1).split("\\").join("/");

            if (!excludes.some((exclude) => zeptomatch(exclude, rel))) {
                found.add(dir);
            }
        }
    }

    return [...found];
};

/**
 * Normal dependency names (including build and target-specific ones) of each member,
 * keyed by the member's crate name. A member whose manifest cannot be read is absent,
 * and its lockfile edges are kept as they are.
 */
const memberNormalDependencies = (workspaceRoot: string): Map<string, Set<string>> => {
    const result = new Map<string, Set<string>>();
    let root: CargoManifestShape;

    try {
        root = parseManifest(readFileSync(join(workspaceRoot, "Cargo.toml"), "utf8"));
    } catch {
        return result;
    }

    const dirs = memberDirectories(workspaceRoot, root);

    if (root.package?.name !== undefined) {
        dirs.push(workspaceRoot);
    }

    for (const dir of dirs) {
        let manifest: CargoManifestShape;

        try {
            manifest = parseManifest(readFileSync(join(dir, "Cargo.toml"), "utf8"));
        } catch {
            continue;
        }

        if (typeof manifest.package?.name !== "string") {
            continue;
        }

        const normal = new Set<string>();
        const collect = (table: Record<string, unknown> | undefined): void => {
            for (const [key, spec] of Object.entries(table ?? {})) {
                normal.add(normalizeCrate(realName(key, spec)));
            }
        };

        collect(manifest.dependencies);
        collect(manifest["build-dependencies"]);

        for (const target of Object.values(manifest.target ?? {})) {
            collect(target.dependencies);
            collect(target["build-dependencies"]);
        }

        result.set(normalizeCrate(manifest.package.name), normal);
    }

    return result;
};

const parseManifest = (raw: string): CargoManifestShape => parseToml(raw);

/**
 * Read `Cargo.lock` at `workspaceRoot` and return its components and dependency
 * edges, restricted to what the workspace reaches. Both are empty without a
 * lockfile, so a repo without Rust code gets the same BOM as before.
 */
export const buildCargoSbomParts = (
    workspaceRoot: string,
    options: { focusNames?: ReadonlyArray<string>; includeDev?: boolean } = {},
): { components: Component[]; dependencies: Dependency[] } => {
    let content: string;

    try {
        content = readFileSync(join(workspaceRoot, "Cargo.lock"), "utf8");
    } catch {
        return { components: [], dependencies: [] };
    }

    const normalDeps = memberNormalDependencies(workspaceRoot);
    const entries = parseLock(content).map((entry): LockEntry => {
        const normal = entry.member ? normalDeps.get(normalizeCrate(entry.name)) : undefined;

        if (normal === undefined) {
            return entry;
        }

        // Dependencies the manifest declares only under [dev-dependencies] are dev edges.
        return {
            ...entry,
            deps: entry.deps.map((dep) => (normal.has(normalizeCrate(dep.name)) ? dep : { ...dep, kind: "dev" as const })),
        };
    });

    return buildLockGraph(entries, {
        focusNames: options.focusNames,
        includeDev: options.includeDev,
        normalize: normalizeCrate,
        purl: toCargoPurl,
    });
};
