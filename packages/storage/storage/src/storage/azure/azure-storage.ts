import type { Readable } from "node:stream";

import type {
    BlobItem,
    BlobServiceClient,
    BlockBlobClient,
    BlockBlobCommitBlockListResponse,
    BlockBlobStageBlockResponse,
    ContainerClient,
} from "@azure/storage-blob";
import { normalize } from "@visulima/path";

import { detectFileTypeFromStream } from "../../utils/detect-file-type";
// @ts-expect-error - UploadError is used for type checking in error handling
import type { UploadError } from "../../utils/errors";
import { ERRORS, throwErrorCode } from "../../utils/errors";
import toMilliseconds from "../../utils/primitives/to-milliseconds";
import type { RetryConfig } from "../../utils/retry";
import LocalMetaStorage from "../local/local-meta-storage";
import type MetaStorage from "../meta-storage";
import { WRITE_CLAIM_KEY } from "../meta-storage";
import { BaseStorage } from "../storage";
import type { BatchOperationResponse, ConditionalOptions, ConditionalSupport, CopyConditionalOptions, OperationOptions, StoredObject } from "../types";
import { quoteETag } from "../utils/etag";
import type { FileInit, FilePart, FileQuery, FileReturn } from "../utils/file";
import { getFileStatus, hasContent, partMatch } from "../utils/file";
import { collectStream } from "../utils/remote";
import type { AzureSasSigner } from "./azure-client";
import { appendSasToken, buildAzureSasUrl, createAzureClient } from "./azure-client";
import AzureFile from "./azure-file";
import AzureMetaStorage from "./azure-meta-storage";
import type { AzureStorageOptions } from "./types";

/** Prefix of the block ids staged by {@link AzureStorage.write}; the rest is the zero-padded chunk offset. */
const BLOCK_ID_PREFIX = "visulima-";

/** Largest block Put Block accepts (4000 MiB); a chunk becomes exactly one block. */
const MAX_BLOCK_SIZE = 4000 * 1024 * 1024;

/**
 * Azure caps a blob's metadata, names and values together, at 8 KiB. Create keeps 1 KiB free for
 * what an upload adds to its record later (request id, offset, status, write claims).
 */
// ponytail: fixed headroom, not the final record; measure that if records grow larger fields.
const MAX_CREATE_METADATA_SIZE = 7 * 1024;

const metadataSize = (metadata: Record<string, string>): number => Object.entries(metadata).reduce((size, [key, value]) => size + key.length + value.length, 0);

/** Rethrows an Azure `412` (`ConditionNotMet`, `SourceConditionNotMet`) as `ERRORS.PRECONDITION_FAILED`. */
const rethrowConditionNotMet = (error: unknown): never => {
    const { code, statusCode } = (error ?? {}) as { code?: string; statusCode?: number };

    // A failed `If-Match` answers 412; `If-None-Match: *` onto an existing blob answers 409
    // BlobAlreadyExists (https://learn.microsoft.com/rest/api/storageservices/specifying-conditional-headers-for-blob-service-operations).
    if (statusCode === 412 || (statusCode === 409 && code === "BlobAlreadyExists")) {
        throwErrorCode(ERRORS.PRECONDITION_FAILED, (error as Error).message);
    }

    throw error;
};

/**
 * Azure Blob Storage implementation.
 * @remarks
 * ## Supported Operations
 * - ✅ create, write, delete, get, list, update, copy, move
 * - ✅ Resumable writes: each chunk is staged as a block (`md5` verified via `transactionalContentMD5`), the ordered block list is committed on completion
 * - ✅ Batch operations: deleteBatch (native Blob Batch API, 256/request), copyBatch + moveBatch (inherited from BaseStorage)
 * - ✅ exists: Implemented (checks metadata and Azure blob)
 * - ❌ getStream: Not implemented natively (falls back to get())
 * - ✅ getReadUrl / getUploadUrl: service SAS (shared key / connection string) or User Delegation SAS (Microsoft Entra credential). SAS-token adapters append the pre-issued token. Anonymous (public-container) adapters serve unsigned read URLs only — uploads are rejected.
 *
 * ## Authentication
 * Precedence: connection string, then account key + name, then Microsoft Entra `credential` (Azure AD / Managed Identity), then a pre-issued `sasToken`, then anonymous (public-container) access.
 */
class AzureStorage extends BaseStorage {
    public static override readonly name: string = "azure";

    public override readonly storageKind: string = "azure";

    /** Parts are appended in order (see assertContiguousWrite). */
    public override readonly sequentialWrites: boolean = true;

    /** A part's length goes into the provider request before its bytes, so it must be known. */
    public override readonly requiresContentLength: boolean = true;

    /** `md5` is verified by Azure per staged block (`transactionalContentMD5`, `Md5Mismatch` on failure). */
    public override checksumTypes: string[] = ["md5"];

    /**
     * Exact reads, conditional deletes and conditional copies go out as Azure access conditions
     * (`If-Match`, `If-None-Match`, `x-ms-source-if-match`). Conditional uploads are not offered:
     * `create` stores an empty blob before the body arrives, so there is no single commit to condition.
     */
    public override readonly conditionalSupport: ConditionalSupport = { copy: true, create: false, delete: true, read: true, replace: false };

    public override get raw(): BlobServiceClient {
        return this.client;
    }

    protected meta: MetaStorage;

    private client: BlobServiceClient;

    private readonly containerClient: ContainerClient;

    private readonly root: string;

    private readonly resolvedRetryConfig: RetryConfig;

    private readonly signer?: AzureSasSigner;

    /** Pre-issued SAS token (leading `?` stripped) when in SAS-token mode. */
    private readonly sasToken?: string;

    /** True only for genuine anonymous (public-container) access. */
    private readonly anonymous?: boolean;

    public constructor(config: AzureStorageOptions) {
        super(config);

        const containerName = config.containerName || process.env.AZURE_STORAGE_CONTAINER;

        if (!containerName) {
            throw new Error("Missing required parameter: Azure container name.");
        }

        const { anonymous, client, sasToken, signer } = createAzureClient(config);

        this.client = client;
        this.signer = signer;
        this.sasToken = sasToken;
        this.anonymous = anonymous;

        this.containerClient = this.client.getContainerClient(containerName);

        this.root = config.root ? normalize(config.root).replaceAll(/^\/+|\/+$/g, "") : "";

        // Initialize retry wrapper with config or defaults
        const retryConfig: RetryConfig = {
            backoffMultiplier: 2,
            initialDelay: 1000,
            maxDelay: 30_000,
            maxRetries: 3,
            retryableStatusCodes: [408, 429, 500, 502, 503, 504],
            shouldRetry: (error: unknown) => {
                // Azure Storage errors
                const errorWithCode = error as { code?: string; statusCode?: number };

                if (errorWithCode.statusCode && [408, 429, 500, 502, 503, 504].includes(errorWithCode.statusCode)) {
                    return true;
                }

                // Network errors
                if (error instanceof Error) {
                    const errorCode = errorWithCode.code;

                    if (errorCode === "ECONNRESET" || errorCode === "ETIMEDOUT" || errorCode === "ENOTFOUND" || errorCode === "ECONNREFUSED") {
                        return true;
                    }
                }

                // Defer to the retry engine's built-in heuristics for anything not
                // explicitly matched above (returning `false` here would suppress them).
                return undefined;
            },
            ...config.retryConfig,
        };

        this.resolvedRetryConfig = retryConfig;

        if (config.metaStorage) {
            this.meta = config.metaStorage;
        } else {
            let metaConfig = { ...config, containerName, ...config.metaStorageConfig, logger: this.logger };

            const localMeta = "directory" in metaConfig;

            if (localMeta) {
                this.logger?.debug("Using local meta storage");

                this.meta = new LocalMetaStorage(metaConfig);
            } else {
                const metaStorageConfig = config.metaStorageConfig as Record<string, unknown> | undefined;
                const metaOverridesAuth = Boolean(
                    metaStorageConfig &&
                    ["accountKey", "accountName", "connectionString", "credential", "endpoint", "sasToken"].some((key) => key in metaStorageConfig),
                );

                // Reuse the already-authenticated client unless the meta config
                // points at a different account/credential.
                if (!metaOverridesAuth) {
                    metaConfig = { ...metaConfig, client: this.client };
                }

                this.meta = new AzureMetaStorage(metaConfig);
            }
        }

        this.startAccessCheck(async () => this.accessCheck());
    }

    protected override getRetryConfig(): RetryConfig {
        return this.resolvedRetryConfig;
    }

    public async create(config: FileInit, options?: OperationOptions): Promise<AzureFile> {
        return this.instrumentOperation("create", async () => {
            // Handle TTL option
            const processedConfig = { ...config };

            if (config.ttl) {
                const ttlMs = typeof config.ttl === "string" ? toMilliseconds(config.ttl) : config.ttl;

                if (ttlMs !== undefined) {
                    processedConfig.expiredAt = Date.now() + ttlMs;
                }
            }

            const file = new AzureFile(processedConfig);

            file.name = this.namingFunction(file);

            await this.validate(file);

            const existing = await this.findResumable(file.id);

            if (existing !== undefined) {
                return existing;
            }

            const records = [AzureStorage.blobMetadata(file), ...(this.meta instanceof AzureMetaStorage ? [AzureMetaStorage.toBlobMetadata(file)] : [])];

            if (records.some((record) => metadataSize(record) > MAX_CREATE_METADATA_SIZE)) {
                return throwErrorCode(
                    ERRORS.REQUEST_ENTITY_TOO_LARGE,
                    "azure: the upload's name and metadata exceed what Azure stores with a blob (8 KiB once encoded); send less metadata.",
                );
            }

            const blobClient = this.containerClient.getBlockBlobClient(this.getFullPath(file.name));

            const response = await this.runOperation(options, (signal) =>
                blobClient.uploadData(Buffer.from(""), {
                    abortSignal: signal,
                    blobHTTPHeaders: {
                        blobContentType: file.contentType,
                    },
                    metadata: AzureStorage.blobMetadata(file),
                }),
            );

            if (response.requestId === undefined) {
                // @TODO add better error message
                return throwErrorCode(ERRORS.FILE_ERROR, "azure create upload error");
            }

            file.requestId = response.requestId;

            file.uri = response._response.headers.get("location");
            file.bytesWritten = 0;

            try {
                await this.saveMeta(file);
            } catch (error) {
                // Without its record the empty blob is unreachable, and a later PUT to the id would conflict with it.
                await blobClient.deleteIfExists().catch(() => undefined);

                throw error;
            }

            file.status = "created";

            await this.onCreate(file);

            return file;
        });
    }

    /**
     * Deletes an upload and its metadata.
     * @param query File query containing the file ID to delete.
     * @param query.id File ID to delete.
     * @returns Promise resolving to the deleted file object with status: "deleted".
     * @throws {UploadError} If the file metadata cannot be found.
     */
    public async delete({ id }: FileQuery, options?: ConditionalOptions & OperationOptions): Promise<AzureFile> {
        return this.instrumentOperation("delete", async () => {
            const file = await this.getMeta(id);
            const ifMatch = options?.ifMatch;

            file.status = "deleted";

            // Sequence the blob delete before the metadata delete so a partial failure leaves a recoverable
            // metadata orphan instead of an unreachable block blob that keeps consuming storage.
            const { succeeded } = await this.runOperation(options, (signal) =>
                this.containerClient
                    .getBlockBlobClient(this.getFullPath(file.name))
                    .deleteIfExists({ abortSignal: signal, ...(ifMatch !== undefined && { conditions: { ifMatch: quoteETag(ifMatch) } }) }),
            ).catch(rethrowConditionNotMet);

            if (ifMatch !== undefined && !succeeded) {
                return throwErrorCode(ERRORS.PRECONDITION_FAILED, "There is no stored blob to match");
            }

            await this.deleteMeta(file.id);

            const deletedFile = { ...file };

            await this.onDelete(deletedFile);

            return deletedFile;
        });
    }

    /**
     * Deletes many blobs in one round-trip using Azure's native
     * [Blob Batch API](https://learn.microsoft.com/rest/api/storageservices/blob-batch)
     * (up to 256 sub-requests per request) instead of issuing one DELETE per key.
     *
     * Sidecar metadata removal and the {@link onDelete} hook are still applied per
     * successfully-deleted id; a 404 sub-response is treated as success to match the
     * `deleteIfExists` semantics of the single-key {@link delete}. If the batch endpoint
     * is unavailable (e.g. an Azurite build without batch support) the call transparently
     * falls back to the per-key base implementation.
     * @param ids File ids/keys to delete.
     * @param options Optional per-call signal/timeout/retries.
     */
    public override async deleteBatch(ids: string[], options?: OperationOptions): Promise<BatchOperationResponse<AzureFile>> {
        if (ids.length === 0) {
            return { failed: [], failedCount: 0, successful: [], successfulCount: 0 };
        }

        const BATCH_LIMIT = 256;

        try {
            const batchClient = this.client.getBlobBatchClient();
            const successful: AzureFile[] = [];
            const failed: { error: string; id: string }[] = [];

            for (let offset = 0; offset < ids.length; offset += BATCH_LIMIT) {
                const chunk = ids.slice(offset, offset + BATCH_LIMIT);
                const names = await Promise.all(chunk.map(async (id) => this.storedName(id)));
                const blobClients = names.map((name) => this.containerClient.getBlockBlobClient(this.getFullPath(name)));

                const response = await this.runOperation(options, (signal) => batchClient.deleteBlobs(blobClients, { abortSignal: signal }));

                // Sub-responses come back in request order; 202 = deleted, 404 = already gone.
                for (const [index, sub] of response.subResponses.entries()) {
                    const id = chunk[index] as string;

                    if (sub.status === 202 || sub.status === 404) {
                        successful.push({ id, name: id, status: "deleted" } as AzureFile);
                    } else {
                        failed.push({ error: sub.errorCode ?? `HTTP ${sub.status}`, id });
                    }
                }
            }

            // Metadata sidecars are cleaned up independently of the blob batch. Failures here are
            // non-fatal — the blob is already gone — so they never demote a successful delete.
            await Promise.all(
                successful.map(async (file) => {
                    try {
                        await this.deleteMeta(file.id);
                        await this.onDelete(file);
                    } catch {
                        // best-effort sidecar cleanup
                    }
                }),
            );

            return { failed, failedCount: failed.length, successful, successfulCount: successful.length };
        } catch (error: unknown) {
            this.logger?.warn(`Azure Blob Batch delete unavailable, falling back to per-key delete: ${error instanceof Error ? error.message : String(error)}`);

            return super.deleteBatch(ids, options);
        }
    }

    /**
     * Moves an upload file to a new location.
     * @param name Source file name/ID.
     * @param destination Destination file name/ID.
     * @returns Promise resolving to the moved file object.
     * @throws {UploadError} If the source file cannot be found.
     */
    public async move(name: string, destination: string, options?: OperationOptions): Promise<AzureFile> {
        return this.instrumentOperation("move", async () => {
            const source = this.getFullPath(await this.storedName(name));
            const copiedFile = await this.copy(name, destination, options);

            await this.runOperation(options, (signal) => this.containerClient.getBlockBlobClient(source).deleteIfExists({ abortSignal: signal }));
            // The source upload is gone; drop its metadata so it does not linger as an orphan.
            await this.deleteMeta(name);

            return copiedFile;
        });
    }

    public async write(part: FilePart | FileQuery | AzureFile, options?: OperationOptions): Promise<AzureFile> {
        return this.instrumentOperation("write", async () => {
            let file: AzureFile;

            if ("contentType" in part && "metadata" in part && !("body" in part) && !("start" in part)) {
                // part is a full file object (not a FilePart)
                file = part;
            } else {
                // part is FilePart or FileQuery
                file = await this.getMeta(part.id);

                await this.checkIfExpired(file);
            }

            if (file.status === "completed") {
                return file;
            }

            if (!partMatch(part, file)) {
                return throwErrorCode(ERRORS.FILE_CONFLICT);
            }

            const lockToken = await this.lock(part.id);

            try {
                const offset = Number(file.bytesWritten) || 0;

                file.bytesWritten = offset;

                if (hasContent(part)) {
                    if (this.isUnsupportedChecksum(part.checksumAlgorithm)) {
                        return throwErrorCode(ERRORS.UNSUPPORTED_CHECKSUM_ALGORITHM);
                    }

                    // Each chunk becomes one block keyed by its start offset.
                    this.assertContiguousWrite(part, file);

                    // Put Block caps a single block at 4000 MiB; reject before any byte is staged.
                    if (part.contentLength !== undefined && part.contentLength > MAX_BLOCK_SIZE) {
                        return throwErrorCode(
                            ERRORS.REQUEST_ENTITY_TOO_LARGE,
                            "Azure accepts at most 4000 MiB per chunk; split the upload into smaller chunks.",
                        );
                    }

                    // Detect file type from stream if contentType is not set or is default
                    // Only detect on first write (offset 0)
                    if (offset === 0 && (!file.contentType || file.contentType === "application/octet-stream")) {
                        try {
                            const { fileType, stream: detectedStream } = await detectFileTypeFromStream(part.body);

                            // Update contentType if file type was detected
                            if (fileType?.mime) {
                                file.contentType = fileType.mime;
                            }

                            // Use the stream from file type detection

                            part.body = detectedStream;
                        } catch {
                            // If file type detection fails, continue with original stream
                            // This is not a critical error
                        }
                    }

                    const blobClient = this.containerClient.getBlockBlobClient(this.getFullPath(file.name));

                    // Without a declared length the chunk is buffered: stageBlock needs the exact size.
                    let { body, contentLength }: { body: Buffer | Readable; contentLength?: number } = part;

                    if (contentLength === undefined) {
                        body = await collectStream(part.body);
                        contentLength = body.length;
                    }

                    if (contentLength > 0) {
                        const abortController = new AbortController();

                        if (!Buffer.isBuffer(body)) {
                            body.on("error", () => {
                                abortController.abort();
                            });
                        }

                        const transactionalContentMD5 = part.checksumAlgorithm === "md5" && part.checksum ? Buffer.from(part.checksum, "base64") : undefined;

                        let response: BlockBlobStageBlockResponse;

                        try {
                            // A streamed chunk is one-shot — only replay an in-memory buffer.
                            response = await this.runOperation(
                                options,
                                (signal) => {
                                    const uploadSignal = signal ? AbortSignal.any([abortController.signal, signal]) : abortController.signal;

                                    return blobClient.stageBlock(AzureStorage.blockId(offset), body, contentLength, {
                                        abortSignal: uploadSignal,
                                        ...(transactionalContentMD5 && { transactionalContentMD5 }),
                                    });
                                },
                                { replayable: Buffer.isBuffer(body) },
                            );
                        } catch (error: unknown) {
                            if ((error as { code?: string }).code === "Md5Mismatch") {
                                return throwErrorCode(ERRORS.CHECKSUM_MISMATCH);
                            }

                            throw error;
                        }

                        if (response.requestId === undefined) {
                            return throwErrorCode(ERRORS.FILE_ERROR, "azure write upload error");
                        }

                        file.requestId = response.requestId;
                        file.bytesWritten = offset + contentLength;
                    }

                    file.status = getFileStatus(file);

                    if (file.status === "completed") {
                        const response = await this.commitBlocks(blobClient, file, options);

                        file.uri = response._response.headers.get("location");
                    }

                    // Completed uploads keep their metadata. Persist the offset after every partial write: HEAD
                    // reports it and the next PATCH is checked against it.
                    await this.saveMeta(file);
                }
            } finally {
                await this.unlock(part.id, lockToken);
            }

            return file;
        });
    }

    protected override async statObject(id: string, options?: OperationOptions): Promise<StoredObject | undefined> {
        const blobClient = this.containerClient.getBlockBlobClient(this.getFullPath(id));

        try {
            const properties = await this.runOperation(options, (signal) => blobClient.getProperties({ abortSignal: signal }));

            return { contentType: properties.contentType, etag: properties.etag, size: properties.contentLength ?? 0 };
        } catch (error) {
            if ((error as { statusCode?: number }).statusCode === 404) {
                return undefined;
            }

            throw error;
        }
    }

    /** Asks Azure for the blob's ETag: the record's may predate a write by another client. */
    protected override async currentETag(file: AzureFile, options?: OperationOptions): Promise<string | undefined> {
        return this.storedETag(file.name, options);
    }

    public async get({ id }: FileQuery, options?: ConditionalOptions & OperationOptions): Promise<FileReturn> {
        return this.instrumentOperation("get", async () => {
            const blobClient = this.containerClient.getBlockBlobClient(this.getFullPath(await this.readableName(id)));

            const exists = await this.runOperation(options, (signal) => blobClient.exists({ abortSignal: signal }));

            if (!exists) {
                // Metadata without a blob: the file was deleted (GONE), otherwise it never existed (NOT_FOUND).
                return throwErrorCode((await this.findMeta(id)) ? ERRORS.GONE : ERRORS.FILE_NOT_FOUND);
            }

            // An exact read conditions both requests, so properties and content are of one generation.
            const conditions = options?.ifMatch === undefined ? undefined : { ifMatch: quoteETag(options.ifMatch) };
            const response = await this.runOperation(options, (signal) => blobClient.getProperties({ abortSignal: signal, conditions })).catch(
                rethrowConditionNotMet,
            );

            const { contentLength, contentType, etag, expiresOn, lastModified } = response;
            const { metadata, name, originalName } = AzureStorage.readBlobMetadata(response.metadata);
            const content = await this.runOperation(options, (signal) => blobClient.downloadToBuffer(0, undefined, { abortSignal: signal, conditions })).catch(
                rethrowConditionNotMet,
            );

            return {
                content,
                contentType: contentType as string,
                ETag: etag,
                expiredAt: expiresOn,
                id,
                metadata,
                modifiedAt: lastModified,
                name: name || id,
                originalName: originalName || "",
                size: contentLength as number,
            };
        });
    }

    /**
     * Whether an upload's blob exists: the one its metadata names, or, for an ID without metadata
     * (a copied blob, or one written by other means), the blob stored under it. Only a missing blob
     * answers `false`; any other failure throws.
     */
    public override async exists({ id }: FileQuery, options?: OperationOptions): Promise<boolean> {
        return this.instrumentOperation("exists", async () => (await this.findStoredObject(await this.storedName(id), options)) !== undefined);
    }

    /**
     * Copies an upload file to a new location.
     * @param name Source file name/ID.
     * @param destination Destination file name/ID.
     * @returns Promise resolving to the copied file object.
     * @throws {UploadError} If the source file cannot be found.
     */
    public async copy(name: string, destination: string, options?: CopyConditionalOptions & OperationOptions & { storageClass?: string }): Promise<AzureFile> {
        return this.instrumentOperation("copy", async () => {
            const sourceName = await this.storedName(name);
            const source = this.containerClient.getBlockBlobClient(this.getFullPath(sourceName));

            const exists = await this.runOperation(options, (signal) => source.exists({ abortSignal: signal }));

            if (!exists) {
                return throwErrorCode((await this.findMeta(name)) ? ERRORS.GONE : ERRORS.FILE_NOT_FOUND);
            }

            const target = this.containerClient.getBlockBlobClient(this.getFullPath(destination));

            // Token- and SAS-token-authenticated clients cannot read an
            // unsigned same-account source, so sign the copy source URL.
            let sourceUrl = source.url;

            if (this.signer?.kind === "userDelegation") {
                sourceUrl = await buildAzureSasUrl(this.containerClient.getBlobClient(this.getFullPath(sourceName)), this.signer, {
                    expiresIn: 300,
                    permissions: "r",
                });
            } else if (this.sasToken) {
                sourceUrl = appendSasToken(source.url, this.sasToken);
            }

            const { ifMatch, ifNoneMatch, sourceIfMatch } = options ?? {};
            const poller = await this.runOperation(options, (signal) =>
                target.beginCopyFromURL(sourceUrl, {
                    abortSignal: signal,
                    ...((ifMatch !== undefined || ifNoneMatch !== undefined) && {
                        conditions: { ...(ifMatch !== undefined && { ifMatch: quoteETag(ifMatch) }), ...(ifNoneMatch !== undefined && { ifNoneMatch }) },
                    }),
                    ...(sourceIfMatch !== undefined && { sourceConditions: { ifMatch: quoteETag(sourceIfMatch) } }),
                }),
            ).catch(rethrowConditionNotMet);

            await this.runOperation(options, () => poller.pollUntilDone());

            // A blob written by other means has no upload metadata; describe it from its properties.
            const sourceFile = ((await this.findMeta(name)) ?? (await this.findStoredObject(name, options))) as AzureFile;

            return { ...sourceFile, id: destination, name: destination };
        });
    }

    public override async list(limit = 1000, options?: OperationOptions): Promise<AzureFile[]> {
        return this.instrumentOperation(
            "list",
            async () => {
                const files: AzureFile[] = [];

                // Declare truncated as a flag that the while loop is based on.
                let truncated = true;
                let token: string | undefined;
                const prefix = this.getFullPath("");

                while (truncated && files.length < limit) {
                    try {
                        const pageSize = Math.min(limit - files.length, 1000);
                        const next = await this.runOperation(options, (signal) =>
                            this.containerClient
                                .listBlobsFlat({
                                    abortSignal: signal,
                                    includeMetadata: true,
                                    prefix,
                                })
                                .byPage({ continuationToken: token, maxPageSize: pageSize })
                                .next(),
                        );
                        const response = next.value;

                        if (response !== undefined && "segment" in response) {
                            for (const blob of response.segment.blobItems as BlobItem[]) {
                                // Upload metadata sidecars share the container with the files.
                                if (blob.deleted || (this.meta instanceof AzureMetaStorage && blob.name.endsWith(this.meta.suffix))) {
                                    continue;
                                }

                                files.push({
                                    createdAt: blob.properties.createdOn,
                                    id: blob.name.slice(prefix.length),
                                    modifiedAt: blob.properties.lastModified,
                                } as AzureFile);

                                if (files.length >= limit) {
                                    break;
                                }
                            }
                        }

                        truncated = response?.continuationToken !== undefined;

                        if (truncated) {
                            token = response.continuationToken;
                        }
                    } catch (error) {
                        const httpError = this.normalizeError(error instanceof Error ? error : new Error(String(error)));

                        // Sequential error handling is intentional

                        await this.onError(httpError);
                        throw error;
                    }
                }

                return files;
            },
            { limit },
        );
    }

    /**
     * Returns a download URL for the blob at `key`.
     *
     * Shared-key / connection-string and Microsoft Entra adapters mint a fresh
     * SAS. SAS-token adapters append the pre-issued token. Genuine anonymous
     * (public-container) adapters return the unsigned blob URL.
     * @param key Storage key.
     * @param options Optional expiry and response content overrides. Response
     * content overrides only apply when the adapter mints a fresh SAS; they are
     * rejected on the pre-issued `sasToken` and anonymous paths, which have no
     * signature in which to bind them.
     * @throws {UploadError} When the adapter has no way to authorise reads, or
     * when a response content override is supplied on a non-signing path.
     */
    public override async getReadUrl(
        key: string,
        options?: { expiresIn?: number; responseContentDisposition?: string; responseContentType?: string },
    ): Promise<string> {
        const blobClient = this.containerClient.getBlobClient(this.getFullPath(key));

        if (this.signer) {
            return buildAzureSasUrl(blobClient, this.signer, {
                expiresIn: options?.expiresIn ?? 3600,
                permissions: "r",
                ...(options?.responseContentDisposition && { contentDisposition: options.responseContentDisposition }),
                ...(options?.responseContentType && { contentType: options.responseContentType }),
            });
        }

        if (options?.responseContentDisposition !== undefined || options?.responseContentType !== undefined) {
            return throwErrorCode(
                ERRORS.BAD_REQUEST,
                "azure: `responseContentDisposition`/`responseContentType` require a freshly minted SAS (construct with a shared key or Microsoft Entra credential). A pre-issued `sasToken` or anonymous public-container URL has no signature in which to bind the override, so it cannot be enforced.",
            );
        }

        if (this.sasToken) {
            return appendSasToken(blobClient.url, this.sasToken);
        }

        if (this.anonymous) {
            return blobClient.url;
        }

        return throwErrorCode(
            ERRORS.METHOD_NOT_ALLOWED,
            "azure: cannot produce a read URL without a shared key, Microsoft Entra credential, or SAS token. Construct the adapter with accountKey + accountName, a connectionString containing an account key, a credential + accountName, or a sasToken.",
        );
    }

    /**
     * Returns an upload URL (HTTP PUT, `x-ms-blob-type: BlockBlob`) for `key`.
     *
     * Shared-key / connection-string and Microsoft Entra adapters mint a fresh
     * SAS. SAS-token adapters append the pre-issued token. Anonymous adapters
     * cannot upload. The caller must send the desired `x-ms-blob-content-type`
     * header on the PUT — a SAS cannot pin the stored content type.
     * @param key Storage key.
     * @param options Optional expiry. `contentLength` and `contentType` are
     * rejected: an Azure SAS does not bind the request `Content-Type` into the
     * signature and has no server-enforced size limit, so accepting them would
     * hand the caller a guarantee that does not hold.
     * @throws {UploadError} When the adapter cannot authorise writes, or when an
     * unenforceable `contentType`/`contentLength` override is supplied.
     */
    public override async getUploadUrl(key: string, options?: { contentLength?: number; contentType?: string; expiresIn?: number }): Promise<string> {
        if (options?.contentType !== undefined || options?.contentLength !== undefined) {
            return throwErrorCode(
                ERRORS.BAD_REQUEST,
                "azure: `contentType`/`contentLength` are not supported for upload URLs. An Azure SAS does not bind the request Content-Type into the signature and cannot enforce a size limit; validate both at your application gateway/proxy before issuing the SAS, or omit them and accept the unbounded PUT.",
            );
        }

        const blobClient = this.containerClient.getBlobClient(this.getFullPath(key));

        if (this.signer) {
            return buildAzureSasUrl(blobClient, this.signer, {
                expiresIn: options?.expiresIn ?? 3600,
                permissions: "cw",
            });
        }

        if (this.sasToken) {
            return appendSasToken(blobClient.url, this.sasToken);
        }

        return throwErrorCode(
            ERRORS.METHOD_NOT_ALLOWED,
            "azure: cannot produce an upload URL without a shared key, Microsoft Entra credential, or SAS token. Anonymous (public-container) access is read-only.",
        );
    }

    /**
     * Prefixes the given filePath with the `root` path and the `assetFolder`, when configured.
     * @param filePath Relative file path to prefix.
     * @returns The blob name.
     */
    private getFullPath(filePath: string): string {
        const prefix = [this.root, this.assetFolder].filter(Boolean).join("/");

        return prefix ? `${prefix}/${filePath}` : filePath;
    }

    /**
     * Block id for the chunk starting at `offset`. Azure requires every block id of a blob to have
     * the same length, so the offset is zero-padded (16 digits cover any Number-safe offset).
     */
    private static blockId(offset: number): string {
        return Buffer.from(`${BLOCK_ID_PREFIX}${String(offset).padStart(16, "0")}`).toString("base64");
    }

    /**
     * Blob metadata as Azure expects it, shared by create and the final commit. Values go out as
     * HTTP headers and names must be C# identifiers, so every value is URI-encoded and the user
     * metadata, whatever its keys, is one JSON value.
     */
    private static blobMetadata(file: AzureFile): Record<string, string> {
        // The write claim is the upload's bookkeeping while a request writes it, never the file's metadata.
        const { [WRITE_CLAIM_KEY]: _claim, ...metadata } = file.metadata ?? {};

        return {
            metadata: encodeURIComponent(JSON.stringify(metadata)),
            name: encodeURIComponent(file.name),
            originalName: encodeURIComponent(file.originalName),
        };
    }

    /**
     * Reads {@link AzureStorage.blobMetadata} back. Blobs written before it was encoded keep their
     * names as-is and the user metadata as one entry per key.
     */
    private static readBlobMetadata(stored: Record<string, string> = {}): { metadata: Record<string, unknown>; name?: string; originalName?: string } {
        // Behind Node's HTTP stack Azure returns metadata names lower-cased.
        const { metadata, name, originalname: originalName } = Object.fromEntries(Object.entries(stored).map(([key, value]) => [key.toLowerCase(), value]));

        try {
            const decoded: unknown = metadata === undefined ? undefined : JSON.parse(decodeURIComponent(metadata));

            if (typeof decoded === "object" && decoded !== null && !Array.isArray(decoded)) {
                return {
                    metadata: decoded as Record<string, unknown>,
                    name: name === undefined ? undefined : decodeURIComponent(name),
                    originalName: originalName === undefined ? undefined : decodeURIComponent(originalName),
                };
            }
        } catch {
            // Not the encoded format.
        }

        return { metadata: stored, name, originalName };
    }

    /**
     * Commits the staged chunks of `file` in offset order. Only the contiguous chain of blocks
     * starting at offset 0 is committed, so a stale block left by an abandoned PATCH is ignored.
     */
    private async commitBlocks(blobClient: BlockBlobClient, file: AzureFile, options?: OperationOptions): Promise<BlockBlobCommitBlockListResponse> {
        const { uncommittedBlocks = [] } = await this.runOperation(options, (signal) => blobClient.getBlockList("uncommitted", { abortSignal: signal }));

        const blocksByOffset = new Map<number, { name: string; size: number }>();

        for (const block of uncommittedBlocks) {
            const decoded = Buffer.from(block.name, "base64").toString();

            if (decoded.startsWith(BLOCK_ID_PREFIX)) {
                blocksByOffset.set(Number(decoded.slice(BLOCK_ID_PREFIX.length)), block);
            }
        }

        const blockIds: string[] = [];
        let position = 0;

        for (let block = blocksByOffset.get(position); block !== undefined && block.size > 0; block = blocksByOffset.get(position)) {
            blockIds.push(block.name);
            position += block.size;
        }

        if (position !== file.size) {
            return throwErrorCode(ERRORS.FILE_ERROR, `azure commit error: staged blocks cover ${position} of ${String(file.size)} bytes`);
        }

        return this.runOperation(options, (signal) =>
            blobClient.commitBlockList(blockIds, {
                abortSignal: signal,
                blobHTTPHeaders: {
                    blobContentType: file.contentType ?? "application/octet-stream",
                },
                metadata: AzureStorage.blobMetadata(file),
            }),
        );
    }

    private async accessCheck(): Promise<void> {
        await this.runOperation(undefined, (signal) => this.containerClient.getProperties({ abortSignal: signal }));
    }
}

export default AzureStorage;
