/**
 * mix.lock → CycloneDX components. Mix records the resolved Hex graph in `mix.lock`,
 * an Elixir map with one entry per line:
 *
 *     "plug": {:hex, :plug, "1.14.0", "&lt;inner checksum>", [:mix], [{:mime, "~> 1.0", [hex: :mime, repo: "hexpm", optional: false]}], "hexpm", "&lt;outer checksum>"},
 *
 * The version is the string after the atom name. The dependency list is the sixth
 * element; each dependency is `{:name, "requirement", [opts]}`. Only `{:hex, …}` entries
 * are read. Git and path entries have no Hex version, so they are not components.
 *
 * `mix.lock` does not record which packages are direct, or which are dev-only, so every
 * locked Hex package is a member and the BOM keeps the whole lock. The workspace's own
 * apps are not in the lock, so `focusNames` cannot narrow it and is not used.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { LockEntry } from "./lockgraph";
import { buildLockGraph } from "./lockgraph";
import type { Component, Dependency } from "./types";

/** `pkg:hex/&lt;name>@&lt;version>`. Hex package names are already URL-safe. */
export const toHexPurl = (name: string, version: string): string => `pkg:hex/${encodeURIComponent(name)}@${encodeURIComponent(version)}`;

const ENTRY = /^\s*"[^"]+":\s*\{:hex,\s*:([a-z_]\w*),\s*"([^"]+)"/;

export const parseMixLockEntries = (content: string): LockEntry[] => {
    const entries: LockEntry[] = [];

    for (const line of content.split(/\r?\n/)) {
        const match = ENTRY.exec(line);

        if (match?.[1] === undefined || match[2] === undefined) {
            continue;
        }

        // The dependency tuples are `{:name, "requirement", …}`; the head tuple `{:hex, :name, "version"` has an atom where the requirement would be.
        const deps: LockEntry["deps"] = [];

        for (const dep of line.matchAll(/\{:([a-z_]\w*),\s*"/g)) {
            deps.push({ kind: "main", name: dep[1]! });
        }

        entries.push({ deps, member: true, name: match[1], version: match[2] });
    }

    return entries;
};

/**
 * Read `mix.lock` at `workspaceRoot` and return its Hex components and dependency edges.
 * Both are empty without a lockfile.
 */
export const buildHexSbomParts = (workspaceRoot: string, options: { includeDev?: boolean } = {}): { components: Component[]; dependencies: Dependency[] } => {
    let content: string;

    try {
        content = readFileSync(join(workspaceRoot, "mix.lock"), "utf8");
    } catch {
        return { components: [], dependencies: [] };
    }

    return buildLockGraph(parseMixLockEntries(content), {
        includeDev: options.includeDev,
        normalize: (name) => name,
        purl: toHexPurl,
    });
};
