import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { pipeline } from "node:stream/promises";

import { join } from "@visulima/path";

import { fetchBlobToFile, putBlobFromFile } from "../cas/store";
import { uniqueId } from "../utils";
import type { ActionResult, BlobSource, CasDigest, RemoteCacheAttestation, RemoteCacheBackend, RemoteCacheCompression, RemoteCacheOptions } from "./types";

/** Header carrying the HMAC-SHA256 signature for an artifact upload. */
const SIGNATURE_HEADER = "X-Artifact-Signature";

/** Header carrying an opaque keyless attestation bundle (Sigstore). */
const ATTESTATION_HEADER = "X-Artifact-Attestation";

const MIN_SECRET_LENGTH = 16;

/**
 * Path used inside the synthesized {@link ActionResult} for the
 * single-tarball blob the HTTP backend ships per action. Opaque to
 * the wire; only the bridge inspects it when re-extracting locally.
 */
const BLOB_OUTPUT_PATH = "vis-entry.tar.gz";

/**
 * Compute a {@link CasDigest} for a file by streaming its bytes
 * through sha256. Used to tag downloaded tarballs before they're
 * staged into the local CAS so the bridge can `fetchBlob` them by
 * the same digest the {@link ActionResult} reports.
 */
const digestFile = async (path: string): Promise<CasDigest> => {
    const hash = createHash("sha256");
    let sizeBytes = 0;

    for await (const chunk of createReadStream(path)) {
        const buffer = chunk as Buffer;

        hash.update(buffer);
        sizeBytes += buffer.byteLength;
    }

    return { hash: hash.digest("hex"), sizeBytes };
};

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

// Archive helpers (tar, tar+gzip, tar+brotli) live in `../archive` so
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
class HttpRemoteCache implements RemoteCacheBackend {
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

    readonly #attestation: RemoteCacheAttestation | undefined;

    readonly #requireAttestation: boolean;

    readonly #localCasRoot: string | undefined;

    /**
     * Per-digest in-flight upload dedup. Two concurrent `storeAction`
     * calls referencing the same blob upload it once per process
     * lifetime, matching REAPI's `FindMissingBlobs` elision.
     */
    readonly #inflightUploads = new Map<string, Promise<boolean>>();

    public constructor(options: RemoteCacheOptions) {
        this.#url = options.url.replace(/\/$/, "");
        this.#token = options.token;
        this.#teamId = options.teamId;
        this.#timeout = options.timeout ?? 30_000;

        const mode = options.mode ?? "readwrite";

        this.#read = mode === "read" || mode === "readwrite";
        this.#write = mode === "write" || mode === "readwrite";
        this.#onUploadError = options.onUploadError;
        this.#compression = options.compression ?? "gzip";
        this.#localCasRoot = options.localCasRoot;

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

        this.#attestation = options.attestation;
        this.#requireAttestation = options.attestation?.requireOnDownload ?? false;
    }

    /**
     * No-op. The HTTP backend uses Node's global `fetch`, which has no
     * persistent connection to release. Implemented to satisfy the
     * {@link RemoteCacheBackend.close} contract uniformly.
     */
    // eslint-disable-next-line class-methods-use-this
    public async close(): Promise<void> {
        // intentionally empty
    }

    /**
     * {@link RemoteCacheBackend.containsAction}: HEAD on the artifact URL.
     * Resolves `false` on any wire failure — existence checks are best
     * effort and never block the caller.
     */
    public async containsAction(actionDigest: CasDigest): Promise<boolean> {
        if (!this.#read) {
            return false;
        }

        try {
            const artifactUrl = this.#buildUrl(`/v8/artifacts/${actionDigest.hash}`);

            const response = await this.#fetchWithRetry(artifactUrl, {
                headers: this.#buildHeaders(),
                method: "HEAD",
            });

            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * {@link RemoteCacheBackend.fetchBlob}: streams a blob out of the
     * local CAS that was hydrated by a previous {@link retrieveAction}
     * call. The HTTP wire ships one tarball per action, so per-blob
     * fetches are local-only — there's no remote endpoint to call.
     */
    public async fetchBlob(digest: CasDigest, destinationPath: string): Promise<boolean> {
        if (!this.#localCasRoot) {
            return false;
        }

        return fetchBlobToFile(this.#localCasRoot, digest, destinationPath);
    }

    /**
     * {@link RemoteCacheBackend.retrieveAction}: GETs the artifact at
     * `/v8/artifacts/{actionDigest.hash}`, ingests the response bytes
     * as a single CAS blob in the local store, and synthesises an
     * {@link ActionResult} that points at that blob. Resolves to `null`
     * on a 404 / signature mismatch / missing local CAS root.
     */
    public async retrieveAction(actionDigest: CasDigest): Promise<ActionResult | null> {
        if (!this.#read || !this.#localCasRoot) {
            return null;
        }

        const stagingRoot = join(this.#localCasRoot, "v2", "tmp");
        const stagingPath = join(stagingRoot, `.remote-${actionDigest.hash}-${uniqueId()}`);

        try {
            await mkdir(stagingRoot, { recursive: true });

            const artifactUrl = this.#buildUrl(`/v8/artifacts/${actionDigest.hash}`);

            const response = await this.#fetchWithRetry(artifactUrl, {
                headers: this.#buildHeaders(),
                method: "GET",
            });

            // 404 is a legitimate cache miss; everything else is a
            // configuration / wire problem that the operator needs
            // to see, not silently swallow as if no entry existed.
            // Auth (401/403), 5xx that survived retry, and similar
            // are surfaced via `onUploadError` (reusing the same
            // sink so operators have one place to look) before we
            // degrade to "miss".
            if (response.status === 404) {
                return null;
            }

            if (!response.ok || !response.body) {
                this.#onUploadError?.(actionDigest.hash, new Error(`remote cache GET ${actionDigest.hash} returned HTTP ${response.status}`));

                return null;
            }

            const receivedSignature = this.#signingSecret
                ? (response.headers.get(SIGNATURE_HEADER.toLowerCase()) ?? response.headers.get(SIGNATURE_HEADER))
                : null;

            if (this.#signingSecret && !receivedSignature && this.#verifyOnDownload) {
                return null;
            }

            await pipeline(response.body as unknown as NodeJS.ReadableStream, createWriteStream(stagingPath));

            // Content-Length integrity check. Without signing
            // configured (the default), this is the only line of
            // defence against a truncated body landing in the local
            // CAS under a hash that no longer matches the bytes —
            // which then crashes the next decompression with an
            // unhelpful "invalid archive" error. A mismatch is
            // surfaced via `onUploadError` and the entry is rejected
            // (not stored), so the orchestrator falls back to
            // re-executing the task with a clear diagnostic.
            const declaredLength = response.headers.get("content-length");

            if (declaredLength !== null) {
                const expectedSize = Number.parseInt(declaredLength, 10);
                const { size: actualSize } = await stat(stagingPath);

                if (Number.isFinite(expectedSize) && actualSize !== expectedSize) {
                    this.#onUploadError?.(
                        actionDigest.hash,
                        new Error(`remote cache GET ${actionDigest.hash} truncated: declared ${expectedSize} bytes, received ${actualSize}`),
                    );

                    return null;
                }
            }

            if (this.#signingSecret && receivedSignature) {
                const expected = await computeArtifactSignatureStream(this.#signingSecret, actionDigest.hash, stagingPath);

                if (!signaturesMatch(receivedSignature, expected)) {
                    return null;
                }
            }

            if (this.#attestation?.verifyArtifact) {
                const receivedAttestation = response.headers.get(ATTESTATION_HEADER);

                if (receivedAttestation) {
                    const ok = await this.#attestation.verifyArtifact({
                        archivePath: stagingPath,
                        attestation: receivedAttestation,
                        hash: actionDigest.hash,
                    });

                    if (!ok) {
                        this.#attestation.onReject?.(actionDigest.hash, "invalid");

                        return null;
                    }
                } else if (this.#requireAttestation) {
                    this.#attestation.onReject?.(actionDigest.hash, "missing");

                    return null;
                }
            }

            const blobDigest = await digestFile(stagingPath);

            await putBlobFromFile(this.#localCasRoot, blobDigest, stagingPath);

            return {
                exitCode: 0,
                outputDirectories: [],
                outputFiles: [{ digest: blobDigest, isExecutable: false, path: BLOB_OUTPUT_PATH }],
            };
        } catch {
            return null;
        } finally {
            await rm(stagingPath, { force: true }).catch(() => {});
        }
    }

    /**
     * {@link RemoteCacheBackend.storeAction}: takes the single blob
     * referenced by `result.outputFiles[0]`, streams its bytes as the
     * PUT body, and signs the body when a signing secret is configured.
     * Per-digest in-flight dedup means parallel writers racing on the
     * same action upload exactly once.
     */
    public async storeAction(actionDigest: CasDigest, result: ActionResult, blobs: ReadonlyArray<BlobSource>): Promise<boolean> {
        if (!this.#write) {
            return false;
        }

        if (result.outputFiles.length !== 1 || blobs.length === 0) {
            return false;
        }

        const tarballEntry = result.outputFiles[0];

        if (!tarballEntry) {
            return false;
        }

        const blob = blobs.find((candidate) => candidate.digest.hash === tarballEntry.digest.hash);

        if (!blob) {
            return false;
        }

        const existing = this.#inflightUploads.get(actionDigest.hash);

        if (existing) {
            return existing;
        }

        const upload = this.#uploadAction(actionDigest, blob).finally(() => {
            this.#inflightUploads.delete(actionDigest.hash);
        });

        this.#inflightUploads.set(actionDigest.hash, upload);

        return upload;
    }

    async #uploadAction(actionDigest: CasDigest, blob: BlobSource): Promise<boolean> {
        const stagingRoot = this.#localCasRoot ? join(this.#localCasRoot, "v2", "tmp") : join(tmpdir(), "visulima-task-runner-uploads");
        const stagingPath = join(stagingRoot, `.upload-${actionDigest.hash}-${uniqueId()}`);

        try {
            await mkdir(stagingRoot, { recursive: true });

            const source = await blob.open();

            await pipeline(source, createWriteStream(stagingPath));

            const artifactUrl = this.#buildUrl(`/v8/artifacts/${actionDigest.hash}`);
            const { size } = await stat(stagingPath);

            const uploadHeaders: Record<string, string> = {
                ...this.#buildHeaders(),
                "Content-Length": String(size),
                "Content-Type": "application/octet-stream",
                "X-Artifact-Compression": this.#compression,
            };

            if (this.#signingSecret) {
                uploadHeaders[SIGNATURE_HEADER] = await computeArtifactSignatureStream(this.#signingSecret, actionDigest.hash, stagingPath);
            }

            if (this.#attestation?.signArtifact) {
                const bundle = await this.#attestation.signArtifact({ archivePath: stagingPath, hash: actionDigest.hash });

                if (bundle !== null) {
                    uploadHeaders[ATTESTATION_HEADER] = bundle;
                }
            }

            // PUTs intentionally don't go through `fetchWithRetry`:
            // each retry would have to re-open the file stream, and
            // duplicate writes on the server side aren't free. Single
            // attempt; non-OK still surfaces via onUploadError below
            // so the operator sees auth / quota / 5xx instead of a
            // silent skip.
            const response = await fetch(artifactUrl, {
                body: createReadStream(stagingPath) as unknown as BodyInit,
                // @ts-expect-error — `duplex` is a Node-specific fetch
                // option required when the body is a stream.
                duplex: "half",
                headers: uploadHeaders,
                method: "PUT",
                signal: AbortSignal.timeout(this.#timeout),
            });

            if (!response.ok) {
                this.#onUploadError?.(
                    actionDigest.hash,
                    new Error(`remote cache PUT ${actionDigest.hash} returned HTTP ${response.status}`),
                );

                return false;
            }

            return true;
        } catch (error) {
            this.#onUploadError?.(actionDigest.hash, error);

            return false;
        } finally {
            await rm(stagingPath, { force: true }).catch(() => {});
        }
    }

    /**
     * Fetch wrapper that retries idempotent reads (GET/HEAD) on
     * transient failures — 502/503/504 from Vercel/S3-backed Turbo
     * caches, 429 burst rejects on shared CI runners, and aborted
     * connections. Exponential backoff (250 ms → 500 → 1000 → 2000,
     * capped at 4 attempts) so a flapping cache server doesn't
     * silently force every task to re-execute. PUTs are NOT routed
     * through here (see `#uploadAction`).
     *
     * 429 `Retry-After` is honoured when present and reasonable
     * (≤ this.#timeout); otherwise we fall back to the exponential
     * delay. Anything outside this set (4xx, success, body errors)
     * returns immediately so the caller can decide.
     */
    async #fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
        const RETRY_STATUSES = new Set([429, 502, 503, 504]);
        const MAX_ATTEMPTS = 4;
        const BASE_DELAY_MS = 250;
        let lastError: unknown;

        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
            try {
                const response = await fetch(url, {
                    ...init,
                    signal: AbortSignal.timeout(this.#timeout),
                });

                if (!RETRY_STATUSES.has(response.status) || attempt === MAX_ATTEMPTS - 1) {
                    return response;
                }

                const retryAfter = response.headers.get("retry-after");
                let delay = BASE_DELAY_MS * (2 ** attempt);

                if (retryAfter !== null) {
                    const parsed = Number.parseInt(retryAfter, 10);

                    if (Number.isFinite(parsed) && parsed > 0) {
                        delay = Math.min(parsed * 1000, this.#timeout);
                    }
                }

                await new Promise((resolve) => {
                    setTimeout(resolve, delay);
                });
            } catch (error) {
                lastError = error;

                // Don't retry abort errors caused by our own timeout;
                // those mean the per-request budget is up.
                if ((error as Error)?.name === "TimeoutError" || attempt === MAX_ATTEMPTS - 1) {
                    throw error;
                }

                await new Promise((resolve) => {
                    setTimeout(resolve, BASE_DELAY_MS * (2 ** attempt));
                });
            }
        }

        // Unreachable: the loop always either returns or throws.
        throw (lastError ?? new Error("remote cache request exhausted retries"));
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

export { HttpRemoteCache };
