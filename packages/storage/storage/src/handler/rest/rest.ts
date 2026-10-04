/* eslint-disable max-classes-per-file */
import type { IncomingMessage, ServerResponse } from "node:http";

import createHttpError from "http-errors";
import { hasBody } from "type-is";

import type { FileInit, UploadFile } from "../../storage/utils/file";
import { getHeader, getIdFromRequestUrl, getRealPath, getRequestStream, readBody } from "../../utils/http";
import BaseHandlerNode from "../base/base-handler-node";
import type { Handlers, ResponseFile, ResponseList, UploadOptions } from "../types";
import {
    extractFileInit,
    nodeHeaderReader,
    parseChunkHeaders,
    parseContentDisposition,
    parseMetadataHeader,
    requirePositiveContentLength,
    validateContentLength,
    validateRequestBody,
} from "../utils/request-parser";
import RestBase, { MAX_BATCH_DELETE_BYTES, parseBatchDeleteBody, parseBatchIdsParameter } from "./rest-base";

/**
 * Extracts the file id from a REST request with the same rules as the Fetch REST handler:
 * the last path segment with its extension stripped, no minimum length.
 * @param request Node.js request
 * @returns The file id, or `undefined` when the path addresses the collection
 * @throws {HttpError} 400 when the id is unsafe
 */
const getRestFileId = (request: IncomingMessage & { originalUrl?: string }): string | undefined =>
    getIdFromRequestUrl(getRealPath(request), { stripExtension: true });

/**
 * REST API handler for direct binary file uploads (Node.js version).
 *
 * This handler provides a clean REST interface for file operations:
 * - POST: Create a new file with raw binary data or initialize chunked upload
 * - PUT: Create or update a file (requires ID in URL)
 * - PATCH: Upload chunks for chunked uploads (requires ID in URL)
 * - GET: Retrieve a file or list files
 * - DELETE: Delete a file (single) or multiple files (via ?ids=id1,id2 or JSON body)
 * - HEAD: Get file metadata and upload progress
 * - OPTIONS: CORS preflight
 * @example
 * ```ts
 * const rest = new Rest({
 *   storage,
 * });
 *
 * app.use('/files', rest.handle);
 * ```
 */
class Rest<
    TFile extends UploadFile,
    NodeRequest extends IncomingMessage = IncomingMessage,
    NodeResponse extends ServerResponse = ServerResponse,
> extends BaseHandlerNode<TFile, NodeRequest, NodeResponse> {
    /**
     * Limiting enabled http method handler
     */
    public static override readonly methods: Handlers[] = ["delete", "get", "head", "options", "patch", "post", "put"];

    private readonly restBase: RestBase<TFile>;

    public constructor(options: UploadOptions<TFile>) {
        super(options);
        // Create RestBase instance with access to this Rest instance
        const restInstance = this;

        this.restBase = new (class extends RestBase<TFile> {
            // eslint-disable-next-line class-methods-use-this
            protected override get storage() {
                return restInstance.storage as unknown as {
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
                    validateInit: (config: FileInit) => Promise<void>;
                    sequentialWrites?: boolean;
                    update: (options: { id: string }, updates: { metadata?: Record<string, unknown>; status?: string }) => Promise<TFile>;
                    withLock: <R>(key: string, function_: () => Promise<R>) => Promise<R>;
                    write: (options: { body: unknown; contentLength: number; id: string; start: number }) => Promise<TFile>;
                };
            }

            // eslint-disable-next-line class-methods-use-this
            protected override buildFileUrl(requestUrl: string, file: TFile): string {
                return restInstance.buildFileUrlForRest(requestUrl, file);
            }
        })();
    }

    /**
     * Compose and register HTTP method handlers.
     */
    protected override compose(): void {
        this.registeredHandlers.set("POST", this.post.bind(this));
        this.registeredHandlers.set("PUT", this.put.bind(this));
        this.registeredHandlers.set("PATCH", this.patch.bind(this));
        this.registeredHandlers.set("DELETE", this.delete.bind(this));
        this.registeredHandlers.set("HEAD", this.head.bind(this));
        this.registeredHandlers.set("GET", this.get.bind(this));
        this.registeredHandlers.set("OPTIONS", this.options.bind(this));

        this.logger?.debug("Registered handler: %s", [...this.registeredHandlers.keys()].join(", "));
    }

    /**
     * Build file URL from request and file data.
     * @param requestUrl Request URL string
     * @param file File object containing ID and content type
     * @returns Constructed file URL with extension based on content type
     */
    protected buildFileUrlForRest(requestUrl: string, file: TFile): string {
        return this.buildFileUrl({ url: requestUrl } as NodeRequest & { originalUrl?: string }, file);
    }

    /**
     * Creates a new file via POST request with raw binary data.
     * Supports both full file uploads and chunked upload initialization.
     * @param request Node.js IncomingMessage with file data.
     * @returns Promise resolving to ResponseFile with upload result.
     */
    public async post(request: NodeRequest): Promise<ResponseFile<TFile>> {
        // Check if this is a chunked upload initialization
        const isChunkedUpload = getHeader(request, "x-chunked-upload", true) === "true";

        // Validate request body (allow empty for chunked upload initialization)
        validateRequestBody(request, true);

        // Validate content length
        const contentLength = validateContentLength(request, true, this.storage.maxUploadSize);

        // Extract file initialization config
        const contentType = getHeader(request, "content-type") || "application/octet-stream";
        const config = extractFileInit(request, contentLength, contentType);

        const requestUrl = this.locationBaseOf(request);
        const bodyStream = getRequestStream(request);

        return this.restBase.handlePost(config, isChunkedUpload, requestUrl, bodyStream, contentLength);
    }

    /**
     * Create or update a file via PUT request.
     * Requires file ID in the URL path.
     * @param request Node.js IncomingMessage with file ID and data
     * @returns Promise resolving to ResponseFile with upload result
     */
    public async put(request: NodeRequest): Promise<ResponseFile<TFile>> {
        const id = getRestFileId(request);

        if (!id) {
            throw createHttpError(400, "File ID is required in URL path");
        }

        // Check if request has a body
        if (!hasBody(request)) {
            throw createHttpError(400, "Request body is required");
        }

        const contentLength = requirePositiveContentLength(getHeader(request, "content-length"));

        // Validate content length against max upload size
        if (contentLength > this.storage.maxUploadSize) {
            throw createHttpError(413, `File size exceeds maximum allowed size of ${this.storage.maxUploadSize} bytes`);
        }

        // Extract content type from headers or default to application/octet-stream
        const contentType = getHeader(request, "content-type") || "application/octet-stream";

        // Extract metadata from headers if present
        const metadata = parseMetadataHeader(getHeader(request, "x-file-metadata", true));

        // Extract original filename from Content-Disposition header if present
        const originalName = parseContentDisposition(request);

        const config: FileInit = {
            contentType,
            metadata: metadata || {},
            originalName,
            size: contentLength,
        };

        const requestUrl = this.locationBaseOf(request);
        const bodyStream = getRequestStream(request);

        return this.restBase.handlePut(id, config, requestUrl, bodyStream, contentLength);
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
            return this.restBase.deleteBatch(parseBatchIdsParameter(idsParameter));
        }

        // Check for batch delete via JSON body
        if (getHeader(request, "content-type").includes("application/json")) {
            const ids = parseBatchDeleteBody(await readBody(request, "utf8", MAX_BATCH_DELETE_BYTES));

            if (ids) {
                return this.restBase.deleteBatch(ids);
            }
        }

        // Single file delete
        const id = getRestFileId(request);

        if (!id) {
            throw createHttpError(404, "File not found");
        }

        try {
            return await this.restBase.deleteSingle(id);
        } catch (error: unknown) {
            if ((error as { code?: string }).code === "ENOENT" || (error as { UploadErrorCode?: string }).UploadErrorCode === "FILE_NOT_FOUND") {
                throw createHttpError(404, "File not found");
            }

            throw error;
        }
    }

    /**
     * Uploads a chunk via PATCH request for chunked uploads.
     * Headers required: X-Chunk-Offset (byte offset), Content-Length (chunk size).
     * Optional: X-Chunk-Checksum (SHA256 checksum for validation).
     * @param request Node.js IncomingMessage with chunk data.
     * @returns Promise resolving to ResponseFile with upload progress.
     */
    public async patch(request: NodeRequest): Promise<ResponseFile<TFile>> {
        const id = getRestFileId(request);

        if (!id) {
            throw createHttpError(404, "File not found");
        }

        // Check if request has a body
        if (!hasBody(request)) {
            throw createHttpError(400, "Request body is required");
        }

        const contentLength = requirePositiveContentLength(getHeader(request, "content-length"));

        // Get chunk offset from headers
        const { chunkOffset } = parseChunkHeaders(nodeHeaderReader(request));

        if (chunkOffset === undefined) {
            throw createHttpError(400, "X-Chunk-Offset header is required");
        }

        const chunkChecksum = getHeader(request, "x-chunk-checksum", true);
        const requestUrl = this.locationBaseOf(request);
        const bodyStream = getRequestStream(request);

        return this.restBase.handlePatch(id, chunkOffset, contentLength, chunkChecksum, requestUrl, bodyStream);
    }

    /**
     * Get file metadata via HEAD request.
     * For chunked uploads, also returns upload progress information.
     * @param request Node.js IncomingMessage with file ID
     * @returns Promise resolving to ResponseFile with metadata headers
     */
    public async head(request: NodeRequest): Promise<ResponseFile<TFile>> {
        const id = getRestFileId(request);

        if (!id) {
            throw createHttpError(404, "File not found");
        }

        try {
            return await this.restBase.handleHead(id);
        } catch (error: unknown) {
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
        return this.restBase.handleOptions(Rest.methods, this.storage.maxUploadSize);
    }
}

export default Rest;
