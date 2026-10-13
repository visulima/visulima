/**
 * Shared graph walk for lockfile ecosystems (Cargo.lock, uv.lock).
 *
 * A reader turns its lockfile into `LockEntry`s, each dependency tagged `main`,
 * `optional` or `dev`. This module decides what the BOM keeps: the closure
 * reachable from the workspace members (or from the focused projects), with
 * `dev` edges followed only when `includeDev` is set, and unique `bom-ref`s.
 */

import type { Component, Dependency } from "./types";

export type LockDepKind = "dev" | "main" | "optional";

export interface LockDep {
    kind: LockDepKind;
    name: string;
    source?: string;
    version?: string;
}

export interface LockEntry {
    deps: LockDep[];
    member: boolean;
    name: string;
    source?: string;
    version: string;
}

export interface LockGraphOptions {
    /** Restrict the walk to members with these names (focus). Undefined means every member. */
    focusNames?: ReadonlyArray<string>;
    /** Follow `dev` edges. Default false, matching the npm path. */
    includeDev?: boolean;
    /** Compare names in this form, e.g. PEP 503 for Python. */
    normalize: (name: string) => string;
    /** Build the purl for an entry, before any source qualifier. */
    purl: (name: string, version: string) => string;
}

/**
 * Build the components and dependency edges for the reachable part of a lockfile
 * graph. Two entries with the same name and version but different sources get a
 * `?source=` qualifier, so each keeps its own `bom-ref`.
 */
export const buildLockGraph = (entries: ReadonlyArray<LockEntry>, options: LockGraphOptions): { components: Component[]; dependencies: Dependency[] } => {
    const { focusNames, includeDev = false, normalize, purl } = options;

    const versionCount = new Map<string, number>();

    for (const entry of entries) {
        const key = `${normalize(entry.name)}@${entry.version}`;

        versionCount.set(key, (versionCount.get(key) ?? 0) + 1);
    }

    const refOf = (entry: LockEntry): string => {
        const duplicated = (versionCount.get(`${normalize(entry.name)}@${entry.version}`) ?? 0) > 1;
        const base = purl(entry.name, entry.version);

        return duplicated && entry.source !== undefined ? `${base}?source=${encodeURIComponent(entry.source)}` : base;
    };

    const byName = new Map<string, LockEntry[]>();

    for (const entry of entries) {
        const key = normalize(entry.name);

        byName.set(key, [...(byName.get(key) ?? []), entry]);
    }

    const resolve = (dep: LockDep): LockEntry | undefined => {
        const candidates = (byName.get(normalize(dep.name)) ?? []).filter(
            (entry) => (dep.version === undefined || entry.version === dep.version) && (dep.source === undefined || entry.source === dep.source),
        );

        return candidates.length === 1 ? candidates[0] : undefined;
    };

    const wanted = focusNames === undefined ? undefined : new Set(focusNames.map((name) => normalize(name)));
    const seeds = entries.filter((entry) => entry.member && (wanted === undefined || wanted.has(normalize(entry.name))));

    const visited = new Set<LockEntry>(seeds);
    const queue = [...seeds];

    while (queue.length > 0) {
        const entry = queue.shift()!;

        for (const dep of entry.deps) {
            if (dep.kind === "dev" && !includeDev) {
                continue;
            }

            const target = resolve(dep);

            if (target !== undefined && !visited.has(target)) {
                visited.add(target);
                queue.push(target);
            }
        }
    }

    const kept = [...visited];
    const components: Component[] = kept
        .map((entry) => {
            const ref = refOf(entry);

            return { "bom-ref": ref, name: entry.name, purl: ref, type: "library" as const, version: entry.version };
        })
        .sort((a, b) => (a["bom-ref"] ?? "").localeCompare(b["bom-ref"] ?? ""));

    const dependencies: Dependency[] = kept
        .map((entry) => {
            const dependsOn = [
                ...new Set(
                    entry.deps
                        .filter((dep) => includeDev || dep.kind !== "dev")
                        .map((dep) => resolve(dep))
                        .filter((target): target is LockEntry => target !== undefined && visited.has(target))
                        .map((target) => refOf(target)),
                ),
            ].sort();
            const ref = refOf(entry);

            return dependsOn.length > 0 ? { dependsOn, ref } : { ref };
        })
        .sort((a, b) => a.ref.localeCompare(b.ref));

    return { components, dependencies };
};
