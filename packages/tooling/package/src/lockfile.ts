/**
 * Lockfile parser covering the three mainstream JS package managers.
 *
 * Returns `{ name, version, integrity? }` entries so callers can build
 * SBOMs, dedupe reports, or any other lockfile-derived artifact from a
 * single source of truth. The parser is regex-based (no YAML
 * dependency) and captures each entry's SRI integrity digest where the
 * lockfile records one.
 *
 * Integrity encoding across package managers:
 *
 * - **npm** (`package-lock.json` v2/v3) stores `integrity: "sha512-…"`
 *   as a top-level field on each `packages` entry.
 * - **pnpm** (`pnpm-lock.yaml`) stores
 *   `resolution: { integrity: "sha512-…" }` under each `packages` key.
 * - **yarn** (Yarn Classic / v1) stores `integrity "sha512-…"`. Yarn
 *   Berry's XXH64 `checksum:` field is skipped — it isn't a crypto
 *   digest and can't be translated into SRI form.
 *
 * The `sha{256,384,512}-<base64>` values npm and pnpm emit are
 * base64-encoded SRI strings. Callers receive a decoded
 * `{ algorithm, hex }` pair so the re-encoding is done once, here.
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
    /** Decoded SRI digest, if the lockfile recorded one. */
    integrity?: LockFileIntegrity;
    /** Package name — `lodash` or `@scope/name`. */
    name: string;
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

/**
 * Decodes a Subresource Integrity string (`sha512-<base64>`) into a
 * `{ algorithm, hex }` pair. Returns `undefined` if the string is
 * malformed or uses an unsupported algorithm.
 */
export const decodeSriIntegrity = (sri: string): LockFileIntegrity | undefined => {
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
 * `name@version` key. Returns `true` if pushed.
 */
const pushUniqueEntry = (result: LockFileEntry[], seen: Set<string>, entry: LockFileEntry): boolean => {
    const key = `${entry.name}@${entry.version}`;

    if (seen.has(key)) {
        return false;
    }

    seen.add(key);
    result.push(entry);

    return true;
};

/** Parses `package-lock.json` v2/v3. */
export const parseNpmLockFile = (content: string): LockFileEntry[] => {
    const result: LockFileEntry[] = [];
    const seen = new Set<string>();

    let parsed: {
        packages?: Record<string, { integrity?: string; name?: string; version?: string }>;
    };

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

        pushUniqueEntry(result, seen, lockEntry);
    }

    return result;
};

/** Parses `yarn.lock` (Yarn Classic / v1 + Berry; Berry checksums are skipped). */
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

        pushUniqueEntry(result, seen, lockEntry);
    }

    return result;
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

        pushUniqueEntry(result, seen, lockEntry);
    }

    return result;
};

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

const LOCKFILE_CANDIDATES = ["pnpm-lock.yaml", "package-lock.json", "npm-shrinkwrap.json", "yarn.lock", "bun.lock"];

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
        throw new Error("Could not find a supported lock file (pnpm-lock.yaml, package-lock.json, npm-shrinkwrap.json, yarn.lock)");
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
        throw new Error("Could not find a supported lock file (pnpm-lock.yaml, package-lock.json, npm-shrinkwrap.json, yarn.lock)");
    }

    const type = inferLockFileType(path);

    if (!type) {
        throw new Error(`Unsupported lock file: ${path}`);
    }

    return { entries: parseLockFileContent(readFileSync(path, "utf8"), type), path, type };
};
