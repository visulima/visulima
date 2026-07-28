/* eslint-disable import/exports-last, @typescript-eslint/no-use-before-define, sonarjs/cognitive-complexity, sonarjs/use-type-alias, jsdoc/check-indentation */

/**
 * Lockfile parser covering all four mainstream JS package managers.
 *
 * Returns `{ name, version, integrity?, dependencies?, … }` entries so
 * callers can build SBOMs, dedupe reports, or any other lockfile-derived
 * artifact from a single source of truth. The parser is regex-based
 * (no YAML dependency) and captures each entry's SRI integrity digest
 * where the lockfile records one.
 *
 * Integrity support:
 *
 * - **npm** (`package-lock.json` v2/v3): `integrity: "sha512-…"` ✅
 * - **pnpm** (`pnpm-lock.yaml`): `resolution: { integrity: "sha512-…" }` ✅
 * - **yarn v1** (Classic): `integrity "sha512-…"` ✅
 * - **yarn v2+** (Berry): emits `checksum: 10c0/…` (XXH64). **Not
 *   supported** — XXH64 is not a cryptographic hash and is outside the
 *   CycloneDX 1.6 `HashAlgorithm` enum. Berry entries are still parsed
 *   (name / version / dependencies), but `integrity` will be `undefined`.
 * - **bun** (`bun.lock`): `[versionKey, registryUrl, metadata, integrity]`
 *   tuples, JSON with trailing commas. ✅ The legacy binary lockfile
 *   (`bun.lockb`) is recognised by type inference, but its binary
 *   contents cannot be parsed — `parseBunLockFile` yields no entries.
 *
 * The `sha{256,384,512}-&lt;base64>` SRI values are decoded once here into
 * `{ algorithm, hex }` pairs.
 */

import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";

import { findUp, findUpSync } from "@visulima/fs";

import { LOCKFILE_CANDIDATES as SHARED_LOCKFILE_CANDIDATES } from "./utils/lockfile-candidates";

/**
 * Lockfiles the parser recognises. Both the modern text `bun.lock` and the
 * legacy binary `bun.lockb` map to the `bun` type, but only `bun.lock`
 * content is parseable — `bun.lockb` is a binary format and yields no entries.
 */
export type LockFileType = "bun" | "npm" | "pnpm" | "yarn";

/** SRI algorithms the parser can decode into hex. */
export type LockFileIntegrityAlgorithm = "sha256" | "sha384" | "sha512";

/** Decoded integrity digest: algorithm + lowercase hex string. */
export interface LockFileIntegrity {
    algorithm: LockFileIntegrityAlgorithm;
    hex: string;
}

/** A single resolved package extracted from a lockfile. */
export interface LockFileEntry {
    /**
     * Declared runtime dependencies — `name → specifier[]` map. Values
     * are arrays so pnpm v9+ peer-context variants (the same dep name
     * resolved to different versions under different peer contexts)
     * can all be preserved. npm, yarn v1, bun, and pnpm v6-v8 always
     * produce single-element arrays; pnpm v9+ may produce multi-element
     * arrays for peer-context-sensitive deps.
     *
     * Specifiers are whatever the lockfile recorded — a range
     * (`^1.0.0`) for npm / yarn / bun, or an already-resolved exact
     * version for pnpm. Callers resolve each specifier against
     * {@link LockFileEntry.version} values elsewhere in the lockfile
     * when they need a concrete edge.
     */
    dependencies?: Record<string, string[]>;
    /** Decoded SRI digest, if the lockfile recorded one. */
    integrity?: LockFileIntegrity;
    /** Package name — `lodash` or `@scope/name`. */
    name: string;
    /** Declared optional dependencies, same shape as `dependencies`. */
    optionalDependencies?: Record<string, string[]>;
    /** Declared peer dependencies, same shape as `dependencies`. */
    peerDependencies?: Record<string, string[]>;
    /** Resolved exact version — e.g. `4.17.21`. */
    version: string;
}

/** Result of locating + parsing a lockfile on disk. */
export interface LockFileParseResult {
    entries: LockFileEntry[];
    /** Absolute path of the lockfile that was parsed. */
    path: string;
    type: LockFileType;
}

const INTEGRITY_ALGORITHMS: Record<string, LockFileIntegrityAlgorithm> = {
    sha256: "sha256",
    sha384: "sha384",
    sha512: "sha512",
};

// Reject oversized inputs rather than hand Buffer.from a pathological
// allocation. SHA-512 SRI is 95 bytes; 1 KiB leaves headroom for
// multi-hash forms without opening a DoS surface.
const MAX_SRI_LENGTH = 1024;

// Strict RFC 4648 base64 alphabet (standard, not URL-safe), with
// optional `=` padding. `Buffer.from("…", "base64")` silently discards
// characters outside the alphabet, so a garbage payload like
// `sha512-abc!def` would decode to the bytes of `abcdef` — we'd emit a
// hash that doesn't match the lockfile content. Validate up front.
const BASE64_PAYLOAD = /^[A-Z0-9+/]+={0,2}$/i;

const NODE_MODULES_SEGMENT = "node_modules/";
const QUOTE_PREFIX = /^['"]/;
const QUOTE_SUFFIX = /['"]$/;
const PNPM_SECTION_HEADER = /^[a-z][a-zA-Z0-9]*:\s*$/m;
const PNPM_INTEGRITY = /resolution:\s*\{[^}]*integrity:\s*([^,}\s]+)/;

const YARN_BLOCK
    // eslint-disable-next-line sonarjs/slow-regex -- linear yarn.lock block parser (no super-linear backtracking)
    = /^["']?((?:@[^/@"']+\/)?[^@"'\n]+)@[^\n]+\n((?:[\t ][^\n]*(?:\n|$))+)/gm;
// eslint-disable-next-line sonarjs/slow-regex
const YARN_VERSION = /^\s+version:?\s+"?([^"\n]+)"?/m;
// eslint-disable-next-line sonarjs/slow-regex
const YARN_INTEGRITY = /^\s+integrity[\s:]+"?([^"\s]+)"?/m;

/**
 * Decodes a Subresource Integrity string (`sha512-&lt;base64>`) into a
 * `{ algorithm, hex }` pair. Returns `undefined` if the string is
 * malformed, oversized, or uses an unsupported algorithm.
 * @param sri Full SRI string, e.g. `sha512-&lt;base64>`.
 * @returns Decoded algorithm + hex digest, or `undefined` when the
 * input can't be parsed.
 */
export const decodeSriIntegrity = (sri: string): LockFileIntegrity | undefined => {
    if (sri.length > MAX_SRI_LENGTH) {
        return undefined;
    }

    const dashIndex = sri.indexOf("-");

    if (dashIndex <= 0) {
        return undefined;
    }

    const algorithm = INTEGRITY_ALGORITHMS[sri.slice(0, dashIndex).toLowerCase()];

    if (!algorithm) {
        return undefined;
    }

    const payload = sri.slice(dashIndex + 1);

    if (!BASE64_PAYLOAD.test(payload)) {
        return undefined;
    }

    try {
        const buffer = Buffer.from(payload, "base64");

        if (buffer.length === 0) {
            return undefined;
        }

        return { algorithm, hex: buffer.toString("hex") };
    } catch {
        return undefined;
    }
};

/**
 * Pushes an entry into `result` unless `seen` already contains its
 * `name@version` key. `seen` is mutated in place.
 */
const pushUniqueEntry = (result: LockFileEntry[], seen: Set<string>, entry: LockFileEntry): void => {
    const key = `${entry.name}@${entry.version}`;

    if (seen.has(key)) {
        return;
    }

    seen.add(key);
    result.push(entry);
};

/** Shallow-copy `source` onto `target` under `field` iff `source` is non-empty. */
const copyDepMap = (
    target: LockFileEntry,
    field: "dependencies" | "optionalDependencies" | "peerDependencies",
    source: Record<string, string[]> | undefined,
): void => {
    if (source && Object.keys(source).length > 0) {
        // eslint-disable-next-line no-param-reassign
        target[field] = { ...source };
    }
};

interface NpmPackageManifest {
    dependencies?: Record<string, string>;
    integrity?: string;
    name?: string;
    optionalDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    version?: string;
}

/**
 * Lifts a single-resolution dep-map from a package.json-shaped source
 * (`Record&lt;string, string>`) into our array-valued shape. Used by npm,
 * yarn v1, and bun — all of which record one resolution per name per
 * parent.
 */
const liftDepMap = (source: Record<string, string> | undefined): Record<string, string[]> | undefined => {
    if (!source) {
        return undefined;
    }

    const result: Record<string, string[]> = {};

    for (const [name, value] of Object.entries(source)) {
        result[name] = [value];
    }

    return Object.keys(result).length > 0 ? result : undefined;
};

/**
 * Parses `package-lock.json` (npm v2 / v3 format).
 * @param content Raw JSON text of the lockfile.
 * @returns One {@link LockFileEntry} per distinct `name@version`.
 */
export const parseNpmLockFile = (content: string): LockFileEntry[] => {
    const result: LockFileEntry[] = [];
    const seen = new Set<string>();

    let parsed: { packages?: Record<string, NpmPackageManifest> };

    try {
        parsed = JSON.parse(content) as typeof parsed;
    } catch {
        return result;
    }

    if (!parsed.packages) {
        return result;
    }

    for (const [path, entry] of Object.entries(parsed.packages)) {
        if (!path || !entry.version) {
            continue;
        }

        // Linear equivalent of /.*node_modules\/((?:@[^/]+\/)?[^/]+)$/ — slice after the
        // last `node_modules/` and accept only a bare `name` or `@scope/name` tail.
        const lastIndex = path.lastIndexOf(NODE_MODULES_SEGMENT);

        if (lastIndex === -1) {
            continue;
        }

        const tail = path.slice(lastIndex + NODE_MODULES_SEGMENT.length);

        if (tail.length === 0) {
            continue;
        }

        const segments = tail.split("/");
        const expectedSegments = tail.startsWith("@") ? 2 : 1;

        if (segments.length !== expectedSegments || segments.some((segment) => segment.length === 0)) {
            continue;
        }

        const name = entry.name ?? tail;

        if (name.startsWith(".")) {
            continue;
        }

        const lockEntry: LockFileEntry = { name, version: entry.version };

        if (entry.integrity) {
            const integrity = decodeSriIntegrity(entry.integrity);

            if (integrity) {
                lockEntry.integrity = integrity;
            }
        }

        copyDepMap(lockEntry, "dependencies", liftDepMap(entry.dependencies));
        copyDepMap(lockEntry, "peerDependencies", liftDepMap(entry.peerDependencies));
        copyDepMap(lockEntry, "optionalDependencies", liftDepMap(entry.optionalDependencies));

        pushUniqueEntry(result, seen, lockEntry);
    }

    return result;
};

interface PnpmPackageKey {
    name: string;
    version: string;
}

/**
 * Parses a pnpm package key (e.g. `/foo@1.2.3`, `foo@1.2.3`,
 * `'@scope/name@1.0.0(peer@4.0.0)'`) into its base `{ name, version }`.
 * Returns `undefined` for workspace / link / file references that have
 * no meaningful version, and strips any `(peer@…)` disambiguator.
 */
const splitPnpmPackageKey = (raw: string): PnpmPackageKey | undefined => {
    let key = raw.trim();

    if (key.startsWith("/")) {
        key = key.slice(1);
    }

    key = key.replace(QUOTE_PREFIX, "").replace(QUOTE_SUFFIX, "");

    // Drop peer disambiguators like `(react@18.0.0)`.
    const parenIndex = key.indexOf("(");

    if (parenIndex > 0) {
        key = key.slice(0, parenIndex);
    }

    const atIndex = key.lastIndexOf("@");

    if (atIndex <= 0) {
        return undefined;
    }

    const name = key.slice(0, atIndex);
    const version = key.slice(atIndex + 1);

    if (!name || !version || version.startsWith("link:") || version.startsWith("workspace:") || version.startsWith("file:")) {
        return undefined;
    }

    return { name, version };
};

/**
 * Extracts the body of a named top-level pnpm YAML section
 * (e.g. `packages:` or `snapshots:`). Returns the indented sub-text or
 * `undefined` if the section isn't present. Matches are anchored so a
 * trailing `packagesExtra:` key won't false-match.
 */
const sliceTopLevelSection = (content: string, section: string): string | undefined => {
    const header = new RegExp(String.raw`^${section}:\s*$`, "m");
    const start = header.exec(content);

    if (!start) {
        return undefined;
    }

    const after = start.index + start[0].length;
    const next = PNPM_SECTION_HEADER.exec(content.slice(after));

    return content.slice(after, next ? after + next.index : content.length);
};

/**
 * Accumulated dep-maps scraped from the `snapshots:` section and keyed
 * by base `name@version` (peer suffixes stripped from the key). In
 * pnpm v9+ the concrete resolved dependency edges live here, not in
 * `packages:`.
 *
 * Each dep-name's value is an **array** of resolved specifiers so
 * conflicting per-peer-context resolutions are preserved — e.g.
 * `react-dom@18.2.0(react@17)` resolving `react: 17.0.2` and
 * `react-dom@18.2.0(react@18)` resolving `react: 18.0.0` both survive
 * the merge instead of one clobbering the other.
 */
interface SnapshotDepEdges {
    dependencies?: Record<string, string[]>;
    optionalDependencies?: Record<string, string[]>;
    peerDependencies?: Record<string, string[]>;
}

/**
 * Parses a pnpm `snapshots:` section (pnpm lockfile v9+). Each entry
 * key may carry a peer-context disambiguator (`foo@1.0.0(react@18.0.0)`);
 * we strip the disambiguator from the key AND from every dependency
 * value, then union dep-maps across all peer variants of the same base
 * `name@version`. The CycloneDX SBOM shape deliberately collapses
 * peer-context variants into one component, so callers see a single
 * merged edge set per base install rather than per-context slices.
 */
const parsePnpmSnapshotEdges = (content: string): Map<string, SnapshotDepEdges> => {
    const result = new Map<string, SnapshotDepEdges>();
    const body = sliceTopLevelSection(content, "snapshots");

    if (!body) {
        return result;
    }

    // Snapshot entries can be empty (`foo@1.0.0: {}`) or indented. We only
    // care about indented bodies — empty bodies have no deps to extract.

    const entryRegex = /^ {2}(['"]?[^\s:][^:\n]*?['"]?):\s*\n((?: {4}[^\n]*\n?)+)/gm;
    let match: RegExpExecArray | undefined;

    // eslint-disable-next-line no-cond-assign
    while ((match = entryRegex.exec(body) ?? undefined) !== undefined) {
        const keyValue = splitPnpmPackageKey(match[1] as string);

        if (!keyValue) {
            continue;
        }

        const baseKey = `${keyValue.name}@${keyValue.version}`;
        const entryBody = match[2] as string;
        const existing = result.get(baseKey) ?? {};

        for (const field of ["dependencies", "peerDependencies", "optionalDependencies"] as const) {
            const scraped = extractPnpmDependencyMap(entryBody, field);

            if (!scraped) {
                continue;
            }

            const merged = existing[field] ?? {};

            // Push unique versions: a spread-merge would overwrite conflicting
            // peer-context resolutions (e.g. `react-dom(react@17)` emitting
            // `react: 17.0.2` and `react-dom(react@18)` emitting `react: 18.0.0`
            // would collapse to one). The array-valued shape keeps both.
            for (const [depName, depVersions] of Object.entries(scraped)) {
                const bucket = merged[depName] ?? [];

                for (const depVersion of depVersions) {
                    if (!bucket.includes(depVersion)) {
                        bucket.push(depVersion);
                    }
                }

                merged[depName] = bucket;
            }

            existing[field] = merged;
        }

        result.set(baseKey, existing);
    }

    return result;
};

/**
 * Parses `pnpm-lock.yaml`. Regex-based; works for lockfile v6 through
 * v9. v9 moves concrete resolved dependency versions out of `packages:`
 * and into `snapshots:`; this parser reads both sections and unions
 * their dep-maps onto the final entry.
 * @param content Raw YAML text of the lockfile.
 * @returns One {@link LockFileEntry} per distinct `name@version`.
 */
export const parsePnpmLockFile = (content: string): LockFileEntry[] => {
    const result: LockFileEntry[] = [];
    const seen = new Set<string>();
    const packagesBody = sliceTopLevelSection(content, "packages");

    if (!packagesBody) {
        return result;
    }

    const snapshotEdges = parsePnpmSnapshotEdges(content);

    const entryRegex = /^ {2}(['"]?[^\s:][^:\n]*?['"]?):\s*\n((?: {4}[^\n]*\n?)+)/gm;
    let match: RegExpExecArray | undefined;

    // eslint-disable-next-line no-cond-assign
    while ((match = entryRegex.exec(packagesBody) ?? undefined) !== undefined) {
        const keyValue = splitPnpmPackageKey(match[1] as string);

        if (!keyValue) {
            continue;
        }

        const body = match[2] as string;

        const integrityMatch = PNPM_INTEGRITY.exec(body); // regex match

        const lockEntry: LockFileEntry = { name: keyValue.name, version: keyValue.version };

        if (integrityMatch?.[1]) {
            const integrity = decodeSriIntegrity(integrityMatch[1]);

            if (integrity) {
                lockEntry.integrity = integrity;
            }
        }

        // v6-v8 inline the concrete deps under `packages:`; v9 moves them to
        // `snapshots:`. Fall back to the snapshot edges for v9 lockfiles
        // (the `packages:` parse is a no-op for those fields). When both
        // sections list deps for the same base key, the snapshot wins —
        // it carries the post-resolution edges.
        const snapshot = snapshotEdges.get(`${keyValue.name}@${keyValue.version}`);

        copyDepMap(lockEntry, "dependencies", snapshot?.dependencies ?? extractPnpmDependencyMap(body, "dependencies"));
        copyDepMap(lockEntry, "peerDependencies", snapshot?.peerDependencies ?? extractPnpmDependencyMap(body, "peerDependencies"));
        copyDepMap(lockEntry, "optionalDependencies", snapshot?.optionalDependencies ?? extractPnpmDependencyMap(body, "optionalDependencies"));

        pushUniqueEntry(result, seen, lockEntry);
    }

    return result;
};

/**
 * Extracts the `name → version` pairs from the named sub-section of
 * a pnpm package body. Returns `undefined` if the body doesn't have
 * the section.
 */
const extractPnpmDependencyMap = (
    body: string,
    section: "dependencies" | "optionalDependencies" | "peerDependencies",
): Record<string, string[]> | undefined => {
    // Package bodies are indented 4 spaces; each section header is at that
    // depth, and its entries are indented 6 spaces. We match the header,
    // capture the block that follows, and stop at the next section header
    // or a line with less indentation.
    const sectionRegex = new RegExp(String.raw`^ {4}${section}:\s*\n((?: {6,}[^\n]*\n?)+)`, "m");
    const sectionMatch = sectionRegex.exec(body);

    if (!sectionMatch?.[1]) {
        return undefined;
    }

    const map: Record<string, string[]> = {};
    // Entries: `      name: version` or `      '@scope/name': version`.
    // Version can be a plain semver, a dist-tag reference, or carry a peer
    // disambiguator like `1.2.3(peer@4.0.0)` — we keep the base version.

    const entryRegex = /^ {6}([^\s:]+):\s*([^\n]+)/gm;
    let match: RegExpExecArray | undefined;

    // eslint-disable-next-line no-cond-assign
    while ((match = entryRegex.exec(sectionMatch[1]) ?? undefined) !== undefined) {
        const name = (match[1] as string).replace(QUOTE_PREFIX, "").replace(QUOTE_SUFFIX, "");
        let version = (match[2] as string).trim();

        // Strip quoting and any peer disambiguator.
        version = version.replace(QUOTE_PREFIX, "").replace(QUOTE_SUFFIX, "");

        const parenIndex = version.indexOf("(");

        if (parenIndex > 0) {
            version = version.slice(0, parenIndex).trim();
        }

        if (!name || !version) {
            continue;
        }

        const bucket = map[name] ?? [];

        if (!bucket.includes(version)) {
            bucket.push(version);
        }

        map[name] = bucket;
    }

    return Object.keys(map).length > 0 ? map : undefined;
};

/**
 * Parses `yarn.lock` for Yarn Classic (v1) and Berry (v2+). Berry's
 * XXH64 `checksum:` is not a cryptographic hash and is intentionally
 * dropped; only v1's SRI `integrity:` flows through to
 * {@link LockFileEntry.integrity}.
 * @param content Raw text of the lockfile.
 * @returns One {@link LockFileEntry} per distinct `name@version`.
 */
export const parseYarnLockFile = (content: string): LockFileEntry[] => {
    const result: LockFileEntry[] = [];
    const seen = new Set<string>();

    const entryRegex = YARN_BLOCK;

    entryRegex.lastIndex = 0;
    let match: RegExpExecArray | undefined;

    // eslint-disable-next-line no-cond-assign
    while ((match = entryRegex.exec(content) ?? undefined) !== undefined) {
        const name = (match[1] as string).replace(QUOTE_PREFIX, "").replace(QUOTE_SUFFIX, "");

        if (!name) {
            continue;
        }

        const body = match[2] as string;
        const versionMatch = YARN_VERSION.exec(body); // regex match

        if (!versionMatch?.[1]) {
            continue;
        }

        const lockEntry: LockFileEntry = { name, version: versionMatch[1].trim() };
        const integrityMatch = YARN_INTEGRITY.exec(body); // regex match

        if (integrityMatch?.[1]) {
            const integrity = decodeSriIntegrity(integrityMatch[1]);

            if (integrity) {
                lockEntry.integrity = integrity;
            }
        }

        // Yarn Berry records an XXH64 `checksum:` instead of `integrity:`.
        // XXH64 isn't a cryptographic hash (CycloneDX 1.6's HashAlgorithm
        // enum doesn't include it), so Berry entries come out of the parser
        // with `integrity: undefined`. Callers that need Berry integrity
        // must read it from yarn.lock directly.

        copyDepMap(lockEntry, "dependencies", extractYarnDependencyMap(body, "dependencies"));
        copyDepMap(lockEntry, "peerDependencies", extractYarnDependencyMap(body, "peerDependencies"));
        copyDepMap(lockEntry, "optionalDependencies", extractYarnDependencyMap(body, "optionalDependencies"));

        pushUniqueEntry(result, seen, lockEntry);
    }

    return result;
};

/**
 * Extracts a yarn entry's `dependencies` / `peerDependencies` /
 * `optionalDependencies` sub-block. Supports both yarn layouts:
 *
 * - Yarn v1 (Classic): `    name "specifier"` (space-separated)
 * - Yarn Berry (v2+):  `    name: "npm:specifier"` (colon-separated,
 *   with an `npm:` protocol prefix on the range)
 *
 * Berry's `npm:`, `workspace:`, `file:`, `patch:` protocol prefixes
 * are retained verbatim in the captured specifier — callers (e.g.
 * `resolveSpecifier`) strip them before attempting semver matching.
 */
const extractYarnDependencyMap = (
    body: string,
    section: "dependencies" | "optionalDependencies" | "peerDependencies",
): Record<string, string[]> | undefined => {
    const sectionRegex = new RegExp(String.raw`^ {2}${section}:\s*\n((?: {4,}[^\n]*\n?)+)`, "m");
    const sectionMatch = sectionRegex.exec(body);

    if (!sectionMatch?.[1]) {
        return undefined;
    }

    const map: Record<string, string[]> = {};
    // Matches both `    name "value"` (v1) and `    "name": "value"` (Berry):
    //   - optional quotes around the key
    //   - optional colon + whitespace between key and value
    //   - required quoted value

    const entryRegex = /^ {4}(['"]?[^\s:'"]+['"]?)\s*(?::\s*)?['"]([^'"\n]+)['"]/gm;
    let match: RegExpExecArray | undefined;

    // eslint-disable-next-line no-cond-assign
    while ((match = entryRegex.exec(sectionMatch[1]) ?? undefined) !== undefined) {
        const name = (match[1] as string).replace(QUOTE_PREFIX, "").replace(QUOTE_SUFFIX, "");
        const version = match[2] as string;

        if (name && version) {
            const bucket = map[name] ?? [];

            if (!bucket.includes(version)) {
                bucket.push(version);
            }

            map[name] = bucket;
        }
    }

    return Object.keys(map).length > 0 ? map : undefined;
};

const TRAILING_COMMA_REGEX = /,(?=\s*[}\]])/g;

interface BunLockPackageTuple extends Array<unknown> {
    /** `name@version` string — always first. */
    0: string;
    /** Optional registry URL or metadata depending on the entry shape. */
    1?: unknown;
    /** Metadata object (dependencies, peer, etc.) for workspace-local refs. */
    2?: unknown;
    /** SRI integrity string — absent for workspace / link entries. */
    3?: string;
}

/**
 * Parses `bun.lock` (Bun v1.1+, JSON-ish with trailing commas). The
 * legacy binary `bun.lockb` format is recognised by {@link inferLockFileType}
 * but cannot be decoded here — feeding its binary contents in returns an
 * empty array (the `JSON.parse` fails and is swallowed).
 *
 * Attribution: format + tuple layout verified against lockparse
 * (https://github.com/43081j/lockparse, MIT).
 * @param content Raw text of the lockfile.
 * @returns One {@link LockFileEntry} per distinct `name@version`.
 */
export const parseBunLockFile = (content: string): LockFileEntry[] => {
    const result: LockFileEntry[] = [];
    const seen = new Set<string>();

    let parsed: {
        packages?: Record<string, BunLockPackageTuple>;
        workspaces?: Record<string, unknown>;
    };

    try {
        parsed = JSON.parse(content.replaceAll(TRAILING_COMMA_REGEX, "")) as typeof parsed;
    } catch {
        return result;
    }

    if (!parsed.packages) {
        return result;
    }

    for (const tuple of Object.values(parsed.packages)) {
        const versionKey = tuple[0];

        if (typeof versionKey !== "string") {
            continue;
        }

        // `name@version` — skip the leading `@` of scoped names.
        const atIndex = versionKey.indexOf("@", 1);

        if (atIndex <= 0) {
            continue;
        }

        const name = versionKey.slice(0, atIndex);
        const version = versionKey.slice(atIndex + 1);

        if (!name || !version || version.startsWith("workspace:") || version.startsWith("link:") || version.startsWith("file:")) {
            continue;
        }

        const lockEntry: LockFileEntry = { name, version };
        const rawIntegrity = tuple[3];

        if (typeof rawIntegrity === "string" && rawIntegrity.length > 0) {
            const integrity = decodeSriIntegrity(rawIntegrity);

            if (integrity) {
                lockEntry.integrity = integrity;
            }
        }

        const metadata = tuple[2];

        if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
            // bun stores the raw package.json-shaped dep maps (single-resolution
            // per name per parent) — lift into our array-valued shape.
            const meta = metadata as {
                dependencies?: Record<string, string>;
                optionalDependencies?: Record<string, string>;
                peerDependencies?: Record<string, string>;
            };

            copyDepMap(lockEntry, "dependencies", liftDepMap(meta.dependencies));
            copyDepMap(lockEntry, "peerDependencies", liftDepMap(meta.peerDependencies));
            copyDepMap(lockEntry, "optionalDependencies", liftDepMap(meta.optionalDependencies));
        }

        pushUniqueEntry(result, seen, lockEntry);
    }

    return result;
};

/**
 * Maps a lockfile path (or filename) to its {@link LockFileType}.
 * Returns `undefined` for unsupported shapes.
 *
 * `npm-shrinkwrap.json` shares `package-lock.json`'s JSON shape and resolves to
 * the `npm` type. Both the modern text `bun.lock` and the legacy binary `bun.lockb`
 * resolve to the `bun` type; only `bun.lock` content is parseable downstream.
 */
const inferLockFileType = (path: string): LockFileType | undefined => {
    if (path.endsWith("pnpm-lock.yaml")) {
        return "pnpm";
    }

    if (path.endsWith("package-lock.json") || path.endsWith("npm-shrinkwrap.json")) {
        return "npm";
    }

    if (path.endsWith("yarn.lock")) {
        return "yarn";
    }

    // `bun.lockb` is checked first because it does not share the `bun.lock`
    // suffix; ordering is informational only since both map to `bun`.
    if (path.endsWith("bun.lockb") || path.endsWith("bun.lock")) {
        return "bun";
    }

    return undefined;
};

/**
 * Parses raw lockfile content of the given type. Returns an empty
 * array if the content is malformed or doesn't contain any package
 * entries.
 * @param content Raw text of the lockfile.
 * @param type Which parser to dispatch to.
 * @returns One {@link LockFileEntry} per distinct `name@version`.
 */
export const parseLockFileContent = (content: string, type: LockFileType): LockFileEntry[] => {
    switch (type) {
        case "bun": {
            return parseBunLockFile(content);
        }
        case "npm": {
            return parseNpmLockFile(content);
        }
        case "pnpm": {
            return parsePnpmLockFile(content);
        }
        case "yarn": {
            return parseYarnLockFile(content);
        }
        default: {
            return [];
        }
    }
};

const LOCKFILE_CANDIDATES = [...SHARED_LOCKFILE_CANDIDATES];

/**
 * Walks up from `cwd`, locates the nearest supported lockfile, reads
 * it, and returns the parsed entries alongside the lockfile type and
 * absolute path.
 * @param cwd Directory to start the search from. Defaults to
 * `process.cwd()` (delegated to `findUp`).
 * @returns The parsed result, keyed by the discovered lockfile path.
 * @throws If no supported lockfile can be found above `cwd`.
 */
export const parseLockFile = async (cwd?: URL | string): Promise<LockFileParseResult> => {
    const path: string | undefined = await findUp(LOCKFILE_CANDIDATES, {
        type: "file",
        ...cwd && { cwd },
    });

    if (!path) {
        throw new Error("Could not find a supported lock file (pnpm-lock.yaml, package-lock.json, npm-shrinkwrap.json, yarn.lock, bun.lock)");
    }

    const type = inferLockFileType(path);

    if (!type) {
        throw new Error(`Unsupported lock file: ${path}`);
    }

    const content = await readFile(path, "utf8");

    return { entries: parseLockFileContent(content, type), path, type };
};

/**
 * Synchronous counterpart to {@link parseLockFile}.
 * @param cwd Directory to start the search from.
 * @returns The parsed result, keyed by the discovered lockfile path.
 * @throws If no supported lockfile can be found above `cwd`.
 */
export const parseLockFileSync = (cwd?: URL | string): LockFileParseResult => {
    const path: string | undefined = findUpSync(LOCKFILE_CANDIDATES, {
        type: "file",
        ...cwd && { cwd },
    });

    if (!path) {
        throw new Error("Could not find a supported lock file (pnpm-lock.yaml, package-lock.json, npm-shrinkwrap.json, yarn.lock, bun.lock)");
    }

    const type = inferLockFileType(path);

    if (!type) {
        throw new Error(`Unsupported lock file: ${path}`);
    }

    return { entries: parseLockFileContent(readFileSync(path, "utf8"), type), path, type };
};
