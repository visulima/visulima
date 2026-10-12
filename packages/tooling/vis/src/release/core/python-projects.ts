/**
 * Python projects as release packages, opt-in through `release.python.discover`.
 *
 * The root `pyproject.toml` (when it has `[project]`) and every directory listed
 * in `[tool.uv.workspace].members` (minus `exclude`) become `WorkspacePackage`s
 * with `ecosystem: "python"`. Their `manifest` is synthetic and carries only what
 * the dependency graph needs: name, version, private, and workspace dependencies.
 * The manifest is never serialized into `pyproject.toml`.
 */

import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { VisReleaseError } from "../errors";
import type { PackageManifest, WorkspacePackage } from "../types";
import { expandMember } from "./member-glob";

interface PyDoc {
    project?: { classifiers?: unknown; dependencies?: unknown; dynamic?: unknown; name?: unknown; version?: unknown };
    tool?: { uv?: { sources?: Record<string, unknown>; workspace?: { exclude?: unknown; members?: unknown } } };
}

const PRIVATE_CLASSIFIER = "Private :: Do Not Upload";

/** PEP 503 name normalization: lowercase, runs of `-_.` become one `-`. */
export const normalizePythonName = (name: string): string => name.toLowerCase().replaceAll(/[-_.]+/g, "-");

const stringList = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []);

const readOptional = async (path: string): Promise<string | undefined> => {
    try {
        return await readFile(path, "utf8");
    } catch {
        return undefined;
    }
};

export const parsePyproject = async (raw: string, manifestPath: string): Promise<PyDoc> => {
    const { parse } = await import("smol-toml");

    try {
        return parse(raw);
    } catch (error) {
        throw new VisReleaseError({
            cause: error,
            code: "CONFIG_INVALID",
            file: manifestPath,
            message: `Failed to parse ${manifestPath}: ${(error as Error).message}`,
        });
    }
};

/** A PEP 508 requirement split into its project name and the rest (specifier, markers). */
export const splitRequirement = (requirement: string): { name: string; specifier: string } | undefined => {
    const match = /^\s*([A-Z0-9](?:[\w.-]*[A-Z0-9])?)\s*(?:\[[^\]]*\])?\s*(.*?)\s*$/i.exec(requirement);

    if (!match) {
        return undefined;
    }

    // Markers (`; python_version < "3.8"`) are not part of the specifier.
    const specifier = (match[2] ?? "").split(";")[0]!.trim();

    return { name: match[1]!, specifier };
};

interface ParsedProject {
    dir: string;
    doc: PyDoc;
    manifestPath: string;
    name: string;
    private: boolean;
    version: string;
}

/**
 * Discover the Python projects under `cwd` as release packages.
 * Returns nothing without a root `pyproject.toml`. A dynamic or missing version
 * is an error, not a silent skip: an opted-in project that cannot be versioned
 * would otherwise ship unreleased.
 * `options.claimedDirs` are project directories a JS package already releases.
 */
export const discoverPythonProjects = async (options: { claimedDirs: ReadonlySet<string>; cwd: string }): Promise<WorkspacePackage[]> => {
    const { claimedDirs, cwd } = options;
    const rootManifest = join(cwd, "pyproject.toml");
    const rootRaw = await readOptional(rootManifest);

    if (rootRaw === undefined) {
        return [];
    }

    const root = await parsePyproject(rootRaw, rootManifest);
    const dirs = new Set<string>();

    if (root.project) {
        dirs.add(cwd);
    }

    const excludes = stringList(root.tool?.uv?.workspace?.exclude);

    for (const pattern of stringList(root.tool?.uv?.workspace?.members)) {
        for (const dir of await expandMember(cwd, pattern)) {
            const rel = dir.slice(cwd.length + 1).split("\\").join("/");

            if (excludes.includes(rel)) {
                continue;
            }

            dirs.add(resolve(dir));
        }
    }

    const projects: ParsedProject[] = [];

    for (const dir of [...dirs].sort()) {
        if (claimedDirs.has(dir)) {
            continue;
        }

        const manifestPath = join(dir, "pyproject.toml");
        const raw = await readOptional(manifestPath);

        if (raw === undefined) {
            continue;
        }

        const doc = await parsePyproject(raw, manifestPath);

        // No [project] table: a uv workspace root that only groups members.
        if (!doc.project) {
            continue;
        }

        const { dynamic, name, version } = doc.project;

        if (typeof name !== "string" || name === "") {
            throw new VisReleaseError({ code: "CONFIG_INVALID", file: manifestPath, message: `${manifestPath} has no [project].name.` });
        }

        if (typeof version !== "string") {
            const reason = stringList(dynamic).includes("version") ? "a dynamic version" : "no [project].version";

            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                file: manifestPath,
                message: `${manifestPath} has ${reason}; vis can only release a literal version. Pin it in pyproject.toml or leave the project out of release.python.`,
            });
        }

        projects.push({
            dir,
            doc,
            manifestPath,
            name,
            private: stringList(doc.project.classifiers).includes(PRIVATE_CLASSIFIER),
            version,
        });
    }

    // uv marks a workspace dependency with `[tool.uv.sources] name = { workspace = true }`.
    // Only those edges are ours to bump; a plain dependency on PyPI is not.
    const byNormalized = new Map(projects.map((project) => [normalizePythonName(project.name), project.name]));

    return projects.map((project) => {
        const dependencies: Record<string, string> = {};
        const sources = project.doc.tool?.uv?.sources ?? {};

        for (const requirement of stringList(project.doc.project?.dependencies)) {
            const parts = splitRequirement(requirement);

            if (!parts) {
                continue;
            }

            const normalized = normalizePythonName(parts.name);
            const source = sources[parts.name] ?? sources[normalized];
            const declaredName = byNormalized.get(normalized);

            if (declaredName !== undefined && typeof source === "object" && source !== null && (source as { workspace?: unknown }).workspace === true) {
                dependencies[declaredName] = parts.specifier === "" ? "*" : parts.specifier;
            }
        }

        const manifest: PackageManifest = { dependencies, name: project.name, private: project.private, version: project.version };

        return {
            dir: project.dir,
            ecosystem: "python",
            manifest,
            manifestPath: project.manifestPath,
            name: project.name,
            private: project.private,
            version: project.version,
        };
    });
};
