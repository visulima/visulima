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
import { mkdir, rename, rm, stat, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { findCacheDirSync } from "@visulima/find-cache-dir";

import type { AdvisoryDbStatus, AdvisoryQueryResult, NativeVulnerabilityJs } from "#native";
import { advisoriesIngest, advisoriesQuery as nativeQuery, advisoriesStatus as nativeStatus, NATIVE_BINDING_VERSION } from "#native";

import { VisUserError } from "../errors/vis-user-error";

const EXPECTED_BINDING_VERSION = 6;

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
    /** Schema version the database had before it was rebuilt. Set only when a rebuild ran. */
    rebuiltFromSchema?: number;
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

/** Schema version the native reader writes. Must match NATIVE_KNOWN_VERSION in native/src/advisories/schema.rs. */
export const ADVISORY_DB_SCHEMA_VERSION = 2;

/** An existing advisory database was written by an older build. `vis advisories sync` rebuilds it. */
export class AdvisoryDbSchemaError extends Error {
    override readonly cause = "DB_SCHEMA_OUTDATED";

    constructor(path: string, schemaVersion: number) {
        super(
            `Advisory DB at ${path} uses schema v${String(schemaVersion)}; this build of vis needs v${String(ADVISORY_DB_SCHEMA_VERSION)}. Run 'vis advisories sync' to rebuild it.`,
        );
        this.name = "AdvisoryDbSchemaError";
    }
}

/** A schema rebuild failed part-way. The previous database file was left in place. */
export class AdvisoryDbRebuildError extends Error {
    override readonly cause = "DB_REBUILD_FAILED";

    constructor(path: string, schemaVersion: number, reason: string) {
        super(
            `Could not rebuild advisory DB at ${path} from schema v${String(schemaVersion)} to v${String(ADVISORY_DB_SCHEMA_VERSION)}: ${reason}. The existing file was left unchanged.`,
        );
        this.name = "AdvisoryDbRebuildError";
    }
}

/** Returns the schema error for an existing database that is older than this build, otherwise undefined. */
export const advisoryDbSchemaError = (dbPath: string): AdvisoryDbSchemaError | undefined => {
    const { schemaVersion } = nativeStatus(dbPath);

    return schemaVersion < ADVISORY_DB_SCHEMA_VERSION ? new AdvisoryDbSchemaError(dbPath, schemaVersion) : undefined;
};

export class AdvisorySourceNotAllowedError extends Error {
    // fallow-ignore-next-line unused-class-member -- error subclass cause field (part of the Error contract / consumed via error inspection)
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

/** SQLite sidecar suffixes. A WAL left next to a replaced file would be replayed into the new one. */
const SQLITE_SIDECARS = ["-wal", "-shm", "-journal"];

interface IngestOutcome {
    advisoriesIngested: number;
    durationMs: number;
}

interface IngestRequest {
    dbPath: string;
    ecosystem: string;
    /** ETag from a prior HEAD. When null, the GET response's ETag is stored. */
    etag: string | null;
    onProgress: SyncOptions["onProgress"];
    zipUrl: URL;
}

/** GET one ecosystem zip, stream it to a temp file, and ingest it into `dbPath`. The zip is always removed. */
const downloadAndIngest = async (request: IngestRequest): Promise<IngestOutcome> => {
    const zipPath = `${request.dbPath}.${request.ecosystem}.${process.pid}.${randomUUID()}.zip.tmp`;

    try {
        const response = await safeFetch(request.zipUrl, { method: "GET" });

        if (!response.ok || !response.body) {
            throw new AdvisorySyncNetworkError(request.zipUrl.toString(), response.status);
        }

        const etag = request.etag ?? response.headers.get("etag");
        const contentLength = response.headers.get("content-length");
        const totalBytes = contentLength ? Number.parseInt(contentLength, 10) : null;
        let downloaded = 0;

        const sink = createWriteStream(zipPath);
        // eslint-disable-next-line n/no-unsupported-features/node-builtins -- Readable.fromWeb works in 22.14+; stable label only flipped in 22.17.
        const source = Readable.fromWeb(response.body as never);

        if (request.onProgress && totalBytes) {
            source.on("data", (chunk: Buffer) => {
                downloaded += chunk.byteLength;
                request.onProgress?.(downloaded, totalBytes, "download");
            });
        }

        await pipeline(source, sink);

        return await advisoriesIngest(
            {
                dbPath: request.dbPath,
                ecosystem: request.ecosystem,
                manifestEtag: etag ?? undefined,
                zipPath,
            },
            (current, total) => request.onProgress?.(current, total, "ingest"),
        );
    } finally {
        // Rust deletes the zip after a successful ingest; this removes the residual when a step threw first.
        await unlink(zipPath).catch(() => undefined);
    }
};

/**
 * Rebuild a database written by an older schema. The file is shared by every ecosystem and ingest
 * only replaces one ecosystem's rows, so every ecosystem already in the old file is downloaded again
 * alongside the requested one. Nothing is lost by the rebuild.
 *
 * The new database is populated at a temp path next to the target, then renamed over it. A rename
 * within one directory is atomic, so on failure the old file is still there.
 */
const rebuildAdvisoryDb = async (
    options: SyncOptions,
    dbPath: string,
    fromSchema: number,
    carriedEcosystems: string[],
    zipUrlFor: (ecosystem: string) => URL,
): Promise<IngestOutcome> => {
    const tmpPath = `${dbPath}.rebuild.${process.pid}.${randomUUID()}.tmp`;

    try {
        const requested = await downloadAndIngest({
            dbPath: tmpPath,
            ecosystem: options.ecosystem,
            etag: null,
            onProgress: options.onProgress,
            zipUrl: zipUrlFor(options.ecosystem),
        });

        for (const ecosystem of carriedEcosystems) {
            if (ecosystem !== options.ecosystem) {
                await downloadAndIngest({ dbPath: tmpPath, ecosystem, etag: null, onProgress: options.onProgress, zipUrl: zipUrlFor(ecosystem) });
            }
        }

        await Promise.all(SQLITE_SIDECARS.map((suffix) => rm(`${dbPath}${suffix}`, { force: true })));
        await rename(tmpPath, dbPath);

        return requested;
    } catch (error) {
        await Promise.all(["", ...SQLITE_SIDECARS].map((suffix) => rm(`${tmpPath}${suffix}`, { force: true }).catch(() => undefined)));

        throw new AdvisoryDbRebuildError(dbPath, fromSchema, error instanceof Error ? error.message : String(error));
    }
};

/**
 * The zip URL for one OSV ecosystem under the configured source. An ecosystem name is an OSV
 * directory name: no separators, no traversal, no empty segments. The resolved URL must still sit
 * under the source, so a crafted name cannot reach another host or path.
 */
export const advisoryZipUrl = (source: URL, ecosystem: string): URL => {
    if (!/^[A-Z0-9][\w.:-]*$/i.test(ecosystem)) {
        throw new VisUserError(`Advisory ecosystem "${ecosystem}" is not a valid OSV name.`);
    }

    const baseUrl = ensureTrailingSlash(source.toString());
    const resolved = new URL(`${ecosystem}/all.zip`, baseUrl);

    if (resolved.origin !== source.origin || !resolved.pathname.startsWith(new URL(baseUrl).pathname)) {
        throw new VisUserError(`Advisory ecosystem "${ecosystem}" resolves outside the configured advisory source.`);
    }

    return resolved;
};

/**
 * Download + ingest one ecosystem. Two-step:
 *   1. HEAD &lt;source>/&lt;eco>/all.zip; compare ETag against stored meta.
 *      Short-circuit when unchanged unless `force`.
 *   2. GET, stream to a `.tmp` file, then native ingest. The DB write is
 *      transactional inside `advisoriesIngest`.
 *
 * A database from an older schema is rebuilt first (see `rebuildAdvisoryDb`).
 */
export const syncAdvisories = async (options: SyncOptions): Promise<SyncResult> => {
    const dbPath = options.dbPath ?? resolveAdvisoryDbPath(options.workspaceRoot);
    const url = validateAdvisorySource(options.source, options.allowedHosts);
    const zipUrlFor = (ecosystem: string): URL => advisoryZipUrl(url, ecosystem);

    // Checked before the ETag short-circuit: an outdated database is rebuilt, never reported as "up to date".
    if (existsSync(dbPath)) {
        const status = nativeStatus(dbPath);

        if (status.schemaVersion < ADVISORY_DB_SCHEMA_VERSION) {
            const carried = status.ecosystems.map((e) => e.name);
            const rebuilt = await rebuildAdvisoryDb(options, dbPath, status.schemaVersion, carried, zipUrlFor);

            return {
                advisoriesIngested: rebuilt.advisoriesIngested,
                dbPath,
                durationMs: rebuilt.durationMs,
                rebuiltFromSchema: status.schemaVersion,
                upToDate: false,
            };
        }
    }

    await mkdir(dirname(dbPath), { recursive: true });

    const storedEtag = await readStoredEtag(dbPath, options.ecosystem);

    let etag: string | null = null;

    if (!options.force) {
        const head = await safeFetch(zipUrlFor(options.ecosystem), { method: "HEAD" });

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

    const ingested = await downloadAndIngest({
        dbPath,
        ecosystem: options.ecosystem,
        etag,
        onProgress: options.onProgress,
        zipUrl: zipUrlFor(options.ecosystem),
    });

    return {
        advisoriesIngested: ingested.advisoriesIngested,
        dbPath,
        durationMs: ingested.durationMs,
        upToDate: false,
    };
};

/**
 * Key under which `queryAdvisories` files a result. A lock file can hold several
 * versions of one package, so the key must include the version.
 */
export const advisoryKey = (name: string, version: string): string => `${name}@${version}`;

/**
 * Map a batch of installed packages to vulnerabilities, keyed by `advisoryKey(name, version)`.
 * Each entry is one installed version. Every version of a package gets its own result.
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

        out.set(
            advisoryKey(packageInfo.name, packageInfo.version),
            hit.vulnerabilities.map((v) => toSecurityVulnerability(v)),
        );
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
