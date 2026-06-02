import type { BlobItem, BlobServiceClient, ContainerClient } from "@azure/storage-blob";
import { normalize } from "@visulima/path";

import { detectFileTypeFromStream } from "../../utils/detect-file-type";
// @ts-expect-error - UploadError is used for type checking in error handling
import type { UploadError } from "../../utils/errors";
import { ERRORS, throwErrorCode } from "../../utils/errors";
import toMilliseconds from "../../utils/primitives/to-milliseconds";
import type { RetryConfig } from "../../utils/retry";
import LocalMetaStorage from "../local/local-meta-storage";
import type MetaStorage from "../meta-storage";
import { BaseStorage } from "../storage";
import type { OperationOptions } from "../types";
import type { FileInit, FilePart, FileQuery, FileReturn } from "../utils/file";
import { getFileStatus, hasContent, partMatch } from "../utils/file";
import type { AzureSasSigner } from "./azure-client";
import { appendSasToken, buildAzureSasUrl, createAzureClient } from "./azure-client";
import AzureFile from "./azure-file";
import AzureMetaStorage from "./azure-meta-storage";
import type { AzureStorageOptions } from "./types";

/**
 * Azure Blob Storage implementation.
 * @remarks
 * ## Supported Operations
 * - ✅ create, write, delete, get, list, update, copy, move
 * - ✅ Batch operations: deleteBatch, copyBatch, moveBatch (inherited from BaseStorage)
 * - ✅ exists: Implemented (checks metadata and Azure blob)
 * - ❌ getStream: Not implemented (use get() for file retrieval)
 * - ✅ getReadUrl / getUploadUrl: service SAS (shared key / connection string) or User Delegation SAS (Microsoft Entra credential). SAS-token adapters append the pre-issued token. Anonymous (public-container) adapters serve unsigned read URLs only — uploads are rejected.
 *
 * ## Authentication
 * Precedence: connection string, then account key + name, then Microsoft Entra `credential` (Azure AD / Managed Identity), then a pre-issued `sasToken`, then anonymous (public-container) access.
 */
class AzureStorage extends BaseStorage {
    public static override readonly name: string = "azure";

    public override checksumTypes: string[] = ["md5"];

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

        // Container name is required
        if (!config.containerName) {
            throw new Error("Missing required parameter: Azure container name.");
        }

        const { anonymous, client, sasToken, signer } = createAzureClient(config);

        this.client = client;
        this.signer = signer;
        this.sasToken = sasToken;
        this.anonymous = anonymous;

        this.containerClient = this.client.getContainerClient(config.containerName);

        this.root = config.root ? normalize(config.root).replace(/^\//, "") : "";

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

                return false;
            },
            ...config.retryConfig,
        };

        this.resolvedRetryConfig = retryConfig;

        if (config.metaStorage) {
            this.meta = config.metaStorage;
        } else {
            let metaConfig = { ...config, ...config.metaStorageConfig, logger: this.logger };

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

        this.isReady = false;
        this.accessCheck()
            .then(() => {
                this.isReady = true;

                return undefined;
            })
            .catch((error) => {
                this.logger?.error("Storage access check failed: %O", error);
            });
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

            try {
                const existing = await this.getMeta(file.id);

                if (existing.bytesWritten >= 0) {
                    return existing;
                }
            } catch {
                // ignore
            }

            const blobClient = this.containerClient.getBlockBlobClient(this.getFullPath(file.name));

            const stringifiedMetaValues: Record<string, string> = {};

            for (const [key, value] of Object.entries(file.metadata || {})) {
                stringifiedMetaValues[key] = JSON.stringify(value);
            }

            const response = await this.runOperation(options, (signal) =>
                blobClient.uploadData(Buffer.from(""), {
                    abortSignal: signal,
                    blobHTTPHeaders: {
                        blobContentType: file.contentType,
                    },
                    metadata: {
                        name: file.name,
                        originalName: file.originalName,
                        ...stringifiedMetaValues,
                    },
                }),
            );

            if (response.requestId === undefined) {
                // @TODO add better error message
                return throwErrorCode(ERRORS.FILE_ERROR, "azure create upload error");
            }

            file.requestId = response.requestId;

            file.uri = response._response.headers.get("location");
            file.bytesWritten = 0;

            await this.saveMeta(file);

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
    public async delete({ id }: FileQuery, options?: OperationOptions): Promise<AzureFile> {
        return this.instrumentOperation("delete", async () => {
            const file = await this.getMeta(id);

            file.status = "deleted";

            // Sequence the blob delete before the metadata delete so a partial failure leaves a recoverable
            // metadata orphan instead of an unreachable block blob that keeps consuming storage.
            await this.runOperation(options, (signal) =>
                this.containerClient.getBlockBlobClient(this.getFullPath(file.name)).deleteIfExists({ abortSignal: signal }),
            );
            await this.deleteMeta(file.id);

            const deletedFile = { ...file };

            await this.onDelete(deletedFile);

            return deletedFile;
        });
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
            const copiedFile = await this.copy(name, destination, options);
            const source = this.getFullPath(name);

            await this.runOperation(options, (signal) => this.containerClient.getBlockBlobClient(source).deleteIfExists({ abortSignal: signal }));

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
                if (hasContent(part)) {
                    // Detect file type from stream if contentType is not set or is default
                    // Only detect on first write (when bytesWritten is 0 or NaN)
                    if (
                        (file.bytesWritten === 0 || Number.isNaN(file.bytesWritten)) &&
                        (!file.contentType || file.contentType === "application/octet-stream")
                    ) {
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

                    const abortController = new AbortController();

                    part.body.on("error", () => {
                        abortController.abort();
                    });

                    // The request body is a one-shot stream — never replay it.
                    const response = await this.runOperation(
                        options,
                        (signal) => {
                            const uploadSignal = signal ? AbortSignal.any([abortController.signal, signal]) : abortController.signal;

                            return blobClient.uploadStream(part.body, undefined, undefined, {
                                abortSignal: uploadSignal,
                                blobHTTPHeaders: {
                                    blobContentType: file.contentType ?? "application/octet-stream",
                                },
                                metadata: file.metadata as Record<string, string>,
                            });
                        },
                        { replayable: false },
                    );

                    if (response.requestId === undefined) {
                        return throwErrorCode(ERRORS.FILE_ERROR, "azure write upload error");
                    }

                    file.requestId = response.requestId;
                    file.bytesWritten += part.contentLength || 0;

                    file.status = getFileStatus(file);

                    if (file.status === "completed") {
                        file.uri = response._response.headers.get("location");

                        await this.deleteMeta(file.id);
                    }
                }
            } finally {
                await this.unlock(part.id, lockToken);
            }

            return file;
        });
    }

    public async get({ id }: FileQuery, options?: OperationOptions): Promise<FileReturn> {
        return this.instrumentOperation("get", async () => {
            const blobClient = this.containerClient.getBlockBlobClient(this.getFullPath(id));

            const exists = await this.runOperation(options, (signal) => blobClient.exists({ abortSignal: signal }));

            if (!exists) {
                // Check if metadata exists - if so, file was deleted (GONE), otherwise never existed (NOT_FOUND)
                try {
                    await this.getMeta(id);

                    return throwErrorCode(ERRORS.GONE);
                } catch {
                    return throwErrorCode(ERRORS.FILE_NOT_FOUND);
                }
            }

            const response = await this.runOperation(options, (signal) => blobClient.getProperties({ abortSignal: signal }));

            const { contentLength, contentType, etag, expiresOn, lastModified, metadata } = response;

            return {
                content: await this.runOperation(options, (signal) => blobClient.downloadToBuffer(0, undefined, { abortSignal: signal })),
                contentType: contentType as string,
                ETag: etag,
                expiredAt: expiresOn,
                id,
                metadata: (metadata as Record<string, string>) || {},
                modifiedAt: lastModified,
                name: metadata?.name || id,
                originalName: metadata?.originalName || "",
                size: contentLength as number,
            };
        });
    }

    /**
     * Checks if a file exists by verifying both metadata and the actual Azure blob.
     * Returns true only if both the metadata and the blob exist.
     * @param query File query containing the file ID to check.
     * @returns Promise resolving to true if both metadata and blob exist, false otherwise.
     */
    public override async exists({ id }: FileQuery, options?: OperationOptions): Promise<boolean> {
        return this.instrumentOperation("exists", async () => {
            try {
                // First check if metadata exists
                await this.getMeta(id);

                // Then verify the actual blob exists
                const blobClient = this.containerClient.getBlockBlobClient(this.getFullPath(id));
                const exists = await this.runOperation(options, (signal) => blobClient.exists({ abortSignal: signal }));

                return exists;
            } catch {
                // Return false if metadata doesn't exist or blob doesn't exist
                return false;
            }
        });
    }

    /**
     * Copies an upload file to a new location.
     * @param name Source file name/ID.
     * @param destination Destination file name/ID.
     * @returns Promise resolving to the copied file object.
     * @throws {UploadError} If the source file cannot be found.
     */
    public async copy(name: string, destination: string, options?: OperationOptions & { storageClass?: string }): Promise<AzureFile> {
        return this.instrumentOperation("copy", async () => {
            const source = this.containerClient.getBlockBlobClient(this.getFullPath(name));

            const exists = await this.runOperation(options, (signal) => source.exists({ abortSignal: signal }));

            if (!exists) {
                // Check if metadata exists - if so, file was deleted (GONE), otherwise never existed (NOT_FOUND)
                try {
                    await this.getMeta(name);

                    return throwErrorCode(ERRORS.GONE);
                } catch {
                    return throwErrorCode(ERRORS.FILE_NOT_FOUND);
                }
            }

            const target = this.containerClient.getBlockBlobClient(this.getFullPath(destination));

            // Token- and SAS-token-authenticated clients cannot read an
            // unsigned same-account source, so sign the copy source URL.
            let sourceUrl = source.url;

            if (this.signer?.kind === "userDelegation") {
                sourceUrl = await buildAzureSasUrl(this.containerClient.getBlobClient(this.getFullPath(name)), this.signer, {
                    expiresIn: 300,
                    permissions: "r",
                });
            } else if (this.sasToken) {
                sourceUrl = appendSasToken(source.url, this.sasToken);
            }

            const poller = await this.runOperation(options, (signal) => target.beginCopyFromURL(sourceUrl, { abortSignal: signal }));

            await this.runOperation(options, () => poller.pollUntilDone());

            // Get source file metadata and return with destination name
            const sourceFile = await this.getMeta(name);

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

                while (truncated && files.length < limit) {
                    try {
                        const pageSize = Math.min(limit - files.length, 1000);
                        const next = await this.runOperation(options, (signal) =>
                            this.containerClient
                                .listBlobsFlat({
                                    abortSignal: signal,
                                    includeMetadata: true,
                                    prefix: this.root,
                                })
                                .byPage({ continuationToken: token, maxPageSize: pageSize })
                                .next(),
                        );
                        const response = next.value;

                        if (response !== undefined && "segment" in response) {
                            for (const blob of response.segment.blobItems as BlobItem[]) {
                                if (blob.deleted) {
                                    continue;
                                }

                                files.push({
                                    createdAt: blob.properties.createdOn,
                                    id: blob.name,
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
     * Prefixes the given filePath with the storage root location (assetFolder if configured).
     * @param filePath Relative file path to prefix.
     * @returns Full path with asset folder prefix if configured, otherwise returns original path.
     */
    private getFullPath(filePath: string): string {
        if (this.assetFolder !== undefined) {
            return `${this.assetFolder}/${filePath}`;
        }

        return filePath;
    }

    private async accessCheck(): Promise<void> {
        await this.runOperation(undefined, (signal) => this.containerClient.getProperties({ abortSignal: signal }));
    }
}

export default AzureStorage;
