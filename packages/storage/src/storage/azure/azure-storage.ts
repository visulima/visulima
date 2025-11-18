import type { BlobBeginCopyFromURLResponse, BlobDeleteIfExistsResponse, BlobItem, ContainerClient } from "@azure/storage-blob";
import { BlobServiceClient, StorageSharedKeyCredential } from "@azure/storage-blob";
// eslint-disable-next-line import/no-extraneous-dependencies
import { normalize } from "@visulima/path";

import { detectFileTypeFromStream } from "../../utils/detect-file-type";
import { ERRORS, throwErrorCode, UploadError } from "../../utils/errors";
import toMilliseconds from "../../utils/primitives/to-milliseconds";
import type { RetryConfig } from "../../utils/retry";
import { createRetryWrapper } from "../../utils/retry";
import LocalMetaStorage from "../local/local-meta-storage";
import type MetaStorage from "../meta-storage";
import BaseStorage from "../storage";
import type { FileInit, FilePart, FileQuery, FileReturn } from "../utils/file";
import { getFileStatus, hasContent, partMatch } from "../utils/file";
import AzureFile from "./azure-file";
import AzureMetaStorage from "./azure-meta-storage";
import type { AzureStorageOptions } from "./types";

/**
 * Azure Blob Storage implementation.
 * @remarks
 * ## Supported Operations
 * - ✅ create, write, delete, get, list, update, copy, move
 * - ✅ Batch operations: deleteBatch, copyBatch, moveBatch (inherited from BaseStorage)
 * - ❌ exists: Not implemented (use get() and catch FILE_NOT_FOUND error)
 * - ❌ getStream: Not implemented (use get() for file retrieval)
 * - ❌ getUrl: Not implemented (Azure Blob URLs not supported)
 * - ❌ getUploadUrl: Not implemented (Azure Blob upload URLs handled internally)
 */
class AzureStorage extends BaseStorage<AzureFile, FileReturn> {
    public static override readonly name: string = "azure";

    public override checksumTypes: string[] = ["md5"];

    protected meta: MetaStorage<AzureFile>;

    private client: BlobServiceClient;

    private readonly containerClient: ContainerClient;

    private readonly root: string;

    private readonly retry: ReturnType<typeof createRetryWrapper>;

    // eslint-disable-next-line sonarjs/cognitive-complexity
    public constructor(config: AzureStorageOptions) {
        super(config);

        // Container name is required
        if (!config.containerName) {
            throw new Error("Missing required parameter: Azure container name.");
        }

        // Connection is preferred.
        const connectionString = config.connectionString || process.env.AZURE_STORAGE_CONNECTION_STRING || undefined;

        if (connectionString) {
            this.client = BlobServiceClient.fromConnectionString(connectionString);
        } else {
            const accountKey: string | undefined = config.accountKey || process.env.AZURE_STORAGE_ACCOUNT_KEY || undefined;
            const accountName: string | undefined = config.accountName || process.env.AZURE_STORAGE_ACCOUNT || undefined;

            // Access key is required if no connection string is provided
            if (!config.accountKey) {
                throw new Error("Missing required parameter: Azure blob storage account key.");
            }

            // Account name is required if no connection string is provided
            if (!config.accountName) {
                throw new Error("Missing required parameter: Azure blob storage account name.");
            }

            const signedCredentials = new StorageSharedKeyCredential(accountName as string, accountKey as string);

            this.client = new BlobServiceClient(config.endpoint ?? `https://${accountName}.blob.core.windows.net`, signedCredentials);
        }

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

        this.retry = createRetryWrapper(retryConfig);

        if (config.metaStorage) {
            this.meta = config.metaStorage;
        } else {
            let metaConfig = { ...config, ...config.metaStorageConfig, logger: this.logger };

            const localMeta = "directory" in metaConfig;

            if (localMeta) {
                this.logger?.debug("Using local meta storage");

                this.meta = new LocalMetaStorage(metaConfig);
            } else {
                if (connectionString === metaConfig.connectionString) {
                    metaConfig = { ...metaConfig, client: this.client };
                }

                this.meta = new AzureMetaStorage<AzureFile>(metaConfig);
            }
        }

        this.isReady = false;
        this.accessCheck()
            .then(() => {
                this.isReady = true;
            })
            .catch((error) => this.logger?.error("Storage access check failed: %O", error));
    }

    public async create(config: FileInit): Promise<AzureFile> {
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

            const response = await this.retry(() =>
                blobClient.uploadData(Buffer.from(""), {
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
            // eslint-disable-next-line no-underscore-dangle
            file.uri = response._response.headers.get("location") as string;
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
    public async delete({ id }: FileQuery): Promise<AzureFile> {
        return this.instrumentOperation("delete", async () => {
            const file = await this.getMeta(id);

            file.status = "deleted";

            await Promise.all([
                this.deleteMeta(file.id),
                this.retry(() => this.containerClient.getBlockBlobClient(this.getFullPath(file.name)).deleteIfExists()),
            ]);

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
    public async move(name: string, destination: string): Promise<AzureFile> {
        return this.instrumentOperation("move", async () => {
            const copiedFile = await this.copy(name, destination);
            const source = this.getFullPath(name);

            await this.retry(() => this.containerClient.getBlockBlobClient(source).deleteIfExists());

            return copiedFile;
        });
    }

    public async write(part: FilePart | FileQuery | AzureFile): Promise<AzureFile> {
        return this.instrumentOperation("write", async () => {
            let file: AzureFile;

            if ("contentType" in part && "metadata" in part && !("body" in part) && !("start" in part)) {
                // part is a full file object (not a FilePart)
                file = part as AzureFile;
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

            await this.lock(part.id);

            try {
                if (hasContent(part)) {
                    // Detect file type from stream if contentType is not set or is default
                    // Only detect on first write (when bytesWritten is 0 or NaN)
                    if (
                        (file.bytesWritten === 0 || Number.isNaN(file.bytesWritten))
                        && (!file.contentType || file.contentType === "application/octet-stream")
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

                    part.body.on("error", () => abortController.abort());

                    const response = await this.retry(() =>
                        blobClient.uploadStream(part.body, undefined, undefined, {
                            abortSignal: abortController.signal,
                            blobHTTPHeaders: {
                                blobContentType: file.contentType ?? "application/octet-stream",
                            },
                            metadata: file.metadata,
                        }),
                    );

                    if (response.requestId === undefined) {
                        return throwErrorCode(ERRORS.FILE_ERROR, "azure write upload error");
                    }

                    file.requestId = response.requestId;
                    file.bytesWritten += part.contentLength || 0;

                    file.status = getFileStatus(file);

                    if (file.status === "completed") {
                        // eslint-disable-next-line no-underscore-dangle
                        file.uri = response._response.headers.get("location") as string;

                        await this.deleteMeta(file.id);
                    }
                }
            } finally {
                await this.unlock(part.id);
            }

            return file;
        });
    }

    public async get({ id }: FileQuery): Promise<FileReturn> {
        return this.instrumentOperation("get", async () => {
            const blobClient = this.containerClient.getBlockBlobClient(id);

            const exists = await this.retry(() => blobClient.exists());

            if (!exists) {
                // Check if metadata exists - if so, file was deleted (GONE), otherwise never existed (NOT_FOUND)
                try {
                    await this.getMeta(id);

                    return throwErrorCode(ERRORS.GONE);
                } catch {
                    return throwErrorCode(ERRORS.FILE_NOT_FOUND);
                }
            }

            const response = await this.retry(() => blobClient.getProperties());

            const { contentLength, contentType, etag, expiresOn, lastModified, metadata } = response;

            return {
                content: await this.retry(() => blobClient.downloadToBuffer()),
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
     * Copies an upload file to a new location.
     * @param name Source file name/ID.
     * @param destination Destination file name/ID.
     * @returns Promise resolving to the copied file object.
     * @throws {UploadError} If the source file cannot be found.
     */
    public async copy(name: string, destination: string): Promise<AzureFile> {
        return this.instrumentOperation("copy", async () => {
            const source = this.containerClient.getBlockBlobClient(this.getFullPath(name));

            const exists = await this.retry(() => source.exists());

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

            const poller = await this.retry(() => target.beginCopyFromURL(source.url));

            await this.retry(() => poller.pollUntilDone());

            // Get source file metadata and return with destination name
            const sourceFile = await this.getMeta(name);

            return { ...sourceFile, id: destination, name: destination } as AzureFile;
        });
    }

    public override async list(limit = 1000): Promise<AzureFile[]> {
        return this.instrumentOperation(
            "list",
            async () => {
                const files: AzureFile[] = [];

                // Declare truncated as a flag that the while loop is based on.
                let truncated = true;
                let token: string | undefined;

                while (truncated) {
                    try {
                        const iterator = this.containerClient
                            .listBlobsFlat({
                                includeMetadata: true,
                                prefix: this.root,
                            })
                            .byPage({ continuationToken: token, maxPageSize: limit });

                        // eslint-disable-next-line no-await-in-loop
                        const next = await this.retry(() => iterator.next());
                        const response = next.value;

                        if (response !== undefined && "segment" in response) {
                            response.segment.blobItems.forEach((blob: BlobItem) => {
                                if (!blob.deleted) {
                                    files.push({
                                        createdAt: blob.properties.createdOn,
                                        id: blob.name,
                                        modifiedAt: blob.properties.lastModified,
                                    } as AzureFile);
                                }
                            });
                        }

                        truncated = response?.continuationToken !== undefined;

                        if (truncated) {
                            token = response.continuationToken;
                        }
                    } catch (error) {
                        truncated = false;

                        throw error;
                    }
                }

                return files;
            },
            { limit },
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
        return this.retry(() => this.containerClient.getProperties());
    }
}

export default AzureStorage;
