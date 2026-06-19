/* eslint-disable max-classes-per-file -- co-located error classes for the osv-bloom sync surface */

/**
 * JS adapter for the native osv-bloom prefilter (`osvBloomDecode` /
 * `osvBloomProbe` / `osvBloomProbeBatch`). Wraps:
 *
 * - HTTPS fetch of `manifest.json` (cheap, ~400 bytes) and `filter.bin`
 *   (~380 KB at current dataset size) from `endevco.github.io/osv-bloom`.
 * - `set_digest_sha256` short-circuit: when the manifest's set digest
 *   matches the locally-cached digest, skip the `filter.bin` download
 *   entirely. ETag on `filter.bin` is a secondary fallback.
 * - `filter_sha256` verification: every downloaded `filter.bin` is hashed
 *   and compared against `manifest.filter_sha256` before it lands in the
 *   cache. A mismatch aborts the sync — we'd rather fail closed than
 *   probe against a corrupted filter.
 * - Host allowlist (default: `endevco.github.io`). The OSV CVE/GHSA
 *   mirror has a *different* allowlist; this surface is bloom-only.
 *
 * Mirrors the shape of `security/advisories.ts` for consistency with
 * `vis advisories sync` / `status`.
 */

import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { findCacheDirSync } from "@visulima/find-cache-dir";

import type { OsvBloomBatchHit, OsvBloomBatchQuery, OsvBloomHandle } from "#native";
import { NATIVE_BINDING_VERSION, osvBloomDecode, osvBloomProbe, osvBloomProbeBatch } from "#native";

const EXPECTED_BINDING_VERSION = 6;

if (NATIVE_BINDING_VERSION !== EXPECTED_BINDING_VERSION) {
    throw new Error(
        `vis native binding ABI mismatch in osv-bloom: expected ${EXPECTED_BINDING_VERSION}, got ${NATIVE_BINDING_VERSION}. `
        + "Rebuild via `pnpm --filter @visulima/vis run build:native` or reinstall the platform binding package.",
    );
}

/** Default upstream — GitHub Pages site `endevco/osv-bloom` deploys to. */
export const DEFAULT_OSV_BLOOM_SOURCE = "https://endevco.github.io/osv-bloom";

/**
 * Hosts we will fetch the bloom filter + manifest from without further
 * opt-in. The filter is hashed (SHA-256) and length-checked against the
 * manifest, but the manifest itself is trusted on first read — so adding
 * a host here implicitly trusts that origin to vend manifest values that
 * gate cache invalidation. Keep this list tiny; users add custom mirrors
 * via `security.audit.advisories.bloom.allowedHosts`.
 */
const BUILTIN_ALLOWED_BLOOM_HOSTS = new Set<string>(["endevco.github.io"]);

/**
 * Validated subset of the upstream `manifest.json`. Only the fields the
 * sync flow needs — additional fields are ignored so adding upstream
 * metadata doesn't break older vis builds.
 */
export interface OsvBloomManifest {
    advisoryCount: number;
    bloomByteLen: number;
    bloomKHashes: number;
    bloomMBits: number;
    builtAtRfc3339: string;
    builtAtUnix: number;
    entryCount: number;
    filterSha256: string;
    formatVersion: number;
    setDigestSha256: string;
    sourceUrl: string;
    targetFpr: number;
}

export interface OsvBloomSourceConfig {
    /** Extra hosts permitted as `source` beyond the built-in allowlist. */
    allowedHosts?: string[];
    /** Base URL (no trailing slash). Defaults to the upstream GH Pages site. */
    source: string;
}

export interface OsvBloomSyncOptions extends OsvBloomSourceConfig {
    /** Override the resolved cache directory. Tests use this. */
    cacheDir?: string;
    /** Force a refetch even when the set digest hasn't moved. */
    force?: boolean;
    /** Optional progress hook for the filter.bin GET. */
    onProgress?: (current: number, total: number) => void;
    workspaceRoot: string;
}

export interface OsvBloomSyncResult {
    /** `filter.bin` length on disk. */
    bytesOnDisk: number;
    cacheDir: string;
    durationMs: number;
    manifest: OsvBloomManifest;
    /** True when the set digest matched and no filter.bin re-download happened. */
    upToDate: boolean;
}

export interface OsvBloomStatus {
    cacheDir: string;
    /** Local ISO of when this client last completed a successful fetch. */
    fetchedAtIso?: string;
    manifest?: OsvBloomManifest;
    present: boolean;
}

interface OsvBloomState {
    fetchedAtIso: string;

    /**
     * ETag returned by the last successful `filter.bin` GET; used as a
     * secondary short-circuit when upstream returns 304 before we get a
     * chance to compare the set digest.
     */
    filterEtag?: string;
    setDigestSha256: string;
}

export class OsvBloomSourceNotAllowedError extends Error {
    override readonly cause = "OSV_BLOOM_SOURCE_NOT_ALLOWED";

    constructor(host: string) {
        super(`osv-bloom source host '${host}' is not in the built-in allowlist. Add it to \`security.audit.advisories.bloom.allowedHosts\` if intentional.`);
        this.name = "OsvBloomSourceNotAllowedError";
    }
}

export class OsvBloomNetworkError extends Error {
    override readonly cause = "OSV_BLOOM_NETWORK";

    constructor(url: string, status: number | string) {
        super(`osv-bloom fetch failed for ${url}: ${status}. Check connectivity, proxy env vars, or --source.`);
        this.name = "OsvBloomNetworkError";
    }
}

export class OsvBloomIntegrityError extends Error {
    override readonly cause = "OSV_BLOOM_INTEGRITY";

    constructor(expectedSha: string, actualSha: string) {
        super(`osv-bloom filter.bin sha256 mismatch (expected ${expectedSha}, got ${actualSha}). Refusing to install a corrupted filter.`);
        this.name = "OsvBloomIntegrityError";
    }
}

export class OsvBloomManifestError extends Error {
    override readonly cause = "OSV_BLOOM_MANIFEST";

    constructor(reason: string) {
        super(`osv-bloom manifest invalid: ${reason}`);
        this.name = "OsvBloomManifestError";
    }
}

export class OsvBloomCacheMissError extends Error {
    override readonly cause = "OSV_BLOOM_CACHE_MISS";

    constructor(cacheDir: string) {
        super(`No osv-bloom cache at ${cacheDir}. Run 'vis advisories bloom sync' first.`);
        this.name = "OsvBloomCacheMissError";
    }
}

/** Resolve the cache directory for the bloom filter. */
export const resolveOsvBloomCacheDir = (workspaceRoot: string): string => {
    const cacheDir = findCacheDirSync("vis", { create: true, cwd: workspaceRoot });
    const root = cacheDir ?? join(workspaceRoot, "node_modules", ".cache", "vis");

    return join(root, "osv-bloom");
};

const filterPath = (cacheDir: string): string => join(cacheDir, "filter.bin");

const manifestPath = (cacheDir: string): string => join(cacheDir, "manifest.json");

const statePath = (cacheDir: string): string => join(cacheDir, "state.json");

/**
 * Validate `source` resolves to an allowed host over HTTPS. Throws
 * `OsvBloomSourceNotAllowedError` otherwise. Called at config-load time
 * and again right before fetch so a hostile env var can't slip through.
 */
export const validateOsvBloomSource = (source: string, allowedHosts?: string[]): URL => {
    let url: URL;

    try {
        url = new URL(source);
    } catch {
        throw new OsvBloomSourceNotAllowedError(source);
    }

    if (!url.host) {
        throw new OsvBloomSourceNotAllowedError(source);
    }

    if (url.protocol !== "https:") {
        throw new OsvBloomSourceNotAllowedError(`${url.protocol}//${url.host}`);
    }

    const allowed = new Set<string>([...BUILTIN_ALLOWED_BLOOM_HOSTS, ...(allowedHosts ?? [])]);

    if (!allowed.has(url.host)) {
        throw new OsvBloomSourceNotAllowedError(url.host);
    }

    return url;
};

/**
 * Download manifest.json + (when changed) filter.bin into the cache
 * directory. Two-step:
 *   1. GET manifest.json. If `set_digest_sha256` matches the persisted
 *      state, return upToDate.
 *   2. Otherwise GET filter.bin, hash it, verify against
 *      `manifest.filter_sha256`, then atomically rename into place along
 *      with the new manifest.json and updated state.json.
 */
export const syncOsvBloom = async (options: OsvBloomSyncOptions): Promise<OsvBloomSyncResult> => {
    const startedAt = Date.now();
    const cacheDir = options.cacheDir ?? resolveOsvBloomCacheDir(options.workspaceRoot);

    await mkdir(cacheDir, { recursive: true });

    const base = validateOsvBloomSource(options.source, options.allowedHosts);
    const manifestUrl = new URL("manifest.json", ensureTrailingSlash(base.toString()));
    const filterUrl = new URL("filter.bin", ensureTrailingSlash(base.toString()));

    const manifestResponse = await safeFetch(manifestUrl, { method: "GET" });

    if (!manifestResponse.ok) {
        throw new OsvBloomNetworkError(manifestUrl.toString(), manifestResponse.status);
    }

    const manifestRaw = await manifestResponse.text();
    const manifest = parseManifest(manifestRaw);

    const storedState = await readState(cacheDir);

    if (!options.force && storedState?.setDigestSha256 === manifest.setDigestSha256 && existsSync(filterPath(cacheDir))) {
        const stats = await stat(filterPath(cacheDir));

        return {
            bytesOnDisk: stats.size,
            cacheDir,
            durationMs: Date.now() - startedAt,
            manifest,
            upToDate: true,
        };
    }

    const filterInit: RequestInit = {};

    if (!options.force && storedState?.filterEtag) {
        filterInit.headers = { "if-none-match": storedState.filterEtag };
    }

    const filterResponse = await safeFetch(filterUrl, { ...filterInit, method: "GET" });

    if (filterResponse.status === 304 && storedState && existsSync(filterPath(cacheDir))) {
        // 304 + cached filter present — write the fresh manifest (set
        // digest is the same so this is mostly a no-op) and call it done.
        await persistManifestAndState(cacheDir, manifestRaw, {
            fetchedAtIso: new Date().toISOString(),
            filterEtag: storedState.filterEtag,
            setDigestSha256: manifest.setDigestSha256,
        });

        const stats = await stat(filterPath(cacheDir));

        return {
            bytesOnDisk: stats.size,
            cacheDir,
            durationMs: Date.now() - startedAt,
            manifest,
            upToDate: true,
        };
    }

    if (!filterResponse.ok || !filterResponse.body) {
        throw new OsvBloomNetworkError(filterUrl.toString(), filterResponse.status);
    }

    const filterBytes = Buffer.from(await filterResponse.arrayBuffer());

    if (options.onProgress) {
        // `filter.bin` is a single-shot ~380 KB download; we don't stream
        // through the progress callback in chunks (it would fire ~once).
        // Emit a single 100%-complete event so progress UIs settle.
        options.onProgress(filterBytes.length, filterBytes.length);
    }

    const actualSha = sha256Hex(filterBytes);

    if (actualSha !== manifest.filterSha256) {
        throw new OsvBloomIntegrityError(manifest.filterSha256, actualSha);
    }

    if (filterBytes.length !== manifest.bloomByteLen) {
        throw new OsvBloomManifestError(`filter.bin length ${filterBytes.length} does not match manifest.bloom_byte_len ${manifest.bloomByteLen}`);
    }

    const newEtag = filterResponse.headers.get("etag") ?? undefined;

    await atomicWrite(filterPath(cacheDir), filterBytes);
    await persistManifestAndState(cacheDir, manifestRaw, {
        fetchedAtIso: new Date().toISOString(),
        filterEtag: newEtag,
        setDigestSha256: manifest.setDigestSha256,
    });

    return {
        bytesOnDisk: filterBytes.length,
        cacheDir,
        durationMs: Date.now() - startedAt,
        manifest,
        upToDate: false,
    };
};

/**
 * Load the cached filter.bin and return a decoded native handle. Throws
 * `OsvBloomCacheMissError` when there is no cache. Returns `null` only
 * if `softFail` is true and the cache is missing — that mode is for
 * `mode = "on"` callers that want to no-op the prefilter when the cache
 * isn't populated yet.
 */
export const loadOsvBloomHandle = async (workspaceRoot: string, opts?: { cacheDir?: string; softFail?: boolean }): Promise<OsvBloomHandle | null> => {
    const cacheDir = opts?.cacheDir ?? resolveOsvBloomCacheDir(workspaceRoot);
    const binPath = filterPath(cacheDir);

    if (!existsSync(binPath)) {
        if (opts?.softFail) {
            return null;
        }

        throw new OsvBloomCacheMissError(cacheDir);
    }

    const bytes = await readFile(binPath);

    return osvBloomDecode(bytes);
};

/** Single-pair convenience wrapper. */
export const probeOsvBloom = (handle: OsvBloomHandle, name: string, version: string): boolean => osvBloomProbe(handle, name, version);

/** Batch wrapper. Returns only the hits in input order. */
export const probeOsvBloomBatch = (handle: OsvBloomHandle, queries: OsvBloomBatchQuery[]): OsvBloomBatchHit[] => osvBloomProbeBatch(handle, queries);

export const getOsvBloomStatus = async (workspaceRoot: string, cacheDirOverride?: string): Promise<OsvBloomStatus> => {
    const cacheDir = cacheDirOverride ?? resolveOsvBloomCacheDir(workspaceRoot);
    const binExists = existsSync(filterPath(cacheDir));

    if (!binExists) {
        return { cacheDir, present: false };
    }

    let manifest: OsvBloomManifest | undefined;
    let state: OsvBloomState | undefined;

    try {
        manifest = parseManifest(await readFile(manifestPath(cacheDir), "utf8"));
    } catch {
        // manifest may be missing if the user manually dropped filter.bin
        // in; treat as `present` but without manifest data.
    }

    try {
        state = await readState(cacheDir);
    } catch {
        // state.json is best-effort.
    }

    return { cacheDir, fetchedAtIso: state?.fetchedAtIso, manifest, present: true };
};

export const clearOsvBloomCache = async (workspaceRoot: string, cacheDirOverride?: string): Promise<void> => {
    const cacheDir = cacheDirOverride ?? resolveOsvBloomCacheDir(workspaceRoot);

    await rm(cacheDir, { force: true, recursive: true });
};

const parseManifest = (raw: string): OsvBloomManifest => {
    let data: Record<string, unknown>;

    try {
        data = JSON.parse(raw) as Record<string, unknown>;
    } catch (error) {
        throw new OsvBloomManifestError(error instanceof Error ? error.message : String(error));
    }

    const requireNumber = (key: string): number => {
        const value = data[key];

        if (typeof value !== "number" || Number.isNaN(value)) {
            throw new OsvBloomManifestError(`field '${key}' missing or non-numeric`);
        }

        return value;
    };

    const requireString = (key: string): string => {
        const value = data[key];

        if (typeof value !== "string" || value.length === 0) {
            throw new OsvBloomManifestError(`field '${key}' missing or empty`);
        }

        return value;
    };

    const formatVersion = requireNumber("format_version");

    if (formatVersion !== 1) {
        throw new OsvBloomManifestError(`unsupported format_version ${formatVersion} (this build expects v1)`);
    }

    return {
        advisoryCount: requireNumber("advisory_count"),
        bloomByteLen: requireNumber("bloom_byte_len"),
        bloomKHashes: requireNumber("bloom_k_hashes"),
        bloomMBits: requireNumber("bloom_m_bits"),
        builtAtRfc3339: requireString("built_at_rfc3339"),
        builtAtUnix: requireNumber("built_at_unix"),
        entryCount: requireNumber("entry_count"),
        filterSha256: requireString("filter_sha256"),
        formatVersion,
        setDigestSha256: requireString("set_digest_sha256"),
        sourceUrl: requireString("source_url"),
        targetFpr: requireNumber("target_fpr"),
    };
};

const readState = async (cacheDir: string): Promise<OsvBloomState | undefined> => {
    try {
        const raw = await readFile(statePath(cacheDir), "utf8");
        const data = JSON.parse(raw) as Partial<OsvBloomState>;

        if (typeof data.setDigestSha256 !== "string" || typeof data.fetchedAtIso !== "string") {
            return undefined;
        }

        return {
            fetchedAtIso: data.fetchedAtIso,
            filterEtag: typeof data.filterEtag === "string" ? data.filterEtag : undefined,
            setDigestSha256: data.setDigestSha256,
        };
    } catch {
        return undefined;
    }
};

const persistManifestAndState = async (cacheDir: string, manifestRaw: string, state: OsvBloomState): Promise<void> => {
    await atomicWrite(manifestPath(cacheDir), Buffer.from(manifestRaw, "utf8"));
    await atomicWrite(statePath(cacheDir), Buffer.from(`${JSON.stringify(state, undefined, 2)}\n`, "utf8"));
};

const atomicWrite = async (target: string, bytes: Buffer): Promise<void> => {
    await mkdir(dirname(target), { recursive: true });
    const tmp = `${target}.${process.pid}.${randomUUID()}.tmp`;

    try {
        await writeFile(tmp, bytes);
        await rename(tmp, target);
    } catch (error) {
        await unlink(tmp).catch(() => undefined);
        throw error;
    }
};

const sha256Hex = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");

const ensureTrailingSlash = (s: string): string => (s.endsWith("/") ? s : `${s}/`);

const FETCH_TIMEOUT_MS = 30_000;

const safeFetch = async (url: URL, init: RequestInit): Promise<Response> => {
    try {
        return await fetch(url, { ...init, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    } catch (error) {
        throw new OsvBloomNetworkError(url.toString(), error instanceof Error ? error.message : String(error));
    }
};
