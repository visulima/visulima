import { createHmac, timingSafeEqual } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rm, stat } from "node:fs/promises";
import { pipeline } from "node:stream/promises";

import { join } from "@visulima/path";

import { createTarBrotli, createTarGz, extractTarBrotli, extractTarGz } from "./archive";

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
 * HMAC signing configuration for cache integrity.
 *
 * When set, every upload carries an `X-Artifact-Signature` header
 * containing the HMAC-SHA256 digest of `hash | body`. On download,
 * the client recomputes the HMAC and rejects any artifact whose
 * signature doesn't match using a constant-time comparison.
 *
 * Prevents cache poisoning in shared team environments where a
 * compromised cache server (or a MITM) could inject malicious
 * artifacts. Unsigned entries (written before signing was enabled)
 * are accepted only when `verifyOnDownload === false` — the default.
 */
export interface RemoteCacheSigning {
    /** Shared secret. Must be at least 16 characters. */
    secret: string;

    /**
     * Reject downloads whose signature doesn't match or is missing.
     * Set to `true` once every upload on your server is signed.
     * @default false
     */
    verifyOnDownload?: boolean;
}

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

    /**
     * HMAC-SHA256 signing for upload integrity. When set, every
     * uploaded artifact carries an `X-Artifact-Signature` header;
     * downloads with `verifyOnDownload: true` reject unsigned or
     * tampered payloads.
     */
    signing?: RemoteCacheSigning;
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

/** Header carrying the HMAC-SHA256 signature for an artifact upload. */
const SIGNATURE_HEADER = "X-Artifact-Signature";

const MIN_SECRET_LENGTH = 16;

/**
 * Computes `HMAC-SHA256(secret, hash || body)` as a hex string by
 * streaming the archive off disk one chunk at a time. The `hash`
 * prefix binds the signature to the artifact's logical identity so
 * a valid signature for one artifact can't be replayed to poison
 * another entry. Streaming keeps memory flat for multi-hundred-MB
 * tarballs — both upload and download paths use this.
 */
const computeArtifactSignatureStream = async (secret: string, hash: string, archivePath: string): Promise<string> => {
    const hmac = createHmac("sha256", secret);

    hmac.update(hash);

    const source = createReadStream(archivePath);

    for await (const chunk of source) {
        hmac.update(chunk as Buffer);
    }

    return hmac.digest("hex");
};

/**
 * Constant-time string comparison. `createHmac('sha256')` always
 * produces 64 hex characters, so we allocate Buffers of equal length
 * before handing them to `timingSafeEqual`.
 */
const signaturesMatch = (a: string, b: string): boolean => {
    if (a.length !== b.length) {
        return false;
    }

    try {
        return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
    } catch {
        return false;
    }
};

// Archive helpers (tar, tar+gzip, tar+brotli) live in `./archive` so
// both the local cache and this remote cache share one implementation.

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

    readonly #signingSecret: string | undefined;

    readonly #verifyOnDownload: boolean;

    public constructor(options: RemoteCacheOptions) {
        this.#url = options.url.replace(/\/$/, "");
        this.#token = options.token;
        this.#teamId = options.teamId;
        this.#timeout = options.timeout ?? 30_000;
        this.#read = options.read ?? true;
        this.#write = options.write ?? true;
        this.#onUploadError = options.onUploadError;
        this.#compression = options.compression ?? "gzip";

        if (options.signing) {
            if (options.signing.secret.length < MIN_SECRET_LENGTH) {
                throw new Error(`Remote cache signing secret must be at least ${String(MIN_SECRET_LENGTH)} characters.`);
            }

            this.#signingSecret = options.signing.secret;
            this.#verifyOnDownload = options.signing.verifyOnDownload ?? false;
        } else {
            this.#signingSecret = undefined;
            this.#verifyOnDownload = false;
        }
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

            // Snapshot the header before we consume the body — on the
            // strict-verify path we can reject early without touching
            // the wire at all, and in the mismatch case we want the
            // received value captured before any stream plumbing.
            const receivedSignature = this.#signingSecret
                ? (response.headers.get(SIGNATURE_HEADER.toLowerCase()) ?? response.headers.get(SIGNATURE_HEADER))
                : null;

            if (this.#signingSecret && !receivedSignature && this.#verifyOnDownload) {
                // Strict mode: server didn't send a signature — refuse
                // before streaming so we don't pay the IO cost for an
                // artifact we'd throw away anyway.
                return false;
            }

            if (!response.body) {
                return false;
            }

            // Stream the response straight to disk. Avoids buffering
            // large tarballs (hundreds of MB on real workspaces) in
            // memory just to compute a hash — the HMAC pass below
            // re-reads the file chunk-by-chunk instead.
            await mkdir(localCacheDirectory, { recursive: true });
            await pipeline(response.body as unknown as NodeJS.ReadableStream, createWriteStream(archivePath));

            if (this.#signingSecret && receivedSignature) {
                const expected = await computeArtifactSignatureStream(this.#signingSecret, hash, archivePath);

                if (!signaturesMatch(receivedSignature, expected)) {
                    // Mismatch — refuse the artifact and nuke the
                    // download so a compromised cache server can't
                    // poison downstream via this hash.
                    return false;
                }
            }

            // Extract the archive to the cache entry directory
            await mkdir(entryDirectory, { recursive: true });

            await (this.#compression === "brotli" ? extractTarBrotli(archivePath, entryDirectory) : extractTarGz(archivePath, entryDirectory));

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
            await (this.#compression === "brotli" ? createTarBrotli(entryDirectory, archivePath) : createTarGz(entryDirectory, archivePath));

            const artifactUrl = this.#buildUrl(`/v8/artifacts/${hash}`);
            const { size } = await stat(archivePath);

            // Sign the archive via a streaming read so we don't hold the
            // entire payload in memory. Falls back to no header when
            // signing isn't configured.
            const uploadHeaders: Record<string, string> = {
                ...this.#buildHeaders(),
                "Content-Length": String(size),
                // Advertise the compression format in a custom header so
                // spec-compatible servers (and the matching download side)
                // can branch if needed. The body is still an opaque blob
                // from the server's perspective.
                "Content-Type": "application/octet-stream",
                "X-Artifact-Compression": this.#compression,
            };

            if (this.#signingSecret) {
                // HMAC-SHA256(secret, hash || body) computed via stream
                // so the archive never has to fit in memory. The hash
                // prefix binds the signature to this artifact's logical
                // id so a valid signature can't be replayed against a
                // different cache entry.
                uploadHeaders[SIGNATURE_HEADER] = await computeArtifactSignatureStream(this.#signingSecret, hash, archivePath);
            }

            // `undici`'s fetch accepts a Node ReadableStream for `body`
            // and streams the upload without buffering. The extra
            // `duplex: "half"` cast is required for Node's type defs.
            const response = await fetch(artifactUrl, {
                body: createReadStream(archivePath) as unknown as BodyInit,
                // @ts-expect-error — `duplex` is a Node-specific fetch
                // option required when the body is a stream. The DOM
                // `RequestInit` type doesn't include it yet.
                duplex: "half",
                headers: uploadHeaders,
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
