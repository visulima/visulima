import createHttpError from "http-errors";

import { isMetaNotFound } from "../../storage/meta-storage";
import type { FileInit, UploadFile } from "../../storage/utils/file";
import { getIdFromRequestUrl, getRequestStream, readWebRequestText } from "../../utils/http";
import BaseHandlerFetch from "../base/base-handler-fetch";
import type { Handlers, ResponseFile, ResponseList, UploadOptions } from "../types";
import type { HeaderReader } from "../utils/request-parser";
import {
    buildFileInit,
    parseChunkHeaders,
    parseContentDispositionValue,
    parseIntegerHeader,
    parseMetadataHeader,
    requirePositiveContentLength,
} from "../utils/request-parser";
import RestBase, { MAX_BATCH_DELETE_BYTES, parseBatchDeleteBody, parseBatchIdsParameter } from "./rest-base";

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
    public static override readonly methods: Handlers[] = ["delete", "get", "head", "options", "patch", "post", "put"];

    private readonly restBase: RestBase<TFile>;

    public constructor(options: UploadOptions<TFile>) {
        super(options);
        this.restBase = new RestBase<TFile>({
            buildFileUrl: (source, file) => this.buildFileUrlFromString(source.url, file),
            storage: () => this.storage,
        });
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

        // Validate content length (chunked upload initialization may have an empty body)
        const contentLengthHeader = request.headers.get("content-length");
        const contentLength = isChunkedUpload ? (parseIntegerHeader(contentLengthHeader) ?? 0) : requirePositiveContentLength(contentLengthHeader);

        if (contentLengthHeader && parseIntegerHeader(contentLengthHeader) === undefined) {
            throw createHttpError(400, "Content-Length must be a non-negative integer");
        }

        // Also check if body exists (for cases where Content-Length might be set incorrectly)
        if (!isChunkedUpload && request.body === null) {
            throw createHttpError(400, "Request body is required");
        }

        if (contentLength > this.storage.maxUploadSize) {
            throw createHttpError(413, `File size exceeds maximum allowed size of ${this.storage.maxUploadSize} bytes`);
        }

        // Extract file initialization config
        const contentType = request.headers.get("content-type") || "application/octet-stream";
        const config = extractFileInitFromRequest(request, contentLength, contentType);

        // Convert Web API ReadableStream to Node.js Readable stream
        const bodyStream = request.body ? getRequestStream(request) : undefined;

        return this.restBase.handlePost(config, isChunkedUpload, { url: request.url }, bodyStream, contentLength);
    }

    /**
     * Create or update a file via PUT request.
     * Requires file ID in the URL path.
     * @param request Web API Request with file ID and data
     * @returns Promise resolving to ResponseFile with upload result
     */
    public async put(request: Request): Promise<ResponseFile<TFile>> {
        const id = getIdFromRequestUrl(request.url, { stripExtension: true });

        if (!id) {
            throw createHttpError(400, "File ID is required in URL path");
        }

        // Check if request has a body
        if (request.body === null) {
            throw createHttpError(400, "Request body is required");
        }

        const contentLength = requirePositiveContentLength(request.headers.get("content-length"));

        // Validate content length against max upload size
        if (contentLength > this.storage.maxUploadSize) {
            throw createHttpError(413, `File size exceeds maximum allowed size of ${this.storage.maxUploadSize} bytes`);
        }

        // Extract content type from headers or default to application/octet-stream
        const contentType = request.headers.get("content-type") || "application/octet-stream";

        // Extract metadata from headers if present
        const metadata = parseMetadataHeader(request.headers.get("x-file-metadata"));

        // Extract original filename from Content-Disposition header if present
        const originalName = parseContentDispositionValue(request.headers.get("content-disposition"));

        const config: FileInit = {
            contentType,
            metadata: metadata ?? {},
            originalName,
            size: contentLength,
        };

        // Convert Web API ReadableStream to Node.js Readable stream
        const bodyStream = getRequestStream(request);

        return this.restBase.handlePut(id, config, { url: request.url }, bodyStream, contentLength);
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
            return this.restBase.deleteBatch(parseBatchIdsParameter(idsParameter));
        }

        // Check for batch delete via JSON body
        if ((request.headers.get("content-type") || "").includes("application/json")) {
            const ids = parseBatchDeleteBody(await readWebRequestText(request, MAX_BATCH_DELETE_BYTES));

            if (ids) {
                return this.restBase.deleteBatch(ids);
            }
        }

        // Single file delete
        const id = getIdFromRequestUrl(request.url, { stripExtension: true });

        if (!id) {
            throw createHttpError(404, "File not found");
        }

        try {
            return await this.restBase.deleteSingle(id);
        } catch (error: unknown) {
            if (isMetaNotFound(error)) {
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
        const id = getIdFromRequestUrl(request.url, { stripExtension: true });

        if (!id) {
            throw createHttpError(404, "File not found");
        }

        // Check if request has a body
        if (request.body === null) {
            throw createHttpError(400, "Request body is required");
        }

        const contentLength = requirePositiveContentLength(request.headers.get("content-length"));

        // Get chunk offset from headers
        const { chunkOffset } = parseChunkHeaders(webHeaderReader(request));

        if (chunkOffset === undefined) {
            throw createHttpError(400, "X-Chunk-Offset header is required");
        }

        const chunkChecksum = request.headers.get("x-chunk-checksum") || undefined;
        // Convert Web API ReadableStream to Node.js Readable stream
        const bodyStream = getRequestStream(request);

        return this.restBase.handlePatch(id, chunkOffset, contentLength, chunkChecksum, { url: request.url }, bodyStream);
    }

    /**
     * Get file metadata via HEAD request.
     * For chunked uploads, also returns upload progress information.
     * @param request Web API Request with file ID
     * @returns Promise resolving to ResponseFile with metadata headers
     */
    public async head(request: Request): Promise<ResponseFile<TFile>> {
        const id = getIdFromRequestUrl(request.url, { stripExtension: true });

        if (!id) {
            throw createHttpError(404, "File not found");
        }

        try {
            return await this.restBase.handleHead(id);
        } catch (error: unknown) {
            if (isMetaNotFound(error)) {
                throw createHttpError(404, "File not found");
            }

            throw error;
        }
    }

    /**
     * Handle OPTIONS requests with REST API capabilities.
     * @param _request Web API Request
     * @returns Promise resolving to ResponseFile with CORS headers
     */
    public async options(_request: Request): Promise<ResponseFile<TFile>> {
        return this.restBase.handleOptions(RestFetch.methods, this.storage.maxUploadSize);
    }
}

export default RestFetch;

/**
 * Reads headers from a Web API request.
 */
const webHeaderReader =
    (request: Request): HeaderReader =>
    (name: string) =>
        request.headers.get(name);

/**
 * Extract file initialization config from Web API Request.
 */
const extractFileInitFromRequest = (request: Request, contentLength: number, contentType: string): FileInit =>
    buildFileInit(webHeaderReader(request), contentLength, contentType);
