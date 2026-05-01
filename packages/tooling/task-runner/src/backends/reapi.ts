import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { dirname } from "@visulima/path";

import type { GrpcClientLike, ReapiGrpcClients } from "./reapi-proto/loader";
import { loadReapiProto } from "./reapi-proto/loader";
import type { ActionResult, BlobSource, CasDigest, RemoteCacheBackend, RemoteCacheOptions } from "./types";

/**
 * REAPI-specific options accepted by {@link ReapiRemoteCache}. A type
 * alias rather than its own interface so callers can hand the same
 * object to the backend factory or to the constructor directly without
 * rewriting field names. HTTP-only fields (`signing`, `compression`)
 * are silently ignored here.
 */
export type ReapiRemoteCacheOptions = RemoteCacheOptions;

const COMPRESSOR_IDENTITY = "IDENTITY";
const STATUS_OK = 0;
const STATUS_NOT_FOUND = 5;
const STATUS_UNAUTHENTICATED = 16;
const STATUS_PERMISSION_DENIED = 7;
const DEFAULT_MAX_BATCH_TOTAL_SIZE_BYTES = 4 * 1024 * 1024;
const STREAM_CHUNK_SIZE = 64 * 1024;

/**
 * Conservative per-entry overhead inside a `BatchUpdateBlobsRequest`.
 * Each entry adds: outer message tag + length-prefix, a `Digest`
 * sub-message (sha256 hex hash up to 64 bytes + size_bytes varint), the
 * `data` field tag + length-prefix, and the `compressor` enum. Budgeting
 * 256 bytes covers all of that with margin so a blob whose payload is
 * exactly at `max_batch_total_size_bytes` does not push the framed
 * request over the server limit.
 */
const BATCH_ENTRY_OVERHEAD_BYTES = 256;
// Streams ship multi-MB blobs and need a longer deadline than unary RPCs.
const STREAM_DEADLINE_MULTIPLIER = 10;

const buildReadResourceName = (instanceName: string, digest: CasDigest): string => {
    const prefix = instanceName === "" ? "" : `${instanceName}/`;

    return `${prefix}blobs/${digest.hash}/${String(digest.sizeBytes)}`;
};

const buildWriteResourceName = (instanceName: string, digest: CasDigest): string => {
    const prefix = instanceName === "" ? "" : `${instanceName}/`;

    return `${prefix}uploads/${randomUUID()}/blobs/${digest.hash}/${String(digest.sizeBytes)}`;
};

const callUnary = async <Response>(
    client: GrpcClientLike,
    method: string,
    request: unknown,
    metadata: unknown,
    deadlineMs: number,
): Promise<Response> => {
    const fn = client[method];

    if (typeof fn !== "function") {
        throw new TypeError(`[task-runner] REAPI client is missing method ${method} — proto descriptor mismatch.`);
    }

    return new Promise<Response>((resolve, reject) => {
        const callOptions = { deadline: Date.now() + deadlineMs } as Record<string, unknown>;

        (fn as (this: GrpcClientLike, request: unknown, metadata: unknown, options: unknown, callback: (error: Error | null, response: Response) => void) => unknown).call(
            client,
            request,
            metadata,
            callOptions,
            (error, response) => {
                if (error) {
                    reject(error);

                    return;
                }

                resolve(response);
            },
        );
    });
};

/**
 * Bazel REAPI gRPC backend. Implements {@link RemoteCacheBackend} over
 * `ContentAddressableStorage` + `ActionCache` + `Capabilities` +
 * `google.bytestream.ByteStream`. Battle-tested REAPI servers
 * (`bazel-remote`, BuildBuddy, BuildBarn, EngFlow) become drop-in
 * backends with no per-server adapter.
 *
 * Wire flow:
 *   - retrieveAction → GetActionResult → fetchBlob (BatchReadBlobs|Read)
 *   - storeAction    → FindMissingBlobs → BatchUpdateBlobs|Write → UpdateActionResult
 */
export class ReapiRemoteCache implements RemoteCacheBackend {
    readonly #target: string;

    readonly #useTls: boolean;

    readonly #bearerToken: string | undefined;

    readonly #instanceName: string;

    readonly #read: boolean;

    readonly #write: boolean;

    readonly #timeout: number;

    readonly #onUploadError: ((hash: string, error: unknown) => void) | undefined;

    readonly #inflightUploads = new Map<string, Promise<boolean>>();

    #clientsPromise: Promise<{
        actionCache: GrpcClientLike;
        byteStream: GrpcClientLike;
        capabilities: GrpcClientLike;
        cas: GrpcClientLike;
        clients: ReapiGrpcClients;
        grpc: typeof import("@grpc/grpc-js");
    }> | undefined;

    #capabilities: { digestFunctions: ReadonlyArray<string>; maxBatchTotalSizeBytes: number } | undefined;

    public constructor(options: ReapiRemoteCacheOptions) {
        const { target, useTls } = parseGrpcUrl(options.url);

        this.#target = target;
        this.#useTls = useTls;
        this.#bearerToken = options.bearerToken;
        this.#instanceName = options.instanceName ?? "";
        this.#timeout = options.timeout ?? 30_000;
        this.#onUploadError = options.onUploadError;

        const mode = options.mode ?? "readwrite";

        this.#read = mode === "read" || mode === "readwrite";
        this.#write = mode === "write" || mode === "readwrite";

        if (this.#bearerToken !== undefined && !this.#useTls && options.allowInsecureBearer !== true) {
            throw new Error(
                "[task-runner] remoteCache.backend = \"reapi\" refuses to send a bearer token over cleartext gRPC. "
                + "Use `grpcs://` (or terminate TLS at a reverse proxy), or pass `allowInsecureBearer: true` "
                + "for trusted-boundary deployments (loopback, mesh mTLS sidecar).",
            );
        }
    }

    /**
     * Close all gRPC channels held by this backend. Idempotent — safe
     * to call multiple times, and safe to call before any RPC was
     * issued. If `#getClients` is currently in flight we await its
     * resolution so the underlying channels are observable to close.
     */
    public async close(): Promise<void> {
        const pending = this.#clientsPromise;

        if (pending === undefined) {
            return;
        }

        this.#clientsPromise = undefined;

        let resolved: Awaited<typeof pending>;

        try {
            resolved = await pending;
        } catch {
            return;
        }

        for (const client of [resolved.actionCache, resolved.byteStream, resolved.capabilities, resolved.cas]) {
            try {
                client.close();
            } catch {
                // best-effort — close failures cannot signal anything
                // actionable to the caller; channels go away on process exit.
            }
        }
    }

    /**
     * Diagnostic probe — fetches the server's `Capabilities` RPC response
     * (or the cached value, if a previous call already negotiated). Used
     * by `vis cache doctor` to surface what the server advertises without
     * forcing the operator to issue a real CAS RPC.
     *
     * Bypasses the read/write mode gate intentionally: a probe must work
     * even on a cache configured `mode: "write"` so the operator can
     * verify the connection regardless of how the runner uses it.
     */
    public async probeCapabilities(): Promise<{
        digestFunctions: ReadonlyArray<string>;
        maxBatchTotalSizeBytes: number;
    }> {
        return this.#negotiateCapabilities();
    }

    public async containsAction(actionDigest: CasDigest): Promise<boolean> {
        if (!this.#read) {
            return false;
        }

        await this.#assertSha256Supported();

        try {
            const { actionCache } = await this.#getClients();
            const metadata = await this.#buildMetadata();

            await callUnary(
                actionCache,
                "GetActionResult",
                {
                    action_digest: digestToProto(actionDigest),
                    inline_stderr: false,
                    inline_stdout: false,
                    instance_name: this.#instanceName,
                },
                metadata,
                this.#timeout,
            );

            return true;
        } catch (error) {
            if (isNotFoundError(error)) {
                return false;
            }

            throw error;
        }
    }

    public async fetchBlob(digest: CasDigest, destinationPath: string): Promise<boolean> {
        if (!this.#read) {
            return false;
        }

        await this.#assertSha256Supported();

        try {
            const maxBatchSize = await this.#getMaxBatchSize();

            await mkdir(dirname(destinationPath), { recursive: true });

            if (digest.sizeBytes <= maxBatchSize) {
                const bytes = await this.#batchReadOne(digest);

                if (bytes === undefined) {
                    return false;
                }

                await pipeline(Readable.from(bytes), createWriteStream(destinationPath));

                return true;
            }

            return await this.#streamRead(digest, destinationPath);
        } catch {
            await rm(destinationPath, { force: true }).catch(() => {});

            return false;
        }
    }

    public async retrieveAction(actionDigest: CasDigest): Promise<ActionResult | null> {
        if (!this.#read) {
            return null;
        }

        await this.#assertSha256Supported();

        try {
            const { actionCache } = await this.#getClients();
            const metadata = await this.#buildMetadata();
            const proto = await callUnary<ProtoActionResult>(
                actionCache,
                "GetActionResult",
                {
                    action_digest: digestToProto(actionDigest),
                    inline_stderr: false,
                    inline_stdout: false,
                    instance_name: this.#instanceName,
                },
                metadata,
                this.#timeout,
            );

            return protoToActionResult(proto);
        } catch (error) {
            if (isNotFoundError(error)) {
                return null;
            }

            throw error;
        }
    }

    public async storeAction(actionDigest: CasDigest, result: ActionResult, blobs: ReadonlyArray<BlobSource>): Promise<boolean> {
        if (!this.#write) {
            return false;
        }

        await this.#assertSha256Supported();

        try {
            const missing = await this.#findMissingBlobs(blobs.map((blob) => blob.digest));
            const missingSet = new Set(missing.map((digest) => digest.hash));
            const blobsToUpload = blobs.filter((blob) => missingSet.has(blob.digest.hash));

            await this.#uploadBlobs(blobsToUpload);

            const { actionCache } = await this.#getClients();
            const metadata = await this.#buildMetadata();

            await callUnary(
                actionCache,
                "UpdateActionResult",
                {
                    action_digest: digestToProto(actionDigest),
                    action_result: actionResultToProto(result),
                    instance_name: this.#instanceName,
                },
                metadata,
                this.#timeout,
            );

            return true;
        } catch (error) {
            this.#onUploadError?.(actionDigest.hash, error);

            return false;
        }
    }

    async #getClients(): Promise<{
        actionCache: GrpcClientLike;
        byteStream: GrpcClientLike;
        capabilities: GrpcClientLike;
        cas: GrpcClientLike;
        clients: ReapiGrpcClients;
        grpc: typeof import("@grpc/grpc-js");
    }> {
        if (this.#clientsPromise === undefined) {
            this.#clientsPromise = (async () => {
                const { clients, grpc } = await loadReapiProto();
                const credentials = this.#useTls ? grpc.credentials.createSsl() : grpc.credentials.createInsecure();

                return {
                    actionCache: new clients.ActionCache(this.#target, credentials) as unknown as GrpcClientLike,
                    byteStream: new clients.ByteStream(this.#target, credentials) as unknown as GrpcClientLike,
                    capabilities: new clients.Capabilities(this.#target, credentials) as unknown as GrpcClientLike,
                    cas: new clients.ContentAddressableStorage(this.#target, credentials) as unknown as GrpcClientLike,
                    clients,
                    grpc,
                };
            })();
        }

        return this.#clientsPromise;
    }

    async #buildMetadata(): Promise<unknown> {
        const { grpc } = await this.#getClients();
        const metadata = new grpc.Metadata();

        if (this.#bearerToken !== undefined) {
            metadata.set("authorization", `Bearer ${this.#bearerToken}`);
        }

        return metadata;
    }

    async #getMaxBatchSize(): Promise<number> {
        const negotiated = await this.#negotiateCapabilities();

        return negotiated.maxBatchTotalSizeBytes;
    }

    /**
     * One-shot capability negotiation. Caches the result so the
     * first {@link RemoteCacheBackend} method to need it pays the
     * round-trip and every subsequent call sees the cached values.
     *
     * Auth failures (`UNAUTHENTICATED` / `PERMISSION_DENIED`) are
     * re-thrown — falling back silently would let a misconfigured
     * token survive until the next CAS RPC, where the failure mode is
     * less obviously "fix your auth". `NOT_FOUND` and benign network
     * errors degrade to defaults so the backend stays usable against
     * older REAPI servers that do not implement Capabilities.
     *
     * `digest_functions` is recorded so `#assertSha256Supported`
     * can refuse to talk to a server that only advertises non-sha256
     * digests — vis pins sha256 for action digests and a server
     * expecting BLAKE3 would reject every request with
     * `INVALID_ARGUMENT`.
     */
    async #negotiateCapabilities(): Promise<{ digestFunctions: ReadonlyArray<string>; maxBatchTotalSizeBytes: number }> {
        if (this.#capabilities !== undefined) {
            return this.#capabilities;
        }

        try {
            const { capabilities } = await this.#getClients();
            const metadata = await this.#buildMetadata();
            const response = await callUnary<ProtoServerCapabilities>(
                capabilities,
                "GetCapabilities",
                { instance_name: this.#instanceName },
                metadata,
                this.#timeout,
            );

            const cacheCaps = response?.cache_capabilities;
            const advertised = cacheCaps && typeof cacheCaps.max_batch_total_size_bytes === "number" ? cacheCaps.max_batch_total_size_bytes : 0;
            const digestFunctions = (cacheCaps?.digest_functions ?? []).map(String);

            this.#capabilities = {
                digestFunctions,
                maxBatchTotalSizeBytes: advertised > 0 ? advertised : DEFAULT_MAX_BATCH_TOTAL_SIZE_BYTES,
            };

            return this.#capabilities;
        } catch (error) {
            if (isAuthError(error)) {
                throw error;
            }

            this.#capabilities = { digestFunctions: [], maxBatchTotalSizeBytes: DEFAULT_MAX_BATCH_TOTAL_SIZE_BYTES };

            return this.#capabilities;
        }
    }

    /**
     * Refuse to issue CAS / ActionCache RPCs against a server whose
     * advertised digest functions don't include sha256. Skipped when
     * negotiation found an empty list (older / non-conforming
     * servers) — there we fall back to "try it and let the server
     * reject" rather than refusing outright.
     */
    async #assertSha256Supported(): Promise<void> {
        const { digestFunctions } = await this.#negotiateCapabilities();

        if (digestFunctions.length === 0) {
            return;
        }

        const supportsSha256 = digestFunctions.some((name) => name.toUpperCase() === "SHA256");

        if (!supportsSha256) {
            throw new Error(
                `[task-runner] REAPI server does not advertise SHA256 in cache_capabilities.digest_functions (got: ${digestFunctions.join(", ")}). `
                + "vis pins sha256 for action digests; a server expecting a different digest function would reject every request.",
            );
        }
    }

    async #findMissingBlobs(digests: ReadonlyArray<CasDigest>): Promise<ReadonlyArray<CasDigest>> {
        if (digests.length === 0) {
            return [];
        }

        const { cas } = await this.#getClients();
        const metadata = await this.#buildMetadata();
        const response = await callUnary<{ missing_blob_digests?: ProtoDigest[] }>(
            cas,
            "FindMissingBlobs",
            {
                blob_digests: digests.map((digest) => digestToProto(digest)),
                instance_name: this.#instanceName,
            },
            metadata,
            this.#timeout,
        );

        const missing = response?.missing_blob_digests ?? [];

        return missing.map((proto) => protoToDigest(proto));
    }

    async #uploadBlobs(blobs: ReadonlyArray<BlobSource>): Promise<void> {
        if (blobs.length === 0) {
            return;
        }

        const maxBatchSize = await this.#getMaxBatchSize();
        const perBlobLimit = maxBatchSize - BATCH_ENTRY_OVERHEAD_BYTES;
        const small: BlobSource[] = [];
        const large: BlobSource[] = [];

        for (const blob of blobs) {
            (blob.digest.sizeBytes <= perBlobLimit ? small : large).push(blob);
        }

        const batches = bucketIntoBatches(small, maxBatchSize);

        for (const batch of batches) {
            // eslint-disable-next-line no-await-in-loop -- intentional serial upload to respect server batch limits
            await this.#uploadBatchOnce(batch);
        }

        for (const blob of large) {
            // eslint-disable-next-line no-await-in-loop -- intentional serial upload so backpressure flows from the server
            await this.#uploadStreamOnce(blob);
        }
    }

    async #uploadBatchOnce(blobs: ReadonlyArray<BlobSource>): Promise<void> {
        const dedupedBlobs: BlobSource[] = [];
        const dedupedPromises: Promise<boolean>[] = [];

        for (const blob of blobs) {
            const inflight = this.#inflightUploads.get(blob.digest.hash);

            if (inflight !== undefined) {
                dedupedPromises.push(inflight);

                continue;
            }

            dedupedBlobs.push(blob);
        }

        if (dedupedBlobs.length > 0) {
            const promise = this.#uploadBatchToWire(dedupedBlobs);

            for (const blob of dedupedBlobs) {
                this.#inflightUploads.set(blob.digest.hash, promise);
            }

            try {
                await promise;
            } finally {
                for (const blob of dedupedBlobs) {
                    this.#inflightUploads.delete(blob.digest.hash);
                }
            }
        }

        await Promise.all(dedupedPromises);
    }

    async #uploadBatchToWire(blobs: ReadonlyArray<BlobSource>): Promise<boolean> {
        const requests: { compressor: string; data: Buffer; digest: ProtoDigest }[] = [];

        for (const blob of blobs) {
            // eslint-disable-next-line no-await-in-loop -- read blobs serially so we never hold more than one full payload in memory at once; bucketIntoBatches already caps the batch's total wire size, but per-blob materialization in parallel could spike RSS for large workloads
            const data = await streamToBuffer(await blob.open());

            requests.push({
                compressor: COMPRESSOR_IDENTITY,
                data,
                digest: digestToProto(blob.digest),
            });
        }

        const { cas } = await this.#getClients();
        const metadata = await this.#buildMetadata();
        const response = await callUnary<{ responses?: { digest: ProtoDigest; status: { code?: number; message?: string } }[] }>(
            cas,
            "BatchUpdateBlobs",
            {
                instance_name: this.#instanceName,
                requests,
            },
            metadata,
            this.#timeout,
        );

        const responses = response?.responses ?? [];

        for (const entry of responses) {
            const code = entry.status.code ?? 0;

            if (code !== STATUS_OK) {
                throw new Error(`[task-runner] BatchUpdateBlobs reported code ${String(code)} for ${entry.digest.hash}: ${entry.status.message ?? ""}`);
            }
        }

        return true;
    }

    async #uploadStreamOnce(blob: BlobSource): Promise<void> {
        const inflight = this.#inflightUploads.get(blob.digest.hash);

        if (inflight !== undefined) {
            await inflight;

            return;
        }

        // Store the streamWrite promise directly in the dedup map so the
        // rejection has a consumer via the local `await` below. A separate
        // deferred wrapper would split the rejection across two promises and
        // surface as an unhandled rejection in the no-concurrent-awaiter case.
        const promise = this.#streamWrite(blob);

        this.#inflightUploads.set(blob.digest.hash, promise);

        try {
            await promise;
        } finally {
            this.#inflightUploads.delete(blob.digest.hash);
        }
    }

    async #streamWrite(blob: BlobSource): Promise<boolean> {
        const { byteStream } = await this.#getClients();
        const metadata = await this.#buildMetadata();
        const resourceName = buildWriteResourceName(this.#instanceName, blob.digest);
        const writeFn = byteStream.Write;

        if (typeof writeFn !== "function") {
            throw new TypeError("[task-runner] REAPI ByteStream client is missing Write method.");
        }

        await new Promise<void>((resolve, reject) => {
            const callOptions = { deadline: Date.now() + this.#timeout * STREAM_DEADLINE_MULTIPLIER };
            const call = (writeFn as (this: GrpcClientLike, metadata: unknown, options: unknown, callback: (error: Error | null) => void) => {
                cancel?: () => void;
                end: () => void;
                write: (request: unknown) => boolean;
            }).call(byteStream, metadata, callOptions, (error) => {
                if (error) {
                    reject(error);

                    return;
                }

                resolve();
            });

            // eslint-disable-next-line no-void -- discard the async IIFE so the surrounding handler doesn't return a promise
            void (async () => {
                try {
                    let writeOffset = 0;
                    let firstChunk = true;
                    const stream = await blob.open();

                    for await (const rawChunk of stream) {
                        const chunk = Buffer.isBuffer(rawChunk) ? rawChunk : Buffer.from(rawChunk as string | Uint8Array);

                        for (let pos = 0; pos < chunk.byteLength; pos += STREAM_CHUNK_SIZE) {
                            const slice = chunk.subarray(pos, pos + STREAM_CHUNK_SIZE);

                            call.write({
                                data: slice,
                                finish_write: false,
                                resource_name: firstChunk ? resourceName : "",
                                write_offset: writeOffset,
                            });

                            writeOffset += slice.byteLength;
                            firstChunk = false;
                        }
                    }

                    call.write({
                        data: Buffer.alloc(0),
                        finish_write: true,
                        resource_name: firstChunk ? resourceName : "",
                        write_offset: writeOffset,
                    });
                    call.end();
                } catch (error) {
                    // Local read or chunk-write threw before the server signaled completion.
                    // Cancel the gRPC call so the channel does not leak the in-flight request
                    // until the deadline fires; the unary callback above will then settle with
                    // the local error rather than a CANCELLED status from the server.
                    try {
                        call.cancel?.();
                    } catch {
                        // call already settled — nothing to cancel
                    }

                    reject(error as Error);
                }
            })();
        });

        return true;
    }

    async #batchReadOne(digest: CasDigest): Promise<Buffer | undefined> {
        const { cas } = await this.#getClients();
        const metadata = await this.#buildMetadata();
        const response = await callUnary<{ responses?: { data?: Buffer | Uint8Array; digest: ProtoDigest; status: { code?: number } }[] }>(
            cas,
            "BatchReadBlobs",
            {
                acceptable_compressors: [COMPRESSOR_IDENTITY],
                digests: [digestToProto(digest)],
                instance_name: this.#instanceName,
            },
            metadata,
            this.#timeout,
        );

        const entry = response?.responses?.[0];

        if (!entry) {
            return undefined;
        }

        const code = entry.status.code ?? 0;

        if (code !== STATUS_OK) {
            return undefined;
        }

        if (entry.data === undefined) {
            return Buffer.alloc(0);
        }

        return Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data);
    }

    async #streamRead(digest: CasDigest, destinationPath: string): Promise<boolean> {
        const { byteStream } = await this.#getClients();
        const metadata = await this.#buildMetadata();
        const resourceName = buildReadResourceName(this.#instanceName, digest);
        const readFn = byteStream.Read;

        if (typeof readFn !== "function") {
            throw new TypeError("[task-runner] REAPI ByteStream client is missing Read method.");
        }

        const callOptions = { deadline: Date.now() + this.#timeout * STREAM_DEADLINE_MULTIPLIER };
        const call = (readFn as (this: GrpcClientLike, request: unknown, metadata: unknown, options: unknown) => NodeJS.ReadableStream).call(
            byteStream,
            { read_limit: 0, read_offset: 0, resource_name: resourceName },
            metadata,
            callOptions,
        );
        const writer = createWriteStream(destinationPath);

        try {
            for await (const message of call) {
                const { data } = (message as { data?: Buffer | Uint8Array });

                if (data === undefined) {
                    continue;
                }

                if (!writer.write(Buffer.isBuffer(data) ? data : Buffer.from(data))) {
                    await new Promise<void>((resolve) => {
                        writer.once("drain", () => {
                            resolve();
                        });
                    });
                }
            }

            await new Promise<void>((resolve, reject) => {
                writer.end((error?: NodeJS.ErrnoException | null) => {
                    if (error) {
                        reject(error);

                        return;
                    }

                    resolve();
                });
            });

            return true;
        } catch (error) {
            writer.destroy();

            if (isNotFoundError(error)) {
                return false;
            }

            throw error;
        }
    }
}

interface ProtoDigest {
    hash: string;
    size_bytes: number;
}

interface ProtoOutputFile {
    digest: ProtoDigest;
    is_executable?: boolean;
    path: string;
}

interface ProtoOutputDirectory {
    path: string;
    tree_digest: ProtoDigest;
}

interface ProtoActionResult {
    exit_code?: number;
    output_directories?: ProtoOutputDirectory[];
    output_files?: ProtoOutputFile[];
    stdout_digest?: ProtoDigest;
}

interface ProtoServerCapabilities {
    cache_capabilities?: {
        digest_functions?: ReadonlyArray<string | number>;
        max_batch_total_size_bytes?: number;
    };
}

const digestToProto = (digest: CasDigest): ProtoDigest => {
    return {
        hash: digest.hash,
        size_bytes: digest.sizeBytes,
    };
};

const protoToDigest = (proto: ProtoDigest | null | undefined): CasDigest => {
    return {
        hash: proto?.hash ?? "",
        sizeBytes: typeof proto?.size_bytes === "number" ? proto.size_bytes : 0,
    };
};

const protoToActionResult = (proto: ProtoActionResult | null | undefined): ActionResult => {
    return {
        exitCode: proto?.exit_code ?? 0,
        outputDirectories: (proto?.output_directories ?? []).map((entry) => {
            return {
                path: entry.path,
                treeDigest: protoToDigest(entry.tree_digest),
            };
        }),
        outputFiles: (proto?.output_files ?? []).map((entry) => {
            return {
                digest: protoToDigest(entry.digest),
                isExecutable: entry.is_executable ?? false,
                path: entry.path,
            };
        }),
        stdoutDigest: proto?.stdout_digest === undefined ? undefined : protoToDigest(proto.stdout_digest),
    };
};

const actionResultToProto = (result: ActionResult): ProtoActionResult => {
    return {
        exit_code: result.exitCode,
        output_directories: result.outputDirectories.map((entry) => {
            return {
                path: entry.path,
                tree_digest: digestToProto(entry.treeDigest),
            };
        }),
        output_files: result.outputFiles.map((entry) => {
            return {
                digest: digestToProto(entry.digest),
                is_executable: entry.isExecutable,
                path: entry.path,
            };
        }),
        stdout_digest: result.stdoutDigest === undefined ? undefined : digestToProto(result.stdoutDigest),
    };
};

const isNotFoundError = (error: unknown): boolean => {
    if (typeof error !== "object" || error === null) {
        return false;
    }

    const { code } = (error as { code?: number });

    return code === STATUS_NOT_FOUND;
};

const isAuthError = (error: unknown): boolean => {
    if (typeof error !== "object" || error === null) {
        return false;
    }

    const { code } = (error as { code?: number });

    return code === STATUS_UNAUTHENTICATED || code === STATUS_PERMISSION_DENIED;
};

const parseGrpcUrl = (url: string): { target: string; useTls: boolean } => {
    const trimmed = url.trim();

    if (trimmed === "") {
        throw new Error("[task-runner] REAPI backend requires a non-empty `url`.");
    }

    const match = /^(grpcs?):\/\/(.+)$/i.exec(trimmed);

    if (match === null) {
        return { target: trimmed, useTls: false };
    }

    const [, scheme, target] = match;
    const finalTarget = (target ?? "").trim();

    if (finalTarget === "") {
        throw new Error(`[task-runner] REAPI backend url ${url} is missing a host:port target.`);
    }

    return { target: finalTarget, useTls: scheme?.toLowerCase() === "grpcs" };
};

const bucketIntoBatches = (blobs: ReadonlyArray<BlobSource>, maxBatchSize: number): BlobSource[][] => {
    const batches: BlobSource[][] = [];
    let current: BlobSource[] = [];
    let currentSize = 0;

    for (const blob of blobs) {
        const entrySize = blob.digest.sizeBytes + BATCH_ENTRY_OVERHEAD_BYTES;

        if (currentSize + entrySize > maxBatchSize && current.length > 0) {
            batches.push(current);
            current = [];
            currentSize = 0;
        }

        current.push(blob);
        currentSize += entrySize;
    }

    if (current.length > 0) {
        batches.push(current);
    }

    return batches;
};

const streamToBuffer = async (source: NodeJS.ReadableStream): Promise<Buffer> => {
    const chunks: Buffer[] = [];

    for await (const chunk of source) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string | Uint8Array));
    }

    return Buffer.concat(chunks);
};
