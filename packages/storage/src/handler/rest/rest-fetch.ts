import createHttpError from "http-errors";

import type { FileInit, UploadFile } from "../../storage/utils/file";
import { ERRORS } from "../../utils/errors";
import { getRequestStream } from "../../utils/http";
import { BaseHandlerFetch } from "../base/base-handler-fetch";
import type { Handlers, ResponseFile, ResponseList, UploadOptions } from "../types";
import { RestBase } from "./rest-base";

/**
 * REST API handler for direct binary file uploads (Web API Fetch version).
 *
 * This handler provides a clean REST interface for file operations using Web API Request/Response:
 * - POST: Create a new file with raw binary data or initialize chunked upload
 * - PUT: Create or update a file (requires ID in URL)
 * - PATCH: Upload chunks for chunked uploads (requires ID in URL)
 * - GET: Retrieve a file or list files
 * - DELETE: Delete a file (single) or multiple files (via ?ids=id1,id2 or JSON body)
 * - HEAD: Get file metadata and upload progress
 * - OPTIONS: CORS preflight
 * @example
 * ```ts
 * const rest = new RestFetch({
 *   storage,
 * });
 *
 * // Use with Hono, Cloudflare Workers, etc.
 * app.all('/files/*', async (c) => {
 *   return rest.fetch(c.req.raw);
 * });
 * ```
 */
class RestFetch<TFile extends UploadFile> extends BaseHandlerFetch<TFile> {
    /**
     * Limiting enabled http method handler
     */
    public static override readonly methods: Handlers[] = ["delete", "download", "get", "head", "options", "patch", "post", "put"];

    private readonly restBase: RestBase<TFile>;

    public constructor(options: UploadOptions<TFile>) {
        super(options);
        // Create RestBase instance with access to this RestFetch instance
        const restInstance = this;

        this.restBase = new class extends RestBase<TFile> {
            protected get storage() {
                return restInstance.storage;
            }

            protected buildFileUrl(requestUrl: string, file: TFile): string {
                return restInstance.buildFileUrl({ url: requestUrl } as Request, file);
            }
        }();
    }

    /**
     * Compose and register HTTP method handlers.
     */
    protected compose(): void {
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
     * Creates a new file via POST request with raw binary data.
     * Supports both full file uploads and chunked upload initialization.
     * @param request Web API Request with file data.
     * @returns Promise resolving to ResponseFile with upload result.
     */
    public async post(request: Request): Promise<ResponseFile<TFile>> {
        // Check if this is a chunked upload initialization
        const isChunkedUpload = request.headers.get("x-chunked-upload") === "true";

        // Validate content length
        const contentLengthHeader = request.headers.get("content-length");
        const contentLength = contentLengthHeader ? Number.parseInt(contentLengthHeader, 10) : 0;

        // Validate request body (allow empty for chunked upload initialization)
        // For Web API Request, check Content-Length header instead of body
        if (!isChunkedUpload) {
            if (!contentLengthHeader || Number.isNaN(contentLength) || contentLength === 0) {
                throw createHttpError(400, "Content-Length is required and must be greater than 0");
            }

            // Also check if body exists (for cases where Content-Length might be set incorrectly)
            if (request.body === null) {
                throw createHttpError(400, "Request body is required");
            }
        }

        if (contentLength > this.storage.maxUploadSize) {
            throw createHttpError(413, `File size exceeds maximum allowed size of ${this.storage.maxUploadSize} bytes`);
        }

        // Extract file initialization config
        const contentType = request.headers.get("content-type") || "application/octet-stream";
        const config = extractFileInitFromRequest(request, contentLength, contentType);

        const requestUrl = request.url;
        // Convert Web API ReadableStream to Node.js Readable stream
        const bodyStream = request.body ? getRequestStream(request) : null;

        return this.restBase.handlePost(config, isChunkedUpload, requestUrl, bodyStream, contentLength);
    }

    /**
     * Create or update a file via PUT request.
     * Requires file ID in the URL path.
     * @param request Web API Request with file ID and data
     * @returns Promise resolving to ResponseFile with upload result
     */
    public async put(request: Request): Promise<ResponseFile<TFile>> {
        const id = getIdFromRequestUrl(request.url);

        if (!id) {
            throw createHttpError(400, "File ID is required in URL path");
        }

        // Check if request has a body
        if (request.body === null) {
            throw createHttpError(400, "Request body is required");
        }

        const contentLengthHeader = request.headers.get("content-length");
        const contentLength = contentLengthHeader ? Number.parseInt(contentLengthHeader, 10) : 0;

        if (contentLength === 0) {
            throw createHttpError(400, "Content-Length is required and must be greater than 0");
        }

        // Validate content length against max upload size
        if (contentLength > this.storage.maxUploadSize) {
            throw createHttpError(413, `File size exceeds maximum allowed size of ${this.storage.maxUploadSize} bytes`);
        }

        // Extract content type from headers or default to application/octet-stream
        const contentType = request.headers.get("content-type") || "application/octet-stream";

        // Extract metadata from headers if present
        const metadataHeader = request.headers.get("x-file-metadata");
        let metadata: Record<string, unknown> | undefined;

        if (metadataHeader) {
            try {
                metadata = JSON.parse(metadataHeader);
            } catch {
                // Ignore invalid JSON
            }
        }

        // Extract original filename from Content-Disposition header if present
        let originalName: string | undefined;
        const contentDisposition = request.headers.get("content-disposition");

        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);

            if (filenameMatch && filenameMatch[1]) {
                originalName = filenameMatch[1].replaceAll(/['"]/g, "");
            }
        }

        const config: FileInit = {
            contentType,
            metadata: metadata || {},
            originalName,
            size: contentLength,
        };

        const requestUrl = request.url;
        // Convert Web API ReadableStream to Node.js Readable stream
        const bodyStream = getRequestStream(request);

        return this.restBase.handlePut(id, config, requestUrl, bodyStream, contentLength, metadata);
    }

    /**
     * Delete an uploaded file or multiple files.
     * Supports single file (ID in URL) or batch delete (via ?ids=id1,id2 or JSON body).
     * @param request Web API Request with file ID(s)
     * @returns Promise resolving to ResponseFile (single) or ResponseList (batch) with deletion result
     */
    public async delete(request: Request): Promise<ResponseFile<TFile> | ResponseList<TFile>> {
        // Check for batch delete via query parameter
        const url = new URL(request.url);
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
        const contentType = request.headers.get("content-type") || "";

        if (contentType.includes("application/json")) {
            try {
                const body = await request.text();
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
        const id = getIdFromRequestUrl(request.url);

        if (!id) {
            throw createHttpError(404, "File not found");
        }

        try {
            return this.restBase.deleteSingle(id);
        } catch (error: unknown) {
            const errorWithCode = error as { code?: string; UploadErrorCode?: string };

            if (errorWithCode.UploadErrorCode === ERRORS.FILE_NOT_FOUND || errorWithCode.code === "ENOENT") {
                throw createHttpError(404, "File not found");
            }

            throw error;
        }
    }

    /**
     * Uploads a chunk via PATCH request for chunked uploads.
     * Headers required: X-Chunk-Offset (byte offset), Content-Length (chunk size).
     * Optional: X-Chunk-Checksum (SHA256 checksum for validation).
     * @param request Web API Request with chunk data.
     * @returns Promise resolving to ResponseFile with upload progress.
     */
    public async patch(request: Request): Promise<ResponseFile<TFile>> {
        const id = getIdFromRequestUrl(request.url);

        if (!id) {
            throw createHttpError(404, "File not found");
        }

        // Check if request has a body
        if (request.body === null) {
            throw createHttpError(400, "Request body is required");
        }

        const contentLengthHeader = request.headers.get("content-length");
        const contentLength = contentLengthHeader ? Number.parseInt(contentLengthHeader, 10) : 0;

        if (contentLength === 0) {
            throw createHttpError(400, "Content-Length is required and must be greater than 0");
        }

        // Get chunk offset from headers
        const chunkOffsetHeader = request.headers.get("x-chunk-offset");
        const chunkOffset = chunkOffsetHeader ? Number.parseInt(chunkOffsetHeader, 10) : undefined;

        if (chunkOffset === undefined) {
            throw createHttpError(400, "X-Chunk-Offset header is required");
        }

        const chunkChecksum = request.headers.get("x-chunk-checksum") || undefined;
        const requestUrl = request.url;
        // Convert Web API ReadableStream to Node.js Readable stream
        const bodyStream = getRequestStream(request);

        return this.restBase.handlePatch(id, chunkOffset, contentLength, chunkChecksum, requestUrl, bodyStream);
    }

    /**
     * Get file metadata via HEAD request.
     * For chunked uploads, also returns upload progress information.
     * @param request Web API Request with file ID
     * @returns Promise resolving to ResponseFile with metadata headers
     */
    public async head(request: Request): Promise<ResponseFile<TFile>> {
        const id = getIdFromRequestUrl(request.url);

        if (!id) {
            throw createHttpError(404, "File not found");
        }

        try {
            return this.restBase.handleHead(id);
        } catch (error: unknown) {
            const errorWithCode = error as { code?: string; UploadErrorCode?: string };

            if (errorWithCode.UploadErrorCode === ERRORS.FILE_NOT_FOUND || errorWithCode.code === "ENOENT") {
                throw createHttpError(404, "File not found");
            }

            throw error;
        }
    }

    /**
     * Handle OPTIONS requests with REST API capabilities.
     * @param request Web API Request
     * @returns Promise resolving to ResponseFile with CORS headers
     */
    public async options(request: Request): Promise<ResponseFile<TFile>> {
        return this.restBase.handleOptions(RestFetch.methods, this.storage.maxUploadSize);
    }

    /**
     * Retrieves a file or list of files based on the request path.
     * Delegates to BaseHandlerFetch.fetch() method.
     * @param request Web API Request
     * @returns Promise resolving to Web API Response
     */
    public async get(request: Request): Promise<ResponseFile<TFile> | ResponseList<TFile>> {
        // For Fetch version, get is handled by the fetch() method
        // This method signature exists for consistency but shouldn't be called directly
        throw createHttpError(500, "GET requests should be handled via fetch() method");
    }
}

export default RestFetch;

/**
 * Extract file initialization config from Web API Request.
 */
const extractFileInitFromRequest = (request: Request, contentLength: number, contentType: string): FileInit => {
    const totalSizeHeader = request.headers.get("x-total-size");
    const totalSize = totalSizeHeader ? Number.parseInt(totalSizeHeader, 10) : contentLength;
    const metadataHeader = request.headers.get("x-file-metadata");
    let metadata = {};

    if (metadataHeader) {
        try {
            metadata = JSON.parse(metadataHeader);
        } catch {
            // Ignore invalid JSON
        }
    }

    // Extract original filename from Content-Disposition header if present
    let originalName: string | undefined;
    const contentDisposition = request.headers.get("content-disposition");

    if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);

        if (filenameMatch && filenameMatch[1]) {
            originalName = filenameMatch[1].replaceAll(/['"]/g, "");
        }
    }

    return {
        contentType,
        metadata,
        originalName,
        size: totalSize,
    };
};

/**
 * Extract file ID from request URL.
 */
const getIdFromRequestUrl = (url: string): string | null => {
    try {
        const urlObject = new URL(url);
        const pathParts = urlObject.pathname.split("/").filter(Boolean);
        const lastPart = pathParts[pathParts.length - 1];

        if (!lastPart) {
            return null;
        }

        // Remove extension if present
        const id = lastPart.replace(/\.[^.]+$/, "");

        return id || null;
    } catch {
        return null;
    }
};
