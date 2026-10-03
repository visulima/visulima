import createHttpError from "http-errors";

import type { FileInit, UploadFile } from "../../storage/utils/file";
import type { ChunkInfo } from "../../utils/chunked-upload";
import { getTotalSize, isChunkedUpload, isUploadComplete, trackChunk, validateChunk } from "../../utils/chunked-upload";
import { ERRORS, isUploadError } from "../../utils/errors";
import { retry } from "../../utils/retry";
import type { ResponseFile, ResponseList } from "../types";
import { buildChunkedUploadHeaders, buildFileHeaders, buildFileMetadataHeaders, buildResponseFile } from "../utils/response-builder";

/**
 * Maximum size of a JSON batch-delete body. 1 MiB comfortably holds thousands of ids.
 */
export const MAX_BATCH_DELETE_BYTES = 1_048_576;

/**
 * Ids a client may choose when creating a file via PUT. Dots are excluded so a client-chosen id can
 * never collide with a storage sidecar such as `id.META` (which would overwrite another file's metadata).
 */
const CLIENT_FILE_ID_PATTERN = /^[\w-]{1,255}$/;

/**
 * Validates a list of ids for batch deletion.
 * @param ids Candidate ids
 * @returns The ids
 * @throws {HttpError} 400 when the list is empty or contains a non-string entry
 */
const assertBatchIds = (ids: unknown[]): string[] => {
    if (ids.length === 0) {
        throw createHttpError(400, "No file IDs provided");
    }

    if (!ids.every((id) => typeof id === "string" && id.length > 0)) {
        throw createHttpError(400, "File IDs must be non-empty strings");
    }

    return ids as string[];
};

/**
 * Parses the `?ids=id1,id2` batch-delete query parameter.
 * @param value Raw query parameter value
 * @returns The ids
 * @throws {HttpError} 400 when no id is given
 */
export const parseBatchIdsParameter = (value: string): string[] =>
    assertBatchIds(
        value
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean),
    );

/**
 * Parses a JSON batch-delete body: either `["id1", "id2"]` or `{ "ids": ["id1", "id2"] }`.
 * @param body Raw request body
 * @returns The ids, or `undefined` when the body is not a batch-delete payload (the request is then a single delete)
 * @throws {HttpError} 400 when the payload is a batch-delete shape with no or invalid ids
 */
export const parseBatchDeleteBody = (body: string): string[] | undefined => {
    let parsed: unknown;

    try {
        parsed = JSON.parse(body);
    } catch {
        return undefined;
    }

    if (Array.isArray(parsed)) {
        return assertBatchIds(parsed);
    }

    if (typeof parsed === "object" && parsed !== null && "ids" in parsed && Array.isArray(parsed.ids)) {
        return assertBatchIds(parsed.ids);
    }

    return undefined;
};

/**
 * Drops the file id segment from a request URL that addresses a single file (PUT/PATCH), so the
 * Location header can be built from the collection URL like it is for POST (`collection/id.ext`).
 * @param requestUrl Request URL (absolute on fetch runtimes, path-only on Node)
 * @returns The collection URL, keeping origin and query string
 */
const toCollectionUrl = (requestUrl: string): string => {
    const url = new URL(requestUrl, "http://localhost");

    url.pathname = url.pathname.replace(/\/[^/]+\/?$/, "") || "/";

    return /^https?:\/\//i.test(requestUrl) ? url.toString() : `${url.pathname}${url.search}`;
};

/**
 * Base class containing shared REST API business logic.
 * Platform-agnostic - contains no Node.js or Web API specific code.
 * @template TFile The file type used by this handler.
 */

/**
 * Reads the chunks recorded for a chunked upload.
 */
const getChunks = (file: UploadFile): ChunkInfo[] => (Array.isArray(file.metadata?._chunks) ? (file.metadata._chunks as ChunkInfo[]) : []);

/**
 * The status a chunked upload has once `chunks` are recorded: "completed" when they cover the
 * file, and a "completed" the chunks don't back up reopened as "part".
 */
const reconcileChunkedStatus = (chunks: ChunkInfo[], totalSize: number, status: UploadFile["status"]): UploadFile["status"] => {
    if (isUploadComplete(chunks, totalSize)) {
        return "completed";
    }

    return status === "completed" ? "part" : status;
};

abstract class RestBase<TFile extends UploadFile> {
    /**
     * Handle single file deletion.
     * @param id File ID to delete
     * @returns Promise resolving to ResponseFile with deletion result
     */
    public async deleteSingle(id: string): Promise<ResponseFile<TFile>> {
        const file = await this.storage.delete({ id });

        if (file.status === undefined) {
            throw createHttpError(404, "File not found");
        }

        return { ...file, headers: {}, statusCode: 204 };
    }

    /**
     * Handle file creation (POST).
     * @param config File initialization config
     * @param isChunkedUpload Whether this is a chunked upload initialization
     * @param requestUrl Request URL for Location header
     * @param bodyStream Request body stream (for non-chunked uploads)
     * @param contentLength Content length (for non-chunked uploads)
     * @returns Promise resolving to ResponseFile with upload result
     */
    public async handlePost(
        config: FileInit,
        isChunkedUpload: boolean,
        requestUrl: string,
        bodyStream: unknown,
        contentLength: number,
    ): Promise<ResponseFile<TFile>> {
        // Validate total size for chunked uploads
        if (isChunkedUpload && config.size !== undefined) {
            const size = typeof config.size === "number" ? config.size : Number.parseInt(String(config.size), 10);

            if (size > 0 && size > this.storage.maxUploadSize) {
                throw createHttpError(413, `File size exceeds maximum allowed size of ${this.storage.maxUploadSize} bytes`);
            }
        }

        // Create file in storage
        const file = await this.storage.create(config);

        // For chunked uploads, don't write data yet - just initialize
        if (isChunkedUpload) {
            const locationUrl = this.buildFileUrl(requestUrl, file);

            return buildResponseFile(
                file,
                {
                    ...buildFileHeaders(file, locationUrl),
                    "X-Chunked-Upload": "true",
                    "X-Upload-ID": file.id,
                },
                201,
            );
        }

        // Write file data for non-chunked uploads
        const completedFile = await this.storage.write({
            body: bodyStream,
            contentLength,
            id: file.id,
            start: 0,
        });

        const locationUrl = this.buildFileUrl(requestUrl, completedFile);

        return buildResponseFile(completedFile, buildFileHeaders(completedFile, locationUrl), 201);
    }

    /**
     * Handle file update or creation (PUT).
     * @param id File ID from URL
     * @param config File initialization config (for new files)
     * @param requestUrl Request URL for Location header
     * @param bodyStream Request body stream
     * @param contentLength Content length
     * @param metadata Optional metadata to merge (for updates)
     * @returns Promise resolving to ResponseFile with upload result
     */
    public async handlePut(
        id: string,
        config: FileInit,
        requestUrl: string,
        bodyStream: unknown,
        contentLength: number,
        metadata?: Record<string, unknown>,
    ): Promise<ResponseFile<TFile>> {
        // Check if file exists
        let file: TFile;
        let isUpdate = false;

        try {
            await this.storage.getMeta(id);

            // File exists, this is an update
            isUpdate = true;

            // Update file metadata if needed
            if (metadata) {
                await this.storage.update({ id }, { metadata });
            }

            // Overwrite file content
            file = await this.storage.write({
                body: bodyStream,
                contentLength,
                id,
                start: 0,
            });
        } catch (error: unknown) {
            // File doesn't exist, create new one
            const errorWithCode = error as { code?: string; UploadErrorCode?: string };

            if (errorWithCode.UploadErrorCode === ERRORS.FILE_NOT_FOUND || errorWithCode.code === "ENOENT") {
                if (!CLIENT_FILE_ID_PATTERN.test(id)) {
                    throw createHttpError(400, 'File ID may only contain letters, digits, "_" and "-" (max 255 characters)');
                }

                // Create new file under the ID from the URL (providers that assign their own IDs may still override it)
                const newFile = await this.storage.create({ ...config, id });

                file = await this.storage.write({
                    body: bodyStream,
                    contentLength,
                    id: newFile.id,
                    start: 0,
                });
            } else {
                throw error;
            }
        }

        const locationUrl = this.buildFileUrl(toCollectionUrl(requestUrl), file);

        return buildResponseFile(file, buildFileHeaders(file, locationUrl), isUpdate ? 200 : 201);
    }

    /**
     * Handle chunked upload chunk (PATCH).
     * @param id File ID from URL
     * @param chunkOffset Chunk offset in bytes
     * @param contentLength Chunk content length
     * @param chunkChecksum Optional chunk checksum
     * @param requestUrl Request URL for Location header
     * @param bodyStream Request body stream
     * @returns Promise resolving to ResponseFile with upload progress
     */
    public async handlePatch(
        id: string,
        chunkOffset: number,
        contentLength: number,
        chunkChecksum: string | undefined,
        requestUrl: string,
        bodyStream: unknown,
    ): Promise<ResponseFile<TFile>> {
        // Get file metadata
        let file = await this.storage.getMeta(id);
        const metadata = file.metadata || {};
        const isChunkedUploadFile = isChunkedUpload(file);

        // For chunked uploads, ensure file.size is set to total size
        if (isChunkedUploadFile) {
            const totalSize = getTotalSize(file);

            if (totalSize && file.size !== totalSize) {
                file = { ...file, size: totalSize };
            }
        }

        const totalSize = typeof metadata._totalSize === "number" ? metadata._totalSize : file.size || 0;

        if (!isChunkedUploadFile) {
            throw createHttpError(400, "File is not a chunked upload. Use POST or PUT for full file uploads.");
        }

        // Validate chunk offset and size (max 100MB per chunk)
        const MAX_CHUNK_SIZE = 100 * 1024 * 1024;

        try {
            validateChunk(chunkOffset, contentLength, totalSize, MAX_CHUNK_SIZE);
        } catch (error) {
            if (error instanceof Error && error.message.includes("exceeds maximum")) {
                throw createHttpError(413, error.message);
            }

            throw createHttpError(400, error instanceof Error ? error.message : String(error));
        }

        // Check if file is already completed. A "completed" status the chunk list doesn't back up
        // is stale: providers mark a file completed once the furthest byte is written, so the last
        // chunk arriving first sets it before earlier chunks exist. Reopen the upload instead of
        // answering "complete" for chunks that were never stored.
        if (file.status === "completed") {
            if (isUploadComplete(getChunks(file), totalSize)) {
                const locationUrl = this.buildFileUrl(toCollectionUrl(requestUrl), file);

                return buildResponseFile(
                    file,
                    {
                        ...buildFileHeaders(file, locationUrl),
                        "X-Upload-Complete": "true",
                    },
                    200,
                );
            }

            await this.storage.update({ id }, { status: "part" });
        }

        // Write the chunk first and record it in `_chunks` only once the provider has stored it.
        // Completion is derived from that list, so recording a chunk the provider then refuses
        // (conflict, transient error, sequential-only provider) would let a later PATCH report the
        // upload complete with bytes missing from storage.
        const written = await this.storage.write({
            body: bodyStream,
            contentLength,
            id,
            start: chunkOffset,
        });

        // The read-modify-write of `_chunks` must be serialized: two concurrent PATCHes for the same
        // file would otherwise each read the same `existingChunks`, append their own entry, and the
        // second write would overwrite the first — silently losing a chunk record. A distinct
        // `chunks:` namespace avoids conflict with the adapter's internal write lock keyed on the file id.
        // The lock fails fast when held, so retry briefly: the chunk is already stored and must be recorded.
        // The stored status is reconciled with the chunk list under the same lock: each provider
        // write sets it from its own view of the bytes, so concurrent PATCHes would otherwise leave
        // "part" behind on a finished upload (#902), or "completed" on an unfinished one.
        let chunks: ChunkInfo[];
        let status: UploadFile["status"];

        try {
            ({ chunks, status } = await retry(
                async () =>
                    this.storage.withLock(`chunks:${id}`, async () => {
                        const current = await this.storage.getMeta(id);
                        const merged = trackChunk(getChunks(current), {
                            checksum: chunkChecksum,
                            length: contentLength,
                            offset: chunkOffset,
                        });
                        const reconciled = reconcileChunkedStatus(merged, totalSize, current.status);

                        await this.storage.update({ id }, { metadata: { ...current.metadata, _chunks: merged }, status: reconciled });

                        return { chunks: merged, status: reconciled };
                    }),
                {
                    initialDelay: 10,
                    maxDelay: 200,
                    maxRetries: 8,
                    shouldRetry: (error) => isUploadError(error) && error.UploadErrorCode === ERRORS.FILE_LOCKED,
                },
            ));
        } catch (error) {
            // Don't leave a "completed" status set by the write behind for an unrecorded chunk.
            if (written.status === "completed") {
                await this.storage.update({ id }, { status: "part" });
            }

            throw error;
        }

        const isComplete = status === "completed";
        const updatedFile: TFile = { ...written, metadata: { ...written.metadata, _chunks: chunks }, status };

        // For completed uploads, ensure bytesWritten equals totalSize
        const finalFile = isComplete && updatedFile.bytesWritten !== totalSize ? { ...updatedFile, bytesWritten: totalSize } : updatedFile;

        const locationUrl = this.buildFileUrl(toCollectionUrl(requestUrl), finalFile);
        const headers = {
            ...buildFileHeaders(finalFile, locationUrl),
            ...buildChunkedUploadHeaders(finalFile, isComplete),
            "x-upload-offset": String(finalFile.bytesWritten || 0),
        };

        return buildResponseFile(finalFile, headers, isComplete ? 200 : 202);
    }

    /**
     * Handle file metadata retrieval (HEAD).
     * @param id File ID from URL
     * @returns Promise resolving to ResponseFile with metadata headers
     */
    public async handleHead(id: string): Promise<ResponseFile<TFile>> {
        let file = await this.storage.getMeta(id);
        const isChunkedUploadFile = isChunkedUpload(file);

        // For chunked uploads, ensure file.size is set to total size
        if (isChunkedUploadFile) {
            const totalSize = getTotalSize(file);

            if (totalSize && file.size !== totalSize) {
                file = { ...file, size: totalSize };
            }
        }

        const headers: Record<string, string | number> = {
            ...buildFileMetadataHeaders(file),
        };

        // Add chunked upload progress headers
        if (isChunkedUploadFile) {
            const totalSize = getTotalSize(file) || file.size || 0;
            const isComplete = isUploadComplete(getChunks(file), totalSize);

            Object.assign(headers, buildChunkedUploadHeaders(file, isComplete));
        }

        return buildResponseFile(file, headers, 200);
    }

    /**
     * Handle OPTIONS request with REST API capabilities.
     * @param methods Array of supported HTTP methods
     * @param maxUploadSize Maximum upload size
     * @returns ResponseFile with CORS headers
     */
    // eslint-disable-next-line class-methods-use-this
    public handleOptions(methods: string[], maxUploadSize: number): ResponseFile<TFile> {
        const headers = {
            "Access-Control-Allow-Headers":
                "Authorization, Content-Type, Content-Length, Content-Disposition, X-File-Metadata, X-Chunked-Upload, X-Total-Size, X-Chunk-Offset, X-Chunk-Checksum",
            "Access-Control-Allow-Methods": methods.map((method) => method.toUpperCase()).join(", "),
            "Access-Control-Max-Age": 86_400,
            "X-Max-Upload-Size": String(maxUploadSize),
        };

        return {
            headers,
            statusCode: 204,
        } as unknown as ResponseFile<TFile>;
    }

    /**
     * Handle batch file deletion.
     * @param ids Array of file IDs to delete
     * @returns Promise resolving to ResponseList with deletion results
     */
    public async deleteBatch(ids: string[]): Promise<ResponseList<TFile>> {
        // Use storage-level batch delete if available, otherwise fall back to individual deletes
        const result = await this.storage.deleteBatch(ids);

        // If all deletions failed, return error
        if (result.successfulCount === 0 && result.failedCount > 0) {
            const failedIds = result.failed.map((errorItem) => errorItem.id).join(", ");

            throw createHttpError(404, `Failed to delete files: ${failedIds}`);
        }

        // Return successful deletions (partial success is OK)
        // Always include headers for batch operations to indicate results
        return {
            data: result.successful,
            headers:
                result.failedCount > 0
                    ? {
                          "X-Delete-Errors": JSON.stringify(result.failed),
                          "X-Delete-Failed": String(result.failedCount),
                          "X-Delete-Successful": String(result.successfulCount),
                      }
                    : {
                          "X-Delete-Successful": String(result.successfulCount),
                      },
            statusCode: result.successfulCount === ids.length ? 204 : 207, // 207 Multi-Status for partial success
        };
    }

    /**
     * Storage instance for file operations.
     */
    // eslint-disable-next-line class-methods-use-this
    protected get storage(): {
        create: (config: FileInit) => Promise<TFile>;
        delete: (options: { id: string }) => Promise<TFile>;
        deleteBatch: (ids: string[]) => Promise<{
            failed: { error: string; id: string }[];
            failedCount: number;
            successful: TFile[];
            successfulCount: number;
        }>;
        getMeta: (id: string) => Promise<TFile>;
        maxUploadSize: number;
        update: (options: { id: string }, updates: { metadata?: Record<string, unknown>; status?: string }) => Promise<void>;
        withLock: <R>(key: string, function_: () => Promise<R>) => Promise<R>;
        write: (options: { body: unknown; contentLength: number; id: string; start: number }) => Promise<TFile>;
    } {
        // This will be overridden by subclasses
        throw new Error("storage must be implemented");
    }

    /**
     * Build file URL from request URL and file data.
     * @param _requestUrl Request URL string
     * @param _file File object containing ID and content type
     * @returns Constructed file URL with extension based on content type
     */
    // eslint-disable-next-line class-methods-use-this
    protected buildFileUrl(_requestUrl: string, _file: TFile): string {
        // This will be overridden by subclasses
        throw new Error("buildFileUrl must be implemented");
    }
}

export default RestBase;
