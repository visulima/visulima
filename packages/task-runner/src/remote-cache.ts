import { execFile } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, rm, stat } from "node:fs/promises";
import { join } from "@visulima/path";
import { pipeline } from "node:stream/promises";

/**
 * Options for the remote cache.
 */
interface RemoteCacheOptions {
    /**
     * Called when a fire-and-forget upload fails.
     * Since uploads are non-blocking, errors are silently swallowed by default.
     * Provide this callback to log or report upload failures.
     */
    onUploadError?: (hash: string, error: unknown) => void;
    /** Whether to enable remote cache reads */
    read?: boolean;
    /** Team ID or namespace for cache isolation */
    teamId?: string;
    /** Request timeout in milliseconds (default: 30000) */
    timeout?: number;
    /** Authentication token for the remote cache */
    token?: string;
    /** Remote cache server URL (e.g., "https://cache.example.com") */
    url: string;
    /** Whether to enable remote cache writes */
    write?: boolean;
}

const createTarGz = (sourceDirectory: string, outputPath: string): Promise<void> =>
    new Promise((resolve, reject) => {
        // eslint-disable-next-line sonarjs/no-os-command-from-path
        execFile("tar", ["-czf", outputPath, "-C", sourceDirectory, "."], (error) => {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
    });

const extractTarGz = (archivePath: string, destinationDirectory: string): Promise<void> =>
    new Promise((resolve, reject) => {
        // eslint-disable-next-line sonarjs/no-os-command-from-path
        execFile("tar", ["-xzf", archivePath, "-C", destinationDirectory], (error) => {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
    });

/**
 * HTTP-based remote cache compatible with the Turborepo remote cache protocol.
 *
 * Protocol:
 * - GET  /v8/artifacts/{hash}?teamId={team}  -> retrieve cached artifact (gzipped tar)
 * - PUT  /v8/artifacts/{hash}?teamId={team}  -> store artifact
 * - POST /v8/artifacts/events                -> analytics (optional)
 *
 * Authentication via `Authorization: Bearer {token}` header.
 *
 * The cache entry is a gzipped tarball containing the cache directory contents
 * (code, terminalOutput, fingerprint.json, outputs/, .commit).
 */
class RemoteCache {
    readonly #url: string;

    readonly #token: string | undefined;

    readonly #teamId: string | undefined;

    readonly #timeout: number;

    readonly #read: boolean;

    readonly #write: boolean;

    readonly #onUploadError: ((hash: string, error: unknown) => void) | undefined;

    public constructor(options: RemoteCacheOptions) {
        this.#url = options.url.replace(/\/$/, "");
        this.#token = options.token;
        this.#teamId = options.teamId;
        this.#timeout = options.timeout ?? 30_000;
        this.#read = options.read ?? true;
        this.#write = options.write ?? true;
        this.#onUploadError = options.onUploadError;
    }

    /**
     * Retrieves a cached artifact from the remote cache.
     * Returns the local path to the extracted cache entry, or undefined if not found.
     */
    public async retrieve(hash: string, localCacheDirectory: string): Promise<boolean> {
        if (!this.#read) {
            return false;
        }

        const entryDirectory = join(localCacheDirectory, hash);
        const archivePath = join(localCacheDirectory, `.remote-${hash}.tar.gz`);

        try {
            const artifactUrl = this.#buildUrl(`/v8/artifacts/${hash}`);
            // eslint-disable-next-line n/no-unsupported-features/node-builtins
            const response = await fetch(artifactUrl, {
                headers: this.#buildHeaders(),
                method: "GET",
                signal: AbortSignal.timeout(this.#timeout),
            });

            if (!response.ok) {
                return false;
            }

            // Write the gzipped response to a temporary file
            await mkdir(localCacheDirectory, { recursive: true });

            const { body } = response;

            if (!body) {
                return false;
            }

            const fileStream = createWriteStream(archivePath);

            // @ts-expect-error - ReadableStream to Writable pipe works in Node.js
            await pipeline(body, fileStream);

            // Extract the archive to the cache entry directory
            await mkdir(entryDirectory, { recursive: true });
            await extractTarGz(archivePath, entryDirectory);
            await rm(archivePath, { force: true });

            return true;
        } catch {
            // Clean up partial downloads
            await rm(archivePath, { force: true }).catch(() => {});
            await rm(entryDirectory, { force: true, recursive: true }).catch(() => {});

            return false;
        }
    }

    /**
     * Stores a cache entry in the remote cache.
     */
    public async store(hash: string, localCacheDirectory: string): Promise<boolean> {
        if (!this.#write) {
            return false;
        }

        const entryDirectory = join(localCacheDirectory, hash);
        const archivePath = join(localCacheDirectory, `.upload-${hash}.tar.gz`);

        try {
            // Check the entry exists and is complete
            await stat(join(entryDirectory, ".commit"));

            // Create a gzipped tarball of the cache entry
            await createTarGz(entryDirectory, archivePath);

            const artifactUrl = this.#buildUrl(`/v8/artifacts/${hash}`);
            const archiveContent = await readFile(archivePath);

            // eslint-disable-next-line n/no-unsupported-features/node-builtins
            const response = await fetch(artifactUrl, {
                body: archiveContent,
                headers: {
                    ...this.#buildHeaders(),
                    "Content-Length": String(archiveContent.length),
                    "Content-Type": "application/octet-stream",
                },
                method: "PUT",
                signal: AbortSignal.timeout(this.#timeout),
            });

            await rm(archivePath, { force: true });

            return response.ok;
        } catch (error) {
            await rm(archivePath, { force: true }).catch(() => {});
            this.#onUploadError?.(hash, error);

            return false;
        }
    }

    /**
     * Checks if an artifact exists in the remote cache without downloading it.
     */
    public async exists(hash: string): Promise<boolean> {
        if (!this.#read) {
            return false;
        }

        try {
            const artifactUrl = this.#buildUrl(`/v8/artifacts/${hash}`);
            // eslint-disable-next-line n/no-unsupported-features/node-builtins
            const response = await fetch(artifactUrl, {
                headers: this.#buildHeaders(),
                method: "HEAD",
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
}

export type { RemoteCacheOptions };
export { RemoteCache };
