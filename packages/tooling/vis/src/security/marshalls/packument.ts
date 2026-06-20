/**
 * Shared packument fetcher + on-disk cache for marshalls that need to
 * inspect npm metadata (author, signatures, provenance, new-bin, metadata,
 * archived-repo). Every marshall in items 1–8 reads through `getPackument`
 * so the registry is hit at most once per `vis add` / `vis update` /
 * `vis inspect` invocation, regardless of how many marshalls run.
 *
 * Layout: `&lt;getVisCacheDir()>/packuments/&lt;encodeURIComponent(name)>.json`
 * containing `{ createdAt, ttlMs, packument }`. Default TTL is 30 minutes.
 *
 * Cached packuments are **stripped** to the fields marshalls consume —
 * `react`/`lodash` packuments can exceed 5 MB on disk, most of which is
 * historical readme/changelog text we never read. We keep:
 *
 *   - top-level: `name`, `dist-tags`, `time`, `readme`
 *   - per-version: `version`, `_npmUser`, `maintainers`, `bin`, `scripts`,
 *     `dist.{signatures,attestations,integrity,tarball}`,
 *     `repository`, `license`, `readme`, `readmeFilename`, `private`,
 *     `deprecated`
 *
 * That subset is enough to power every marshall sections 1–8 describe.
 */

/* eslint-disable no-underscore-dangle -- `_npmUser` is the npm registry field name. */

import { readdirSync, rmSync, writeFileSync } from "node:fs";

import { ensureDirSync, isAccessibleSync, readJsonSync } from "@visulima/fs";
import { join } from "@visulima/path";
import { maxSatisfying } from "semver";

import { getVisCacheDir } from "../../util/vis-paths";

/** A single maintainer entry — both `_npmUser` and `maintainers[*]` share this shape. */
export interface PackumentMaintainer {
    email?: string;
    name?: string;
}

export interface PackumentDist {
    /** sigstore-style provenance bundle. We only check presence (item 4). */
    attestations?: { provenance?: unknown };
    /** Number of files in the published tarball (npm registry `dist.fileCount`). */
    fileCount?: number;
    integrity?: string;
    /** ECDSA P-256 signatures from npm's signing keys (item 3). */
    signatures?: { keyid: string; sig: string }[];
    tarball?: string;
    /** Unpacked install footprint in bytes (npm registry `dist.unpackedSize`). */
    unpackedSize?: number;
}

export interface PackumentVersionEntry {
    _npmUser?: PackumentMaintainer;
    bin?: Record<string, string> | string;
    /** When the publisher marked the version deprecated. Empty string = not deprecated; npm sets it as a non-empty string when active. */
    deprecated?: string;
    dist?: PackumentDist;
    license?: string | { type: string; url?: string };
    maintainers?: PackumentMaintainer[];
    private?: boolean;
    readme?: string;
    readmeFilename?: string;
    repository?: { directory?: string; type?: string; url?: string };
    /** Lifecycle scripts from the published package.json — only the install hooks are read (s1ngularity marshall). */
    scripts?: Record<string, string>;
    version: string;
}

export interface Packument {
    "dist-tags"?: Record<string, string>;
    name: string;
    readme?: string;
    /** ISO timestamps keyed by version (plus `created` / `modified`). */
    time?: Record<string, string>;
    versions: Record<string, PackumentVersionEntry>;
}

interface PackumentCacheEntry {
    /** Stripped-packument schema version. A mismatch invalidates the entry (see {@link PACKUMENT_CACHE_VERSION}). */
    cacheVersion: number;
    createdAt: number;
    packument: Packument;
    ttlMs: number;
}

/**
 * Bump whenever {@link stripPackument} starts retaining (or stops retaining)
 * a field a marshall reads. A stale on-disk entry written by an older binary
 * would otherwise be served for up to its TTL with the new field missing —
 * e.g. a pre-`scripts` entry silently blinding the s1ngularity marshall.
 * v2: added per-version `scripts` retention.
 * v3: added per-version `dist.unpackedSize` / `dist.fileCount` retention
 *     (dlx first-run install-footprint panel).
 */
const PACKUMENT_CACHE_VERSION = 3;

export interface GetPackumentOptions {
    authToken?: string;
    cacheTtlMs?: number;
    /** Cache-only mode: never hit the network — return undefined on a cache miss. */
    offline?: boolean;
    registryUrl?: string;
    signal?: AbortSignal;
    /** Workspace root used to resolve `.npmrc` for registry overrides + auth. */
    workspaceRoot?: string;
}

const DEFAULT_TTL_MS = 30 * 60 * 1000;
const DEFAULT_FETCH_TIMEOUT_MS = 15_000;

const getPackumentCacheDir = (): string => join(getVisCacheDir(), "packuments");

const cacheFilePath = (name: string): string => join(getPackumentCacheDir(), `${encodeURIComponent(name)}.json`);

/** Read cached packument and validate TTL; returns undefined on miss/expired/corrupt. */
const readCached = (name: string): Packument | undefined => {
    const filePath = cacheFilePath(name);

    if (!isAccessibleSync(filePath)) {
        return undefined;
    }

    try {
        const entry = readJsonSync(filePath) as unknown as PackumentCacheEntry;

        if (entry.cacheVersion !== PACKUMENT_CACHE_VERSION) {
            rmSync(filePath, { force: true });

            return undefined;
        }

        if (Date.now() - entry.createdAt > entry.ttlMs) {
            rmSync(filePath, { force: true });

            return undefined;
        }

        return entry.packument;
    } catch {
        // Corrupt entry — drop it and refetch.
        rmSync(filePath, { force: true });

        return undefined;
    }
};

const writeCached = (name: string, packument: Packument, ttlMs: number): void => {
    ensureDirSync(getPackumentCacheDir());

    const entry: PackumentCacheEntry = {
        cacheVersion: PACKUMENT_CACHE_VERSION,
        createdAt: Date.now(),
        packument,
        ttlMs,
    };

    writeFileSync(cacheFilePath(name), JSON.stringify(entry), "utf8");
};

/**
 * Strip the registry packument to the fields marshalls actually read.
 * Drops historical readme/changelog text that bloats `react`/`lodash`
 * packuments well past 5 MB on disk. Unknown fields are dropped silently.
 */
const stripPackument = (raw: Record<string, unknown>): Packument => {
    const versions: Record<string, PackumentVersionEntry> = {};
    const rawVersions = (raw.versions ?? {}) as Record<string, Record<string, unknown>>;

    for (const [version, entry] of Object.entries(rawVersions)) {
        const dist = entry.dist as Record<string, unknown> | undefined;
        const stripped: PackumentVersionEntry = { version };

        if (entry._npmUser !== undefined) {
            stripped._npmUser = entry._npmUser as PackumentMaintainer;
        }

        if (entry.maintainers !== undefined) {
            stripped.maintainers = entry.maintainers as PackumentMaintainer[];
        }

        if (entry.bin !== undefined) {
            stripped.bin = entry.bin as PackumentVersionEntry["bin"];
        }

        if (dist !== undefined) {
            const trimmedDist: PackumentDist = {};

            if (dist.signatures !== undefined) {
                trimmedDist.signatures = dist.signatures as PackumentDist["signatures"];
            }

            if (dist.attestations !== undefined) {
                trimmedDist.attestations = dist.attestations as PackumentDist["attestations"];
            }

            if (typeof dist.integrity === "string") {
                trimmedDist.integrity = dist.integrity;
            }

            if (typeof dist.tarball === "string") {
                trimmedDist.tarball = dist.tarball;
            }

            if (typeof dist.unpackedSize === "number" && Number.isFinite(dist.unpackedSize) && dist.unpackedSize >= 0) {
                trimmedDist.unpackedSize = dist.unpackedSize;
            }

            if (typeof dist.fileCount === "number" && Number.isInteger(dist.fileCount) && dist.fileCount >= 0) {
                trimmedDist.fileCount = dist.fileCount;
            }

            stripped.dist = trimmedDist;
        }

        if (entry.repository !== undefined) {
            stripped.repository = entry.repository as PackumentVersionEntry["repository"];
        }

        if (entry.license !== undefined) {
            stripped.license = entry.license as PackumentVersionEntry["license"];
        }

        if (typeof entry.readme === "string") {
            stripped.readme = entry.readme;
        }

        if (typeof entry.readmeFilename === "string") {
            stripped.readmeFilename = entry.readmeFilename;
        }

        if (typeof entry.private === "boolean") {
            stripped.private = entry.private;
        }

        if (typeof entry.deprecated === "string") {
            stripped.deprecated = entry.deprecated;
        }

        if (entry.scripts !== undefined && typeof entry.scripts === "object") {
            stripped.scripts = entry.scripts as Record<string, string>;
        }

        versions[version] = stripped;
    }

    const result: Packument = {
        name: typeof raw.name === "string" ? raw.name : "",
        versions,
    };

    if (raw["dist-tags"] !== undefined) {
        result["dist-tags"] = raw["dist-tags"] as Record<string, string>;
    }

    if (raw.time !== undefined) {
        result.time = raw.time as Record<string, string>;
    }

    if (typeof raw.readme === "string") {
        result.readme = raw.readme;
    }

    return result;
};

const buildHeaders = (authToken: string | undefined): Record<string, string> => {
    // Full packument (not abbreviated) — abbreviated drops `_npmUser`, `time`,
    // `maintainers`, `readme`, `repository`, `license` which are critical for marshalls.
    const headers: Record<string, string> = { Accept: "application/json" };

    if (authToken !== undefined && authToken !== "") {
        headers["Authorization"] = `Bearer ${authToken}`;
    }

    return headers;
};

const resolveRegistry = async (name: string, options: GetPackumentOptions): Promise<{ authToken?: string; url: string }> => {
    if (options.registryUrl !== undefined) {
        return { authToken: options.authToken, url: options.registryUrl };
    }

    if (options.workspaceRoot !== undefined) {
        // Defer the import to avoid pulling catalog → editorconfig → native binding into
        // every consumer of this module. Marshalls only need .npmrc resolution when
        // running against a real workspace; unit tests typically stub fetch and pass
        // neither workspaceRoot nor registryUrl.
        const { getRegistryForPackage, loadNpmrc } = await import("../../util/catalog");
        const npmrc = loadNpmrc(options.workspaceRoot);
        const { token, url } = getRegistryForPackage(name, npmrc);

        return { authToken: options.authToken ?? token, url };
    }

    return { authToken: options.authToken, url: "https://registry.npmjs.org" };
};

/**
 * Fetch and cache a registry packument for a single package.
 *
 * Returns the stripped packument, or `undefined` when the registry returns
 * 404 (no such package). Throws on transport / 5xx errors so callers can
 * decide whether to soft-fail or block — most marshalls degrade to a
 * warning, matching `socket-security.ts`'s "errors are visible but not
 * fatal" UX.
 * @param name Package name (scoped names like `@scope/pkg` are accepted as-is).
 */
export const getPackument = async (name: string, options: GetPackumentOptions = {}): Promise<Packument | undefined> => {
    const ttlMs = options.cacheTtlMs ?? DEFAULT_TTL_MS;
    const cached = readCached(name);

    if (cached !== undefined) {
        return cached;
    }

    // Cache-only mode: a miss must not fall through to a network fetch.
    if (options.offline) {
        return undefined;
    }

    const registry = await resolveRegistry(name, options);
    const baseUrl = registry.url.endsWith("/") ? registry.url.slice(0, -1) : registry.url;
    const url = `${baseUrl}/${name.replace("/", "%2f")}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => {
        controller.abort();
    }, DEFAULT_FETCH_TIMEOUT_MS);

    // Propagate caller-supplied abort.
    const abortListener = (): void => {
        controller.abort();
    };

    options.signal?.addEventListener("abort", abortListener, { once: true });

    try {
        const response = await fetch(url, { headers: buildHeaders(registry.authToken), signal: controller.signal });

        if (response.status === 404) {
            return undefined;
        }

        if (!response.ok) {
            throw new Error(`Registry returned ${String(response.status)} for ${name}`);
        }

        const raw = (await response.json()) as Record<string, unknown>;
        const stripped = stripPackument(raw);

        writeCached(name, stripped, ttlMs);

        return stripped;
    } finally {
        clearTimeout(timeout);
        options.signal?.removeEventListener("abort", abortListener);
    }
};

/**
 * Resolve a semver range (or dist-tag, or exact version, or `undefined`)
 * against a packument. Returns the highest satisfying version, or
 * `undefined` if nothing matches.
 *
 * Semver resolution intentionally lives here rather than in each marshall
 * — marshalls receive `name@version` from the resolver pipeline, but the
 * `vis inspect` command needs to take a user-typed spec and resolve it
 * itself.
 */
export const resolveVersionRange = (packument: Packument, spec: string | undefined): string | undefined => {
    const versions = Object.keys(packument.versions);

    if (versions.length === 0) {
        return undefined;
    }

    if (spec === undefined || spec === "" || spec === "latest") {
        return packument["dist-tags"]?.latest ?? versions.at(-1);
    }

    // dist-tag (e.g. "next", "beta")
    const distTag = packument["dist-tags"]?.[spec];

    if (distTag !== undefined) {
        return distTag;
    }

    // Exact version match
    if (Object.hasOwn(packument.versions, spec)) {
        return spec;
    }

    return maxSatisfying(versions, spec) ?? undefined;
};

/**
 * Remove every entry from the packument cache. Returns the number of
 * files removed. Used by `vis cache clean --packuments` (documented as a
 * mitigation for large packument caches; see plan §Risks).
 */
export const clearPackumentCache = (): number => {
    const directory = getPackumentCacheDir();

    if (!isAccessibleSync(directory)) {
        return 0;
    }

    let removed = 0;

    for (const entry of readdirSync(directory)) {
        if (entry.endsWith(".json")) {
            rmSync(join(directory, entry), { force: true });
            removed += 1;
        }
    }

    return removed;
};
