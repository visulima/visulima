/**
 * pom.xml → CycloneDX components. The root pom, every module reachable through `&lt;modules>`,
 * and each module's declared `&lt;dependency>` entries are read. A module is a component with its
 * own coordinates, and it depends on each of its declared dependencies.
 *
 * Versions are resolved only when the pom defines them: a literal, or a `${property}` found in
 * the module's own pom, its parents' poms, or the built-in `project.*` names. A version that
 * cannot be resolved (a range, a property the workspace does not define, or a dependency whose
 * version is managed by a parent or BOM outside the workspace) gives the component no version
 * and a `vis:maven:version-unresolved` property. No version is ever invented.
 *
 * Dependencies with scope `test` or `provided` are dev-like (POM reference: `test` is for the
 * test phases only, `provided` is available for compilation and test but is not transitive).
 * They are included only when `includeDev` is set. Transitive dependencies are not read: a pom
 * lists direct dependencies only, and resolving the rest needs a Maven resolver.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import type { PomScan } from "../util/maven-pom";
import { effectiveGroupId, isPinned, scanPom } from "../util/maven-pom";
import type { Component, Dependency } from "./types";

/** Maven's own limit on parent chains is not documented; this bounds a cycle of `&lt;parent>` references. */
const MAX_POM_DEPTH = 8;

/** The `${…}` expansion depth. Property chains deeper than this are treated as cycles. */
const MAX_EXPANSION_DEPTH = 8;

/** Marks a component whose version the pom does not define. The value is the declared text, empty when there is none. */
export const VERSION_UNRESOLVED_PROPERTY = "vis:maven:version-unresolved";

/** `pkg:maven/group/artifact@version`. Each coordinate is encoded; the version is omitted when unresolved. */
export const toMavenPurl = (group: string, artifact: string, version?: string): string =>
    `pkg:maven/${encodeURIComponent(group)}/${encodeURIComponent(artifact)}${version === undefined ? "" : `@${encodeURIComponent(version)}`}`;

/** One declared coordinate. `version` is undefined when the pom does not resolve it; `unresolved` then holds the declared text. */
export interface MavenCoordinate {
    artifact?: string;
    group?: string;
    unresolved?: string;
    version?: string;
}

export interface MavenDeclaration extends MavenCoordinate {
    /** `compile` when the pom does not say. */
    scope: string;
}

export interface MavenModule extends MavenCoordinate {
    dependencies: MavenDeclaration[];
    /** The module's pom path, for diagnostics. */
    path: string;
}

interface PomNode {
    path: string;
    scan: PomScan;
}

const readPom = (path: string): PomNode | undefined => {
    if (!existsSync(path)) {
        return undefined;
    }

    try {
        return { path, scan: scanPom(readFileSync(path, "utf8")) };
    } catch {
        return undefined;
    }
};

/**
 * The parent a `&lt;parent>` block points at, accepted only when its coordinates match the block.
 * Maven's default `relativePath` is `../pom.xml`.
 */
const loadParent = (node: PomNode): PomNode | undefined => {
    const block = node.scan.parent;

    if (!block) {
        return undefined;
    }

    const relativePath = block.relativePath || "../pom.xml";
    const path = relativePath.endsWith(".xml") ? resolve(dirname(node.path), relativePath) : resolve(dirname(node.path), relativePath, "pom.xml");
    const parent = readPom(path);

    if (!parent) {
        return undefined;
    }

    const matches = parent.scan.artifactId?.value === block.artifactId?.value && effectiveGroupId(parent.scan) === block.groupId?.value;

    return matches ? parent : undefined;
};

/** The pom and its workspace-local ancestors, child first. */
const loadChain = (node: PomNode): PomNode[] => {
    const chain: PomNode[] = [node];

    let parent = loadParent(node);

    while (parent && chain.length < MAX_POM_DEPTH) {
        chain.push(parent);
        parent = loadParent(parent);
    }

    return chain;
};

/**
 * Expand `${name}` references with `lookup`, recursively. Undefined when a reference has no value,
 * the expansion is too deep, or text that looks like a reference is left over.
 */
const expand = (value: string, lookup: (name: string) => string | undefined, depth = 0): string | undefined => {
    if (value === "" || depth > MAX_EXPANSION_DEPTH) {
        return undefined;
    }

    let failed = false;
    const out = value.replaceAll(/\$\{([^}]+)\}/g, (_match, name: string) => {
        const found = lookup(name);
        const expanded = found === undefined ? undefined : expand(found, lookup, depth + 1);

        if (expanded === undefined) {
            failed = true;

            return "";
        }

        return expanded;
    });

    return failed || out.includes("${") ? undefined : out;
};

/** A version the pom pins to one value. Ranges (`[1.0,2.0)`) and undefined values are not pinned. */
const pinnedVersion = (raw: string | undefined, lookup: (name: string) => string | undefined): { unresolved?: string; version?: string } => {
    if (raw === undefined) {
        return { unresolved: "" };
    }

    const expanded = expand(raw, lookup);

    if (expanded === undefined || !isPinned(expanded)) {
        return { unresolved: raw };
    }

    return { version: expanded };
};

/** Read the workspace's root pom and every module pom reachable from it through `&lt;modules>`. */
const readModuleChains = (rootPath: string): PomNode[][] => {
    const chains: PomNode[][] = [];
    const seen = new Set<string>();

    const visit = (path: string): void => {
        const absolute = resolve(path);
        const node = readPom(absolute);

        if (!node || seen.has(absolute)) {
            return;
        }

        seen.add(absolute);
        chains.push(loadChain(node));

        for (const module of node.scan.modules) {
            visit(module.endsWith(".xml") ? resolve(dirname(absolute), module) : resolve(dirname(absolute), module, "pom.xml"));
        }
    };

    visit(rootPath);

    return chains;
};

/**
 * Every module in the workspace's pom tree, with its coordinates and its declared dependencies.
 * Inherited `&lt;dependencies>` of the workspace-local parents are included, the way Maven inherits them.
 * A dependency declared by a closer pom overrides one with the same `group:artifact`.
 */
export const readMavenModules = (workspaceRoot: string): MavenModule[] => {
    const modules: MavenModule[] = [];

    for (const chain of readModuleChains(resolve(workspaceRoot, "pom.xml"))) {
        const own = chain[0]!.scan;
        const props = new Map<string, string>();

        for (const node of chain) {
            for (const [key, slot] of node.scan.properties) {
                if (!props.has(key)) {
                    props.set(key, slot.value);
                }
            }
        }

        const rawGroup = effectiveGroupId(own);
        const rawArtifact = own.artifactId?.value;
        const rawVersion = own.version?.value ?? own.parent?.version?.value;
        const parentVersion = own.parent?.version?.value;

        const lookup = (name: string): string | undefined => {
            switch (name) {
                case "artifactId":
                case "pom.artifactId":
                case "project.artifactId": {
                    return rawArtifact;
                }
                case "groupId":
                case "pom.groupId":
                case "project.groupId": {
                    return rawGroup;
                }
                case "pom.version":
                case "project.version":
                case "version": {
                    return rawVersion;
                }
                case "project.parent.version": {
                    return parentVersion;
                }
                default: {
                    return props.get(name);
                }
            }
        };

        const moduleGroup = rawGroup === undefined ? undefined : expand(rawGroup, lookup);
        const moduleArtifact = rawArtifact === undefined ? undefined : expand(rawArtifact, lookup);
        const moduleVersion = pinnedVersion(rawVersion, lookup);

        const declared = new Map<string, MavenDeclaration>();

        for (const node of chain) {
            for (const dependency of node.scan.dependencies) {
                const groupRaw = dependency.groupId?.value ?? "";
                const artifactRaw = dependency.artifactId?.value ?? "";
                const key = `${groupRaw}:${artifactRaw}`;

                if (declared.has(key)) {
                    continue;
                }

                const group = expand(groupRaw, lookup);
                const artifact = expand(artifactRaw, lookup);
                const version = group === undefined || artifact === undefined ? { unresolved: dependency.version?.value ?? "" } : pinnedVersion(dependency.version?.value, lookup);

                declared.set(key, {
                    artifact,
                    group,
                    scope: dependency.scope?.value ?? "compile",
                    unresolved: group === undefined || artifact === undefined ? key : version.unresolved,
                    version: version.version,
                });
            }
        }

        modules.push({
            artifact: moduleArtifact,
            dependencies: [...declared.values()],
            group: moduleGroup,
            path: chain[0]!.path,
            unresolved: moduleVersion.unresolved,
            version: moduleVersion.version,
        });
    }

    return modules;
};

const isDevScope = (scope: string): boolean => scope === "test" || scope === "provided";

export interface MavenSbomOptions {
    includeDev?: boolean;
}

/**
 * The module and dependency graph as CycloneDX parts. A dependency is one component across modules,
 * keyed by its purl. Modules are kept whatever the scope, and edges follow the declared dependencies.
 */
export const buildMavenSbomParts = (workspaceRoot: string, options: MavenSbomOptions = {}): { components: Component[]; dependencies: Dependency[] } => {
    const includeDev = options.includeDev ?? false;
    const components = new Map<string, Component>();
    const edges = new Map<string, Set<string>>();

    const addComponent = (group: string, artifact: string, version: string | undefined, unresolved: string | undefined, scope?: Component["scope"]): string => {
        const ref = toMavenPurl(group, artifact, version);

        if (!components.has(ref)) {
            const component: Component = { "bom-ref": ref, group, name: artifact, purl: ref, type: "library" };

            if (version !== undefined) {
                component.version = version;
            }

            if (unresolved !== undefined) {
                component.properties = [{ name: VERSION_UNRESOLVED_PROPERTY, value: unresolved }];
            }

            if (scope !== undefined) {
                component.scope = scope;
            }

            components.set(ref, component);
        }

        return ref;
    };

    for (const module of readMavenModules(workspaceRoot)) {
        const moduleRef = module.group !== undefined && module.artifact !== undefined ? addComponent(module.group, module.artifact, module.version, module.unresolved) : undefined;

        for (const dependency of module.dependencies) {
            if (isDevScope(dependency.scope) && !includeDev) {
                continue;
            }

            if (dependency.group === undefined || dependency.artifact === undefined) {
                continue;
            }

            const depRef = addComponent(dependency.group, dependency.artifact, dependency.version, dependency.unresolved, isDevScope(dependency.scope) ? "optional" : "required");

            if (moduleRef !== undefined) {
                edges.set(moduleRef, (edges.get(moduleRef) ?? new Set<string>()).add(depRef));
            }
        }
    }

    const sorted = [...components.values()].sort((a, b) => (a["bom-ref"] ?? "").localeCompare(b["bom-ref"] ?? ""));

    return {
        components: sorted,
        dependencies: sorted.map((component) => {
            const ref = component["bom-ref"] ?? "";
            const dependsOn = [...(edges.get(ref) ?? [])].sort();

            return dependsOn.length > 0 ? { dependsOn, ref } : { ref };
        }),
    };
};
