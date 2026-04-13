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
 *   tuples, JSON with trailing commas. ✅
 *
 * The `sha{256,384,512}-<base64>` SRI values are decoded once here into
 * `{ algorithm, hex }` pairs.
 */

import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";

import { findUp, findUpSync } from "@visulima/fs";

/** Lockfiles the parser recognises. Legacy binary `bun.lockb` is unsupported. */
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
     * Declared runtime dependencies — `name → specifier` map. Specifiers
     * are whatever the lockfile recorded (often a range like `^1.0.0`
     * for npm/yarn/bun, but pnpm stores already-resolved exact versions).
     * Callers resolve the specifier against {@link LockFileEntry.version}
     * values elsewhere in the lockfile when they need a concrete edge.
     */
    dependencies?: Record<string, string>;
    /** Decoded SRI digest, if the lockfile recorded one. */
    integrity?: LockFileIntegrity;
    /** Package name — `lodash` or `@scope/name`. */
    name: string;
    /** Declared optional dependencies, same shape as `dependencies`. */
    optionalDependencies?: Record<string, string>;
    /** Declared peer dependencies, same shape as `dependencies`. */
    peerDependencies?: Record<string, string>;
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

/**
 * Decodes a Subresource Integrity string (`sha512-<base64>`) into a
 * `{ algorithm, hex }` pair. Returns `undefined` if the string is
 * malformed, oversized, or uses an unsupported algorithm.
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

    try {
        const buffer = Buffer.from(sri.slice(dashIndex + 1), "base64");

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
    source: Record<string, string> | undefined,
): void => {
    if (source && Object.keys(source).length > 0) {
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

/** Parses `package-lock.json` v2/v3. */
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

        // eslint-disable-next-line sonarjs/slow-regex
        const match = /.*node_modules\/((?:@[^/]+\/)?[^/]+)$/.exec(path);

        if (!match?.[1]) {
            continue;
        }

        const name = entry.name ?? match[1];

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

        copyDepMap(lockEntry, "dependencies", entry.dependencies);
        copyDepMap(lockEntry, "peerDependencies", entry.peerDependencies);
        copyDepMap(lockEntry, "optionalDependencies", entry.optionalDependencies);

        pushUniqueEntry(result, seen, lockEntry);
    }

    return result;
};

interface PnpmPackageKey {
    name: string;
    version: string;
}

const splitPnpmPackageKey = (raw: string): PnpmPackageKey | undefined => {
    let key = raw.trim();

    if (key.startsWith("/")) {
        key = key.slice(1);
    }

    key = key.replace(/^['"]/, "").replace(/['"]$/, "");

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

/** Parses `pnpm-lock.yaml` (regex-based, works for lockfile v6-v9). */
export const parsePnpmLockFile = (content: string): LockFileEntry[] => {
    const result: LockFileEntry[] = [];
    const seen = new Set<string>();

    const packagesSectionMatch = /^packages:\s*$/m.exec(content);

    if (!packagesSectionMatch) {
        return result;
    }

    const packagesStart = packagesSectionMatch.index + packagesSectionMatch[0].length;
    // The packages section runs to the next top-level key, or EOF.
    const nextSectionMatch = /^[a-z][a-zA-Z0-9]*:\s*$/m.exec(content.slice(packagesStart));
    const packagesEnd = nextSectionMatch ? packagesStart + nextSectionMatch.index : content.length;
    const packagesBody = content.slice(packagesStart, packagesEnd);

    // eslint-disable-next-line sonarjs/slow-regex, regexp/no-super-linear-backtracking
    const entryRegex = /^ {2}(['"]?[^\s:][^:\n]*?['"]?):\s*\n((?: {4,}[^\n]*\n?)+)/gm;
    let match: RegExpExecArray | undefined;

    // eslint-disable-next-line no-cond-assign
    while ((match = entryRegex.exec(packagesBody) ?? undefined) !== undefined) {
        const keyValue = splitPnpmPackageKey(match[1] as string);

        if (!keyValue) {
            continue;
        }

        const body = match[2] as string;
        // eslint-disable-next-line sonarjs/slow-regex
        const integrityMatch = /resolution:\s*\{[^}]*integrity:\s*([^,}\s]+)/m.exec(body);

        const lockEntry: LockFileEntry = { name: keyValue.name, version: keyValue.version };

        if (integrityMatch?.[1]) {
            const integrity = decodeSriIntegrity(integrityMatch[1]);

            if (integrity) {
                lockEntry.integrity = integrity;
            }
        }

        copyDepMap(lockEntry, "dependencies", extractPnpmDependencyMap(body, "dependencies"));
        copyDepMap(lockEntry, "peerDependencies", extractPnpmDependencyMap(body, "peerDependencies"));
        copyDepMap(lockEntry, "optionalDependencies", extractPnpmDependencyMap(body, "optionalDependencies"));

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
): Record<string, string> | undefined => {
    // Package bodies are indented 4 spaces; each section header is at that
    // depth, and its entries are indented 6 spaces. We match the header,
    // capture the block that follows, and stop at the next section header
    // or a line with less indentation.
    const sectionRegex = new RegExp(`^ {4}${section}:\\s*\\n((?: {6,}[^\\n]*\\n?)+)`, "m");
    const sectionMatch = sectionRegex.exec(body);

    if (!sectionMatch?.[1]) {
        return undefined;
    }

    const map: Record<string, string> = {};
    // Entries: `      name: version` or `      '@scope/name': version`.
    // Version can be a plain semver, a dist-tag reference, or carry a peer
    // disambiguator like `1.2.3(peer@4.0.0)` — we keep the base version.
    // eslint-disable-next-line sonarjs/slow-regex
    const entryRegex = /^ {6}(['"]?[^\s:]+['"]?):\s*([^\n]+)/gm;
    let match: RegExpExecArray | undefined;

    // eslint-disable-next-line no-cond-assign
    while ((match = entryRegex.exec(sectionMatch[1]) ?? undefined) !== undefined) {
        const name = (match[1] as string).replace(/^['"]/, "").replace(/['"]$/, "");
        let version = (match[2] as string).trim();

        // Strip quoting and any peer disambiguator.
        version = version.replace(/^['"]/, "").replace(/['"]$/, "");

        const parenIndex = version.indexOf("(");

        if (parenIndex > 0) {
            version = version.slice(0, parenIndex).trim();
        }

        if (name && version) {
            map[name] = version;
        }
    }

    return Object.keys(map).length > 0 ? map : undefined;
};

/**
 * Parses `yarn.lock` for Yarn Classic (v1) and Berry (v2+). Berry's
 * XXH64 `checksum:` is not a cryptographic hash and is intentionally
 * dropped; only v1's SRI `integrity:` flows through to
 * {@link LockFileEntry.integrity}.
 */
export const parseYarnLockFile = (content: string): LockFileEntry[] => {
    const result: LockFileEntry[] = [];
    const seen = new Set<string>();

    /* eslint-disable sonarjs/slow-regex, sonarjs/regex-complexity, regexp/no-super-linear-backtracking */
    const entryRegex
        = /^["']?((?:@[^/@"']+\/)?[^@"'\n]+)@[^"'\n]+["']?:?[\t\v\f\r \u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]*\n((?:[\t ]+[^\n]*\n?)+)/gm;
    /* eslint-enable sonarjs/slow-regex, sonarjs/regex-complexity, regexp/no-super-linear-backtracking */
    let match: RegExpExecArray | undefined;

    // eslint-disable-next-line no-cond-assign
    while ((match = entryRegex.exec(content) ?? undefined) !== undefined) {
        const name = (match[1] as string).replace(/^['"]/, "").replace(/['"]$/, "");

        if (!name) {
            continue;
        }

        const body = match[2] as string;
        const versionMatch = /^\s+version:?\s+"?([^"\n]+)"?/m.exec(body);

        if (!versionMatch?.[1]) {
            continue;
        }

        const lockEntry: LockFileEntry = { name, version: versionMatch[1].trim() };
        const integrityMatch = /^\s+integrity[\s:]+"?([^"\s]+)"?/m.exec(body);

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
): Record<string, string> | undefined => {
    const sectionRegex = new RegExp(`^ {2}${section}:\\s*\\n((?: {4,}[^\\n]*\\n?)+)`, "m");
    const sectionMatch = sectionRegex.exec(body);

    if (!sectionMatch?.[1]) {
        return undefined;
    }

    const map: Record<string, string> = {};
    // Matches both `    name "value"` (v1) and `    "name": "value"` (Berry):
    //   - optional quotes around the key
    //   - optional colon + whitespace between key and value
    //   - required quoted value
    // eslint-disable-next-line sonarjs/slow-regex
    const entryRegex = /^ {4}(['"]?[^\s:'"]+['"]?)\s*:?\s*['"]([^'"\n]+)['"]/gm;
    let match: RegExpExecArray | undefined;

    // eslint-disable-next-line no-cond-assign
    while ((match = entryRegex.exec(sectionMatch[1]) ?? undefined) !== undefined) {
        const name = (match[1] as string).replace(/^['"]/, "").replace(/['"]$/, "");
        const version = match[2] as string;

        if (name && version) {
            map[name] = version;
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
 * binary `bun.lockb` format is not supported.
 *
 * Attribution: format + tuple layout verified against lockparse
 * (https://github.com/43081j/lockparse, MIT).
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
            const meta = metadata as Partial<Pick<LockFileEntry, "dependencies" | "optionalDependencies" | "peerDependencies">>;

            copyDepMap(lockEntry, "dependencies", meta.dependencies);
            copyDepMap(lockEntry, "peerDependencies", meta.peerDependencies);
            copyDepMap(lockEntry, "optionalDependencies", meta.optionalDependencies);
        }

        pushUniqueEntry(result, seen, lockEntry);
    }

    return result;
};

const inferLockFileType = (path: string): LockFileType | undefined => {
    if (path.endsWith("pnpm-lock.yaml")) {
        return "pnpm";
    }

    if (path.endsWith("package-lock.json")) {
        return "npm";
    }

    if (path.endsWith("yarn.lock")) {
        return "yarn";
    }

    if (path.endsWith("bun.lock")) {
        return "bun";
    }

    return undefined;
};

/**
 * Parses raw lockfile content of the given type. Returns an empty
 * array if the content is malformed or doesn't contain any package
 * entries.
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

const LOCKFILE_CANDIDATES = ["pnpm-lock.yaml", "package-lock.json", "yarn.lock", "bun.lock"];

/**
 * Walks up from `cwd`, locates the nearest supported lockfile, reads
 * it, and returns the parsed entries alongside the lockfile type and
 * absolute path.
 *
 * @throws If no supported lockfile can be found above `cwd`.
 */
export const parseLockFile = async (cwd?: URL | string): Promise<LockFileParseResult> => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call -- findUp types unresolvable from bundled workspace package
    const path: string | undefined = await findUp(LOCKFILE_CANDIDATES, {
        type: "file",
        ...cwd && { cwd },
    });

    if (!path) {
        throw new Error("Could not find a supported lock file (pnpm-lock.yaml, package-lock.json, yarn.lock, bun.lock)");
    }

    const type = inferLockFileType(path);

    if (!type) {
        throw new Error(`Unsupported lock file: ${path}`);
    }

    const content = await readFile(path, "utf8");

    return { entries: parseLockFileContent(content, type), path, type };
};

/** Synchronous counterpart to {@link parseLockFile}. */
export const parseLockFileSync = (cwd?: URL | string): LockFileParseResult => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call -- findUpSync types unresolvable from bundled workspace package
    const path: string | undefined = findUpSync(LOCKFILE_CANDIDATES, {
        type: "file",
        ...cwd && { cwd },
    });

    if (!path) {
        throw new Error("Could not find a supported lock file (pnpm-lock.yaml, package-lock.json, yarn.lock, bun.lock)");
    }

    const type = inferLockFileType(path);

    if (!type) {
        throw new Error(`Unsupported lock file: ${path}`);
    }

    return { entries: parseLockFileContent(readFileSync(path, "utf8"), type), path, type };
};
