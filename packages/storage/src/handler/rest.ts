import type { IncomingMessage, ServerResponse } from "node:http";

import createHttpError from "http-errors";
import { hasBody } from "type-is";

import type { FileInit, UploadFile } from "../storage/utils/file";
import type { UploadError } from "../utils/errors";
import { ERRORS } from "../utils/errors";
import { getHeader, getIdFromRequest, getRequestStream, readBody } from "../utils/http";
import pick from "../utils/primitives/pick";
import BaseHandler from "./base-handler";
import type { Handlers, ResponseFile, ResponseList, UploadOptions } from "./types";

/**
 * REST API handler for direct binary file uploads.
 *
 * This handler provides a clean REST interface for file operations:
 * - POST: Create a new file with raw binary data or initialize chunked upload
 * - PUT: Create or update a file (requires ID in URL)
 * - PATCH: Upload chunks for chunked uploads (requires ID in URL)
 * - GET: Retrieve a file or list files
 * - DELETE: Delete a file (single) or multiple files (via ?ids=id1,id2 or JSON body)
 * - HEAD: Get file metadata and upload progress
 * - OPTIONS: CORS preflight
 *
 * Chunked Uploads:
 * - POST with X-Chunked-Upload: true header to initialize chunked upload
 * - PATCH with X-Chunk-Offset header to upload chunks
 * - HEAD to check upload progress
 * - Supports out-of-order chunks and resumable uploads
 *
 * Batch Operations:
 * - DELETE ?ids=id1,id2,id3: Delete multiple files via query parameter
 * - DELETE with JSON body: Delete multiple files via JSON array of IDs
 * @example
 * ```ts
 * const rest = new Rest({
 *   storage,
 * });
 *
 * app.use('/files', rest.handle);
 * ```
 * @example
 * ```ts
 * // Initialize chunked upload
 * const initResponse = await fetch('/files', {
 *   method: 'POST',
 *   headers: {
 *     'X-Chunked-Upload': 'true',
 *     'X-Total-Size': '1048576',
 *     'Content-Length': '0'
 *   }
 * });
 * const { id } = await initResponse.json();
 *
 * // Upload chunks
 * await fetch(`/files/${id}`, {
 *   method: 'PATCH',
 *   headers: {
 *     'X-Chunk-Offset': '0',
 *     'Content-Length': '524288'
 *   },
 *   body: chunk1
 * });
 * ```
 */
class Rest<
    TFile extends UploadFile,
    NodeRequest extends IncomingMessage = IncomingMessage,
    NodeResponse extends ServerResponse = ServerResponse,
> extends BaseHandler<TFile, NodeRequest, NodeResponse> {
    /**
     * Limiting enabled http method handler
     * @example
     * ```ts
     * Rest.methods = ['post', 'put', 'delete'];
     * app.use('/upload', new Rest(opts).handle);
     * ```
     */
    public static override readonly methods: Handlers[] = ["delete", "download", "get", "head", "options", "patch", "post", "put"];

    public constructor(options: UploadOptions<TFile>) {
        super(options);
    }

    /**
     * Create a new file via POST request with raw binary data.
     * Supports both full file uploads and chunked upload initialization.
     * For chunked uploads, include headers: X-Chunked-Upload: true, X-Total-Size: &lt;total>
     * @param request Node.js IncomingMessage with file data
     * @returns Promise resolving to ResponseFile with upload result
     */
    public async post(request: NodeRequest): Promise<ResponseFile<TFile>> {
        // Check if this is a chunked upload initialization
        const isChunkedUpload = getHeader(request, "x-chunked-upload", true) === "true";

        // For chunked uploads, empty body is allowed (initialization only)
        if (
            !isChunkedUpload // Check if request has a body
            && !hasBody(request)
        ) {
            throw createHttpError(400, "Request body is required");
        }

        const contentLength = Number.parseInt(getHeader(request, "content-length") || "0", 10);

        // For chunked uploads, Content-Length can be 0 (initialization)
        // For regular uploads, Content-Length must be greater than 0
        if (!isChunkedUpload && contentLength === 0) {
            throw createHttpError(400, "Content-Length is required and must be greater than 0");
        }

        // Validate content length against max upload size
        if (contentLength > this.storage.maxUploadSize) {
            throw createHttpError(413, `File size exceeds maximum allowed size of ${this.storage.maxUploadSize} bytes`);
        }

        // Extract content type from headers or default to application/octet-stream
        const contentType = getHeader(request, "content-type") || "application/octet-stream";

        // Extract original filename from Content-Disposition header if present
        let originalName: string | undefined;
        const contentDisposition = getHeader(request, "content-disposition", true);

        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);

            if (filenameMatch && filenameMatch[1]) {
                originalName = filenameMatch[1].replaceAll(/['"]/g, "");
            }
        }

        // Extract metadata from headers if present
        const metadataHeader = getHeader(request, "x-file-metadata", true);
        let metadata = {};

        if (metadataHeader) {
            try {
                metadata = JSON.parse(metadataHeader);
            } catch {
                // Ignore invalid JSON, use empty metadata
            }
        }

        // Get total size for chunked uploads
        const totalSizeHeader = getHeader(request, "x-total-size", true);
        const totalSize = totalSizeHeader ? Number.parseInt(totalSizeHeader, 10) : contentLength;

        if (isChunkedUpload && totalSize > this.storage.maxUploadSize) {
            throw createHttpError(413, `File size exceeds maximum allowed size of ${this.storage.maxUploadSize} bytes`);
        }

        // For chunked uploads, store chunk tracking info in metadata and set file size
        if (isChunkedUpload) {
            metadata = {
                ...metadata,
                _chunkedUpload: true,
                _chunks: [], // Array to track received chunks: [{ offset, length }]
                _totalSize: totalSize,
            };
        }

        const config: FileInit = {
            contentType,
            metadata,
            originalName,
            size: isChunkedUpload ? totalSize : contentLength,
        };

        // Create file in storage
        const file = await this.storage.create(request, config);

        // For chunked uploads, don't write data yet - just initialize
        if (isChunkedUpload) {
            // File is already persisted by storage.create() which calls saveMeta()
            // The file should be fully persisted at this point
            // No need to save again - storage.create() already handled persistence

            // Return response with file body included
            const responseFile: ResponseFile<TFile> = {
                ...file,
                headers: {
                    Location: this.buildFileUrl(request, file),
                    "X-Chunked-Upload": "true",
                    "X-Upload-ID": file.id,
                    ...file.expiredAt === undefined ? {} : { "X-Upload-Expires": file.expiredAt.toString() },
                },
                status: file.status || "created",
                statusCode: 201,
            };

            return responseFile;
        }

        // Write file data for non-chunked uploads
        const completedFile = await this.storage.write({
            body: getRequestStream(request),
            contentLength,
            id: file.id,
            start: 0,
        });

        return {
            ...completedFile,
            headers: {
                Location: this.buildFileUrl(request, completedFile),
                ...completedFile.expiredAt === undefined ? {} : { "X-Upload-Expires": completedFile.expiredAt.toString() },
                ...completedFile.ETag === undefined ? {} : { ETag: completedFile.ETag },
            },
            statusCode: 201,
        };
    }

    /**
     * Create or update a file via PUT request.
     * Requires file ID in the URL path.
     * @param request Node.js IncomingMessage with file ID and data
     * @returns Promise resolving to ResponseFile with upload result
     */
    public async put(request: NodeRequest): Promise<ResponseFile<TFile>> {
        let id: string;

        try {
            id = getIdFromRequest(request);
        } catch (error: unknown) {
            this.checkForUndefinedIdOrPath(error);

            throw error;
        }

        // Check if request has a body
        if (!hasBody(request)) {
            throw createHttpError(400, "Request body is required");
        }

        const contentLength = Number.parseInt(getHeader(request, "content-length") || "0", 10);

        if (contentLength === 0) {
            throw createHttpError(400, "Content-Length is required and must be greater than 0");
        }

        // Validate content length against max upload size
        if (contentLength > this.storage.maxUploadSize) {
            throw createHttpError(413, `File size exceeds maximum allowed size of ${this.storage.maxUploadSize} bytes`);
        }

        // Extract content type from headers or default to application/octet-stream
        const contentType = getHeader(request, "content-type") || "application/octet-stream";

        // Check if file exists
        let file: TFile;
        let isUpdate = false;

        try {
            const existingFile = await this.storage.getMeta(id);

            // File exists, this is an update
            isUpdate = true;

            // Extract metadata from headers if present
            const metadataHeader = getHeader(request, "x-file-metadata", true);
            let metadata = existingFile.metadata || {};

            if (metadataHeader) {
                try {
                    metadata = { ...metadata, ...JSON.parse(metadataHeader) };
                } catch {
                    // Ignore invalid JSON, keep existing metadata
                }
            }

            // Update file metadata if needed
            if (metadataHeader) {
                await this.storage.update({ id }, { metadata });
            }

            // Overwrite file content
            file = await this.storage.write({
                body: getRequestStream(request),
                contentLength,
                id,
                start: 0,
            });
        } catch (error: unknown) {
            // File doesn't exist, create new one
            const errorWithCode = error as { code?: string; UploadErrorCode?: string };

            if (errorWithCode.UploadErrorCode === ERRORS.FILE_NOT_FOUND || errorWithCode.code === "ENOENT") {
                // Extract original filename from Content-Disposition header if present
                let originalName: string | undefined;
                const contentDisposition = getHeader(request, "content-disposition", true);

                if (contentDisposition) {
                    const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);

                    if (filenameMatch && filenameMatch[1]) {
                        originalName = filenameMatch[1].replaceAll(/['"]/g, "");
                    }
                }

                // Extract metadata from headers if present
                const metadataHeader = getHeader(request, "x-file-metadata", true);
                let metadata = {};

                if (metadataHeader) {
                    try {
                        metadata = JSON.parse(metadataHeader);
                    } catch {
                        // Ignore invalid JSON, use empty metadata
                    }
                }

                const config: FileInit = {
                    contentType,
                    metadata,
                    originalName,
                    size: contentLength,
                };

                // Create new file (storage will generate ID)
                const newFile = await this.storage.create(request, config);

                // Write file data
                file = await this.storage.write({
                    body: getRequestStream(request),
                    contentLength,
                    id: newFile.id,
                    start: 0,
                });
            } else {
                throw error;
            }
        }

        return {
            ...file,
            headers: {
                Location: this.buildFileUrl(request, file),
                ...file.expiredAt === undefined ? {} : { "X-Upload-Expires": file.expiredAt.toString() },
                ...file.ETag === undefined ? {} : { ETag: file.ETag },
            },
            statusCode: isUpdate ? 200 : 201,
        };
    }

    /**
     * Delete an uploaded file or multiple files.
     * Supports single file (ID in URL) or batch delete (via ?ids=id1,id2 or JSON body).
     * @param request Node.js IncomingMessage with file ID(s)
     * @returns Promise resolving to ResponseFile (single) or ResponseList (batch) with deletion result
     */
    public async delete(request: NodeRequest): Promise<ResponseFile<TFile> | ResponseList<TFile>> {
        // Check for batch delete via query parameter
        const url = new URL(request.url || "", "http://localhost");
        const idsParameter = url.searchParams.get("ids");

        if (idsParameter) {
            // Batch delete via query parameter: ?ids=id1,id2,id3
            const ids = idsParameter
                .split(",")
                .map((id) => id.trim())
                .filter(Boolean);

            if (ids.length === 0) {
                throw createHttpError(400, "No file IDs provided");
            }

            return this.deleteBatch(ids);
        }

        // Check for batch delete via JSON body
        const contentType = getHeader(request, "content-type") || "";

        if (contentType.includes("application/json")) {
            try {
                const body = await readBody(request, "utf8", 1024 * 1024); // 1MB limit
                const parsed = JSON.parse(body) as unknown;

                if (Array.isArray(parsed)) {
                    // Array of IDs: ["id1", "id2", "id3"]
                    if (parsed.length === 0) {
                        throw createHttpError(400, "No file IDs provided");
                    }

                    return this.deleteBatch(parsed as string[]);
                }

                if (typeof parsed === "object" && parsed !== null && "ids" in parsed && Array.isArray((parsed as { ids: unknown }).ids)) {
                    // Object with ids array: { ids: ["id1", "id2"] }
                    const idsArray = (parsed as { ids: string[] }).ids;

                    if (idsArray.length === 0) {
                        throw createHttpError(400, "No file IDs provided");
                    }

                    return this.deleteBatch(idsArray);
                }
            } catch (error: unknown) {
                if ((error as { statusCode?: number }).statusCode === 400) {
                    throw error;
                }

                // If JSON parsing fails, fall through to single file delete
            }
        }

        // Single file delete
        try {
            const id = getIdFromRequest(request);

            const file = await this.storage.delete({ id });

            if (file.status === undefined) {
                throw createHttpError(404, "File not found");
            }

            return { ...file, headers: {}, statusCode: 204 } as ResponseFile<TFile>;
        } catch (error: unknown) {
            this.checkForUndefinedIdOrPath(error);

            if ((error as { code?: string }).code === "ENOENT" || (error as { UploadErrorCode?: string }).UploadErrorCode === "FILE_NOT_FOUND") {
                throw createHttpError(404, "File not found");
            }

            throw error;
        }
    }

    /**
     * Upload a chunk via PATCH request for chunked uploads.
     * Headers required: X-Chunk-Offset (byte offset), Content-Length (chunk size)
     * Optional: X-Chunk-Checksum (SHA256 checksum for validation)
     * @param request Node.js IncomingMessage with chunk data
     * @returns Promise resolving to ResponseFile with upload progress
     */
    public async patch(request: NodeRequest): Promise<ResponseFile<TFile>> {
        let id: string;

        try {
            id = getIdFromRequest(request);
        } catch (error: unknown) {
            this.checkForUndefinedIdOrPath(error);

            throw error;
        }

        // Check if request has a body
        if (!hasBody(request)) {
            throw createHttpError(400, "Request body is required");
        }

        const contentLength = Number.parseInt(getHeader(request, "content-length") || "0", 10);

        if (contentLength === 0) {
            throw createHttpError(400, "Content-Length is required and must be greater than 0");
        }

        // Validate chunk size (max 100MB per chunk)
        const MAX_CHUNK_SIZE = 100 * 1024 * 1024;

        if (contentLength > MAX_CHUNK_SIZE) {
            throw createHttpError(413, `Chunk size exceeds maximum allowed size of ${MAX_CHUNK_SIZE} bytes`);
        }

        // Get chunk offset from headers
        const chunkOffsetHeader = getHeader(request, "x-chunk-offset", true);

        if (!chunkOffsetHeader) {
            throw createHttpError(400, "X-Chunk-Offset header is required");
        }

        const chunkOffset = Number.parseInt(chunkOffsetHeader, 10);

        if (Number.isNaN(chunkOffset) || chunkOffset < 0) {
            throw createHttpError(400, "X-Chunk-Offset must be a valid non-negative number");
        }

        // Get file metadata
        let file: TFile;

        try {
            file = await this.storage.getMeta(id);
        } catch (error: unknown) {
            const errorWithCode = error as { code?: string; UploadErrorCode?: string };

            if (errorWithCode.UploadErrorCode === ERRORS.FILE_NOT_FOUND || errorWithCode.code === "ENOENT") {
                throw createHttpError(404, "Upload session not found");
            }

            throw error;
        }

        // Verify this is a chunked upload
        const metadata = file.metadata || {};
        const isChunkedUpload = metadata._chunkedUpload === true;

        // For chunked uploads, ensure file.size is set to total size
        if (isChunkedUpload && metadata._totalSize && file.size !== metadata._totalSize) {
            file = { ...file, size: metadata._totalSize };
        }

        const totalSize = typeof metadata._totalSize === "number" ? metadata._totalSize : file.size || 0;

        if (!isChunkedUpload) {
            throw createHttpError(400, "File is not a chunked upload. Use POST or PUT for full file uploads.");
        }

        // Validate chunk offset and size
        if (chunkOffset + contentLength > totalSize) {
            throw createHttpError(400, `Chunk exceeds file size. Offset: ${chunkOffset}, Size: ${contentLength}, Total: ${totalSize}`);
        }

        // Check if file is already completed
        if (file.status === "completed") {
            return {
                ...file,
                headers: {
                    Location: this.buildFileUrl(request, file),
                    "X-Upload-Complete": "true",
                    ...file.expiredAt === undefined ? {} : { "X-Upload-Expires": file.expiredAt.toString() },
                    ...file.ETag === undefined ? {} : { ETag: file.ETag },
                },
                statusCode: 200,
            };
        }

        // Track chunks in metadata (for status checking)
        type ChunkInfo = { checksum?: string; length: number; offset: number };
        const chunks: ChunkInfo[] = Array.isArray(metadata._chunks) ? ([...metadata._chunks] as ChunkInfo[]) : [];
        const chunkInfo: ChunkInfo = { length: contentLength, offset: chunkOffset };

        // Check if this chunk was already uploaded (idempotency)
        const existingChunk = chunks.find((chunk) => chunk.offset === chunkOffset && chunk.length === contentLength);

        if (!existingChunk) {
            chunks.push(chunkInfo);
        }

        // Optional: Validate chunk checksum if provided
        const chunkChecksum = getHeader(request, "x-chunk-checksum", true);

        if (chunkChecksum) {
            // Note: Full checksum validation would require reading the stream twice
            // For now, we'll store it for later validation if needed
            const chunkWithChecksum = chunks.find((chunk) => chunk.offset === chunkOffset);

            if (chunkWithChecksum) {
                chunkWithChecksum.checksum = chunkChecksum;
            }
        }

        // Update metadata with chunk info
        const updatedMetadata = {
            ...metadata,
            _chunks: chunks,
        };

        await this.storage.update({ id }, { metadata: updatedMetadata });

        // Write chunk data using start offset (handles out-of-order chunks)
        const updatedFile = await this.storage.write({
            body: getRequestStream(request),
            contentLength,
            id,
            start: chunkOffset,
        });

        // Check if upload is complete
        const isComplete = updatedFile.bytesWritten >= totalSize;

        // For completed uploads, ensure bytesWritten equals totalSize
        const finalFile = isComplete && updatedFile.bytesWritten !== totalSize ? { ...updatedFile, bytesWritten: totalSize } : updatedFile;

        return {
            ...finalFile,
            headers: {
                Location: this.buildFileUrl(request, finalFile),
                "x-upload-complete": isComplete ? "true" : "false",
                "x-upload-offset": String(finalFile.bytesWritten || 0),
                ...finalFile.expiredAt === undefined ? {} : { "x-upload-expires": finalFile.expiredAt?.toString() },
                ...finalFile.ETag === undefined ? {} : { etag: finalFile.ETag },
            },
            statusCode: isComplete ? 200 : 202, // 202 Accepted for partial upload
        };
    }

    /**
     * Get file metadata via HEAD request.
     * For chunked uploads, also returns upload progress information.
     * @param request Node.js IncomingMessage with file ID
     * @returns Promise resolving to ResponseFile with metadata headers
     */
    public async head(request: NodeRequest): Promise<ResponseFile<TFile>> {
        try {
            const id = getIdFromRequest(request);

            let file = await this.storage.getMeta(id);
            const metadata = file.metadata || {};
            const isChunkedUpload = metadata._chunkedUpload === true;

            // For chunked uploads, ensure file.size is set to total size
            if (isChunkedUpload && metadata._totalSize && file.size !== metadata._totalSize) {
                file = { ...file, size: metadata._totalSize };
            }

            const headers: Record<string, string | number> = {
                "Content-Length": String(file.size || 0),
                "Content-Type": file.contentType,
                ...file.expiredAt === undefined ? {} : { "X-Upload-Expires": file.expiredAt.toString() },
                ...file.modifiedAt === undefined ? {} : { "Last-Modified": file.modifiedAt.toString() },
                ...file.ETag === undefined ? {} : { ETag: file.ETag },
            };

            // Add chunked upload progress headers
            if (isChunkedUpload) {
                headers["x-chunked-upload"] = "true";
                headers["x-upload-offset"] = String(file.bytesWritten || 0);
                headers["x-upload-complete"] = file.status === "completed" ? "true" : "false";

                // Include received chunks info for resumability
                if (Array.isArray(metadata._chunks) && metadata._chunks.length > 0) {
                    headers["x-received-chunks"] = JSON.stringify(metadata._chunks);
                }
            }

            return {
                ...file,
                headers,
                statusCode: 200,
            } as ResponseFile<TFile>;
        } catch (error: unknown) {
            this.checkForUndefinedIdOrPath(error);

            if ((error as { UploadErrorCode?: string }).UploadErrorCode === "FILE_NOT_FOUND" || (error as { code?: string }).code === "ENOENT") {
                throw createHttpError(404, "File not found");
            }

            throw error;
        }
    }

    /**
     * Handle OPTIONS requests with REST API capabilities.
     * @returns Promise resolving to ResponseFile with CORS headers
     */
    public override async options(): Promise<ResponseFile<TFile>> {
        const headers = {
            "Access-Control-Allow-Headers":
                "Authorization, Content-Type, Content-Length, Content-Disposition, X-File-Metadata, X-Chunked-Upload, X-Total-Size, X-Chunk-Offset, X-Chunk-Checksum",
            "Access-Control-Allow-Methods": Rest.methods.map((method) => method.toUpperCase()).join(", "),
            "Access-Control-Max-Age": 86_400,
        };

        // Access storage to satisfy linter requirement for 'this' usage
        const { maxUploadSize } = this.storage;

        return {
            headers: {
                ...headers,
                "X-Max-Upload-Size": String(maxUploadSize),
            } as Record<string, string | number>,
            statusCode: 204,
        } as ResponseFile<TFile>;
    }

    /**
     * Handle Web API Fetch requests for REST API (for Hono, Cloudflare Workers, etc.).
     * @param request Web API Request object
     * @returns Promise resolving to Web API Response
     */
    public override fetch = async (request: Request): Promise<globalThis.Response> => {
        this.logger?.debug("[fetch request]: %s %s", request.method, request.url);

        const handler = this.registeredHandlers.get(request.method || "GET");

        if (!handler) {
            return this.createErrorResponse({ UploadErrorCode: ERRORS.METHOD_NOT_ALLOWED } as UploadError);
        }

        if (!this.storage.isReady) {
            return this.createErrorResponse({ UploadErrorCode: ERRORS.STORAGE_ERROR } as UploadError);
        }

        try {
            const nodeRequest = await this.convertRequestToNode(request);
            const mockResponse = this.createMockResponse();
            const file = await handler.call(this, nodeRequest as NodeRequest, mockResponse as NodeResponse);

            return this.handleFetchResponse(request, file);
        } catch (error: unknown) {
            const errorObject = error as Record<string, unknown>;
            const uError = pick(errorObject, ["name", ...(Object.getOwnPropertyNames(errorObject) as (keyof Error)[])]) as UploadError;
            const errorEvent = {
                ...uError,
                request: {
                    headers: Object.fromEntries((request.headers as Headers & { entries?: () => IterableIterator<[string, string]> })?.entries?.() || []),
                    method: request.method,
                    url: request.url,
                },
            };

            if (this.listenerCount("error") > 0) {
                this.emit("error", errorEvent);
            }

            this.logger?.error("[fetch error]: %O", errorEvent);

            return this.createErrorResponse(error instanceof Error ? error : new Error(String(error)));
        }
    };

    /**
     * Handle batch file deletion.
     * @param ids Array of file IDs to delete
     * @returns Promise resolving to ResponseList with deletion results
     */
    private async deleteBatch(ids: string[]): Promise<ResponseList<TFile>> {
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
     * Check if error is related to undefined ID or path and throw appropriate HTTP error.
     * @param error Error object to check
     */
    // eslint-disable-next-line class-methods-use-this
    private checkForUndefinedIdOrPath(error: unknown): void {
        if (error instanceof Error && ["Id is undefined", "Invalid request URL", "Path is undefined"].includes(error.message)) {
            throw createHttpError(404, "File not found");
        }
    }
}

export default Rest;
