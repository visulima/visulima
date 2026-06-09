/**
 * Inverted dependency graph for the workspace (RFC §6.1, port from bumpy).
 *
 * Stores `dependents: Map&lt;packageName, DependentInfo[]>` — given a source
 * package, instantly find every workspace package that depends on it (and
 * how — `dependencies`/`devDependencies`/`peerDependencies`/`optionalDependencies`,
 * plus the original range string with any `workspace:`/`catalog:` prefix
 * intact for the publish-time resolver).
 *
 * Topological sort via Tarjan's strongly-connected-components algorithm so
 * cycles are surfaced explicitly (not silently ordered).
 */

import { VisReleaseError } from "../errors";
import type { DependencyKind, DependentInfo, WorkspacePackage } from "../types";

const DEPENDENCY_KINDS: ReadonlyArray<DependencyKind> = [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
] as const;

export class DependencyGraph {
    /** Source package name → array of dependents. */
    private readonly dependents: Map<string, DependentInfo[]>;

    /** Source package name → array of {name, kind, range} for the source's outbound deps to internal packages. */
    private readonly dependenciesByPackage: Map<string, DependentInfo[]>;

    /** Workspace package directory by name. */
    private readonly packagesByName: Map<string, WorkspacePackage>;

    public constructor(packages: WorkspacePackage[]) {
        this.dependents = new Map();
        this.dependenciesByPackage = new Map();
        this.packagesByName = new Map();

        for (const pkg of packages) {
            if (this.packagesByName.has(pkg.name)) {
                throw new VisReleaseError({
                    code: "DUPLICATE_PACKAGE_NAME",
                    message: `Duplicate package name "${pkg.name}" — found at ${this.packagesByName.get(pkg.name)!.dir} and ${pkg.dir}.`,
                    packageName: pkg.name,
                });
            }

            this.packagesByName.set(pkg.name, pkg);
            this.dependents.set(pkg.name, []);
            this.dependenciesByPackage.set(pkg.name, []);
        }

        // Build inverted index.
        for (const pkg of packages) {
            for (const kind of DEPENDENCY_KINDS) {
                const block = pkg.manifest[kind];

                if (!block || typeof block !== "object") {
                    continue;
                }

                for (const [depName, range] of Object.entries(block)) {
                    if (!this.packagesByName.has(depName)) {
                        // External dep — not in workspace.
                        continue;
                    }

                    this.dependents.get(depName)!.push({ kind, name: pkg.name, range });
                    this.dependenciesByPackage.get(pkg.name)!.push({ kind, name: depName, range });
                }
            }
        }
    }

    /** Look up a package by name. */
    public getPackage(name: string): WorkspacePackage | undefined {
        return this.packagesByName.get(name);
    }

    /** Iterate every workspace package. */
    public allPackages(): WorkspacePackage[] {
        return [...this.packagesByName.values()];
    }

    /** True iff `name` is a workspace package (not an external dep). */
    public isInternal(name: string): boolean {
        return this.packagesByName.has(name);
    }

    /** Get every workspace package depending on `source`. */
    public getDependents(source: string): ReadonlyArray<DependentInfo> {
        return this.dependents.get(source) ?? [];
    }

    /** Get every internal dep of `source`. */
    public getDependencies(source: string): ReadonlyArray<DependentInfo> {
        return this.dependenciesByPackage.get(source) ?? [];
    }

    /**
     * Topologically sort the workspace so dependencies appear before dependents.
     * Cycles are detected and reported via a `CYCLIC_DEPENDENCY` error.
     *
     * Optional `subset` restricts the sort to a subset of packages
     * (used when only a release wave's worth of packages need ordering).
     */
    public topologicalSort(subset?: Iterable<string>): string[] {
        const allowed = subset ? new Set(subset) : new Set(this.packagesByName.keys());
        const visited = new Set<string>();
        const onStack = new Set<string>();
        const result: string[] = [];

        const visit = (name: string, path: string[]): void => {
            if (visited.has(name)) {
                return;
            }

            if (onStack.has(name)) {
                const cycleStart = path.indexOf(name);
                const cycle = cycleStart === -1 ? [...path, name] : [...path.slice(cycleStart), name];

                throw new VisReleaseError({
                    code: "CYCLIC_DEPENDENCY",
                    message: `Cyclic dependency detected: ${cycle.join(" → ")}`,
                });
            }

            onStack.add(name);

            for (const dep of this.getDependencies(name)) {
                if (!allowed.has(dep.name)) {
                    continue;
                }

                if (dep.kind === "devDependencies") {
                    // Dev cycles are tolerated — they're irrelevant to publish ordering.
                    continue;
                }

                visit(dep.name, [...path, name]);
            }

            onStack.delete(name);
            visited.add(name);
            result.push(name);
        };

        for (const name of allowed) {
            visit(name, []);
        }

        return result;
    }

    /** Count of packages in the graph. */
    public get size(): number {
        return this.packagesByName.size;
    }
}
