/* eslint-disable max-classes-per-file -- co-located error classes for the advisory sync surface */

/**
 * JS adapter for the native offline-advisories surface. Wraps the
 * `advisoriesIngest` / `advisoriesQuery` / `advisoriesStatus` NAPI functions
 * with: cache-dir resolution, HTTP fetch + ETag short-circuit, atomic
 * temp-file download, source-URL allowlist, and a `SecurityVulnerability`
 * return shape that matches the existing online path in `util/catalog.ts`.
 */

import { randomUUID } from "node:crypto";
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, stat, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { findCacheDirSync } from "@visulima/find-cache-dir";

import type { AdvisoryDbStatus, AdvisoryQueryResult, NativeVulnerabilityJs } from "#native";
import {
    advisoriesIngest,
    advisoriesQuery as nativeQuery,
    advisoriesStatus as nativeStatus,
    NATIVE_BINDING_VERSION,
} from "#native";

const EXPECTED_BINDING_VERSION = 4;

if (NATIVE_BINDING_VERSION !== EXPECTED_BINDING_VERSION) {
    throw new Error(
        `vis native binding ABI mismatch in advisories: expected ${EXPECTED_BINDING_VERSION}, got ${NATIVE_BINDING_VERSION}. `
        + "Rebuild via `pnpm --filter @visulima/vis run build:native` or reinstall the platform binding package.",
    );
}

/** Default OSV mirror. Auto-allowed; users add more via `allowedHosts`. */
export const DEFAULT_ADVISORY_SOURCE = "https://osv-vulnerabilities.storage.googleapis.com";

const BUILTIN_ALLOWED_HOSTS = new Set<string>(["osv-vulnerabilities.storage.googleapis.com"]);

export interface SecurityVulnerability {
    aliases?: string[];
    cvssScore?: number;
    fixedVersions: string[];
    id: string;
    severity: "CRITICAL" | "HIGH" | "LOW" | "MODERATE" | "UNKNOWN";
    summary: string;
}

export interface AdvisorySourceConfig {
    /** Extra hosts permitted as `source` beyond the built-in allowlist. */
    allowedHosts?: string[];
    /** Base URL (no trailing slash). */
    source: string;
}

export interface SyncOptions extends AdvisorySourceConfig {
    /** Override the resolved cache path. Tests use this. */
    dbPath?: string;
    ecosystem: string;
    /** Force re-download even if ETag matches. */
    force?: boolean;
    /** Progress callback during ingest. */
    onProgress?: (current: number, total: number, phase: "download" | "ingest") => void;
    workspaceRoot: string;
}

export interface SyncResult {
    advisoriesIngested: number;
    dbPath: string;
    durationMs: number;
    /** True when the ETag short-circuit fired and no work happened. */
    upToDate: boolean;
}

export interface QueryOptions {
    dbPath?: string;
    ecosystem?: string;
    workspaceRoot: string;
}

export class AdvisoryDbNotFoundError extends Error {
    override readonly cause = "DB_NOT_FOUND";

    constructor(path: string) {
        super(`No local advisory DB at ${path}. Run 'vis advisories sync' first.`);
        this.name = "AdvisoryDbNotFoundError";
    }
}

export class AdvisorySourceNotAllowedError extends Error {
    override readonly cause = "SOURCE_NOT_ALLOWED";

    constructor(host: string) {
        super(`Advisory source host '${host}' is not in the built-in allowlist. Add it to \`security.audit.advisories.allowedHosts\` if intentional.`);
        this.name = "AdvisorySourceNotAllowedError";
    }
}

export class AdvisorySyncNetworkError extends Error {
    override readonly cause = "SYNC_NETWORK";

    constructor(url: string, status: number | string) {
        super(`Advisory sync failed for ${url}: ${status}. Check connectivity, proxy env vars, or --source.`);
        this.name = "AdvisorySyncNetworkError";
    }
}

/**
 * Resolve the canonical advisory DB path under the workspace's cache dir.
 * All ecosystems share one file; see RFC §C.
 */
export const resolveAdvisoryDbPath = (workspaceRoot: string): string => {
    const cacheDir = findCacheDirSync("vis", { create: true, cwd: workspaceRoot });
    const root = cacheDir ?? join(workspaceRoot, "node_modules", ".cache", "vis");

    return join(root, "advisories", "db.sqlite");
};

/**
 * Validate that `source` resolves to a host in the allowlist. Throws
 * `AdvisorySourceNotAllowedError` if not. Called at config-load time and
 * again right before fetch, so misconfiguration via env-var injection is
 * caught even when the config validator ran in a different process.
 */
export const validateAdvisorySource = (source: string, allowedHosts?: string[]): URL => {
    let url: URL;

    try {
        url = new URL(source);
    } catch {
        throw new AdvisorySourceNotAllowedError(source);
    }

    if (url.protocol !== "https:") {
        throw new AdvisorySourceNotAllowedError(`${url.protocol}//${url.host}`);
    }

    const allowed = new Set<string>([...BUILTIN_ALLOWED_HOSTS, ...(allowedHosts ?? [])]);

    if (!allowed.has(url.host)) {
        throw new AdvisorySourceNotAllowedError(url.host);
    }

    return url;
};

/**
 * Download + ingest one ecosystem. Two-step:
 *   1. HEAD &lt;source>/&lt;eco>/all.zip; compare ETag against stored meta.
 *      Short-circuit when unchanged unless `force`.
 *   2. GET, stream to a `.tmp` file, then native ingest. Atomic rename
 *      not needed for the zip (Rust deletes it after ingest) but the
 *      DB write is transactional inside `advisoriesIngest`.
 */
export const syncAdvisories = async (options: SyncOptions): Promise<SyncResult> => {
    const dbPath = options.dbPath ?? resolveAdvisoryDbPath(options.workspaceRoot);

    await mkdir(dirname(dbPath), { recursive: true });

    const url = validateAdvisorySource(options.source, options.allowedHosts);
    const zipUrl = new URL(`${options.ecosystem}/all.zip`, ensureTrailingSlash(url.toString()));

    const storedEtag = await readStoredEtag(dbPath, options.ecosystem);

    let etag: string | null = null;

    if (!options.force) {
        const head = await safeFetch(zipUrl, { method: "HEAD" });

        if (head.ok) {
            etag = head.headers.get("etag");

            if (etag && storedEtag && etag === storedEtag) {
                return {
                    advisoriesIngested: 0,
                    dbPath,
                    durationMs: 0,
                    upToDate: true,
                };
            }
        }
    }

    const zipPath = `${dbPath}.${options.ecosystem}.${process.pid}.${randomUUID()}.zip.tmp`;
    const response = await safeFetch(zipUrl, { method: "GET" });

    if (!response.ok || !response.body) {
        throw new AdvisorySyncNetworkError(zipUrl.toString(), response.status);
    }

    if (!etag) {
        etag = response.headers.get("etag");
    }

    const contentLength = response.headers.get("content-length");
    const totalBytes = contentLength ? Number.parseInt(contentLength, 10) : null;
    let downloaded = 0;

    const sink = createWriteStream(zipPath);
    // eslint-disable-next-line n/no-unsupported-features/node-builtins -- Readable.fromWeb works in 22.14+; stable label only flipped in 22.17.
    const source = Readable.fromWeb(response.body as never);

    if (options.onProgress && totalBytes) {
        source.on("data", (chunk: Buffer) => {
            downloaded += chunk.byteLength;
            options.onProgress?.(downloaded, totalBytes, "download");
        });
    }

    await pipeline(source, sink);

    try {
        const result = await advisoriesIngest(
            {
                dbPath,
                ecosystem: options.ecosystem,
                manifestEtag: etag ?? undefined,
                zipPath,
            },
            (current, total) => options.onProgress?.(current, total, "ingest"),
        );

        return {
            advisoriesIngested: result.advisoriesIngested,
            dbPath,
            durationMs: result.durationMs,
            upToDate: false,
        };
    } finally {
        // Rust deletes the zip after a successful ingest; we clean up the
        // residual when ingest threw before reaching that point.
        await unlink(zipPath).catch(() => undefined);
    }
};

/**
 * Map a batch of installed packages to vulnerabilities, returning the same
 * `Map&lt;name, SecurityVulnerability[]>` shape the online path produces in
 * `util/catalog.ts:fetchVulnerabilities`.
 */
export const queryAdvisories = (packages: { name: string; version: string }[], options: QueryOptions): Map<string, SecurityVulnerability[]> => {
    if (packages.length === 0) {
        return new Map();
    }

    const dbPath = options.dbPath ?? resolveAdvisoryDbPath(options.workspaceRoot);
    const ecosystem = options.ecosystem ?? "npm";

    if (!existsSync(dbPath)) {
        throw new AdvisoryDbNotFoundError(dbPath);
    }

    const queries = packages.map((p) => {
        return {
            ecosystem,
            name: p.name,
            version: p.version,
        };
    });

    const results: AdvisoryQueryResult[] = nativeQuery(dbPath, queries);
    const out = new Map<string, SecurityVulnerability[]>();

    for (const [index, packageInfo] of packages.entries()) {
        const hit = results[index];

        if (!hit || hit.vulnerabilities.length === 0) {
            continue;
        }

        out.set(packageInfo.name, hit.vulnerabilities.map((v) => toSecurityVulnerability(v)));
    }

    return out;
};

export const getAdvisoryStatus = async (workspaceRoot: string, dbPath?: string): Promise<AdvisoryDbStatus> => {
    const path = dbPath ?? resolveAdvisoryDbPath(workspaceRoot);

    return nativeStatus(path);
};

const readStoredEtag = async (dbPath: string, ecosystem: string): Promise<string | null> => {
    try {
        await stat(dbPath);
    } catch {
        return null;
    }

    const status = nativeStatus(dbPath);
    const eco = status.ecosystems.find((e) => e.name === ecosystem);

    return eco?.manifestEtag ?? null;
};

const toSecurityVulnerability = (v: NativeVulnerabilityJs): SecurityVulnerability => {
    return {
        aliases: v.aliases.length > 0 ? v.aliases : undefined,
        cvssScore: v.cvssScore ?? undefined,
        fixedVersions: v.fixedVersions,
        id: v.id,
        severity: normalizeSeverity(v.severity),
        summary: v.summary,
    };
};

const normalizeSeverity = (s: string): SecurityVulnerability["severity"] => {
    const upper = s.toUpperCase();

    if (upper === "CRITICAL" || upper === "HIGH" || upper === "MODERATE" || upper === "LOW") {
        return upper;
    }

    return "UNKNOWN";
};

const ensureTrailingSlash = (s: string): string => (s.endsWith("/") ? s : `${s}/`);

const safeFetch = async (url: URL, init: RequestInit): Promise<Response> => {
    try {
        return await fetch(url, init);
    } catch (error) {
        throw new AdvisorySyncNetworkError(url.toString(), error instanceof Error ? error.message : String(error));
    }
};
