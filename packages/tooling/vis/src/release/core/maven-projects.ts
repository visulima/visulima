/**
 * Maven modules as release packages, opt-in through `release.maven.discover`.
 *
 * The root `pom.xml` and every module reachable through its `&lt;modules>` list
 * become `WorkspacePackage`s with `ecosystem: "maven"`, named `groupId:artifactId`.
 * Their `manifest` is synthetic and carries only what the dependency graph
 * needs. It is never serialized into `pom.xml`. Reading the pom is done by the
 * masking scanner in `src/util/maven-pom.ts`.
 */

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import type { PomScan } from "../../util/maven-pom";
import { dependencyName, effectiveGroupId, isPinned, isPropertyReference, scanPom } from "../../util/maven-pom";
import { VisReleaseError } from "../errors";
import type { PackageManifest, WorkspacePackage } from "../types";

/** A pom that has been read: its path and what the scanner found in it. */
export interface PomFile {
    manifestPath: string;
    scan: PomScan;
}

/**
 * One Maven module as the release wave sees it. `owner` is the pom whose text
 * holds the version literal this module's release rewrites: the module itself
 * (`literal`), its parent (`inherited`), or the pom declaring its `${property}`
 * (`property`, with `property` set to the name).
 */
export interface MavenProject {
    kind: "inherited" | "literal" | "property";
    manifestPath: string;
    name: string;
    owner: string;
    package: WorkspacePackage;
    property?: string;
}

const PROPERTY_REF = /^\$\{([^}]+)\}$/;

const readOptional = async (path: string): Promise<string | undefined> => {
    try {
        return await readFile(path, "utf8");
    } catch {
        return undefined;
    }
};

const readPom = async (manifestPath: string): Promise<PomFile | undefined> => {
    const raw = await readOptional(manifestPath);

    return raw === undefined ? undefined : { manifestPath, scan: scanPom(raw) };
};

/** The parent pom a `&lt;parent>` block points at, accepted only when its coordinates match the block. */
const loadParent = async (pom: PomFile): Promise<PomFile | undefined> => {
    const block = pom.scan.parent;

    if (!block) {
        return undefined;
    }

    const relativePath = block.relativePath || "../pom.xml";
    const path = relativePath.endsWith(".xml") ? resolve(dirname(pom.manifestPath), relativePath) : resolve(dirname(pom.manifestPath), relativePath, "pom.xml");
    const parent = await readPom(path);

    if (!parent) {
        return undefined;
    }

    const matches = parent.scan.artifactId?.value === block.artifactId?.value && effectiveGroupId(parent.scan) === block.groupId?.value;

    return matches ? parent : undefined;
};

interface ResolvedVersion {
    kind: "inherited" | "literal" | "property";
    owner: string;
    property?: string;
    version: string;
}

const invalid = (file: string, message: string): VisReleaseError => new VisReleaseError({ code: "CONFIG_INVALID", file, message });

/**
 * The version of a pom and the place it is written. A literal `&lt;version>` is
 * the pom's own. `${name}` is looked up in its `&lt;properties>`, then each
 * ancestor's. No own version means the parent's, followed up the chain.
 */
const resolveVersion = async (pom: PomFile, seen: ReadonlySet<string> = new Set()): Promise<ResolvedVersion> => {
    const { manifestPath, scan } = pom;

    if (seen.has(manifestPath)) {
        throw invalid(manifestPath, `${manifestPath} is part of a parent cycle; vis cannot resolve its version.`);
    }

    if (!scan.version) {
        const parent = await loadParent(pom);

        if (!parent) {
            throw invalid(manifestPath, `${manifestPath} has no <version>, and its <parent> is not a pom on disk with matching coordinates.`);
        }

        const inherited = await resolveVersion(parent, new Set([...seen, manifestPath]));

        return inherited.kind === "literal" ? { ...inherited, kind: "inherited" } : inherited;
    }

    const literal = scan.version.value;
    const property = PROPERTY_REF.exec(literal)?.[1];

    if (property === undefined) {
        if (literal === "" || isPropertyReference(literal)) {
            throw invalid(manifestPath, `${manifestPath} has an unresolvable <version> "${literal}".`);
        }

        return { kind: "literal", owner: manifestPath, version: literal };
    }

    let current: PomFile | undefined = pom;
    const visited = new Set<string>();

    while (current && !visited.has(current.manifestPath)) {
        visited.add(current.manifestPath);

        const slot = current.scan.properties.get(property);

        if (slot !== undefined) {
            if (slot.value === "" || isPropertyReference(slot.value)) {
                break;
            }

            return { kind: "property", owner: current.manifestPath, property, version: slot.value };
        }

        current = await loadParent(current);
    }

    throw invalid(manifestPath, `${manifestPath} has version \${${property}}, but no literal <properties> entry ${property} in it or its parents.`);
};

/**
 * Discover the Maven modules under `cwd` as release packages. Walks the root
 * pom's `&lt;modules>` recursively. Returns nothing without a root `pom.xml`.
 * `options.claimedDirs` are module directories a JS package already releases
 * (its `pomPath`, or an `extraFiles` rule on a pom.xml). They are skipped as
 * packages, but their own modules are still walked.
 */
export const discoverMavenProjects = async (options: { claimedDirs: ReadonlySet<string>; cwd: string }): Promise<MavenProject[]> => {
    const { claimedDirs, cwd } = options;
    const root = await readPom(resolve(cwd, "pom.xml"));

    if (!root) {
        return [];
    }

    // Depth-first over <modules>, root first. A module listed twice is read once.
    const poms: PomFile[] = [];
    const visited = new Set<string>();

    const walk = async (pom: PomFile): Promise<void> => {
        if (visited.has(pom.manifestPath)) {
            return;
        }

        visited.add(pom.manifestPath);
        poms.push(pom);

        for (const module of pom.scan.modules) {
            const manifestPath = resolve(dirname(pom.manifestPath), module, "pom.xml");
            const child = await readPom(manifestPath);

            if (!child) {
                throw invalid(pom.manifestPath, `${pom.manifestPath} lists module "${module}", but ${manifestPath} does not exist.`);
            }

            await walk(child);
        }
    };

    await walk(root);

    const modules: { name: string; pom: PomFile; version: ResolvedVersion }[] = [];

    for (const pom of poms) {
        if (claimedDirs.has(resolve(dirname(pom.manifestPath)))) {
            continue;
        }

        const groupId = effectiveGroupId(pom.scan);
        const artifactId = pom.scan.artifactId?.value;

        if (groupId === undefined) {
            throw invalid(pom.manifestPath, `${pom.manifestPath} has no groupId, and its <parent> does not supply one.`);
        }

        if (artifactId === undefined || artifactId === "") {
            throw invalid(pom.manifestPath, `${pom.manifestPath} has no <artifactId>.`);
        }

        modules.push({ name: `${groupId}:${artifactId}`, pom, version: await resolveVersion(pom) });
    }

    // Only edges to discovered modules count. A dependency on a property version
    // follows that property, so it is "*" and never bumps on its own.
    const names = new Set(modules.map((module) => module.name));

    return modules.map(({ name, pom, version }) => {
        const dependencies: Record<string, string> = {};

        for (const dependency of pom.scan.dependencies) {
            const target = dependencyName(pom.scan, dependency);
            const declared = dependency.version?.value;

            if (target !== undefined && declared !== undefined && names.has(target)) {
                dependencies[target] = isPinned(declared) ? declared : "*";
            }
        }

        const manifest: PackageManifest = { dependencies, name, private: false, version: version.version };

        return {
            kind: version.kind,
            manifestPath: pom.manifestPath,
            name,
            owner: version.owner,
            package: {
                dir: dirname(pom.manifestPath),
                ecosystem: "maven",
                manifest,
                manifestPath: pom.manifestPath,
                name,
                private: false,
                version: version.version,
            },
            ...(version.property === undefined ? {} : { property: version.property }),
        };
    });
};
