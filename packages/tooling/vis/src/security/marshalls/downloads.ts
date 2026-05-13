/**
 * Download-count floor marshall.
 *
 * Hits `https://api.npmjs.org/downloads/point/last-month/&lt;pkg>` and flags
 * packages whose monthly downloads fall under a configurable warn (and
 * optional error) threshold. The stats endpoint has its own rate-limits
 * and is cached locally for 24 hours.
 *
 * This module defaults to soft warnings since "obscure but legitimate"
 * packages are common. Callers can upgrade to error by setting
 * `warnThreshold === errorThreshold`.
 */

import { readdirSync, rmSync, writeFileSync } from "node:fs";

import { ensureDirSync, isAccessibleSync, readJsonSync } from "@visulima/fs";
import { join } from "@visulima/path";

import { getVisCacheDir } from "../../util/vis-paths";
import { DEFAULT_MARSHALL_CONCURRENCY, mapWithConcurrency } from "./concurrency";
import { isMarshallDisabled } from "./registry";

export interface DownloadFinding {
    downloadsLastMonth: number | undefined;
    /** "no-data" when the API returned 404 (newly published pkg). */
    kind: "below-error" | "below-warning" | "no-data";
    packageName: string;
    severity: "error" | "warning";
}

export interface RunDownloadsMarshallOptions {
    allowlist?: string[];
    cacheTtlMs?: number;
    /** Max packages inspected in parallel. Defaults to {@link DEFAULT_MARSHALL_CONCURRENCY}. */
    concurrency?: number;
    errorThreshold?: number;
    signal?: AbortSignal;
    warnThreshold?: number;
}

interface DownloadsCacheEntry {
    createdAt: number;
    downloads: number;
    observedAt: string;
    ttlMs: number;
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_FETCH_TIMEOUT_MS = 15_000;
const DEFAULT_ERROR_THRESHOLD = 20;
const DEFAULT_WARN_THRESHOLD = 10_000;
const DOWNLOADS_API_BASE = "https://api.npmjs.org/downloads/point/last-month";

const getDownloadsCacheDir = (): string => join(getVisCacheDir(), "downloads");

const cacheFilePath = (name: string): string => join(getDownloadsCacheDir(), `${encodeURIComponent(name)}.json`);

const readCachedDownloads = (name: string): number | undefined => {
    const filePath = cacheFilePath(name);

    if (!isAccessibleSync(filePath)) {
        return undefined;
    }

    try {
        const entry = readJsonSync(filePath) as unknown as DownloadsCacheEntry;

        if (Date.now() - entry.createdAt > entry.ttlMs) {
            rmSync(filePath, { force: true });

            return undefined;
        }

        return entry.downloads;
    } catch {
        rmSync(filePath, { force: true });

        return undefined;
    }
};

const writeCachedDownloads = (name: string, downloads: number, ttlMs: number): void => {
    ensureDirSync(getDownloadsCacheDir());

    const entry: DownloadsCacheEntry = {
        createdAt: Date.now(),
        downloads,
        observedAt: new Date().toISOString(),
        ttlMs,
    };

    writeFileSync(cacheFilePath(name), JSON.stringify(entry), "utf8");
};

interface FetchResult {
    downloads?: number;
    kind: "error" | "no-data" | "ok";
}

const fetchDownloads = async (name: string, signal: AbortSignal | undefined): Promise<FetchResult> => {
    const url = `${DOWNLOADS_API_BASE}/${encodeURIComponent(name)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => {
        controller.abort();
    }, DEFAULT_FETCH_TIMEOUT_MS);
    const abortListener = (): void => {
        controller.abort();
    };

    signal?.addEventListener("abort", abortListener, { once: true });

    try {
        const response = await fetch(url, { signal: controller.signal });

        if (response.status === 404) {
            return { kind: "no-data" };
        }

        if (!response.ok) {
            // 429 / 5xx: surface as warning without caching.
            return { kind: "error" };
        }

        const body = (await response.json()) as { downloads?: number };

        if (typeof body.downloads === "number") {
            return { downloads: body.downloads, kind: "ok" };
        }

        return { kind: "no-data" };
    } catch {
        return { kind: "error" };
    } finally {
        clearTimeout(timeout);
        signal?.removeEventListener("abort", abortListener);
    }
};

export const runDownloadsMarshall = async (
    packageNames: string[],
    options: RunDownloadsMarshallOptions = {},
): Promise<DownloadFinding[]> => {
    if (isMarshallDisabled("downloads")) {
        return [];
    }

    const allowlist = new Set(options.allowlist);
    const errorThreshold = options.errorThreshold ?? DEFAULT_ERROR_THRESHOLD;
    const warnThreshold = options.warnThreshold ?? DEFAULT_WARN_THRESHOLD;
    const ttlMs = options.cacheTtlMs ?? DEFAULT_TTL_MS;
    const concurrency = options.concurrency ?? DEFAULT_MARSHALL_CONCURRENCY;

    const perPackage = await mapWithConcurrency(packageNames, concurrency, async (name): Promise<DownloadFinding | undefined> => {
        if (allowlist.has(name)) {
            return undefined;
        }

        const cached = readCachedDownloads(name);
        let downloads = cached;

        if (downloads === undefined) {
            const result = await fetchDownloads(name, options.signal);

            if (result.kind === "no-data" || result.kind === "error") {
                // Surface as no-data warning; "error" path intentionally does not pollute the cache.
                return { downloadsLastMonth: undefined, kind: "no-data", packageName: name, severity: "warning" };
            }

            downloads = result.downloads ?? 0;
            writeCachedDownloads(name, downloads, ttlMs);
        }

        if (downloads < errorThreshold) {
            return { downloadsLastMonth: downloads, kind: "below-error", packageName: name, severity: "error" };
        }

        if (downloads < warnThreshold) {
            return { downloadsLastMonth: downloads, kind: "below-warning", packageName: name, severity: "warning" };
        }

        return undefined;
    });

    return perPackage.filter((entry): entry is DownloadFinding => entry !== undefined);
};

/**
 * Drop every cached download record. Returns the number of files removed.
 * Used by `vis cache clean --downloads`.
 */
export const clearDownloadsCache = (): number => {
    const directory = getDownloadsCacheDir();

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
