import { randomUUID } from "node:crypto";

import { readJsonSync } from "@visulima/fs";
import { join } from "@visulima/path";
import type { ProjectConfiguration, ProjectGraph, WorkspaceConfiguration } from "@visulima/task-runner";
import type { XmlElement } from "jstoxml";
import { toXML } from "jstoxml";

import { resolveFocusProjects } from "../util/docker";
import { readInstalledPackageMetadata } from "./installed-package";
import type { RawLicenseInput } from "./license";
import { extractLicenseChoice } from "./license";
import type { ResolvedPackage } from "./lockfile";
import { readLockfilePackages } from "./lockfile";
import { toNpmPurl } from "./purl";
import type { VersionIndex } from "./resolve-specifier";
import { resolveSpecifier } from "./resolve-specifier";
import type { Component, ComponentScope, CycloneDxBom, Dependency, ExternalReference, Hash, LicenseChoice } from "./types";

/**
 * CycloneDX 1.7 BOM builder — bridges vis' workspace graph and the
 * lockfile closure parsed in `./lockfile.ts`. Output is validated by
 * `__tests__/sbom/validator.ts`.
 */

/** Subset of `package.json` the builder consumes. */
interface BuilderPackageJson extends RawLicenseInput {
    author?: string | { email?: string; name?: string; url?: string };
    bugs?: string | { url?: string };
    dependencies?: Record<string, string>;
    description?: string;
    devDependencies?: Record<string, string>;
    homepage?: string;
    name?: string;
    optionalDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    repository?: string | { type?: string; url?: string };
    version?: string;
}

export interface BuildSbomOptions {
    /** If set, limit the emitted BOM to these projects + their transitive closure. */
    focus?: string[];
    /** Optional package.json version of vis itself — stamped into `metadata.tools`. */
    generatorVersion?: string;
    /** Include devDependencies in the emitted BOM (default: false — production only). */
    includeDev?: boolean;

    /**
     * Override the `serialNumber`. Useful for deterministic tests; in
     * production the builder generates one per call.
     */
    now?: Date;
    /** Project graph used for resolving focus closure and dependency edges. */
    projectGraph: ProjectGraph;
    /** Override the `serialNumber` (defaults to a fresh UUID). */
    serialNumber?: string;
    /** Workspace configuration with resolved project roots. */
    workspace: WorkspaceConfiguration;
    /** Workspace root on disk. */
    workspaceRoot: string;
}

const CYCLONEDX_SPEC_VERSION = "1.7" as const;
const CYCLONEDX_BOM_FORMAT = "CycloneDX" as const;
// eslint-disable-next-line sonarjs/no-clear-text-protocols -- canonical CycloneDX $schema URI; not a fetch target
const CYCLONEDX_SCHEMA_URL = "http://cyclonedx.org/schema/bom-1.7.schema.json";
const GENERATOR_NAME = "@visulima/vis";

const readPackageJson = (path: string): BuilderPackageJson | undefined => {
    try {
        return readJsonSync(path) as BuilderPackageJson;
    } catch {
        return undefined;
    }
};

/**
 * Narrow view of {@link ComponentScope} used by the dependency-closure
 * walker — `"excluded"` doesn't apply because anything we walk to is,
 * by definition, reachable.
 */
type ReachableScope = Exclude<ComponentScope, "excluded">;

const toAuthorString = (author: BuilderPackageJson["author"]): string | undefined => {
    if (!author) {
        return undefined;
    }

    if (typeof author === "string") {
        return author;
    }

    if (typeof author === "object" && author.name) {
        return author.email ? `${author.name} <${author.email}>` : author.name;
    }

    return undefined;
};

const toRepositoryUrl = (repository: BuilderPackageJson["repository"]): string | undefined => {
    if (!repository) {
        return undefined;
    }

    if (typeof repository === "string") {
        return repository;
    }

    return repository.url;
};

const toBugsUrl = (bugs: BuilderPackageJson["bugs"]): string | undefined => {
    if (!bugs) {
        return undefined;
    }

    if (typeof bugs === "string") {
        return bugs;
    }

    return bugs.url;
};

/** Build the `externalReferences[]` array from a package.json. */
const buildExternalReferences = (pkg: BuilderPackageJson): ExternalReference[] | undefined => {
    const references: ExternalReference[] = [];

    if (pkg.homepage) {
        references.push({ type: "website", url: pkg.homepage });
    }

    const vcs = toRepositoryUrl(pkg.repository);

    if (vcs) {
        references.push({ type: "vcs", url: vcs });
    }

    const issues = toBugsUrl(pkg.bugs);

    if (issues) {
        references.push({ type: "issue-tracker", url: issues });
    }

    return references.length > 0 ? references : undefined;
};

// Services and CLI tools are deployable executables — CycloneDX models them as `application`.
const toCycloneDxComponentType = (projectType: ProjectConfiguration["projectType"]): "application" | "library" =>
    (projectType === "application" || projectType === "service" || projectType === "tool" ? "application" : "library");

/** Assemble the required parts of a component from a parsed package.json. */
const decoratePackageComponent = (component: Component, pkg: BuilderPackageJson | undefined): void => {
    if (!pkg) {
        return;
    }

    if (pkg.description) {
        component.description = pkg.description;
    }

    const author = toAuthorString(pkg.author);

    if (author) {
        component.author = author;
    }

    const license = extractLicenseChoice(pkg);

    if (license) {
        component.licenses = license;
    }

    const references = buildExternalReferences(pkg);

    if (references) {
        component.externalReferences = references;
    }
};

/**
 * Builds the BOM from workspace + lockfile data. Pure function — all
 * I/O is relative to `workspaceRoot` so tests point it at a temp dir.
 */
export const buildCycloneDxBom = (options: BuildSbomOptions): CycloneDxBom => {
    const { focus, generatorVersion, includeDev = false, now = new Date(), projectGraph, serialNumber, workspace, workspaceRoot } = options;

    const projectNames = focus && focus.length > 0 ? [...resolveFocusProjects(focus, projectGraph)].sort() : Object.keys(workspace.projects).sort();

    const inScope = new Set(projectNames);

    // Read each project's package.json exactly once.
    const projectPackages = new Map<string, BuilderPackageJson | undefined>();

    for (const name of projectNames) {
        const projectConfig = workspace.projects[name];

        if (projectConfig) {
            projectPackages.set(name, readPackageJson(join(workspaceRoot, projectConfig.root, "package.json")));
        }
    }

    const projectComponents: Component[] = [];
    const projectBomRefs = new Map<string, string>();

    for (const name of projectNames) {
        const projectConfig = workspace.projects[name];

        if (!projectConfig) {
            continue;
        }

        const pkg = projectPackages.get(name);
        const version = pkg?.version ?? "0.0.0";
        const bomRef = toNpmPurl(name, version);

        projectBomRefs.set(name, bomRef);

        const component: Component = {
            "bom-ref": bomRef,
            name,
            purl: bomRef,
            type: toCycloneDxComponentType(projectConfig.projectType),
            version,
        };

        decoratePackageComponent(component, pkg);

        projectComponents.push(component);
    }

    const lockfile = readLockfilePackages(workspaceRoot);

    // Build a lockfile-wide index so the transitive walk can look up
    // resolved `name@version` entries by their name and (for edge
    // building) resolve specifiers against the set of known versions.
    const lockfileByRef = new Map<string, ResolvedPackage>();
    const versionIndex: VersionIndex = new Map();

    if (lockfile) {
        for (const pkg of lockfile.packages.values()) {
            lockfileByRef.set(`${pkg.name}@${pkg.version}`, pkg);

            let versions = versionIndex.get(pkg.name);

            if (!versions) {
                versions = new Set();
                versionIndex.set(pkg.name, versions);
            }

            versions.add(pkg.version);
        }
    }

    // Seed required/optional separately; BFS: required edges upgrade
    // optional, optional edges never downgrade required.
    const requiredSeed: string[] = [];
    const optionalSeed: string[] = [];
    const directDepEdges = new Map<string, Set<string>>();

    for (const name of projectNames) {
        const pkg = projectPackages.get(name);

        if (!pkg) {
            continue;
        }

        const requiredMaps = [pkg.dependencies, pkg.peerDependencies];

        if (includeDev) {
            requiredMaps.push(pkg.devDependencies);
        }

        const edges = new Set<string>();
        const seedRef = (target: string[], depMap: Record<string, string> | undefined): void => {
            if (!depMap) {
                return;
            }

            for (const [depName, specifier] of Object.entries(depMap)) {
                if (inScope.has(depName)) {
                    const ref = projectBomRefs.get(depName);

                    if (ref) {
                        edges.add(ref);
                    }

                    continue;
                }

                const resolvedVersion = resolveSpecifier(depName, specifier, versionIndex);

                if (resolvedVersion) {
                    edges.add(toNpmPurl(depName, resolvedVersion));
                    target.push(`${depName}@${resolvedVersion}`);
                }
            }
        };

        for (const depMap of requiredMaps) {
            seedRef(requiredSeed, depMap);
        }

        seedRef(optionalSeed, pkg.optionalDependencies);

        directDepEdges.set(name, edges);
    }

    const reachableRegistryRefs = new Map<string, ReachableScope>();
    const registryDepEdges = new Map<string, Set<string>>();

    const walk = (seeds: string[], scope: ReachableScope): void => {
        const queue = [...seeds];

        while (queue.length > 0) {
            const ref = queue.pop()!;
            const existing = reachableRegistryRefs.get(ref);

            // Skip if we've already recorded this ref at this or a higher scope.
            // Required outranks optional; optional never overwrites required.
            if (existing === "required" || (existing === "optional" && scope === "optional")) {
                continue;
            }

            reachableRegistryRefs.set(ref, scope);

            const entry = lockfileByRef.get(ref);

            if (!entry) {
                continue;
            }

            const outgoing = registryDepEdges.get(ref) ?? new Set<string>();
            // `dependencies` + `peerDependencies` inherit the parent's scope;
            // `optionalDependencies` are always optional regardless of parent.
            // Each dep name may resolve to multiple versions when pnpm's
            // peer-context variants disagree — iterate all of them so no
            // edge is dropped.
            const inheritedMaps = [entry.dependencies, entry.peerDependencies];

            for (const depMap of inheritedMaps) {
                if (!depMap) {
                    continue;
                }

                for (const [depName, specifiers] of Object.entries(depMap)) {
                    for (const specifier of specifiers) {
                        const resolvedVersion = resolveSpecifier(depName, specifier, versionIndex);

                        if (!resolvedVersion) {
                            continue;
                        }

                        outgoing.add(toNpmPurl(depName, resolvedVersion));
                        queue.push(`${depName}@${resolvedVersion}`);
                    }
                }
            }

            if (entry.optionalDependencies) {
                for (const [depName, specifiers] of Object.entries(entry.optionalDependencies)) {
                    for (const specifier of specifiers) {
                        const resolvedVersion = resolveSpecifier(depName, specifier, versionIndex);

                        if (!resolvedVersion) {
                            continue;
                        }

                        outgoing.add(toNpmPurl(depName, resolvedVersion));
                        optionalSeed.push(`${depName}@${resolvedVersion}`);
                    }
                }
            }

            if (outgoing.size > 0) {
                registryDepEdges.set(ref, outgoing);
            }
        }
    };

    walk(requiredSeed, "required");
    walk(optionalSeed, "optional");

    // Emit one Component per reachable `name@version`, sorted for
    // deterministic output.
    const registryComponents: Component[] = [];
    const sortedRefs = [...reachableRegistryRefs.keys()].sort();

    for (const ref of sortedRefs) {
        const pkg = lockfileByRef.get(ref);

        if (!pkg) {
            continue;
        }

        const purl = toNpmPurl(pkg.name, pkg.version);
        const component: Component = {
            "bom-ref": purl,
            name: pkg.name,
            purl,
            scope: reachableRegistryRefs.get(ref) ?? "required",
            type: "library",
            version: pkg.version,
        };

        if (pkg.hash) {
            component.hashes = [pkg.hash satisfies Hash];
        }

        // Resolve licence + author + references against the *installed
        // copy* of this specific name@version, not against a single
        // hoisted or top-level package.json. Different versions of the
        // same package can ship different licences.
        decoratePackageComponent(component, readInstalledPackageMetadata(workspaceRoot, pkg.name, pkg.version));

        registryComponents.push(component);
    }

    const dependencies: Dependency[] = [];

    // Workspace project → its direct deps (mix of project and registry).
    for (const [projectName, edges] of directDepEdges) {
        const ref = projectBomRefs.get(projectName);

        if (!ref) {
            continue;
        }

        const dependsOn = [...edges].sort();

        dependencies.push(dependsOn.length > 0 ? { dependsOn, ref } : { ref });
    }

    // Registry → registry edges from the lockfile graph walk.
    for (const ref of sortedRefs) {
        const pkg = lockfileByRef.get(ref);

        if (!pkg) {
            continue;
        }

        const purl = toNpmPurl(pkg.name, pkg.version);
        const outgoing = registryDepEdges.get(ref);
        const dependsOn = outgoing ? [...outgoing].sort() : [];

        dependencies.push(dependsOn.length > 0 ? { dependsOn, ref: purl } : { ref: purl });
    }

    dependencies.sort((a, b) => a.ref.localeCompare(b.ref));

    const rootPkg = readPackageJson(join(workspaceRoot, "package.json"));

    const metadataComponent: Component = (() => {
        if (focus?.length === 1) {
            const match = projectComponents.find((component) => component.name === focus[0]);

            if (match) {
                return {
                    "bom-ref": match["bom-ref"],
                    name: match.name,
                    purl: match.purl,
                    type: match.type,
                    version: match.version,
                };
            }
        }

        const rootName = rootPkg?.name ?? "workspace";
        const rootVersion = rootPkg?.version ?? "0.0.0";
        const rootRef = toNpmPurl(rootName, rootVersion);

        const component: Component = {
            "bom-ref": rootRef,
            name: rootName,
            purl: rootRef,
            type: "application",
            version: rootVersion,
        };

        decoratePackageComponent(component, rootPkg);

        return component;
    })();

    // CycloneDX 1.7 requires unique `bom-ref`s. If the metadata component
    // mirrors a workspace project (focus mode), drop that project from
    // components[] to avoid a duplicate.
    const metadataRef = metadataComponent["bom-ref"];
    const filteredProjectComponents = metadataRef ? projectComponents.filter((component) => component["bom-ref"] !== metadataRef) : projectComponents;

    return {
        $schema: CYCLONEDX_SCHEMA_URL,
        bomFormat: CYCLONEDX_BOM_FORMAT,
        components: [...filteredProjectComponents, ...registryComponents],
        dependencies,
        metadata: {
            component: metadataComponent,
            lifecycles: [{ phase: "build" }],
            timestamp: now.toISOString(),
            tools: {
                components: [
                    {
                        name: GENERATOR_NAME,
                        type: "application",
                        ...(generatorVersion ? { version: generatorVersion } : {}),
                    },
                ],
            },
        },
        serialNumber: serialNumber ?? `urn:uuid:${randomUUID()}`,
        specVersion: CYCLONEDX_SPEC_VERSION,
        version: 1,
    };
};

/**
 * Serialises a {@link CycloneDxBom} document to CycloneDX 1.7 XML.
 *
 * Delegates all escaping, indentation, and attribute serialisation to
 * the project-standard `jstoxml` library (already used elsewhere in
 * the monorepo — see `packages/api/api-platform` and
 * `packages/error-debugging/error-handler`). We only translate our
 * typed JSON-shaped BOM into jstoxml's `{ _name, _attrs, _content }`
 * tree.
 */
export const serializeBomToXml = (bom: CycloneDxBom): string => {
    const rootAttributes: Record<string, string | number> = {
        version: bom.version ?? 1,
        // eslint-disable-next-line sonarjs/no-clear-text-protocols -- XML namespace URI fixed by the CycloneDX spec; never resolved at runtime
        xmlns: "http://cyclonedx.org/schema/bom/1.7",
    };

    if (bom.serialNumber) {
        rootAttributes.serialNumber = bom.serialNumber;
    }

    const content: XmlElement[] = [];

    if (bom.metadata) {
        content.push(metadataToXmlElement(bom.metadata));
    }

    if (bom.components && bom.components.length > 0) {
        content.push({
            _content: bom.components.map((component) => componentToXmlElement(component)),
            _name: "components",
        });
    }

    if (bom.dependencies && bom.dependencies.length > 0) {
        content.push({
            _content: bom.dependencies.map((dependency) => dependencyToXmlElement(dependency)),
            _name: "dependencies",
        });
    }

    const xml = toXML(
        {
            _attrs: rootAttributes,
            _content: content,
            _name: "bom",
        },
        {
            header: true,
            indent: "  ",
            selfCloseTags: true,
        },
    );

    return `${xml}\n`;
};

const metadataToXmlElement = (metadata: NonNullable<CycloneDxBom["metadata"]>): XmlElement => {
    const children: XmlElement[] = [];

    if (metadata.timestamp) {
        children.push({ timestamp: metadata.timestamp });
    }

    if (metadata.lifecycles && metadata.lifecycles.length > 0) {
        children.push({
            _content: metadata.lifecycles.map((lifecycle) => {
                const entries: XmlElement[] = [];

                if (lifecycle.phase) {
                    entries.push({ phase: lifecycle.phase });
                }

                if (lifecycle.name) {
                    entries.push({ name: lifecycle.name });
                }

                if (lifecycle.description) {
                    entries.push({ description: lifecycle.description });
                }

                return { _content: entries, _name: "lifecycle" };
            }),
            _name: "lifecycles",
        });
    }

    if (metadata.tools?.components) {
        children.push({
            _content: [
                {
                    _content: metadata.tools.components.map((component) => componentToXmlElement(component)),
                    _name: "components",
                },
            ],
            _name: "tools",
        });
    }

    if (metadata.component) {
        children.push(componentToXmlElement(metadata.component));
    }

    return { _content: children, _name: "metadata" };
};

const componentToXmlElement = (component: Component): XmlElement => {
    const attributes: Record<string, string> = { type: component.type };

    if (component["bom-ref"]) {
        attributes["bom-ref"] = component["bom-ref"];
    }

    const children: XmlElement[] = [];

    if (component.group) {
        children.push({ group: component.group });
    }

    children.push({ name: component.name });

    if (component.version) {
        children.push({ version: component.version });
    }

    if (component.description) {
        children.push({ description: component.description });
    }

    if (component.author) {
        children.push({ author: component.author });
    }

    if (component.hashes && component.hashes.length > 0) {
        children.push({
            _content: component.hashes.map((hash) => {
                return {
                    _attrs: { alg: hash.alg },
                    _content: hash.content,
                    _name: "hash",
                };
            }),
            _name: "hashes",
        });
    }

    const licenses = licensesToXmlElement(component.licenses);

    if (licenses) {
        children.push(licenses);
    }

    if (component.purl) {
        children.push({ purl: component.purl });
    }

    if (component.scope) {
        children.push({ scope: component.scope });
    }

    if (component.externalReferences && component.externalReferences.length > 0) {
        children.push({
            _content: component.externalReferences.map((reference) => {
                return {
                    _attrs: { type: reference.type },
                    _content: [{ url: reference.url }],
                    _name: "reference",
                };
            }),
            _name: "externalReferences",
        });
    }

    return { _attrs: attributes, _content: children, _name: "component" };
};

const licensesToXmlElement = (licenses: LicenseChoice | undefined): XmlElement | undefined => {
    if (!licenses || licenses.length === 0) {
        return undefined;
    }

    const entries: XmlElement[] = [];

    for (const entry of licenses) {
        if ("expression" in entry) {
            entries.push({ expression: entry.expression });

            continue;
        }

        const licenseChildren: XmlElement[] = [];

        if ("id" in entry.license && entry.license.id) {
            licenseChildren.push({ id: entry.license.id });
        } else if ("name" in entry.license && entry.license.name) {
            licenseChildren.push({ name: entry.license.name });
        }

        entries.push({ _content: licenseChildren, _name: "license" });
    }

    return { _content: entries, _name: "licenses" };
};

const dependencyToXmlElement = (dep: Dependency): XmlElement => {
    if (dep.dependsOn && dep.dependsOn.length > 0) {
        return {
            _attrs: { ref: dep.ref },
            _content: dep.dependsOn.map((child) => {
                return {
                    _attrs: { ref: child },
                    _name: "dependency",
                };
            }),
            _name: "dependency",
        };
    }

    return { _attrs: { ref: dep.ref }, _name: "dependency" };
};
