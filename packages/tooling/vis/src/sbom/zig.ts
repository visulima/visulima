/**
 * Zig dependencies for the BOM, read from the `.dependencies` of each `build.zig.zon` the root
 * reaches (the root manifest and its in-workspace `.path` packages). Zig has no lock file with
 * versions, so this is a flat list with no edges, like the other flat readers in `flat.ts`.
 *
 * A `.url` dependency is a component named by its host and path. Its version is set only when
 * the URL is a tag archive (`.../archive/refs/tags/TAG.tar.gz`, or `.zip`/`.tgz`), and then the
 * leading `v` is dropped. Any other URL (a commit archive, a `git+` URL) has no version, and the
 * component says so in its properties. A `.path` dependency is named by its directory, with no
 * version. `.hash` is a SHA-256 only in the legacy multihash form (`1220` + 64 hex). The current
 * form (`name-version-hashplus`) holds a truncated digest and a package id, so it is kept as a
 * property, not as a hash.
 *
 * A manifest that does not parse, or a dependency with neither `.url` nor `.path`, fails `vis sbom`
 * with the reason. A BOM that quietly leaves out a package it could not read would look complete.
 * The release side refuses the same manifest with `CONFIG_INVALID` when `release.zig.discover` is on.
 * Refs and the `vis:zig:path` property are relative to the workspace, so the BOM holds no
 * absolute path.
 */

import { basename, relative, resolve } from "node:path";

import { VisUserError } from "../errors/vis-user-error";
import type { ZigDependency } from "../util/zig-manifest";
import { readIfExists, walkZigManifests, ZigManifestError } from "../util/zig-manifest";
import type { Component, Dependency, ExternalReference, Hash, Property } from "./types";

const TAG_ARCHIVE = /^(?<repo>\/.+?)\/archive\/refs\/tags\/(?<tag>.+)\.(?:tar\.gz|tgz|zip)$/;
const LEGACY_MULTIHASH_SHA256 = /^1220([0-9a-f]{64})$/i;

const VERSION_PROPERTY = "vis:zig:version";
const HASH_PROPERTY = "vis:zig:hash";
const PATH_PROPERTY = "vis:zig:path";

/** Components and flat dependency entries for the Zig packages of the workspace. */
export const buildZigSbomParts = (workspaceRoot: string): { components: Component[]; dependencies: Dependency[] } => {
    const components = new Map<string, Component>();

    try {
        for (const node of walkZigManifests(workspaceRoot, workspaceRoot, readIfExists)) {
            for (const dependency of node.manifest.dependencies) {
                const key = dependencyKey(dependency, node.dir, node.path, workspaceRoot);

                if (!components.has(key)) {
                    components.set(key, toComponent(dependency, node.dir, node.path, workspaceRoot, key));
                }
            }
        }
    } catch (error) {
        if (error instanceof ZigManifestError) {
            throw new VisUserError(error.message);
        }

        throw error;
    }

    const sorted = [...components.values()].sort((a, b) => (a["bom-ref"] ?? "").localeCompare(b["bom-ref"] ?? ""));

    return {
        components: sorted,
        dependencies: sorted.map((component) => { return { ref: component["bom-ref"] ?? "" }; }),
    };
};

/** Identity of a dependency across manifests: the URL, or the resolved directory for a `.path`. */
const dependencyKey = (dependency: ZigDependency, dir: string, manifestPath: string, workspaceRoot: string): string => {
    if (dependency.url !== undefined) {
        return `url:${dependency.url}`;
    }

    if (dependency.path !== undefined) {
        return `path:${relative(workspaceRoot, resolve(dir, dependency.path))}`;
    }

    throw new ZigManifestError(manifestPath, `${manifestPath} line ${String(dependency.line)}: dependency .${dependency.name} has neither .url nor .path.`);
};

const toComponent = (dependency: ZigDependency, dir: string, manifestPath: string, workspaceRoot: string, key: string): Component => {
    const bomRef = `zig:${key}`;

    if (dependency.url === undefined) {
        const target = resolve(dir, dependency.path ?? "");
        const name = basename(target);

        return {
            "bom-ref": bomRef,
            name,
            properties: [
                { name: VERSION_PROPERTY, value: "unversioned: local path dependency" },
                { name: PATH_PROPERTY, value: relative(workspaceRoot, target) },
            ],
            purl: `pkg:generic/${encodeURIComponent(name)}`,
            type: "library",
        };
    }

    const { name, purl, tag } = describeUrl(dependency.url, manifestPath);
    const properties: Property[] = [];
    const hashes: Hash[] = [];

    if (tag === undefined) {
        properties.push({ name: VERSION_PROPERTY, value: "unversioned: URL is not a tag archive" });
    }

    if (dependency.hash !== undefined) {
        const legacy = LEGACY_MULTIHASH_SHA256.exec(dependency.hash);

        if (legacy?.[1] === undefined) {
            properties.push({ name: HASH_PROPERTY, value: dependency.hash });
        } else {
            hashes.push({ alg: "SHA-256", content: legacy[1].toLowerCase() });
        }
    }

    const externalReferences: ExternalReference[] = [{ type: "distribution", url: dependency.url }];

    return {
        "bom-ref": bomRef,
        externalReferences,
        hashes: hashes.length > 0 ? hashes : undefined,
        name,
        properties: properties.length > 0 ? properties : undefined,
        purl,
        type: "library",
        version: tag === undefined ? undefined : tag.replace(/^v/, ""),
    };
};

interface UrlDescription {
    name: string;
    purl: string;
    /** The tag as written in the URL, or undefined when the URL is not a tag archive. */
    tag: string | undefined;
}

/**
 * Name and purl for a `.url`. A `git+` prefix and a `#fragment` are not part of the package
 * identity. A GitHub URL becomes `pkg:github` (purl-spec defines the type); any other URL becomes
 * `pkg:generic` with the URL as `download_url`. The purl version is the tag exactly as written.
 */
const describeUrl = (raw: string, manifestPath: string): UrlDescription => {
    let url: URL;

    try {
        url = new URL(raw.startsWith("git+") ? raw.slice("git+".length) : raw);
    } catch {
        throw new ZigManifestError(manifestPath, `${manifestPath}: dependency URL "${raw}" is not a valid URL.`);
    }

    const tagMatch = TAG_ARCHIVE.exec(url.pathname);
    const tag = tagMatch?.groups?.tag;
    const repoPath = (tagMatch?.groups?.repo ?? url.pathname.replace(/\/archive\/.*$/, "")).replace(/\.git$/, "");
    const name = `${url.host}${repoPath}`;
    const segments = repoPath.split("/").filter((segment) => segment !== "");
    const version = tag === undefined ? "" : `@${encodeURIComponent(tag)}`;

    if (url.hostname === "github.com" && segments.length === 2) {
        const [owner, repo] = segments as [string, string];

        return { name, purl: `pkg:github/${owner.toLowerCase()}/${repo.toLowerCase()}${version}`, tag };
    }

    return { name, purl: `pkg:generic/${encodeURIComponent(name)}${version}?download_url=${encodeURIComponent(raw)}`, tag };
};
