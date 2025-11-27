import type { Readable } from "node:stream";

import { copy, del, list, put } from "@vercel/blob";

import { detectFileTypeFromBuffer } from "../../utils/detect-file-type";
import toMilliseconds from "../../utils/primitives/to-milliseconds";
import LocalMetaStorage from "../local/local-meta-storage";
import type MetaStorage from "../meta-storage";
import { BaseStorage } from "../storage";
import type { FileInit, FilePart, FileQuery, FileReturn } from "../utils/file";
import { getFileStatus, hasContent, partMatch, updateSize } from "../utils/file";
import type { VercelBlobStorageOptions } from "./types";
import VercelBlobFile from "./vercel-blob-file";

/**
 * Vercel Blob storage based backend.
 * @example
 * ```ts
 * const storage = new VercelBlobStorage({
 *   token: process.env.BLOB_READ_WRITE_TOKEN,
 *   metaStorageConfig: { directory: '/tmp/upload-metafiles' }
 * });
 * ```
 * @remarks
 * ## Supported Operations
 * - ✅ create, write, delete, get, copy, move
 * - ✅ Batch operations: deleteBatch, copyBatch, moveBatch (inherited from BaseStorage)
 * - ❌ exists: Not implemented (use get() and catch FILE_NOT_FOUND error)
 * - ❌ getStream: Not implemented (use get() for file retrieval)
 * - ❌ list: Not implemented (Vercel Blob API doesn't support listing)
 * - ❌ update: Not implemented (Vercel Blob API doesn't support metadata updates)
 * - ❌ getUrl: Not implemented (Vercel Blob URLs available via Vercel Blob API)
 * - ❌ getUploadUrl: Not implemented (Vercel Blob upload URLs handled internally)
 */
class VercelBlobStorage extends BaseStorage<VercelBlobFile, FileReturn> {
    public static override readonly name: string = "vercel-blob";

    public override checksumTypes: string[] = ["md5"];

    protected meta: MetaStorage<VercelBlobFile>;

    private readonly token: string;

    private readonly multipart: boolean | number;

    public constructor(config: VercelBlobStorageOptions) {
        super(config);

        this.token = config.token || process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_TOKEN || "";

        if (!this.token) {
            throw new Error("Vercel Blob token is required. Set BLOB_READ_WRITE_TOKEN or VERCEL_BLOB_TOKEN environment variable, or provide token in config.");
        }

        this.multipart = config.multipart ?? false;

        const { metaStorage, metaStorageConfig } = config;

        this.meta = metaStorage || new LocalMetaStorage<VercelBlobFile>(metaStorageConfig);

        this.isReady = true;
    }

    public async create(config: FileInit): Promise<VercelBlobFile> {
        return this.instrumentOperation("create", async () => {
            // Handle TTL option
            const processedConfig = { ...config };

            if (config.ttl) {
                const ttlMs = typeof config.ttl === "string" ? toMilliseconds(config.ttl) : config.ttl;

                processedConfig.expiredAt = ttlMs === undefined ? undefined : Date.now() + ttlMs;
            }

            const file = new VercelBlobFile(processedConfig);

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

            // For Vercel Blob, we don't create an empty blob initially
            // We create the file metadata and upload when write() is called
            file.bytesWritten = 0;
            file.status = getFileStatus(file);

            await this.saveMeta(file);

            await this.onCreate(file);

            return file;
        });
    }

    public async write(part: FilePart | FileQuery | VercelBlobFile): Promise<VercelBlobFile> {
        return this.instrumentOperation("write", async () => {
            let file: VercelBlobFile;

            if ("contentType" in part && "metadata" in part && !("body" in part) && !("start" in part)) {
                // part is a full file object (not a FilePart)
                file = part as VercelBlobFile;
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

                    // Convert stream to buffer for Vercel Blob
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

                    const blob = new Blob([buffer], { type: file.contentType });

                    // Upload to Vercel Blob
                    const result = await put(file.name, blob, {
                        access: "public",
                        multipart: this.shouldUseMultipart(file),
                    });

                    file.url = result.url;
                    file.pathname = result.pathname;
                    file.downloadUrl = result.downloadUrl;
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
    public async delete({ id }: FileQuery): Promise<VercelBlobFile> {
        return this.instrumentOperation("delete", async () => {
            const file = await this.getMeta(id);

            if (!file.url) {
                throw new Error(`File ${id} does not have a valid URL`);
            }

            file.status = "deleted";

            try {
                await del(file.url, { token: this.token });
            } catch (error) {
                this.logger?.error("Failed to delete blob from Vercel Blob:", error);

                const httpError = this.normalizeError(error instanceof Error ? error : new Error(String(error)));

                await this.onError(httpError);
            }

            await this.deleteMeta(file.id);

            const deletedFile = { ...file };

            await this.onDelete(deletedFile);

            return deletedFile;
        });
    }

    public async get({ id }: FileQuery): Promise<FileReturn> {
        return this.instrumentOperation("get", async () => {
            const file = await this.checkIfExpired(await this.getMeta(id));

            if (!file.url || file.url.length === 0) {
                throw new Error("File URL not found");
            }

            // For Vercel Blob, we need to fetch the content
            // In a real implementation, you might want to use the blob URL directly
            // and let the client download it, but for compatibility with the interface,
            // we'll fetch the content
            const response = await fetch(file.url);
            const content = Buffer.from(await response.arrayBuffer());

            return {
                content,
                contentType: file.contentType,
                ETag: file.ETag,
                expiredAt: file.expiredAt,
                id,
                metadata: file.metadata,
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
    public async copy(name: string, destination: string): Promise<VercelBlobFile> {
        return this.instrumentOperation("copy", async () => {
            const sourceFile = await this.getMeta(name);

            if (!sourceFile.url) {
                throw new Error("Source file URL not found");
            }

            // Use Vercel Blob's copy function
            const result = await copy(sourceFile.url, destination, {
                access: "public",
            });

            // Convert CopyBlobResult to VercelBlobFile
            return {
                ...sourceFile,
                id: destination,
                name: destination,
                pathname: result.pathname,
                url: result.url,
            } as VercelBlobFile;
        });
    }

    /**
     * Moves an upload file to a new location.
     * @param name Source file name/ID.
     * @param destination Destination file name/ID.
     * @returns Promise resolving to the moved file object.
     * @throws {UploadError} If the source file cannot be found.
     */
    public async move(name: string, destination: string): Promise<VercelBlobFile> {
        return this.instrumentOperation("move", async () => {
            const copiedFile = await this.copy(name, destination);

            await this.delete({ id: name });

            return copiedFile;
        });
    }

    public override async list(limit = 1000): Promise<VercelBlobFile[]> {
        return this.instrumentOperation(
            "list",
            async () => {
                const result = await list({ limit });

                return result.blobs.map((blob) => {
                    const file = new VercelBlobFile({
                        contentType: "application/octet-stream", // Default content type
                        metadata: {},
                        originalName: blob.pathname,
                    });

                    file.createdAt = blob.uploadedAt?.toISOString();
                    file.id = blob.pathname;
                    file.modifiedAt = blob.uploadedAt?.toISOString();
                    file.name = blob.pathname;
                    file.pathname = blob.pathname;
                    file.size = blob.size;
                    file.url = blob.url;
                    file.downloadUrl = blob.downloadUrl;

                    return file;
                });
            },
            { limit },
        );
    }

    private internalOnComplete = (file: VercelBlobFile): Promise<void> => this.deleteMeta(file.id);

    /**
     * Determines if multipart upload should be used for the given file.
     * @param file File object to check.
     * @returns True if multipart upload should be used, false otherwise.
     */
    private shouldUseMultipart(file: VercelBlobFile): boolean {
        if (typeof this.multipart === "boolean") {
            return this.multipart;
        }

        if (typeof this.multipart === "number" && file.size !== undefined) {
            return file.size >= this.multipart;
        }

        return false;
    }
}

export default VercelBlobStorage;
