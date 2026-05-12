/**
 * File-type classification used by `vis hook` (filter evaluation,
 * migration validation) and any other vis feature that needs to map a
 * path to `types:`-style tags.
 *
 * Two layers compose into a single result:
 *
 *   1. The upstream `prek-identify` universe (extensions, interpreters,
 *      filename patterns, executability, text/binary, ~311 tags). Mirrors
 *      pre-commit's classification exactly so that migrated configs keep
 *      their `types:` / `types_or:` / `exclude_types:` semantics.
 *
 *   2. A vis-specific overlay for files the pre-commit ecosystem doesn't
 *      know about (`vis-config`, `packem-config`, `ruleset`, monorepo
 *      package manifests, …). Lives entirely on the JS side — no Rust
 *      recompile to extend.
 *
 * The native layer is pinned via the ABI version constant; an outdated
 * `.node` file would silently misinterpret arguments, so we surface a
 * descriptive error at load time instead.
 */

import { basename } from "node:path";

import {
    allKnownTags,
    NATIVE_BINDING_VERSION,
    parseShebang as parseShebangNative,
    tagsFromPath as tagsFromPathNative,
    tagsFromPaths as tagsFromPathsNative,
} from "#native";

const EXPECTED_BINDING_VERSION = 3;

if (NATIVE_BINDING_VERSION !== EXPECTED_BINDING_VERSION) {
    throw new Error(
        `vis native binding ABI mismatch: expected ${EXPECTED_BINDING_VERSION}, got ${NATIVE_BINDING_VERSION}. `
        + "Rebuild via `pnpm --filter @visulima/vis run build:native` or reinstall the platform binding package.",
    );
}

export interface ClassifyResult {
    /** Union of both layers. The set filter evaluation queries against. */
    readonly all: ReadonlySet<string>;
    /** Upstream prek-identify tags. Closed universe; mirrors pre-commit. */
    readonly prek: ReadonlySet<string>;
    /** Vis-specific overlay tags. Open universe; extend via VIS_TAG_*. */
    readonly vis: ReadonlySet<string>;
}

export interface TypesFilter {
    /** None of the listed tags may be present. */
    excludeTypes?: ReadonlyArray<string>;
    /** All listed tags must be present. */
    types?: ReadonlyArray<string>;
    /** At least one listed tag must be present. */
    typesOr?: ReadonlyArray<string>;
}

// ---------- vis-specific overlay -----------------------------------------

/**
 * Exact filename → vis tag mapping. Matches `basename(path)` literally.
 * Add entries here for files the pre-commit ecosystem doesn't already
 * tag (avoid duplicating `Dockerfile`, `Makefile`, etc. — those are
 * covered by prek-identify).
 */
const VIS_FILENAME_TAGS: Readonly<Record<string, ReadonlyArray<string>>> = {
    ".releaserc": ["release-config", "vis-config"],
    ".releaserc.json": ["release-config", "vis-config"],
    "nx.json": ["nx-workspace", "vis-config"],
    "packem.config.js": ["packem-config", "vis-config"],
    "packem.config.mjs": ["packem-config", "vis-config"],
    "packem.config.ts": ["packem-config", "vis-config"],
    "pnpm-workspace.yaml": ["pnpm-workspace", "vis-config"],
    "project.json": ["nx-project", "vis-config"],
    "turbo.json": ["turbo-config", "vis-config"],
    "vis.config.js": ["vis-config"],
    "vis.config.ts": ["vis-config"],
};

/**
 * Suffix → vis tag mapping. Suffixes are matched against the full
 * basename (lowercased) to avoid an exhaustive filename table for
 * conventionally-named files.
 */
const VIS_SUFFIX_TAGS: ReadonlyArray<readonly [string, ReadonlyArray<string>]> = [[".releaserc.json", ["release-config", "vis-config"]]];

const classifyVis = (path: string): Set<string> => {
    const tags = new Set<string>();
    const name = basename(path);
    const direct = VIS_FILENAME_TAGS[name];

    if (direct) {
        for (const tag of direct) {
            tags.add(tag);
        }
    }

    const lower = name.toLowerCase();

    for (const [suffix, suffixTags] of VIS_SUFFIX_TAGS) {
        if (lower.endsWith(suffix)) {
            for (const tag of suffixTags) {
                tags.add(tag);
            }
        }
    }

    return tags;
};

/** The full vis tag universe — every tag any path in this repo could produce. */
const VIS_TAG_UNIVERSE: ReadonlySet<string> = new Set<string>([...Object.values(VIS_FILENAME_TAGS).flat(), ...VIS_SUFFIX_TAGS.flatMap(([, t]) => t)]);

// ---------- public API ---------------------------------------------------

let prekUniverse: Set<string> | undefined;

const getPrekUniverse = (): Set<string> => {
    if (!prekUniverse) {
        prekUniverse = new Set<string>(allKnownTags());
    }

    return prekUniverse;
};

/**
 * Classifies a single path. The native layer is consulted for the prek
 * layer; failures collapse to an empty prek set (the file may have been
 * deleted between staging and classification, for example).
 */
export const classify = (path: string): ClassifyResult => {
    const prek = new Set<string>(tagsFromPathNative(path));
    const vis = classifyVis(path);
    const all = new Set<string>([...prek, ...vis]);

    return { all, prek, vis };
};

/**
 * Batch classifier. Uses the native batch entrypoint so the FFI cost is
 * paid once per call instead of once per path.
 */
export const classifyMany = (paths: ReadonlyArray<string>): Map<string, ClassifyResult> => {
    const native = tagsFromPathsNative([...paths]);
    const out = new Map<string, ClassifyResult>();

    for (const [index, path] of paths.entries()) {
        const prek = new Set<string>(native[index]);
        const vis = classifyVis(path);
        const all = new Set<string>([...prek, ...vis]);

        out.set(path, { all, prek, vis });
    }

    return out;
};

export const parseShebang = (path: string): ReadonlyArray<string> => parseShebangNative(path);

/** True iff `tag` is recognised by either the prek universe or the vis overlay. */
export const isKnownTag = (tag: string): boolean => getPrekUniverse().has(tag) || VIS_TAG_UNIVERSE.has(tag);

export const isPrekTag = (tag: string): boolean => getPrekUniverse().has(tag);

export const isVisTag = (tag: string): boolean => VIS_TAG_UNIVERSE.has(tag);

/**
 * Evaluates a pre-commit-style filter against a classification.
 *
 * Semantics match pre-commit / prek:
 *   - `types`:        every listed tag must be in the file's tag set
 *   - `types_or`:     at least one listed tag must be in the set
 *   - `exclude_types`: no listed tag may be in the set
 *
 * Missing fields are treated as "no constraint" — an empty filter
 * matches every file.
 */
export const matchesFilter = (classification: ClassifyResult, filter: TypesFilter): boolean => {
    const { all } = classification;

    if (filter.types && filter.types.length > 0) {
        for (const tag of filter.types) {
            if (!all.has(tag)) {
                return false;
            }
        }
    }

    if (filter.typesOr && filter.typesOr.length > 0) {
        let matched = false;

        for (const tag of filter.typesOr) {
            if (all.has(tag)) {
                matched = true;

                break;
            }
        }

        if (!matched) {
            return false;
        }
    }

    if (filter.excludeTypes && filter.excludeTypes.length > 0) {
        for (const tag of filter.excludeTypes) {
            if (all.has(tag)) {
                return false;
            }
        }
    }

    return true;
};
