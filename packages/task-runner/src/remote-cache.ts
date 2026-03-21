import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { createGzip, createGunzip } from "node:zlib";
import { exec } from "node:child_process";

/**
 * Options for the remote cache.
 */
export interface RemoteCacheOptions {
    /** Remote cache server URL (e.g., "https://cache.example.com") */
    url: string;
    /** Authentication token for the remote cache */
    token?: string;
    /** Team ID or namespace for cache isolation */
    teamId?: string;
    /** Request timeout in milliseconds (default: 30000) */
    timeout?: number;
    /** Whether to enable remote cache reads */
    read?: boolean;
    /** Whether to enable remote cache writes */
    write?: boolean;
}

/**
 * HTTP-based remote cache compatible with the Turborepo remote cache protocol.
 *
 * Protocol:
 * - GET  /v8/artifacts/{hash}?teamId={team}  → retrieve cached artifact (gzipped tar)
 * - PUT  /v8/artifacts/{hash}?teamId={team}  → store artifact
 * - POST /v8/artifacts/events                → analytics (optional)
 *
 * Authentication via `Authorization: Bearer {token}` header.
 *
 * The cache entry is a gzipped tarball containing the cache directory contents
 * (code, terminalOutput, fingerprint.json, outputs/, .commit).
 */
export class RemoteCache {
    readonly #url: string;
    readonly #token: string | null;
    readonly #teamId: string | null;
    readonly #timeout: number;
    readonly #read: boolean;
    readonly #write: boolean;

    constructor(options: RemoteCacheOptions) {
        this.#url = options.url.replace(/\/$/, "");
        this.#token = options.token ?? null;
        this.#teamId = options.teamId ?? null;
        this.#timeout = options.timeout ?? 30_000;
        this.#read = options.read ?? true;
        this.#write = options.write ?? true;
    }

    /**
     * Retrieves a cached artifact from the remote cache.
     * Returns the local path to the extracted cache entry, or null if not found.
     */
    async retrieve(
        hash: string,
        localCacheDir: string,
    ): Promise<boolean> {
        if (!this.#read) {
            return false;
        }

        const entryDir = join(localCacheDir, hash);
        const archivePath = join(localCacheDir, `.remote-${hash}.tar.gz`);

        try {
            const artifactUrl = this.#buildUrl(`/v8/artifacts/${hash}`);
            const response = await fetch(artifactUrl, {
                method: "GET",
                headers: this.#buildHeaders(),
                signal: AbortSignal.timeout(this.#timeout),
            });

            if (!response.ok) {
                return false;
            }

            // Write the gzipped response to a temporary file
            await mkdir(localCacheDir, { recursive: true });

            const body = response.body;

            if (!body) {
                return false;
            }

            const fileStream = createWriteStream(archivePath);
            // @ts-expect-error - ReadableStream to Writable pipe works in Node.js
            await pipeline(body, fileStream);

            // Extract the archive to the cache entry directory
            await mkdir(entryDir, { recursive: true });
            await this.#extractTarGz(archivePath, entryDir);
            await rm(archivePath, { force: true });

            return true;
        } catch {
            // Clean up partial downloads
            await rm(archivePath, { force: true }).catch(() => {});
            await rm(entryDir, { recursive: true, force: true }).catch(() => {});

            return false;
        }
    }

    /**
     * Stores a cache entry in the remote cache.
     */
    async store(
        hash: string,
        localCacheDir: string,
    ): Promise<boolean> {
        if (!this.#write) {
            return false;
        }

        const entryDir = join(localCacheDir, hash);
        const archivePath = join(localCacheDir, `.upload-${hash}.tar.gz`);

        try {
            // Check the entry exists and is complete
            await stat(join(entryDir, ".commit"));

            // Create a gzipped tarball of the cache entry
            await this.#createTarGz(entryDir, archivePath);

            const artifactUrl = this.#buildUrl(`/v8/artifacts/${hash}`);
            const archiveContent = await readFile(archivePath);

            const response = await fetch(artifactUrl, {
                method: "PUT",
                headers: {
                    ...this.#buildHeaders(),
                    "Content-Type": "application/octet-stream",
                    "Content-Length": String(archiveContent.length),
                },
                body: archiveContent,
                signal: AbortSignal.timeout(this.#timeout),
            });

            await rm(archivePath, { force: true });

            return response.ok;
        } catch {
            await rm(archivePath, { force: true }).catch(() => {});

            return false;
        }
    }

    /**
     * Checks if an artifact exists in the remote cache without downloading it.
     */
    async exists(hash: string): Promise<boolean> {
        if (!this.#read) {
            return false;
        }

        try {
            const artifactUrl = this.#buildUrl(`/v8/artifacts/${hash}`);
            const response = await fetch(artifactUrl, {
                method: "HEAD",
                headers: this.#buildHeaders(),
                signal: AbortSignal.timeout(this.#timeout),
            });

            return response.ok;
        } catch {
            return false;
        }
    }

    #buildUrl(path: string): string {
        const url = `${this.#url}${path}`;

        if (this.#teamId) {
            return `${url}?teamId=${encodeURIComponent(this.#teamId)}`;
        }

        return url;
    }

    #buildHeaders(): Record<string, string> {
        const headers: Record<string, string> = {};

        if (this.#token) {
            headers["Authorization"] = `Bearer ${this.#token}`;
        }

        return headers;
    }

    async #createTarGz(sourceDir: string, outputPath: string): Promise<void> {
        return new Promise((promiseResolve, reject) => {
            exec(
                `tar -czf ${outputPath} -C ${sourceDir} .`,
                (error) => {
                    if (error) {
                        reject(error);
                    } else {
                        promiseResolve();
                    }
                },
            );
        });
    }

    async #extractTarGz(archivePath: string, destDir: string): Promise<void> {
        return new Promise((promiseResolve, reject) => {
            exec(
                `tar -xzf ${archivePath} -C ${destDir}`,
                (error) => {
                    if (error) {
                        reject(error);
                    } else {
                        promiseResolve();
                    }
                },
            );
        });
    }
}
