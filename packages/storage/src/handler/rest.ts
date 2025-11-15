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
 * - POST: Create a new file with raw binary data
 * - PUT: Create or update a file (requires ID in URL)
 * - GET: Retrieve a file or list files
 * - DELETE: Delete a file (single) or multiple files (via ?ids=id1,id2 or JSON body)
 * - HEAD: Get file metadata
 * - OPTIONS: CORS preflight
 *
 * Batch Operations:
 * - DELETE ?ids=id1,id2,id3: Delete multiple files via query parameter
 * - DELETE with JSON body: Delete multiple files via JSON array of IDs
 *
 * @example
 * ```ts
 * const rest = new Rest({
 *   storage,
 * });
 *
 * app.use('/files', rest.handle);
 * ```
 *
 * @example
 * ```ts
 * const rest = new Rest({
 *   storage,
 * });
 *
 * app.all('/files', rest.upload, (req, response, next) => {
 *   if (req.method === 'GET') return response.sendStatus(404);
 *   console.log('File upload complete: ', req.body.name);
 *   return response.sendStatus(200);
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
    public static override readonly methods: Handlers[] = ["delete", "download", "get", "head", "options", "post", "put"];

    public constructor(options: UploadOptions<TFile>) {
        super(options);
    }

    /**
     * Create a new file via POST request with raw binary data.
     * @param request Node.js IncomingMessage with file data
     * @returns Promise resolving to ResponseFile with upload result
     */
    public async post(request: NodeRequest): Promise<ResponseFile<TFile>> {
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

        // Create file in storage
        const file = await this.storage.create(request, config);

        // Write file data
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
        } catch (error: any) {
            // File doesn't exist, create new one
            if (error.UploadErrorCode === ERRORS.FILE_NOT_FOUND || error.code === "ENOENT") {
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
            const ids = idsParameter.split(",").map((id) => id.trim()).filter(Boolean);

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

                if (
                    typeof parsed === "object"
                    && parsed !== null
                    && "ids" in parsed
                    && Array.isArray((parsed as { ids: unknown }).ids)
                ) {
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

            if (
                (error as { code?: string }).code === "ENOENT"
                || (error as { UploadErrorCode?: string }).UploadErrorCode === "FILE_NOT_FOUND"
            ) {
                throw createHttpError(404, "File not found");
            }

            throw error;
        }
    }

    /**
     * Get file metadata via HEAD request.
     * @param request Node.js IncomingMessage with file ID
     * @returns Promise resolving to ResponseFile with metadata headers
     */
    public async head(request: NodeRequest): Promise<ResponseFile<TFile>> {
        try {
            const id = getIdFromRequest(request);

            const file = await this.storage.getMeta(id);

            return {
                ...file,
                headers: {
                    "Content-Length": String(file.size || 0),
                    "Content-Type": file.contentType,
                    ...file.expiredAt === undefined ? {} : { "X-Upload-Expires": file.expiredAt.toString() },
                    ...file.modifiedAt === undefined ? {} : { "Last-Modified": file.modifiedAt.toString() },
                    ...file.ETag === undefined ? {} : { ETag: file.ETag },
                },
                statusCode: 200,
            } as ResponseFile<TFile>;
        } catch (error: unknown) {
            this.checkForUndefinedIdOrPath(error);

            if (
                (error as { UploadErrorCode?: string }).UploadErrorCode === "FILE_NOT_FOUND"
                || (error as { code?: string }).code === "ENOENT"
            ) {
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
            "Access-Control-Allow-Headers": "Authorization, Content-Type, Content-Length, Content-Disposition, X-File-Metadata",
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
                    headers: Object.fromEntries(
                        (request.headers as Headers & { entries?: () => IterableIterator<[string, string]> })?.entries?.() || [],
                    ),
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
        const deletedFiles: TFile[] = [];
        const errors: { error: string; id: string }[] = [];

        // Delete all files in parallel using Promise.allSettled
        const deletePromises = ids.map(async (id) => {
            try {
                const file = await this.storage.delete({ id });

                if (file.status === undefined) {
                    return { error: "File not found", id, success: false as const };
                }

                return { file, id, success: true as const };
            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : "Delete failed";

                return { error: errorMessage, id, success: false as const };
            }
        });

        const results = await Promise.allSettled(deletePromises);

        for (const result of results) {
            if (result.status === "fulfilled") {
                if (result.value.success) {
                    deletedFiles.push(result.value.file);
                } else {
                    errors.push({ error: result.value.error, id: result.value.id });
                }
            } else {
                // Promise rejected - shouldn't happen but handle it
                errors.push({ error: result.reason?.message || "Delete failed", id: "" });
            }
        }

        // If all deletions failed, return error
        if (deletedFiles.length === 0 && errors.length > 0) {
            const failedIds = errors.map((errorItem) => errorItem.id).join(", ");

            throw createHttpError(404, `Failed to delete files: ${failedIds}`);
        }

        // Return successful deletions (partial success is OK)
        return {
            data: deletedFiles,
            headers: errors.length > 0
                ? {
                    "X-Delete-Errors": JSON.stringify(errors),
                    "X-Delete-Failed": String(errors.length),
                    "X-Delete-Successful": String(deletedFiles.length),
                }
                : {},
            statusCode: deletedFiles.length === ids.length ? 204 : 207, // 207 Multi-Status for partial success
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
