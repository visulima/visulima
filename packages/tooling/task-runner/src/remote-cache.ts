import { execFile } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, rm, stat } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { createBrotliCompress, createBrotliDecompress, constants as zlibConstants } from "node:zlib";

import { join } from "@visulima/path";

/**
 * Compression algorithm used for artifact tarballs on the wire.
 * - `"gzip"` (default): tar+gzip, matches Turborepo's protocol format
 *   and stays interop-safe with existing remote cache servers.
 * - `"brotli"`: tar + Node brotli (BROTLI_MODE_TEXT, quality 4) — a
 *   solid ratio/speed trade-off for source-tree tarballs. Both upload
 *   and download sides must agree; switching invalidates existing
 *   remote entries (they will simply re-populate on next run).
 */
export type RemoteCacheCompression = "brotli" | "gzip";

/**
 * Options for the remote cache.
 */
interface RemoteCacheOptions {
    /**
     * Compression format for artifact tarballs. Defaults to `"gzip"`
     * for Turborepo protocol compatibility.
     */
    compression?: RemoteCacheCompression;
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
        execFile("tar", ["-xzf", archivePath, "-C", destinationDirectory], (error) => {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
    });

const createTar = (sourceDirectory: string, outputPath: string): Promise<void> =>
    new Promise((resolve, reject) => {
        execFile("tar", ["-cf", outputPath, "-C", sourceDirectory, "."], (error) => {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
    });

const extractTar = (archivePath: string, destinationDirectory: string): Promise<void> =>
    new Promise((resolve, reject) => {
        execFile("tar", ["-xf", archivePath, "-C", destinationDirectory], (error) => {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
    });

/**
 * Brotli quality 4 hits a sweet spot for cache tarballs: ~15% smaller
 * than gzip -6 on typical source/dist payloads at comparable throughput.
 * Higher qualities (8+) reach diminishing returns and slow uploads.
 */
const BROTLI_OPTIONS = {
    params: {
        [zlibConstants.BROTLI_PARAM_MODE]: zlibConstants.BROTLI_MODE_TEXT,
        [zlibConstants.BROTLI_PARAM_QUALITY]: 4,
    },
};

/**
 * Creates an uncompressed tar and pipes it through brotli into `outputPath`.
 * Uses a two-step (tar to temp, then brotli-stream it) to avoid shelling
 * out to an external `brotli` binary that may not exist.
 */
const createTarBrotli = async (sourceDirectory: string, outputPath: string): Promise<void> => {
    const tarPath = `${outputPath}.tar`;

    try {
        await createTar(sourceDirectory, tarPath);
        await pipeline(createReadStream(tarPath), createBrotliCompress(BROTLI_OPTIONS), createWriteStream(outputPath));
    } finally {
        await rm(tarPath, { force: true }).catch(() => {});
    }
};

const extractTarBrotli = async (archivePath: string, destinationDirectory: string): Promise<void> => {
    const tarPath = `${archivePath}.tar`;

    try {
        await pipeline(createReadStream(archivePath), createBrotliDecompress(), createWriteStream(tarPath));
        await extractTar(tarPath, destinationDirectory);
    } finally {
        await rm(tarPath, { force: true }).catch(() => {});
    }
};

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

    readonly #compression: RemoteCacheCompression;

    public constructor(options: RemoteCacheOptions) {
        this.#url = options.url.replace(/\/$/, "");
        this.#token = options.token;
        this.#teamId = options.teamId;
        this.#timeout = options.timeout ?? 30_000;
        this.#read = options.read ?? true;
        this.#write = options.write ?? true;
        this.#onUploadError = options.onUploadError;
        this.#compression = options.compression ?? "gzip";
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

            await pipeline(body as unknown as NodeJS.ReadableStream, fileStream);

            // Extract the archive to the cache entry directory
            await mkdir(entryDirectory, { recursive: true });

            if (this.#compression === "brotli") {
                await extractTarBrotli(archivePath, entryDirectory);
            } else {
                await extractTarGz(archivePath, entryDirectory);
            }

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

            // Compressed tarball of the cache entry, algorithm per config.
            if (this.#compression === "brotli") {
                await createTarBrotli(entryDirectory, archivePath);
            } else {
                await createTarGz(entryDirectory, archivePath);
            }

            const artifactUrl = this.#buildUrl(`/v8/artifacts/${hash}`);
            const archiveContent = await readFile(archivePath);

            const response = await fetch(artifactUrl, {
                body: archiveContent,
                headers: {
                    ...this.#buildHeaders(),
                    "Content-Length": String(archiveContent.length),
                    // Advertise the compression format in a custom header so
                    // spec-compatible servers (and the matching download side)
                    // can branch if needed. The body is still an opaque blob
                    // from the server's perspective.
                    "Content-Type": "application/octet-stream",
                    "X-Artifact-Compression": this.#compression,
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
// RemoteCacheCompression is exported above as `export type`, re-export grouping
// intentional to stay compatible with consumers importing from the barrel.
