/**
 * Cached fetcher for `https://registry.npmjs.org/-/npm/v1/keys`.
 *
 * The endpoint returns the ECDSA P-256 public keys npm currently uses to
 * sign tarballs. The signatures marshall reads this set on every run, so
 * we cache the response on disk for 24h. Stale-while-revalidate: when the
 * remote returns 5xx we keep using the expired cache if it exists.
 *
 * Override the URL with `VIS_NPM_KEYS_URL` (test mirrors, custom registries).
 */

import { rmSync, writeFileSync } from "node:fs";

import { ensureDirSync, isAccessibleSync, readJsonSync } from "@visulima/fs";
import { join } from "@visulima/path";

import { getVisCacheDir } from "../../util/vis-paths";

export interface RegistryKey {
    expires?: string;
    /** Base64-encoded SPKI public key. */
    key: string;
    /** Stable identifier — `sha256-…`. Used by `dist.signatures[*].keyid`. */
    keyid: string;
    keytype?: string;
    scheme?: string;
}

interface KeyCacheEntry {
    createdAt: number;
    keys: RegistryKey[];
    ttlMs: number;
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_FETCH_TIMEOUT_MS = 15_000;
const DEFAULT_KEYS_URL = "https://registry.npmjs.org/-/npm/v1/keys";

const getRegistryKeysCacheDir = (): string => join(getVisCacheDir(), "registry-keys");

const cacheFilePath = (): string => join(getRegistryKeysCacheDir(), "npmjs.json");

const readCachedKeys = (): { entry: KeyCacheEntry; expired: boolean } | undefined => {
    const filePath = cacheFilePath();

    if (!isAccessibleSync(filePath)) {
        return undefined;
    }

    try {
        const entry = readJsonSync(filePath) as unknown as KeyCacheEntry;
        const expired = Date.now() - entry.createdAt > entry.ttlMs;

        return { entry, expired };
    } catch {
        rmSync(filePath, { force: true });

        return undefined;
    }
};

const writeCachedKeys = (keys: RegistryKey[], ttlMs: number): void => {
    ensureDirSync(getRegistryKeysCacheDir());

    const entry: KeyCacheEntry = { createdAt: Date.now(), keys, ttlMs };

    writeFileSync(cacheFilePath(), JSON.stringify(entry), "utf8");
};

export interface FetchRegistryKeysOptions {
    /** Force a fresh fetch even when a fresh cache exists. */
    forceRefresh?: boolean;
    /** Override the upstream URL — defaults to env `VIS_NPM_KEYS_URL` or npmjs. */
    keysUrl?: string;
    signal?: AbortSignal;
    ttlMs?: number;
}

export interface FetchRegistryKeysResult {
    /** True when the response came from disk without hitting the network. */
    fromCache: boolean;
    keys: RegistryKey[];
    /** Set when we fell back to an expired cache because the network failed. */
    stale?: boolean;
}

/**
 * Fetch (or read from disk) the registry signing key set. Returns
 * `undefined` only when both the network and any cache are unavailable.
 */
export const fetchRegistryKeys = async (options: FetchRegistryKeysOptions = {}): Promise<FetchRegistryKeysResult | undefined> => {
    const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    const url = options.keysUrl ?? process.env.VIS_NPM_KEYS_URL ?? DEFAULT_KEYS_URL;
    const cached = readCachedKeys();

    if (cached !== undefined && !cached.expired && options.forceRefresh !== true) {
        return { fromCache: true, keys: cached.entry.keys };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_FETCH_TIMEOUT_MS);
    const abortListener = (): void => controller.abort();

    options.signal?.addEventListener("abort", abortListener, { once: true });

    try {
        const response = await fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal });

        if (!response.ok) {
            if (cached !== undefined) {
                return { fromCache: true, keys: cached.entry.keys, stale: true };
            }

            return undefined;
        }

        const body = (await response.json()) as { keys?: RegistryKey[] };
        const keys = Array.isArray(body.keys) ? body.keys : [];

        writeCachedKeys(keys, ttlMs);

        return { fromCache: false, keys };
    } catch {
        if (cached !== undefined) {
            return { fromCache: true, keys: cached.entry.keys, stale: true };
        }

        return undefined;
    } finally {
        clearTimeout(timeout);
        options.signal?.removeEventListener("abort", abortListener);
    }
};

/**
 * Drop the cached key set. Returns true when a file was removed. Used by
 * `vis security keys-refresh`.
 */
export const clearRegistryKeysCache = (): boolean => {
    const filePath = cacheFilePath();

    if (!isAccessibleSync(filePath)) {
        return false;
    }

    rmSync(filePath, { force: true });

    return true;
};
