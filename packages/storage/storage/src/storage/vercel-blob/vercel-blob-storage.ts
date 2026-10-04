import { BlobNotFoundError, copy, del, head, list, put } from "@vercel/blob";

import { detectFileTypeFromBuffer } from "../../utils/detect-file-type";
// @ts-expect-error - UploadError is used for type checking in error handling
import type { UploadError } from "../../utils/errors";
import { ERRORS, throwErrorCode } from "../../utils/errors";
import toMilliseconds from "../../utils/primitives/to-milliseconds";
import LocalMetaStorage from "../local/local-meta-storage";
import type MetaStorage from "../meta-storage";
import { BaseStorage } from "../storage";
import type { OperationOptions } from "../types";
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
 * - ✅ exists: Implemented (checks metadata and Vercel Blob)
 * - ❌ getStream: Not implemented (use get() for file retrieval)
 * - ❌ list: Not implemented (Vercel Blob API doesn't support listing)
 * - ❌ update: Not implemented (Vercel Blob API doesn't support metadata updates)
 * - ❌ getUrl: Not implemented (Vercel Blob URLs available via Vercel Blob API)
 * - ❌ getUploadUrl: Not implemented (Vercel Blob upload URLs handled internally)
 * - ⚠️ Per-operation `signal`/`timeout` are best-effort: the underlying SDK does not support request cancellation, so an in-flight call may complete server-side even after abort. `retries` is honored.
 */

/**
 * Auth credentials resolved at construction and forwarded verbatim to every
 * `@vercel/blob` SDK call. Mirrors the SDK's `BlobCommandOptions` shape so
 * env-based auto-pickup is never required.
 */
type VercelBlobCredentials = { oidcToken: string; storeId: string; token?: never } | { oidcToken?: never; storeId?: never; token: string };

class VercelBlobStorage extends BaseStorage<VercelBlobFile> {
    public static override readonly name: string = "vercel-blob";

    /** Stores each object in a single request, so chunked/resumable uploads are rejected. */
    public override readonly supportsResumableWrites: boolean = false;

    /** No checksum is verified against the written bytes, so none is advertised. */
    public override checksumTypes: string[] = [];

    public override get raw(): {
        copy: typeof copy;
        credentials: VercelBlobCredentials;
        del: typeof del;
        list: typeof list;
        put: typeof put;
    } {
        return { copy, credentials: this.credentials, del, list, put };
    }

    protected meta: MetaStorage;

    private readonly credentials: VercelBlobCredentials;

    private readonly multipart: boolean | number;

    private readonly access: "public";

    public constructor(config: VercelBlobStorageOptions) {
        super(config);

        this.credentials = VercelBlobStorage.resolveCredentials(config);

        this.multipart = config.multipart ?? false;
        this.access = config.access ?? "public";

        const { metaStorage, metaStorageConfig } = config;

        this.meta = metaStorage || new LocalMetaStorage(metaStorageConfig);

        this.isReady = true;
    }

    /**
     * Resolves auth credentials in the same precedence as `@vercel/blob`:
     *
     * 1. Explicit `token` (RW or client token) — always wins.
     * 2. OIDC pair (`oidcToken` + `storeId`), from options or env.
     * 3. `BLOB_READ_WRITE_TOKEN` / `VERCEL_BLOB_TOKEN` env.
     *
     * Throws if no credentials are found, or if OIDC config is partial (one of
     * the two values present without the other) so callers fail loudly instead
     * of silently dropping to anonymous calls that 401 at runtime.
     */
    private static resolveCredentials(config: VercelBlobStorageOptions): VercelBlobCredentials {
        if (config.token) {
            return { token: config.token };
        }

        const oidcToken = config.oidcToken ?? process.env.VERCEL_OIDC_TOKEN;
        const rawStoreId = config.storeId ?? process.env.BLOB_STORE_ID;
        const storeId = rawStoreId?.startsWith("store_") ? rawStoreId.slice("store_".length) : rawStoreId;

        if (oidcToken && storeId) {
            return { oidcToken, storeId };
        }

        if (oidcToken || storeId) {
            throw new Error(
                "Vercel Blob OIDC auth requires both `oidcToken` and `storeId` (or `VERCEL_OIDC_TOKEN` and `BLOB_STORE_ID` env vars). " +
                    `Got: oidcToken=${oidcToken ? "set" : "missing"}, storeId=${storeId ? "set" : "missing"}.`,
            );
        }

        const envToken = process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_TOKEN;

        if (envToken) {
            return { token: envToken };
        }

        throw new Error(
            "Vercel Blob credentials are required. Provide `token`, an `oidcToken`+`storeId` pair, " +
                "or set BLOB_READ_WRITE_TOKEN / (VERCEL_OIDC_TOKEN + BLOB_STORE_ID) env vars.",
        );
    }

    public async create(config: FileInit, _options?: OperationOptions): Promise<VercelBlobFile> {
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

    public async write(part: FilePart | FileQuery | VercelBlobFile, options?: OperationOptions): Promise<VercelBlobFile> {
        return this.instrumentOperation("write", async () => {
            let file: VercelBlobFile;

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

            if (part.size !== undefined) {
                updateSize(file, part.size);
            }

            if (!partMatch(part, file)) {
                throw new Error("File part does not match");
            }

            const lockToken = await this.lock(part.id);

            try {
                if (hasContent(part)) {
                    if (this.isUnsupportedChecksum(part.checksumAlgorithm)) {
                        throw new Error("Unsupported checksum algorithm");
                    }

                    this.assertWholeFileWrite(part, file);

                    // Convert stream to buffer for Vercel Blob
                    const chunks: Buffer[] = [];
                    const stream = part.body;

                    for await (const chunk of stream) {
                        chunks.push(Buffer.from(chunk));
                    }

                    const buffer = Buffer.concat(chunks);

                    this.assertWholeFileWrite(part, file, buffer.byteLength);

                    // Detect file type from buffer if contentType is not set or is default
                    // Only detect on first write (when bytesWritten is 0 or NaN)
                    if (
                        (file.bytesWritten === 0 || Number.isNaN(file.bytesWritten)) &&
                        (!file.contentType || file.contentType === "application/octet-stream")
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
                    const result = await this.runOperation(options, () =>
                        put(file.name, blob, {
                            access: this.access,
                            multipart: this.shouldUseMultipart(file),
                            ...this.credentials,
                        }),
                    );

                    file.url = result.url;
                    file.pathname = result.pathname;
                    file.downloadUrl = result.downloadUrl;
                    file.bytesWritten = buffer.length;
                }

                file.status = getFileStatus(file);

                // Completed uploads keep their metadata.
                await this.saveMeta(file);

                return file;
            } finally {
                await this.unlock(part.id, lockToken);
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
    public async delete({ id }: FileQuery, options?: OperationOptions): Promise<VercelBlobFile> {
        return this.instrumentOperation("delete", async () => {
            const meta = await this.getMeta(id).catch(() => undefined);
            // Without metadata, the blob is looked up by the ID as its pathname.
            const file = meta ?? (await this.getCompletedFile(id, options));

            if (!file) {
                return throwErrorCode(ERRORS.FILE_NOT_FOUND);
            }

            const { url } = file;

            file.status = "deleted";

            // An upload that never received content has no blob to delete, only its metadata.
            if (url) {
                try {
                    await this.runOperation(options, () => del(url, { ...this.credentials }));
                } catch (error) {
                    if (!(error instanceof BlobNotFoundError)) {
                        throw error;
                    }
                }
            }

            // Only once the blob is gone, so a failed delete stays retryable.
            if (meta) {
                await this.deleteMeta(file.id);
            }

            const deletedFile = { ...file };

            await this.onDelete(deletedFile);

            return deletedFile;
        });
    }

    /**
     * Checks if a file exists by verifying both metadata and the actual Vercel Blob.
     * Returns true only if both the metadata and the blob exist.
     * @param query File query containing the file ID to check.
     * @returns Promise resolving to true if both metadata and blob exist, false otherwise.
     */
    public override async exists({ id }: FileQuery, options?: OperationOptions): Promise<boolean> {
        return this.instrumentOperation("exists", async () => {
            try {
                // First check if metadata exists
                const file = await this.getMeta(id);

                if (!file.url || file.url.length === 0) {
                    return false;
                }

                const { url } = file;

                // Then verify the actual blob exists by checking if URL is accessible
                const response = await this.runOperation(options, () => fetch(url, { method: "HEAD" }));

                return response.ok;
            } catch {
                // Return false if metadata doesn't exist or blob doesn't exist
                return false;
            }
        });
    }

    /**
     * Describes the blob stored under an ID that has no upload metadata (an object written by other means).
     * Only blob metadata is requested — the content is never downloaded. The blob is looked up by the upload's ID as its pathname.
     * @param id Upload ID.
     * @param options Operation options.
     * @returns The completed file, or `undefined` when no stored blob exists. Any other failure throws, so a failed lookup never reads as absent.
     */
    public override async getCompletedFile(id: string, options?: OperationOptions): Promise<VercelBlobFile | undefined> {
        return this.instrumentOperation("getCompletedFile", async () => {
            let blob;

            try {
                blob = await this.runOperation(options, () => head(id, this.credentials));
            } catch (error) {
                if (error instanceof BlobNotFoundError) {
                    return undefined;
                }

                throw error;
            }

            const file = new VercelBlobFile({ contentType: blob.contentType, id, metadata: {}, size: blob.size });

            return Object.assign(file, {
                bytesWritten: blob.size,
                downloadUrl: blob.downloadUrl,
                ETag: blob.etag,
                id,
                name: id,
                pathname: blob.pathname,
                status: "completed" as const,
                url: blob.url,
            });
        });
    }

    public async get({ id }: FileQuery, options?: OperationOptions): Promise<FileReturn> {
        return this.instrumentOperation("get", async () => {
            const file = await this.checkIfExpired(await this.getMeta(id));

            if (!file.url || file.url.length === 0) {
                throw new Error("File URL not found");
            }

            const { url } = file;

            // For Vercel Blob, we need to fetch the content
            // In a real implementation, you might want to use the blob URL directly
            // and let the client download it, but for compatibility with the interface,
            // we'll fetch the content
            const response = await this.runOperation(options, () => fetch(url));

            if (!response.ok) {
                if (response.status === 404) {
                    return throwErrorCode(ERRORS.FILE_NOT_FOUND);
                }

                throw new Error(`Vercel Blob: fetching ${url} failed with status ${String(response.status)}`);
            }

            const content = Buffer.from(await this.runOperation(options, () => response.arrayBuffer()));

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
    public async copy(name: string, destination: string, options?: OperationOptions & { storageClass?: string }): Promise<VercelBlobFile> {
        return this.instrumentOperation("copy", async () => {
            const sourceFile = await this.getMeta(name);

            if (!sourceFile.url) {
                throw new Error("Source file URL not found");
            }

            const sourceUrl = sourceFile.url;

            // Use Vercel Blob's copy function
            const result = await this.runOperation(options, () =>
                copy(sourceUrl, destination, {
                    access: "public",
                    ...this.credentials,
                }),
            );

            // Convert CopyBlobResult to VercelBlobFile
            return {
                ...sourceFile,
                id: destination,
                name: destination,
                pathname: result.pathname,
                url: result.url,
            };
        });
    }

    /**
     * Moves an upload file to a new location.
     * @param name Source file name/ID.
     * @param destination Destination file name/ID.
     * @returns Promise resolving to the moved file object.
     * @throws {UploadError} If the source file cannot be found.
     */
    public async move(name: string, destination: string, options?: OperationOptions): Promise<VercelBlobFile> {
        return this.instrumentOperation("move", async () => {
            const copiedFile = await this.copy(name, destination, options);

            await this.delete({ id: name }, options);

            return copiedFile;
        });
    }

    /** Upload records by id: `list` yields blob pathnames, which differ from the ids under a custom `filename`. */
    protected override async listUploads(): Promise<VercelBlobFile[]> {
        return (await this.meta.list()) ?? this.list();
    }

    public override async list(limit = 1000, options?: OperationOptions): Promise<VercelBlobFile[]> {
        return this.instrumentOperation(
            "list",
            async () => {
                const result = await this.runOperation(options, () => list({ limit, ...this.credentials }));

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
