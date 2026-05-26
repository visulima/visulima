/**
 * Root → vulnerable-package path construction.
 *
 * `@visulima/package`'s lockfile parsers already preserve `Record<string, string[]>`
 * multi-edge dep maps (a single dep can resolve to multiple versions under
 * different peer contexts in pnpm v9+). This module consumes those entries
 * and emits the actual paths a maintainer would walk from a declared root
 * (a workspace `package.json`) down to the vulnerable resolution.
 *
 * Used by the HTML audit report (#232) and any future surface that wants
 * "why is this installed?" context per finding.
 *
 * Algorithm — iterative DFS from each root, recording paths that reach
 * the target `(name, version)`. The traversal:
 *   - resolves a `dependencies[name]` specifier to a concrete entry version
 *     via exact match → semver.satisfies → single-candidate fallback;
 *   - skips nodes already on the current path stack (cycle guard);
 *   - stops collecting once `maxPathsPerTarget` paths have been recorded;
 *   - bounds recursion via `maxDepth` (defensive against pathological
 *     lockfiles, not a realistic ceiling).
 */

import type { LockFileEntry } from "@visulima/package";
import { satisfies } from "semver";

export interface DependencyPathNode {
    name: string;
    version: string;
}

export type DependencyPath = ReadonlyArray<DependencyPathNode>;

export interface LockfileGraph {
    /**
     * Parsed lockfile entries. Each entry carries `dependencies`,
     * `peerDependencies`, and `optionalDependencies` as `Record<name, specifiers[]>`.
     */
    entries: ReadonlyArray<LockFileEntry>;
    /**
     * The declared root packages — workspace `package.json` deps. Edges
     * from these into the graph kick off the DFS.
     */
    roots: ReadonlyArray<DependencyPathNode>;
}

export interface BuildDependencyPathsOptions {
    /** Hard ceiling on traversal depth. Defaults to 64. */
    maxDepth?: number;
    /** Number of paths to return per target. Defaults to 5 (shortest first). */
    maxPathsPerTarget?: number;
}

const DEFAULT_MAX_PATHS = 5;
const DEFAULT_MAX_DEPTH = 64;

/**
 * Resolve a `dependencies[name]` specifier list to concrete entry versions
 * present in the lockfile. Preference order:
 *   1. exact version match (specifier IS an installed version)
 *   2. semver-range match (specifier satisfies an installed version)
 *   3. single-candidate fallback (only one version present — must be it)
 *
 * Returns every matching version so callers can enumerate multi-edge cases
 * (pnpm v9+ peer-context variants), not just the first.
 */
const resolveSpecifierVersions = (specifiers: ReadonlyArray<string>, candidateVersions: ReadonlyArray<string>): string[] => {
    if (candidateVersions.length === 0) {
        return [];
    }

    const resolved = new Set<string>();

    for (const specifier of specifiers) {
        if (candidateVersions.includes(specifier)) {
            resolved.add(specifier);
            continue;
        }

        let matched = false;

        for (const candidate of candidateVersions) {
            try {
                if (satisfies(candidate, specifier)) {
                    resolved.add(candidate);
                    matched = true;
                }
            } catch {
                // Non-semver specifier (a tarball URL, a git ref, …) — fall
                // through to the single-candidate fallback below.
            }
        }

        if (!matched && candidateVersions.length === 1) {
            resolved.add(candidateVersions[0]!);
        }
    }

    return [...resolved];
};

interface ResolvedEdges {
    /** Concrete child nodes (name + version) declared by this entry. */
    children: DependencyPathNode[];
}

interface ResolvedGraph {
    adjacency: Map<string, ResolvedEdges>;
    versionsByName: Map<string, string[]>;
}

/**
 * Pre-resolves the forward adjacency `entry → child nodes` once so the BFS
 * pass below doesn't re-run semver matching at every node visit.
 *
 * pnpm v9+ lockfiles emit one `LockFileEntry` per peer-context variant of a
 * package (e.g. `react-dom@18.2.0` resolved against `react@17.0.2` and again
 * against `react@18.2.0`). Each variant carries its OWN `dependencies` map,
 * so we UNION edges across every entry sharing the same `name@version` key —
 * the same approach `computeProdReachable` uses in `dependency-scan.ts`.
 * `versionsByName` is computed once and returned alongside the adjacency so
 * the caller (`buildDependencyPaths`) does not rebuild it.
 */
const buildAdjacency = (graph: LockfileGraph): ResolvedGraph => {
    const versionsByName = new Map<string, string[]>();

    for (const entry of graph.entries) {
        let bucket = versionsByName.get(entry.name);

        if (!bucket) {
            bucket = [];
            versionsByName.set(entry.name, bucket);
        }

        if (!bucket.includes(entry.version)) {
            bucket.push(entry.version);
        }
    }

    // `childrenByKey[key][childKey] = node` accumulates the union of edges
    // across every peer-context variant of `name@version`.
    const childrenByKey = new Map<string, Map<string, DependencyPathNode>>();

    for (const entry of graph.entries) {
        const key = `${entry.name}@${entry.version}`;
        let merged = childrenByKey.get(key);

        if (!merged) {
            merged = new Map<string, DependencyPathNode>();
            childrenByKey.set(key, merged);
        }

        for (const depMap of [entry.dependencies, entry.peerDependencies, entry.optionalDependencies]) {
            if (!depMap) {
                continue;
            }

            for (const [depName, specifiers] of Object.entries(depMap)) {
                const candidates = versionsByName.get(depName) ?? [];
                const versions = resolveSpecifierVersions(specifiers, candidates);

                for (const version of versions) {
                    const childKey = `${depName}@${version}`;

                    if (!merged.has(childKey)) {
                        merged.set(childKey, { name: depName, version });
                    }
                }
            }
        }
    }

    const adjacency = new Map<string, ResolvedEdges>();

    for (const [key, merged] of childrenByKey) {
        adjacency.set(key, { children: [...merged.values()] });
    }

    return { adjacency, versionsByName };
};

/**
 * Resolve a root edge (workspace declaration) to a concrete entry. Workspace
 * specifiers may be ranges (`^1.0.0`) — pick the lowest installed version
 * that satisfies, or fall back to a single candidate when there's only one.
 */
const resolveRootNode = (root: DependencyPathNode, versionsByName: Map<string, string[]>): DependencyPathNode | undefined => {
    const candidates = versionsByName.get(root.name);

    if (!candidates || candidates.length === 0) {
        return undefined;
    }

    if (candidates.includes(root.version)) {
        return { name: root.name, version: root.version };
    }

    for (const candidate of candidates) {
        try {
            if (satisfies(candidate, root.version)) {
                return { name: root.name, version: candidate };
            }
        } catch {
            // Non-semver — keep trying others, fall back to single-candidate below.
        }
    }

    if (candidates.length === 1) {
        return { name: root.name, version: candidates[0]! };
    }

    return undefined;
};

/**
 * Enumerate up to `maxPathsPerTarget` paths from `graph.roots` to `target`.
 *
 * BFS — paths are emitted in non-decreasing length order, so the first
 * `maxPaths` records are the shortest available. Cycles are skipped: a node
 * already on the current path's stack will not be re-entered. `maxDepth`
 * caps the longest path length (a frame at depth = maxDepth does not expand
 * children).
 */
export const buildDependencyPaths = (graph: LockfileGraph, target: DependencyPathNode, options: BuildDependencyPathsOptions = {}): DependencyPath[] => {
    const maxPaths = options.maxPathsPerTarget ?? DEFAULT_MAX_PATHS;
    const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;

    if (maxPaths <= 0) {
        return [];
    }

    const { adjacency, versionsByName } = buildAdjacency(graph);
    const targetKey = `${target.name}@${target.version}`;
    const found: DependencyPath[] = [];

    interface Frame {
        node: DependencyPathNode;
        path: DependencyPathNode[];
        visited: Set<string>;
    }

    const startNodes: DependencyPathNode[] = [];
    const startSeen = new Set<string>();

    for (const root of graph.roots) {
        const resolved = resolveRootNode(root, versionsByName);

        if (!resolved) {
            continue;
        }

        const key = `${resolved.name}@${resolved.version}`;

        if (startSeen.has(key)) {
            continue;
        }

        startSeen.add(key);
        startNodes.push(resolved);
    }

    // Seed the BFS queue with all resolved roots. Length-1 paths (root IS
    // the target) are recorded directly; everything else queues for expansion.
    const queue: Frame[] = [];

    for (const start of startNodes) {
        const startKey = `${start.name}@${start.version}`;

        if (startKey === targetKey) {
            found.push([start]);

            if (found.length >= maxPaths) {
                return found;
            }

            continue;
        }

        queue.push({ node: start, path: [start], visited: new Set<string>([startKey]) });
    }

    // Array-as-queue with a head pointer — `Array.shift()` is O(n), and the
    // bounded `maxPaths` cap means we never queue an unbounded frontier
    // anyway, but the pointer makes the loop O(1) per dequeue regardless.
    let head = 0;

    while (head < queue.length && found.length < maxPaths) {
        const frame = queue[head]!;

        head += 1;

        // A frame at depth = maxDepth would emit length-(maxDepth+1) paths
        // for any child, so skip expansion at the boundary.
        if (frame.path.length >= maxDepth) {
            continue;
        }

        const edges = adjacency.get(`${frame.node.name}@${frame.node.version}`);
        const children = edges?.children ?? [];

        for (const child of children) {
            const childKey = `${child.name}@${child.version}`;

            if (frame.visited.has(childKey)) {
                continue;
            }

            const nextPath = [...frame.path, child];

            if (childKey === targetKey) {
                found.push(nextPath);

                if (found.length >= maxPaths) {
                    return found;
                }

                continue;
            }

            const nextVisited = new Set(frame.visited);

            nextVisited.add(childKey);
            queue.push({ node: child, path: nextPath, visited: nextVisited });
        }
    }

    return found;
};
