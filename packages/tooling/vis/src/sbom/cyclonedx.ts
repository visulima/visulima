import { randomUUID } from "node:crypto";

import { readJsonSync } from "@visulima/fs";
import { join } from "@visulima/path";
import type { ProjectGraph, WorkspaceConfiguration } from "@visulima/task-runner";
import type { XmlElement } from "jstoxml";
import { toXML } from "jstoxml";

import { resolveFocusProjects } from "../docker";
import { extractLicenseChoice, type RawLicenseInput } from "./license";
import type { ResolvedPackage } from "./lockfile";
import { readLockfilePackages } from "./lockfile";
import { toNpmPurl } from "./purl";
import type { Component, CycloneDxBom, Dependency, ExternalReference, Hash, LicenseChoice } from "./types";

/**
 * CycloneDX 1.6 BOM builder — bridges vis' workspace graph and the
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
    /** If set, limit the emitted BOM to these projects + their transitive closure. */
    focus?: string[];
    /** Override the `serialNumber` (defaults to a fresh UUID). */
    serialNumber?: string;
    /** Workspace configuration with resolved project roots. */
    workspace: WorkspaceConfiguration;
    /** Workspace root on disk. */
    workspaceRoot: string;
}

const CYCLONEDX_SPEC_VERSION = "1.6" as const;
const CYCLONEDX_BOM_FORMAT = "CycloneDX" as const;
const CYCLONEDX_SCHEMA_URL = "http://cyclonedx.org/schema/bom-1.6.schema.json";
const GENERATOR_NAME = "@visulima/vis";

const readPackageJson = (path: string): BuilderPackageJson | undefined => {
    try {
        return readJsonSync(path) as BuilderPackageJson;
    } catch {
        return undefined;
    }
};

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
 *
 * v1 limitation: registry components cover **direct** deps of in-scope
 * projects only. Transitive lockfile-only deps require walking the
 * lockfile-internal graph, deferred to a future revision.
 */
export const buildCycloneDxBom = (options: BuildSbomOptions): CycloneDxBom => {
    const {
        focus,
        generatorVersion,
        includeDev = false,
        now = new Date(),
        projectGraph,
        serialNumber,
        workspace,
        workspaceRoot,
    } = options;

    const projectNames = focus && focus.length > 0
        ? [...resolveFocusProjects(focus, projectGraph)].sort()
        : Object.keys(workspace.projects).sort();

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
            type: projectConfig.projectType === "application" ? "application" : "library",
            version,
        };

        decoratePackageComponent(component, pkg);

        projectComponents.push(component);
    }

    const lockfile = readLockfilePackages(workspaceRoot);
    const registryVersionByName = new Map<string, string>();

    if (lockfile) {
        for (const pkg of lockfile.packages.values()) {
            if (!registryVersionByName.has(pkg.name)) {
                registryVersionByName.set(pkg.name, pkg.version);
            }
        }
    }

    const reachableRegistryDeps = new Set<string>();
    const directDepEdges = new Map<string, Set<string>>();

    for (const name of projectNames) {
        const pkg = projectPackages.get(name);

        if (!pkg) {
            continue;
        }

        const depMaps = [pkg.dependencies, pkg.peerDependencies, pkg.optionalDependencies];

        if (includeDev) {
            depMaps.push(pkg.devDependencies);
        }

        const edges = new Set<string>();

        for (const depMap of depMaps) {
            if (!depMap) {
                continue;
            }

            for (const depName of Object.keys(depMap)) {
                if (inScope.has(depName)) {
                    const ref = projectBomRefs.get(depName);

                    if (ref) {
                        edges.add(ref);
                    }

                    continue;
                }

                reachableRegistryDeps.add(depName);

                const resolvedVersion = registryVersionByName.get(depName);

                if (resolvedVersion) {
                    edges.add(toNpmPurl(depName, resolvedVersion));
                }
            }
        }

        directDepEdges.set(name, edges);
    }

    const registryComponents: Component[] = [];

    if (lockfile) {
        const matched: ResolvedPackage[] = [];

        for (const pkg of lockfile.packages.values()) {
            if (reachableRegistryDeps.has(pkg.name)) {
                matched.push(pkg);
            }
        }

        matched.sort((a, b) => (a.name === b.name ? a.version.localeCompare(b.version) : a.name.localeCompare(b.name)));

        for (const pkg of matched) {
            const purl = toNpmPurl(pkg.name, pkg.version);
            const component: Component = {
                "bom-ref": purl,
                name: pkg.name,
                purl,
                scope: "required",
                type: "library",
                version: pkg.version,
            };

            if (pkg.hash) {
                component.hashes = [pkg.hash satisfies Hash];
            }

            registryComponents.push(component);
        }
    }

    const dependencies: Dependency[] = [];

    for (const [name, edges] of directDepEdges) {
        const ref = projectBomRefs.get(name);

        if (!ref) {
            continue;
        }

        const dependsOn = [...edges].sort();

        dependencies.push(dependsOn.length > 0 ? { dependsOn, ref } : { ref });
    }

    dependencies.sort((a, b) => a.ref.localeCompare(b.ref));

    const rootPkg = readPackageJson(join(workspaceRoot, "package.json"));

    const metadataComponent: Component = (() => {
        if (focus && focus.length === 1) {
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

    // CycloneDX 1.6 requires unique `bom-ref`s. If the metadata component
    // mirrors a workspace project (focus mode), drop that project from
    // components[] to avoid a duplicate.
    const metadataRef = metadataComponent["bom-ref"];
    const filteredProjectComponents = metadataRef
        ? projectComponents.filter((component) => component["bom-ref"] !== metadataRef)
        : projectComponents;

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
 * Serialises a {@link CycloneDxBom} document to CycloneDX 1.6 XML.
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
        xmlns: "http://cyclonedx.org/schema/bom/1.6",
        version: bom.version ?? 1,
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
            _content: bom.components.map(componentToXmlElement),
            _name: "components",
        });
    }

    if (bom.dependencies && bom.dependencies.length > 0) {
        content.push({
            _content: bom.dependencies.map(dependencyToXmlElement),
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
                    _content: metadata.tools.components.map(componentToXmlElement),
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
            _content: component.hashes.map((hash) => ({
                _attrs: { alg: hash.alg },
                _content: hash.content,
                _name: "hash",
            })),
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
            _content: component.externalReferences.map((reference) => ({
                _attrs: { type: reference.type },
                _content: [{ url: reference.url }],
                _name: "reference",
            })),
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
            _content: dep.dependsOn.map((child) => ({
                _attrs: { ref: child },
                _name: "dependency",
            })),
            _name: "dependency",
        };
    }

    return { _attrs: { ref: dep.ref }, _name: "dependency" };
};
