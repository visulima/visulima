/**
 * Lockfile parsing tuned for SBOM generation.
 *
 * Unlike `task-runner/src/lockfile-hasher.ts` — which only collects
 * `name` + `version` because it's optimised for XXH3 cache hashing —
 * this module also captures each package's **integrity digest** so it
 * can land on the emitted `Component.hashes` array.
 *
 * The three mainstream JS package managers encode integrity differently:
 *
 * - **pnpm** (`pnpm-lock.yaml`): under each `packages` key as
 *   `resolution: { integrity: "sha512-..." }`.
 * - **npm** (`package-lock.json`, v2/v3): under each `packages` entry as
 *   a top-level `integrity` field (same `sha512-...` encoding).
 * - **yarn** (`yarn.lock`): Yarn v1 uses `integrity "sha512-..."`,
 *   Yarn Berry uses `checksum: <64-hex>` (XXH64, not a crypto hash — we
 *   skip it because the CycloneDX schema only allows the algorithms in
 *   {@link HashAlgorithm}).
 *
 * The `sha512-...` / `sha384-...` / `sha256-...` values npm and pnpm
 * emit are **base64-encoded SRI strings**, not hex. CycloneDX requires
 * hex-encoded digests, so {@link sriToHexDigest} decodes the SRI and
 * re-encodes it as hex.
 */

import { readFileSync } from "node:fs";

import { join } from "@visulima/path";

import type { HashAlgorithm } from "./types";

/** A single resolved package extracted from the lockfile. */
export interface ResolvedPackage {
    /** SRI algorithm + hex-encoded digest, if the lockfile recorded one. */
    hash?: { alg: HashAlgorithm; content: string };
    /** Package name, e.g. `lodash` or `@scope/name`. */
    name: string;
    /** Resolved exact version, e.g. `4.17.21`. */
    version: string;
}

/** Supported lockfile formats. */
export type LockfileType = "npm" | "pnpm" | "yarn";

const SRI_ALG_MAP: Record<string, HashAlgorithm> = {
    sha256: "SHA-256",
    sha384: "SHA-384",
    sha512: "SHA-512",
};

/**
 * Decodes a Subresource Integrity string (`sha512-<base64>`) into a
 * `{ alg, hex }` pair. Returns `undefined` if the string is malformed
 * or uses an unsupported algorithm.
 */
export const sriToHexDigest = (sri: string): { alg: HashAlgorithm; content: string } | undefined => {
    const dashIndex = sri.indexOf("-");

    if (dashIndex <= 0) {
        return undefined;
    }

    const algKey = sri.slice(0, dashIndex).toLowerCase();
    const alg = SRI_ALG_MAP[algKey];

    if (!alg) {
        return undefined;
    }

    const base64 = sri.slice(dashIndex + 1);

    try {
        const buffer = Buffer.from(base64, "base64");

        if (buffer.length === 0) {
            return undefined;
        }

        return { alg, content: buffer.toString("hex") };
    } catch {
        return undefined;
    }
};

/**
 * Parses `package-lock.json` v2/v3. Each entry under `packages` is
 * keyed by its node_modules path. We take the first occurrence so the
 * top-level install wins over nested duplicates.
 */
export const parseNpmLockfile = (content: string): ResolvedPackage[] => {
    const result: ResolvedPackage[] = [];
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

        // Match the last `node_modules/...` segment.
        // eslint-disable-next-line sonarjs/slow-regex
        const match = /.*node_modules\/((?:@[^/]+\/)?[^/]+)$/.exec(path);

        if (!match?.[1]) {
            continue;
        }

        const name = entry.name ?? match[1];

        if (name.startsWith(".") || seen.has(name)) {
            continue;
        }

        seen.add(name);

        const pkg: ResolvedPackage = {
            name,
            version: entry.version,
        };

        if (entry.integrity) {
            const hash = sriToHexDigest(entry.integrity);

            if (hash) {
                pkg.hash = hash;
            }
        }

        result.push(pkg);
    }

    return result;
};

interface PnpmPackageKey {
    name: string;
    version: string;
}

/**
 * Splits a pnpm package key like `@scope/name@1.2.3(peer@4.0.0)` or
 * `lodash@4.17.21` into `{ name, version }`. Returns `undefined` for
 * workspace/link references.
 */
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

    // Split on the last `@` that isn't the leading scope delimiter.
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
 * Parses `pnpm-lock.yaml` for `packages:` entries with their
 * `resolution.integrity` field. Regex-based so we don't pull a YAML
 * parser in; the structure is stable across lockfile v6-v9.
 */
export const parsePnpmLockfile = (content: string): ResolvedPackage[] => {
    const result: ResolvedPackage[] = [];
    const seen = new Set<string>();

    const packagesSectionMatch = /^packages:\s*$/m.exec(content);

    if (!packagesSectionMatch) {
        return result;
    }

    const packagesStart = packagesSectionMatch.index + packagesSectionMatch[0].length;
    // The packages section runs to the next top-level key, or end of file.
    const nextSectionMatch = /^[a-z][a-zA-Z0-9]*:\s*$/m.exec(content.slice(packagesStart));
    const packagesEnd = nextSectionMatch ? packagesStart + nextSectionMatch.index : content.length;
    const packagesBody = content.slice(packagesStart, packagesEnd);

    // Each entry starts at column 2 (two-space indent) with a key + `:`.
    // eslint-disable-next-line sonarjs/slow-regex, regexp/no-super-linear-backtracking
    const entryRegex = /^ {2}(['"]?[^\s:][^:\n]*?['"]?):\s*\n((?: {4,}[^\n]*\n?)+)/gm;
    let match: RegExpExecArray | undefined;

    // eslint-disable-next-line no-cond-assign
    while ((match = entryRegex.exec(packagesBody) ?? undefined) !== undefined) {
        const keyValue = splitPnpmPackageKey(match[1] as string);

        if (!keyValue) {
            continue;
        }

        const { name, version } = keyValue;

        if (seen.has(name)) {
            continue;
        }

        seen.add(name);

        const body = match[2] as string;
        // eslint-disable-next-line sonarjs/slow-regex
        const integrityMatch = /resolution:\s*\{[^}]*integrity:\s*([^,}\s]+)/m.exec(body);

        const pkg: ResolvedPackage = { name, version };

        if (integrityMatch?.[1]) {
            const hash = sriToHexDigest(integrityMatch[1]);

            if (hash) {
                pkg.hash = hash;
            }
        }

        result.push(pkg);
    }

    return result;
};

/**
 * Parses `yarn.lock` (v1 Classic + Berry). Yarn Classic stores SRI
 * digests under `integrity "sha512-..."`; Berry uses `checksum:` which
 * is XXH64 and therefore unrepresentable in CycloneDX — we drop it.
 */
export const parseYarnLockfile = (content: string): ResolvedPackage[] => {
    const result: ResolvedPackage[] = [];
    const seen = new Set<string>();

    /* eslint-disable sonarjs/slow-regex, sonarjs/regex-complexity, regexp/no-super-linear-backtracking */
    const entryRegex
        = /^["']?((?:@[^/@"']+\/)?[^@"'\n]+)@[^"'\n]+["']?:?[\t\v\f\r \u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]*\n((?:[\t ]+[^\n]*\n?)+)/gm;
    /* eslint-enable sonarjs/slow-regex, sonarjs/regex-complexity, regexp/no-super-linear-backtracking */
    let match: RegExpExecArray | undefined;

    // eslint-disable-next-line no-cond-assign
    while ((match = entryRegex.exec(content) ?? undefined) !== undefined) {
        const name = (match[1] as string).replace(/^['"]/, "").replace(/['"]$/, "");

        if (!name || seen.has(name)) {
            continue;
        }

        const body = match[2] as string;
        const versionMatch = /^\s+version:?\s+"?([^"\n]+)"?/m.exec(body);

        if (!versionMatch?.[1]) {
            continue;
        }

        const version = versionMatch[1].trim();

        seen.add(name);

        const pkg: ResolvedPackage = { name, version };

        const integrityMatch = /^\s+integrity[\s:]+"?([^"\s]+)"?/m.exec(body);

        if (integrityMatch?.[1]) {
            const hash = sriToHexDigest(integrityMatch[1]);

            if (hash) {
                pkg.hash = hash;
            }
        }

        result.push(pkg);
    }

    return result;
};

/**
 * Detects which lockfile lives at the workspace root and parses it.
 * Returns `undefined` if no lockfile exists.
 */
export const readLockfilePackages = (
    workspaceRoot: string,
): { packages: Map<string, ResolvedPackage>; type: LockfileType } | undefined => {
    const candidates: { file: string; parse: (content: string) => ResolvedPackage[]; type: LockfileType }[] = [
        { file: "pnpm-lock.yaml", parse: parsePnpmLockfile, type: "pnpm" },
        { file: "package-lock.json", parse: parseNpmLockfile, type: "npm" },
        { file: "yarn.lock", parse: parseYarnLockfile, type: "yarn" },
    ];

    for (const { file, parse, type } of candidates) {
        let content: string;

        try {
            content = readFileSync(join(workspaceRoot, file), "utf8");
        } catch {
            continue;
        }

        const packages = new Map<string, ResolvedPackage>();

        for (const pkg of parse(content)) {
            // Key by `name@version` so multiple versions of the same package
            // each become their own component.
            packages.set(`${pkg.name}@${pkg.version}`, pkg);
        }

        return { packages, type };
    }

    return undefined;
};
