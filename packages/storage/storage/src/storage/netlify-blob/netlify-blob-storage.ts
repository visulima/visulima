import type { Readable } from "node:stream";

import { getStore } from "@netlify/blobs";

import { detectFileTypeFromBuffer } from "../../utils/detect-file-type";
// @ts-expect-error - UploadError is used for type checking in error handling
import type { UploadError } from "../../utils/errors";
import toMilliseconds from "../../utils/primitives/to-milliseconds";
import type { RetryConfig } from "../../utils/retry";
import { createRetryWrapper } from "../../utils/retry";
import LocalMetaStorage from "../local/local-meta-storage";
import type MetaStorage from "../meta-storage";
import { BaseStorage } from "../storage";
import type { FileInit, FilePart, FileQuery, FileReturn } from "../utils/file";
import { getFileStatus, hasContent, partMatch, updateMetadata, updateSize } from "../utils/file";
import NetlifyBlobFile from "./netlify-blob-file";
import type { NetlifyBlobStorageOptions } from "./types";

/**
 * Netlify Blob storage based backend.
 * @example
 * ```ts
 * const storage = new NetlifyBlobStorage({
 *   storeName: 'uploads',
 *   metaStorageConfig: { directory: '/tmp/upload-metafiles' }
 * });
 * ```
 * @remarks
 * ## Supported Operations
 * - ✅ create, write, delete, get, list, copy, move
 * - ✅ Batch operations: deleteBatch, copyBatch, moveBatch (inherited from BaseStorage)
 * - ✅ exists: Implemented (checks metadata and Netlify Blob)
 * - ✅ update: Implemented (updates metadata file, Netlify Blob API doesn't support blob metadata updates)
 * - ❌ getStream: Not implemented (use get() for file retrieval)
 * - ❌ getUrl: Not implemented (Netlify Blob URLs available via Netlify Blob API)
 * - ❌ getUploadUrl: Not implemented (Netlify Blob upload URLs handled internally)
 */
class NetlifyBlobStorage extends BaseStorage<NetlifyBlobFile, FileReturn> {
    public static override readonly name: string = "netlify-blob";

    public override checksumTypes: string[] = ["md5"];

    protected meta: MetaStorage<NetlifyBlobFile>;

    private readonly storeName: string;

    private readonly siteID?: string;

    private readonly token?: string;

    private store: ReturnType<typeof getStore>;

    private readonly retry: ReturnType<typeof createRetryWrapper>;

    public constructor(config: NetlifyBlobStorageOptions) {
        super(config);

        this.storeName = config.storeName || "default";
        this.siteID = config.siteID || process.env.NETLIFY_SITE_ID;
        this.token = config.token || process.env.NETLIFY_TOKEN;

        // Initialize Netlify Blob store
        this.store = getStore({
            name: this.storeName,
            ...this.siteID && { siteID: this.siteID },
            ...this.token && { token: this.token },
        });

        // Initialize retry wrapper with config or defaults
        const retryConfig: RetryConfig = {
            backoffMultiplier: 2,
            initialDelay: 1000,
            maxDelay: 30_000,
            maxRetries: 3,
            retryableStatusCodes: [408, 429, 500, 502, 503, 504],
            shouldRetry: (error: unknown) => {
                // Network errors
                if (error instanceof Error) {
                    const errorWithCode = error as { code?: string };
                    const errorCode = errorWithCode.code;

                    if (errorCode === "ECONNRESET" || errorCode === "ETIMEDOUT" || errorCode === "ENOTFOUND" || errorCode === "ECONNREFUSED") {
                        return true;
                    }
                }

                // HTTP errors
                const errorWithStatus = error as { status?: number };

                return Boolean(errorWithStatus.status && [408, 429, 500, 502, 503, 504].includes(errorWithStatus.status));
            },
            ...config.retryConfig,
        };

        this.retry = createRetryWrapper(retryConfig);

        const { metaStorage, metaStorageConfig } = config;

        this.meta = metaStorage || new LocalMetaStorage<NetlifyBlobFile>(metaStorageConfig);

        this.isReady = true;
    }

    public async create(config: FileInit): Promise<NetlifyBlobFile> {
        return this.instrumentOperation("create", async () => {
            // Handle TTL option
            const processedConfig = { ...config };

            if (config.ttl) {
                const ttlMs = typeof config.ttl === "string" ? toMilliseconds(config.ttl) : config.ttl;

                processedConfig.expiredAt = ttlMs === undefined ? undefined : Date.now() + ttlMs;
            }

            const file = new NetlifyBlobFile(processedConfig);

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

            // For Netlify Blob, we don't create an empty blob initially
            // We create the file metadata and upload when write() is called
            file.bytesWritten = 0;
            file.status = getFileStatus(file);

            await this.saveMeta(file);

            await this.onCreate(file);

            return file;
        });
    }

    public async write(part: FilePart | FileQuery | NetlifyBlobFile): Promise<NetlifyBlobFile> {
        return this.instrumentOperation("write", async () => {
            let file: NetlifyBlobFile;

            if ("contentType" in part && "metadata" in part && !("body" in part) && !("start" in part)) {
                // part is a full file object (not a FilePart)
                file = part as NetlifyBlobFile;
            } else {
                // part is FilePart or FileQuery
                file = await this.getMeta(part.id);

                await this.checkIfExpired(file);
            }

            if (file.status === "completed") {
                return file;
            }

            if (part.size !== undefined) {
                updateSize(file, part.size);
            }

            if (!partMatch(part, file)) {
                throw new Error("File part does not match");
            }

            await this.lock(part.id);

            try {
                if (hasContent(part)) {
                    if (this.isUnsupportedChecksum(part.checksumAlgorithm)) {
                        throw new Error("Unsupported checksum algorithm");
                    }

                    // Convert stream to buffer for Netlify Blob
                    const chunks: Buffer[] = [];
                    const stream = part.body as Readable;

                    for await (const chunk of stream) {
                        chunks.push(Buffer.from(chunk));
                    }

                    const buffer = Buffer.concat(chunks);

                    // Detect file type from buffer if contentType is not set or is default
                    // Only detect on first write (when bytesWritten is 0 or NaN)
                    if (
                        (file.bytesWritten === 0 || Number.isNaN(file.bytesWritten))
                        && (!file.contentType || file.contentType === "application/octet-stream")
                    ) {
                        try {
                            const fileType = await detectFileTypeFromBuffer(buffer);

                            // Update contentType if file type was detected
                            if (fileType?.mime) {
                                file.contentType = fileType.mime;
                            }
                        } catch {
                            // If file type detection fails, continue with original contentType
                            // This is not a critical error
                        }
                    }

                    // Upload to Netlify Blob
                    // Convert Buffer to ArrayBuffer for Netlify Blob API
                    await this.retry(() =>
                        this.store.set(file.name, buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), {
                            metadata: {
                                contentType: file.contentType,
                                ...file.metadata,
                            },
                        }),
                    );

                    // Generate URL - Netlify Blob URLs are based on the store and key
                    file.pathname = file.name;
                    file.url = this.getBlobUrl(file.name);
                    file.bytesWritten = buffer.length;
                }

                file.status = getFileStatus(file);

                if (file.status === "completed") {
                    await this.internalOnComplete(file);
                }

                await this.saveMeta(file);

                return file;
            } finally {
                await this.unlock(part.id);
            }
        });
    }

    /**
     * Deletes an upload and its metadata.
     * @param query File query containing the file ID to delete.
     * @param query.id File ID to delete.
     * @returns Promise resolving to the deleted file object with status: "deleted".
     * @throws {UploadError} If the file metadata cannot be found.
     */
    public async delete({ id }: FileQuery): Promise<NetlifyBlobFile> {
        return this.instrumentOperation("delete", async () => {
            const file = await this.getMeta(id);

            if (!file.pathname) {
                throw new Error(`File ${id} does not have a valid pathname`);
            }

            file.status = "deleted";

            try {
                await this.retry(() => this.store.delete(file.pathname as string));
            } catch (error) {
                this.logger?.error("Failed to delete blob from Netlify Blob:", error);

                const httpError = this.normalizeError(error instanceof Error ? error : new Error(String(error)));

                await this.onError(httpError);
            }

            await this.deleteMeta(file.id);

            const deletedFile = { ...file };

            await this.onDelete(deletedFile);

            return deletedFile;
        });
    }

    /**
     * Checks if a file exists by verifying both metadata and the actual Netlify Blob.
     * Returns true only if both the metadata and the blob exist.
     * @param query File query containing the file ID to check.
     * @returns Promise resolving to true if both metadata and blob exist, false otherwise.
     */
    public override async exists({ id }: FileQuery): Promise<boolean> {
        return this.instrumentOperation("exists", async () => {
            try {
                // First check if metadata exists
                const file = await this.getMeta(id);

                if (!file.pathname || file.pathname.length <= 0) {
                    return false;
                }

                // Then verify the actual blob exists
                const blob = await this.retry(() => this.store.get(file.pathname as string, { type: "blob" }));

                return blob !== null && blob !== undefined;
            } catch {
                // Return false if metadata doesn't exist or blob doesn't exist
                return false;
            }
        });
    }

    public async get({ id }: FileQuery): Promise<FileReturn> {
        return this.instrumentOperation("get", async () => {
            const file = await this.checkIfExpired(await this.getMeta(id));

            if (!file.pathname || file.pathname.length <= 0) {
                throw new Error("File pathname not found");
            }

            // Fetch the blob from Netlify Blob
            // Note: Netlify Blobs returns Blob or null
            const blob = await this.retry(() => this.store.get(file.pathname as string, { type: "blob" }));

            if (!blob) {
                throw new Error("File not found in Netlify Blob");
            }

            // Handle both Blob object and string types
            let arrayBuffer: ArrayBuffer;

            if (typeof blob === "string") {
                arrayBuffer = Buffer.from(blob, "utf8").buffer;
            } else if (blob && typeof blob === "object" && "arrayBuffer" in blob && typeof blob.arrayBuffer === "function") {
                arrayBuffer = await this.retry(() => blob.arrayBuffer());
            } else {
                throw new Error("Invalid blob type returned from Netlify Blob");
            }

            const content = Buffer.from(arrayBuffer);

            // Get metadata - Netlify Blobs stores metadata separately
            // We'll use the file metadata from our meta storage as primary source
            // eslint-disable-next-line unicorn/no-null
            let blobMetadata: { contentType?: string; metadata?: Record<string, unknown> } | null = null;

            try {
                // Try to get metadata if the API supports it
                // If not supported, we'll fall back to file metadata

                const metadata = await (
                    this.store as { getMetadata?: (key: string) => Promise<{ contentType?: string; metadata?: Record<string, unknown> } | undefined> }
                ).getMetadata?.(file.pathname);

                blobMetadata = metadata ?? null;
            } catch {
                // Metadata retrieval not supported or failed, use file metadata
            }

            return {
                content,
                contentType: blobMetadata?.contentType || file.contentType,
                ETag: file.ETag,
                expiredAt: file.expiredAt,
                id,
                metadata: {
                    ...file.metadata,
                    ...blobMetadata?.metadata,
                },
                modifiedAt: file.modifiedAt,
                name: file.name,
                originalName: file.originalName,
                size: file.size || content.length,
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
    public async copy(name: string, destination: string): Promise<NetlifyBlobFile> {
        return this.instrumentOperation("copy", async () => {
            const sourceFile = await this.getMeta(name);

            if (!sourceFile.pathname) {
                throw new Error("Source file pathname not found");
            }

            // Get the source blob
            const sourceBlob = await this.retry(() => this.store.get(sourceFile.pathname as string, { type: "blob" }));

            if (!sourceBlob) {
                throw new Error("Source file not found in Netlify Blob");
            }

            // Get source metadata if available
            // eslint-disable-next-line unicorn/no-null
            let sourceMetadata: { contentType?: string; metadata?: Record<string, unknown> } | null = null;

            try {
                const storeWithMetadata = this.store as {
                    getMetadata?: (key: string) => Promise<{ contentType?: string; metadata?: Record<string, unknown> } | null>;
                };

                if (storeWithMetadata.getMetadata && sourceFile.pathname) {
                    sourceMetadata = await storeWithMetadata.getMetadata(sourceFile.pathname);
                }
            } catch {
                // Metadata retrieval not supported, use file metadata
            }

            // Copy by setting the destination with source content
            let arrayBuffer: ArrayBuffer;

            if (typeof sourceBlob === "string") {
                arrayBuffer = Buffer.from(sourceBlob, "utf8").buffer;
            } else if (sourceBlob && typeof sourceBlob === "object" && "arrayBuffer" in sourceBlob) {
                const blobWithArrayBuffer = sourceBlob as { arrayBuffer: () => Promise<ArrayBuffer> };

                arrayBuffer = await this.retry(() => blobWithArrayBuffer.arrayBuffer());
            } else {
                throw new Error("Invalid blob type returned from Netlify Blob");
            }

            const buffer = Buffer.from(arrayBuffer);

            // Convert Buffer to ArrayBuffer for Netlify Blob API
            await this.retry(() =>
                this.store.set(destination, buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), {
                    metadata: sourceMetadata || {
                        contentType: sourceFile.contentType,
                        ...sourceFile.metadata,
                    },
                }),
            );

            // Create a new file metadata for the copied file
            const copiedFile: NetlifyBlobFile = {
                ...sourceFile,
                id: destination,
                name: destination,
                pathname: destination,
                url: this.getBlobUrl(destination),
            };

            // Save metadata for the copied file
            await this.saveMeta(copiedFile);

            return copiedFile;
        });
    }

    /**
     * Moves an upload file to a new location.
     * @param name Source file name/ID.
     * @param destination Destination file name/ID.
     * @returns Promise resolving to the moved file object.
     * @throws {UploadError} If the source file cannot be found.
     */
    public async move(name: string, destination: string): Promise<NetlifyBlobFile> {
        return this.instrumentOperation("move", async () => {
            const copiedFile = await this.copy(name, destination);

            await this.delete({ id: name });

            return copiedFile;
        });
    }

    /**
     * Updates file metadata with user-provided key-value pairs.
     * Updates the metadata file (overwrites it) but does not update Netlify Blob metadata
     * since the Netlify Blob API doesn't support metadata updates.
     * @param query File query containing the file ID to update.
     * @param query.id File ID to update.
     * @param metadata Partial file object containing fields to update.
     * @returns Promise resolving to the updated file object.
     * @throws {UploadError} If the file cannot be found (ERRORS.FILE_NOT_FOUND).
     * @remarks
     * Supports TTL (time-to-live) option: if metadata contains a 'ttl' field,
     * it will be converted to an 'expiredAt' timestamp.
     * TTL can be a number (milliseconds) or string (e.g., "1h", "30m", "7d").
     */
    public override async update({ id }: FileQuery, metadata: Partial<NetlifyBlobFile>): Promise<NetlifyBlobFile> {
        return this.instrumentOperation("update", async () => {
            const file = await this.getMeta(id);

            // Handle TTL option in metadata
            const processedMetadata = { ...metadata };

            if ("ttl" in processedMetadata && processedMetadata.ttl !== undefined) {
                const ttlValue = processedMetadata.ttl;
                const ttlMs = typeof ttlValue === "string" ? toMilliseconds(ttlValue) : ttlValue;

                if (ttlMs !== undefined) {
                    processedMetadata.expiredAt = Date.now() + (ttlMs as number);
                }

                delete (processedMetadata as Record<string, unknown>).ttl;
            }

            // Update metadata (deep merge)
            updateMetadata(file, processedMetadata);

            // Save metadata (overwrites the meta file)
            await this.saveMeta(file);

            const updatedFile = { ...file, status: "updated" } as NetlifyBlobFile;

            await this.onUpdate(updatedFile);

            return updatedFile;
        });
    }

    public override async list(limit = 1000): Promise<NetlifyBlobFile[]> {
        return this.instrumentOperation(
            "list",
            async () => {
                // Netlify Blob list doesn't support limit option directly
                // We'll get all results and limit manually if needed
                const listResult = await this.retry(() => this.store.list());

                const files: NetlifyBlobFile[] = [];

                for await (const blob of listResult.blobs) {
                    // Try to get metadata if available
                    // eslint-disable-next-line unicorn/no-null
                    let metadata: { contentType?: string; metadata?: Record<string, unknown> } | null = null;

                    try {
                        const fetchedMetadata = await (
                            this.store as {
                                getMetadata?: (key: string) => Promise<{ contentType?: string; metadata?: Record<string, unknown> } | undefined>;
                            }
                        ).getMetadata?.(blob.key);

                        metadata = fetchedMetadata ?? null;
                    } catch {
                        // Metadata retrieval not supported
                    }

                    const file = new NetlifyBlobFile({
                        contentType: metadata?.contentType || "application/octet-stream",
                        metadata: metadata?.metadata || {},
                        originalName: blob.key,
                    });

                    // Netlify Blob ListResultBlob may not have createdAt, updatedAt, or size properties
                    // Use type assertion to access them if they exist
                    const blobWithDates = blob as { createdAt?: Date; size?: number; updatedAt?: Date };

                    file.createdAt = blobWithDates.createdAt?.toISOString();
                    file.id = blob.key;
                    file.modifiedAt = blobWithDates.updatedAt?.toISOString();
                    file.name = blob.key;
                    file.pathname = blob.key;
                    file.size = blobWithDates.size;
                    file.url = this.getBlobUrl(blob.key);

                    files.push(file);

                    // Apply limit if specified
                    if (files.length >= limit) {
                        break;
                    }
                }

                return files;
            },
            { limit },
        );
    }

    private internalOnComplete = (file: NetlifyBlobFile): Promise<void> => this.deleteMeta(file.id);

    /**
     * Generate a URL for a blob in Netlify Blob store
     * Note: Netlify Blob doesn't provide direct public URLs like Vercel Blob
     * In production, you would typically serve these through Netlify Functions or Edge Functions
     */
    private getBlobUrl(pathname: string): string {
        // In a real implementation, you might want to return a URL that goes through
        // a Netlify Function or Edge Function to serve the blob
        // For now, we'll return a placeholder that indicates the blob path
        return `/api/blobs/${this.storeName}/${pathname}`;
    }
}

export default NetlifyBlobStorage;
