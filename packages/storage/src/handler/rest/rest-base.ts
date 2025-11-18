import createHttpError from "http-errors";

import type { FileInit, UploadFile } from "../../storage/utils/file";
import { ERRORS } from "../../utils/errors";
import type { ChunkInfo } from "../services/chunked-upload-service";
import { ChunkedUploadService } from "../services/chunked-upload-service";
import type { ResponseFile, ResponseList } from "../types";
import { buildChunkedUploadHeaders, buildFileHeaders, buildFileMetadataHeaders, buildResponseFile } from "../utils/response-builder";

/**
 * Base class containing shared REST API business logic.
 * Platform-agnostic - contains no Node.js or Web API specific code.
 * @template TFile The file type used by this handler.
 */
export abstract class RestBase<TFile extends UploadFile> {
    /**
     * Storage instance for file operations.
     */
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
        write: (options: { body: unknown; contentLength: number; id: string; start: number }) => Promise<TFile>;
    } {
        // This will be overridden by subclasses
        throw new Error("storage must be implemented");
    }

    /**
     * Build file URL from request URL and file data.
     * @param requestUrl Request URL string
     * @param file File object containing ID and content type
     * @returns Constructed file URL with extension based on content type
     */
    protected buildFileUrl(requestUrl: string, file: TFile): string {
        // This will be overridden by subclasses
        throw new Error("buildFileUrl must be implemented");
    }

    /**
     * Handle batch file deletion.
     * @param ids Array of file IDs to delete
     * @returns Promise resolving to ResponseList with deletion results
     */
    protected async deleteBatch(ids: string[]): Promise<ResponseList<TFile>> {
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
     * Handle single file deletion.
     * @param id File ID to delete
     * @returns Promise resolving to ResponseFile with deletion result
     */
    protected async deleteSingle(id: string): Promise<ResponseFile<TFile>> {
        const file = await this.storage.delete({ id });

        if (file.status === undefined) {
            throw createHttpError(404, "File not found");
        }

        return { ...file, headers: {}, statusCode: 204 } as ResponseFile<TFile>;
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
    protected async handlePost(
        config: FileInit,
        isChunkedUpload: boolean,
        requestUrl: string,
        bodyStream: unknown,
        contentLength: number,
    ): Promise<ResponseFile<TFile>> {
        // Validate total size for chunked uploads
        if (isChunkedUpload && config.size > 0 && config.size > this.storage.maxUploadSize) {
            throw createHttpError(413, `File size exceeds maximum allowed size of ${this.storage.maxUploadSize} bytes`);
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
    protected async handlePut(
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
            const existingFile = await this.storage.getMeta(id);

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
                // Create new file (storage will generate ID, but we use the one from URL)
                const newFile = await this.storage.create(config);

                // Write file data
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

        const locationUrl = this.buildFileUrl(requestUrl, file);

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
    protected async handlePatch(
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
        const isChunkedUpload = ChunkedUploadService.isChunkedUpload(file);

        // For chunked uploads, ensure file.size is set to total size
        if (isChunkedUpload) {
            const totalSize = ChunkedUploadService.getTotalSize(file);

            if (totalSize && file.size !== totalSize) {
                file = { ...file, size: totalSize };
            }
        }

        const totalSize = typeof metadata._totalSize === "number" ? metadata._totalSize : file.size || 0;

        if (!isChunkedUpload) {
            throw createHttpError(400, "File is not a chunked upload. Use POST or PUT for full file uploads.");
        }

        // Validate chunk offset and size (max 100MB per chunk)
        const MAX_CHUNK_SIZE = 100 * 1024 * 1024;

        try {
            ChunkedUploadService.validateChunk(chunkOffset, contentLength, totalSize, MAX_CHUNK_SIZE);
        } catch (error) {
            if (error instanceof Error && error.message.includes("exceeds maximum")) {
                throw createHttpError(413, error.message);
            }

            throw createHttpError(400, error instanceof Error ? error.message : String(error));
        }

        // Check if file is already completed
        if (file.status === "completed") {
            const locationUrl = this.buildFileUrl(requestUrl, file);

            return buildResponseFile(
                file,
                {
                    ...buildFileHeaders(file, locationUrl),
                    "X-Upload-Complete": "true",
                },
                200,
            );
        }

        // Track chunks in metadata (for status checking)
        const existingChunks = Array.isArray(metadata._chunks) ? (metadata._chunks as ChunkInfo[]) : [];
        const chunkInfo: ChunkInfo = {
            checksum: chunkChecksum,
            length: contentLength,
            offset: chunkOffset,
        };
        const chunks = ChunkedUploadService.trackChunk(existingChunks, chunkInfo);

        // Update metadata with chunk info
        const updatedMetadata = {
            ...metadata,
            _chunks: chunks,
        };

        await this.storage.update({ id }, { metadata: updatedMetadata });

        // Write chunk data using start offset (handles out-of-order chunks)
        const updatedFile = await this.storage.write({
            body: bodyStream,
            contentLength,
            id,
            start: chunkOffset,
        });

        // Check if upload is complete using ChunkedUploadService
        let isComplete = updatedFile.bytesWritten >= totalSize;

        if (isChunkedUpload) {
            const isChunksComplete = ChunkedUploadService.isUploadComplete(chunks, totalSize);

            isComplete = isChunksComplete;

            // If storage marked it as completed but chunks are missing (out of order upload reaching end), revert status
            if (updatedFile.status === "completed" && !isComplete) {
                await this.storage.update({ id }, { status: "part" });
                // Update local object for response

                (updatedFile as TFile).status = "part";
            }
        }

        // For completed uploads, ensure bytesWritten equals totalSize
        const finalFile = isComplete && updatedFile.bytesWritten !== totalSize ? { ...updatedFile, bytesWritten: totalSize } : updatedFile;

        const locationUrl = this.buildFileUrl(requestUrl, finalFile);
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
    protected async handleHead(id: string): Promise<ResponseFile<TFile>> {
        let file = await this.storage.getMeta(id);
        const isChunkedUpload = ChunkedUploadService.isChunkedUpload(file);

        // For chunked uploads, ensure file.size is set to total size
        if (isChunkedUpload) {
            const totalSize = ChunkedUploadService.getTotalSize(file);

            if (totalSize && file.size !== totalSize) {
                file = { ...file, size: totalSize };
            }
        }

        const headers: Record<string, string | number> = {
            ...buildFileMetadataHeaders(file),
        };

        // Add chunked upload progress headers
        if (isChunkedUpload) {
            const metadata = file.metadata || {};
            const totalSize = ChunkedUploadService.getTotalSize(file) || file.size || 0;
            const chunks = Array.isArray(metadata._chunks) ? (metadata._chunks as ChunkInfo[]) : [];
            const isComplete = ChunkedUploadService.isUploadComplete(chunks, totalSize);

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
    protected handleOptions(methods: string[], maxUploadSize: number): ResponseFile<TFile> {
        const headers = {
            "Access-Control-Allow-Headers":
                "Authorization, Content-Type, Content-Length, Content-Disposition, X-File-Metadata, X-Chunked-Upload, X-Total-Size, X-Chunk-Offset, X-Chunk-Checksum",
            "Access-Control-Allow-Methods": methods.map((method) => method.toUpperCase()).join(", "),
            "Access-Control-Max-Age": 86_400,
            "X-Max-Upload-Size": String(maxUploadSize),
        };

        return {
            headers: headers as Record<string, string | number>,
            statusCode: 204,
        } as ResponseFile<TFile>;
    }
}
