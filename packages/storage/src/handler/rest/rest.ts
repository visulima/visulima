/* eslint-disable max-classes-per-file */
import type { IncomingMessage, ServerResponse } from "node:http";

// eslint-disable-next-line import/no-extraneous-dependencies
import createHttpError from "http-errors";
import { hasBody } from "type-is";

import type { FileInit, UploadFile } from "../../storage/utils/file";
import { getHeader, getIdFromRequest, getRequestStream, readBody } from "../../utils/http";
import BaseHandlerNode from "../base/base-handler-node";
import type { Handlers, ResponseFile, ResponseList, UploadOptions } from "../types";
import { extractFileInit, parseChunkHeaders, parseContentDisposition, validateContentLength, validateRequestBody } from "../utils/request-parser";
import RestBase from "./rest-base";

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
    public static override readonly methods: Handlers[] = ["delete", "download", "get", "head", "options", "patch", "post", "put"];

    private readonly restBase: RestBase<TFile>;

    public constructor(options: UploadOptions<TFile>) {
        super(options);
        // Create RestBase instance with access to this Rest instance
        const restInstance = this;

        this.restBase = new class extends RestBase<TFile> {
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
                    update: (options: { id: string }, updates: { metadata?: Record<string, unknown>; status?: string }) => Promise<void>;
                    write: (options: { body: unknown; contentLength: number; id: string; start: number }) => Promise<TFile>;
                };
            }

            protected override buildFileUrl(requestUrl: string, file: TFile): string {
                return restInstance.buildFileUrlForRest(requestUrl, file);
            }
        }();
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

        const requestUrl = (request as NodeRequest & { originalUrl?: string }).originalUrl || (request.url as string);
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

        // Extract metadata from headers if present
        const metadataHeader = getHeader(request, "x-file-metadata", true);
        let metadata: Record<string, unknown> | undefined;

        if (metadataHeader) {
            try {
                metadata = JSON.parse(metadataHeader);
            } catch {
                // Ignore invalid JSON
            }
        }

        // Extract original filename from Content-Disposition header if present
        const originalName = parseContentDisposition(request);

        const config: FileInit = {
            contentType,
            metadata: metadata || {},
            originalName,
            size: contentLength,
        };

        const requestUrl = (request as NodeRequest & { originalUrl?: string }).originalUrl || (request.url as string);
        const bodyStream = getRequestStream(request);

        return this.restBase.handlePut(id, config, requestUrl, bodyStream, contentLength, metadata);
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

            return this.restBase.deleteBatch(ids);
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

                    return this.restBase.deleteBatch(parsed as string[]);
                }

                if (typeof parsed === "object" && parsed !== null && "ids" in parsed && Array.isArray((parsed as { ids: unknown }).ids)) {
                    // Object with ids array: { ids: ["id1", "id2"] }
                    const idsArray = (parsed as { ids: string[] }).ids;

                    if (idsArray.length === 0) {
                        throw createHttpError(400, "No file IDs provided");
                    }

                    return this.restBase.deleteBatch(idsArray);
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

            return this.restBase.deleteSingle(id);
        } catch (error: unknown) {
            this.checkForUndefinedIdOrPath(error);

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

        // Get chunk offset from headers
        const { chunkOffset } = parseChunkHeaders(request);

        if (chunkOffset === undefined) {
            throw createHttpError(400, "X-Chunk-Offset header is required");
        }

        const chunkChecksum = getHeader(request, "x-chunk-checksum", true);
        const requestUrl = (request as NodeRequest & { originalUrl?: string }).originalUrl || (request.url as string);
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
        try {
            const id = getIdFromRequest(request);

            return this.restBase.handleHead(id);
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
        return this.restBase.handleOptions(Rest.methods, this.storage.maxUploadSize);
    }

    /**
     * Retrieves a file or list of files based on the request path.
     * Delegates to BaseHandlerNode.get() method.
     * @param request Node.js IncomingMessage with optional originalUrl.
     * @param response Node.js ServerResponse.
     * @returns Promise resolving to a single file, paginated list, or array of files.
     */
    public override async get(request: NodeRequest, response: NodeResponse): Promise<ResponseFile<TFile> | ResponseList<TFile>> {
        return super.get(request, response);
    }
}

export default Rest;
