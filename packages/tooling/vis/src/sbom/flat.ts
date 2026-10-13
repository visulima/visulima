/**
 * Flat SBOM components for lock files that record versions but no dependency edges:
 * `go.sum` (Go), `pubspec.lock` (Dart) and `Package.resolved` (Swift). Each locked package
 * is a component with a purl, and each gets a `dependencies` entry with no `dependsOn`.
 * The lists are flat on purpose: the BOM claims no edges between these packages.
 *
 * `go.sum` also records module versions needed only to resolve the graph, not to build, so
 * the Go list can hold more modules than the build compiles.
 */

import { lockedPackagesForEcosystem } from "../security/multi-eco-lockfiles";
import type { Component, Dependency } from "./types";

export type FlatEcosystem = "Go" | "Pub" | "SwiftURL";

const encodePath = (path: string): string => path.split("/").map((segment) => encodeURIComponent(segment)).join("/");

/** Purl per ecosystem. Go and Swift names are paths, so each segment is encoded and `/` is kept. */
const PURL: Record<FlatEcosystem, (name: string, version: string) => string> = {
    Go: (name, version) => `pkg:golang/${encodePath(name)}@${encodeURIComponent(version)}`,
    Pub: (name, version) => `pkg:pub/${encodeURIComponent(name)}@${encodeURIComponent(version)}`,
    SwiftURL: (name, version) => `pkg:swift/${encodePath(name)}@${encodeURIComponent(version)}`,
};

export const buildFlatSbomParts = (workspaceRoot: string, ecosystem: FlatEcosystem): { components: Component[]; dependencies: Dependency[] } => {
    const components: Component[] = lockedPackagesForEcosystem(workspaceRoot, ecosystem)
        .map((pkg) => {
            const ref = PURL[ecosystem](pkg.name, pkg.version);

            return { "bom-ref": ref, name: pkg.name, purl: ref, type: "library" as const, version: pkg.version };
        })
        .sort((a, b) => (a["bom-ref"] ?? "").localeCompare(b["bom-ref"] ?? ""));

    return {
        components,
        dependencies: components.map((component) => { return { ref: component["bom-ref"] ?? "" }; }),
    };
};
