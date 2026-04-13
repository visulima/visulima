import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

import { join } from "@visulima/path";
import type { ProjectGraph, WorkspaceConfiguration } from "@visulima/task-runner";

import { resolveFocusProjects } from "../docker";
import { extractLicenseChoice, type RawLicenseInput } from "./license";
import type { ResolvedPackage } from "./lockfile";
import { readLockfilePackages } from "./lockfile";
import { toNpmPurl } from "./purl";
import type { Component, CycloneDxBom, Dependency, ExternalReference, Hash, LicenseChoice } from "./types";

/**
 * CycloneDX 1.6 BOM builder.
 *
 * This module is the bridge between vis' workspace graph (projects +
 * their inter-dependencies) and the lockfile-level dependency closure
 * parsed in `./lockfile.ts`. The output is a fully-validated
 * `CycloneDxBom` document that round-trips through
 * `__tests__/sbom/validator.ts` without errors.
 *
 * Responsibilities:
 *
 * 1. Walk each workspace project, read its `package.json`, and emit
 *    one `Component { type: "library"|"application", scope, purl, … }`.
 * 2. Walk every lockfile entry (transitively from the root) and emit
 *    one library `Component` per `name@version` pair.
 * 3. Build a `dependencies[]` array that mirrors the workspace's
 *    project-to-project edges. (Registry-to-registry edges are not
 *    captured — the lockfile is the source of truth for those at scan
 *    time, and duplicating them here would bloat the BOM considerably.)
 * 4. Stamp a unique `serialNumber` and ISO-8601 `timestamp` onto
 *    `metadata`, plus identify vis itself as the generator tool.
 */

/**
 * Subset of `package.json` the builder consumes. Intentionally narrow
 * so `readPackageJson` stays a simple filesystem read + JSON.parse.
 */
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
        return JSON.parse(readFileSync(path, "utf8")) as BuilderPackageJson;
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
 * Builds the BOM. Pure function: all I/O is performed through paths
 * derived from `workspaceRoot`, so tests point it at a temporary
 * directory and inspect the result.
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

    // ── 1. Determine the project set ────────────────────────────────
    const projectNames = focus && focus.length > 0
        ? [...resolveFocusProjects(focus, projectGraph)].sort()
        : Object.keys(workspace.projects).sort();

    const inScope = new Set(projectNames);

    // ── 2. Emit a component per workspace project ───────────────────
    const projectComponents: Component[] = [];
    const projectBomRefs = new Map<string, string>();

    for (const name of projectNames) {
        const projectConfig = workspace.projects[name];

        if (!projectConfig) {
            continue;
        }

        const pkg = readPackageJson(join(workspaceRoot, projectConfig.root, "package.json"));
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

    // ── 3. Collect external (registry) dependencies from lockfile ───
    const lockfile = readLockfilePackages(workspaceRoot);

    /**
     * Lookup table of `name → resolved version` for every package in
     * the lockfile. Used for two things: deciding which lockfile
     * entries become components (step 4), and resolving project →
     * registry edges (step 5).
     */
    const registryVersionByName = new Map<string, string>();

    if (lockfile) {
        for (const pkg of lockfile.packages.values()) {
            if (!registryVersionByName.has(pkg.name)) {
                registryVersionByName.set(pkg.name, pkg.version);
            }
        }
    }

    /**
     * Union of every registry package reachable from the in-scope
     * projects. `includeDev` flag drives the `--include-dev` filter:
     * only packages listed in `dependencies` / `peerDependencies` /
     * `optionalDependencies` arrive in production mode.
     */
    const reachableRegistryDeps = new Set<string>();
    const directDepEdges = new Map<string, Set<string>>();

    for (const name of projectNames) {
        const projectConfig = workspace.projects[name];

        if (!projectConfig) {
            continue;
        }

        const pkg = readPackageJson(join(workspaceRoot, projectConfig.root, "package.json"));

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
                // Workspace-internal dependency → link to the project component.
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

    // ── 4. Emit a component per resolved lockfile entry ────────────
    //
    // We emit one library `Component` per lockfile entry whose name
    // appears in the in-scope projects' direct dependency lists.
    // `--include-dev` controls whether `devDependencies` is one of
    // those lists.
    //
    // **Caveat**: this is a v1 implementation that captures **direct**
    // registry dependencies only — transitive deps that live in the
    // lockfile but aren't named in any workspace `package.json` are
    // not included. A future revision will walk the lockfile-internal
    // dependency graph to capture the full closure; until then the
    // SBOM is conservative (smaller than reality).
    const registryComponents: Component[] = [];

    if (lockfile) {
        const matched: ResolvedPackage[] = [];

        for (const pkg of lockfile.packages.values()) {
            if (!reachableRegistryDeps.has(pkg.name)) {
                continue;
            }

            matched.push(pkg);
        }

        matched.sort((a, b) => {
            if (a.name !== b.name) {
                return a.name.localeCompare(b.name);
            }

            return a.version.localeCompare(b.version);
        });

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

    // ── 5. Build dependency graph edges ────────────────────────────
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

    // ── 6. Metadata ────────────────────────────────────────────────
    const rootPkg = readPackageJson(join(workspaceRoot, "package.json"));

    const metadataComponent: Component | undefined = (() => {
        // If the user focused on exactly one project, use it as the metadata component.
        if (focus && focus.length === 1) {
            const focusName = focus[0] as string;
            const match = projectComponents.find((component) => component.name === focusName);

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

    // Per CycloneDX 1.6: every `bom-ref` must be unique within the BOM.
    // When `metadata.component` mirrors a workspace project (focus mode),
    // strip that project from `components[]` so we don't emit two
    // entries with the same `bom-ref`.
    const metadataRef = metadataComponent?.["bom-ref"];
    const filteredProjectComponents = metadataRef
        ? projectComponents.filter((component) => component["bom-ref"] !== metadataRef)
        : projectComponents;

    const bom: CycloneDxBom = {
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

    return bom;
};

/**
 * Minimal CycloneDX 1.6 XML serialiser. Covers the subset of fields
 * our builder emits; nothing more. We hand-roll this rather than
 * pulling in an XML library because the schema is well-defined and
 * the escape surface is tiny.
 */
export const serializeBomToXml = (bom: CycloneDxBom): string => {
    const escape = (value: string): string =>
        value
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll("\"", "&quot;")
            .replaceAll("'", "&apos;");

    const lines: string[] = [];

    lines.push("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");

    const rootAttributes: string[] = [
        "xmlns=\"http://cyclonedx.org/schema/bom/1.6\"",
        `version="${bom.version ?? 1}"`,
    ];

    if (bom.serialNumber) {
        rootAttributes.push(`serialNumber="${escape(bom.serialNumber)}"`);
    }

    lines.push(`<bom ${rootAttributes.join(" ")}>`);

    if (bom.metadata) {
        lines.push("  <metadata>");

        if (bom.metadata.timestamp) {
            lines.push(`    <timestamp>${escape(bom.metadata.timestamp)}</timestamp>`);
        }

        if (bom.metadata.tools?.components) {
            lines.push("    <tools>");

            for (const tool of bom.metadata.tools.components) {
                lines.push(`      <component type="${escape(tool.type)}">`);
                lines.push(`        <name>${escape(tool.name)}</name>`);

                if (tool.version) {
                    lines.push(`        <version>${escape(tool.version)}</version>`);
                }

                lines.push("      </component>");
            }

            lines.push("    </tools>");
        }

        if (bom.metadata.component) {
            lines.push(...renderComponentXml(bom.metadata.component, "    ", escape));
        }

        lines.push("  </metadata>");
    }

    if (bom.components && bom.components.length > 0) {
        lines.push("  <components>");

        for (const component of bom.components) {
            lines.push(...renderComponentXml(component, "    ", escape));
        }

        lines.push("  </components>");
    }

    if (bom.dependencies && bom.dependencies.length > 0) {
        lines.push("  <dependencies>");

        for (const dep of bom.dependencies) {
            if (dep.dependsOn && dep.dependsOn.length > 0) {
                lines.push(`    <dependency ref="${escape(dep.ref)}">`);

                for (const child of dep.dependsOn) {
                    lines.push(`      <dependency ref="${escape(child)}"/>`);
                }

                lines.push("    </dependency>");
            } else {
                lines.push(`    <dependency ref="${escape(dep.ref)}"/>`);
            }
        }

        lines.push("  </dependencies>");
    }

    lines.push("</bom>");

    return `${lines.join("\n")}\n`;
};

const renderComponentXml = (
    component: Component,
    indent: string,
    escape: (value: string) => string,
): string[] => {
    const openAttributes: string[] = [`type="${escape(component.type)}"`];

    if (component["bom-ref"]) {
        openAttributes.push(`bom-ref="${escape(component["bom-ref"])}"`);
    }

    const lines: string[] = [`${indent}<component ${openAttributes.join(" ")}>`];

    if (component.group) {
        lines.push(`${indent}  <group>${escape(component.group)}</group>`);
    }

    lines.push(`${indent}  <name>${escape(component.name)}</name>`);

    if (component.version) {
        lines.push(`${indent}  <version>${escape(component.version)}</version>`);
    }

    if (component.description) {
        lines.push(`${indent}  <description>${escape(component.description)}</description>`);
    }

    if (component.author) {
        lines.push(`${indent}  <author>${escape(component.author)}</author>`);
    }

    if (component.hashes && component.hashes.length > 0) {
        lines.push(`${indent}  <hashes>`);

        for (const hash of component.hashes) {
            lines.push(`${indent}    <hash alg="${escape(hash.alg)}">${escape(hash.content)}</hash>`);
        }

        lines.push(`${indent}  </hashes>`);
    }

    renderLicenseXml(component.licenses, `${indent}  `, escape, lines);

    if (component.purl) {
        lines.push(`${indent}  <purl>${escape(component.purl)}</purl>`);
    }

    if (component.scope) {
        lines.push(`${indent}  <scope>${escape(component.scope)}</scope>`);
    }

    if (component.externalReferences && component.externalReferences.length > 0) {
        lines.push(`${indent}  <externalReferences>`);

        for (const reference of component.externalReferences) {
            lines.push(`${indent}    <reference type="${escape(reference.type)}">`);
            lines.push(`${indent}      <url>${escape(reference.url)}</url>`);
            lines.push(`${indent}    </reference>`);
        }

        lines.push(`${indent}  </externalReferences>`);
    }

    lines.push(`${indent}</component>`);

    return lines;
};

const renderLicenseXml = (
    licenses: LicenseChoice | undefined,
    indent: string,
    escape: (value: string) => string,
    lines: string[],
): void => {
    if (!licenses || licenses.length === 0) {
        return;
    }

    lines.push(`${indent}<licenses>`);

    for (const entry of licenses) {
        if ("expression" in entry) {
            lines.push(`${indent}  <expression>${escape(entry.expression)}</expression>`);

            continue;
        }

        lines.push(`${indent}  <license>`);

        if ("id" in entry.license && entry.license.id) {
            lines.push(`${indent}    <id>${escape(entry.license.id)}</id>`);
        } else if ("name" in entry.license && entry.license.name) {
            lines.push(`${indent}    <name>${escape(entry.license.name)}</name>`);
        }

        lines.push(`${indent}  </license>`);
    }

    lines.push(`${indent}</licenses>`);
};
