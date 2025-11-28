import type { IncomingMessage, ServerResponse } from "node:http";
import type { Readable } from "node:stream";

import { paginate } from "@visulima/pagination";
import createHttpError, { isHttpError } from "http-errors";
import mime from "mime";

import type { UploadFile } from "../../storage/utils/file";
import type { UploadError } from "../../utils/errors";
import { ERRORS, isUploadError } from "../../utils/errors";
import filePathUrlMatcher from "../../utils/file-path-url-matcher";
import { HeaderUtilities } from "../../utils/headers";
import { getRealPath, setHeaders, uuidRegex } from "../../utils/http";
import pick from "../../utils/primitives/pick";
import type { HttpError, ResponseBody, UploadResponse } from "../../utils/types";
import { isValidationError } from "../../utils/validator";
import type { AsyncHandler, Handlers, MethodHandler, ResponseFile, ResponseList, UploadOptions } from "../types";
import { waitForStorage } from "../utils/storage-utils";
import { createRangeLimitedStream, pipeWithBackpressure } from "../utils/stream-utils";
import { handleCompletedUpload, handleGetRequest, handleHeadOptionsRequest, handlePartialUpload, handleUploadError } from "../utils/upload-handlers";
import BaseHandlerCore from "./base-handler-core";

const CONTENT_TYPE = "Content-Type";

/**
 * Base handler for Node.js platform (IncomingMessage/ServerResponse).
 * Extends BaseHandlerCore with Node.js-specific request/response handling.
 * @template TFile The file type used by this handler.
 * @template NodeRequest The Node.js request type.
 * @template NodeResponse The Node.js response type.
 */
abstract class BaseHandlerNode<
    TFile extends UploadFile,
    NodeRequest extends IncomingMessage = IncomingMessage,
    NodeResponse extends ServerResponse = ServerResponse,
>
    extends BaseHandlerCore<TFile>
    implements MethodHandler<NodeRequest, NodeResponse> {
    /**
     * Limiting enabled HTTP method handler.
     */
    public static readonly methods: Handlers[] = ["delete", "get", "head", "options", "patch", "post", "put"];

    /**
     * Map of registered HTTP method handlers.
     */
    protected registeredHandlers: Map<string, AsyncHandler<NodeRequest, NodeResponse>> = new Map<string, AsyncHandler<NodeRequest, NodeResponse>>();

    public constructor(options: UploadOptions<TFile>) {
        super(options);
        this.compose();
    }

    /**
     * Gets the registered handlers map.
     * @returns Map of registered handlers.
     */
    public get handlers(): Map<string, AsyncHandler<NodeRequest, NodeResponse>> {
        return this.registeredHandlers;
    }

    /**
     * Handles HTTP request (alias for upload method).
     * @param request Node.js IncomingMessage.
     * @param response Node.js ServerResponse.
     */
    public handle = async (request: NodeRequest, response: NodeResponse): Promise<void> => this.upload(request, response);

    /**
     * Main upload handler that processes HTTP requests and routes them to appropriate method handlers.
     * @param request Node.js IncomingMessage.
     * @param response Node.js ServerResponse.
     * @param next Optional Express-style next function for middleware compatibility.
     * @throws {UploadError} When storage is not ready or method is not allowed.
     */
    public upload = async (request: NodeRequest, response: NodeResponse, next?: () => void): Promise<void> => {
        request.on("error", (error) => this.logger?.error("[request error]: %O", error));

        this.logger?.debug("[request]: %s %s", request.method, request.url);

        const handler = this.registeredHandlers.get(request.method as string);

        if (!handler) {
            await this.sendError(response, { UploadErrorCode: ERRORS.METHOD_NOT_ALLOWED } as UploadError);

            return;
        }

        try {
            await waitForStorage(this.storage);
        } catch {
            await this.sendError(response, { UploadErrorCode: ERRORS.STORAGE_ERROR } as UploadError);

            return;
        }

        try {
            const file = await handler.call(this, request, response);

            if (["HEAD", "OPTIONS"].includes(request.method as string)) {
                handleHeadOptionsRequest(file as ResponseFile<TFile>, this.send.bind(this), response);
            } else if (request.method === "GET") {
                const fileResponse = file as ResponseFile<TFile> | ResponseList<TFile>;

                if (fileResponse) {
                    handleGetRequest(
                        fileResponse,
                        request as IncomingMessage & NodeRequest,
                        response,
                        next,
                        this.send.bind(this),
                        this.sendStream.bind(this),
                        this.parseRangeHeader.bind(this),
                    );
                }
            } else {
                const { headers: _fileHeaders, statusCode: _statusCode, ...basicFile } = file as ResponseFile<TFile>;

                this.logger?.debug("[%s]: %s: %d/%d", basicFile.status, basicFile.name, basicFile.bytesWritten, basicFile.size);

                if (basicFile.status !== undefined && this.listenerCount(basicFile.status) > 0) {
                    this.emit(basicFile.status, {
                        ...basicFile,
                        request: pick(request, ["headers", "method", "url"]),
                    });
                }

                if (basicFile.status === "completed") {
                    await handleCompletedUpload(
                        file as ResponseFile<TFile>,
                        request as IncomingMessage,
                        response,
                        next,
                        this.storage,
                        this.logger,
                        (_request, resp, uploadResp) => {
                            this.finish(_request as NodeRequest, resp, uploadResp);
                        },
                    );
                } else {
                    handlePartialUpload(file as ResponseFile<TFile>, request, response, (resp, data) => {
                        this.send(resp, {
                            body: data.body,
                            headers: data.headers,
                            statusCode: data.statusCode,
                        });
                    });
                }
            }
        } catch (error: unknown) {
            await handleUploadError(error, request, this.emit.bind(this), this.listenerCount.bind(this), this.logger, this.sendError.bind(this), response);
        }
    };

    /**
     * Compose and register HTTP method handlers.
     * Subclasses should override this to register their specific handlers.
     */
    protected abstract compose(): void;

    /**
     * Sends an HTTP response with the provided body, headers, and status code.
     * @param response Node.js ServerResponse to send data to.
     * @param body Response body, headers, and status code.
     */
    // eslint-disable-next-line class-methods-use-this
    public send(response: NodeResponse, { body = "", headers = {}, statusCode = 200 }: UploadResponse): void {
        let data: Buffer | string;
        const finalHeaders = { ...headers };

        if (typeof body === "string") {
            data = body;

            if (finalHeaders[CONTENT_TYPE] === undefined) {
                finalHeaders[CONTENT_TYPE] = HeaderUtilities.createContentType({ mediaType: "text/plain" });
            } else {
                // Ensure charset is present for text content
                const contentTypeValue = Array.isArray(finalHeaders[CONTENT_TYPE]) ? finalHeaders[CONTENT_TYPE].join(", ") : String(finalHeaders[CONTENT_TYPE]);

                finalHeaders[CONTENT_TYPE] = HeaderUtilities.ensureCharset(contentTypeValue);
            }

            if (finalHeaders["Content-Length"] === undefined) {
                finalHeaders["Content-Length"] = Buffer.byteLength(body);
            }
        } else if (body instanceof Buffer) {
            data = body;
        } else {
            data = JSON.stringify(body);

            if (!finalHeaders[CONTENT_TYPE]) {
                finalHeaders[CONTENT_TYPE] = HeaderUtilities.createContentType({
                    charset: "utf8",
                    mediaType: "application/json",
                });
            }
        }

        setHeaders(response, finalHeaders);

        response.statusCode = statusCode;

        response.end(data);
    }

    /**
     * Sends an error response to the client with appropriate status code and message.
     * @param response Node.js ServerResponse to send error to.
     * @param error Error object to convert to HTTP error response.
     */
    public async sendError(response: NodeResponse, error: Error): Promise<void> {
        let httpError: HttpError;

        if (isUploadError(error)) {
            httpError = this.internalErrorResponses[error.UploadErrorCode] as HttpError;
        } else if (!isValidationError(error) && !isHttpError(error)) {
            httpError = this.storage.normalizeError(error);
        } else {
            // For http-errors, pass through without body - onError will format it
            httpError = {
                ...error,
                code: (error as HttpError).code || error.name,
                headers: (error as HttpError).headers || {},
                message: error.message,
                name: error.name,
                statusCode: (error as HttpError).statusCode || 500,
            } as HttpError;
        }

        // Call onError hook - user can modify the error object in place
        await this.storage.onError(httpError);

        // Format error response - if body is not set, format it into body.error structure
        let errorResponse: UploadResponse;

        if (httpError.body) {
            // If body is already an object, use it directly
            // If body is a string, wrap it in error structure for consistency
            if (typeof httpError.body === "object" && httpError.body !== null) {
                errorResponse = { body: httpError.body as unknown as ResponseBody, headers: httpError.headers, statusCode: httpError.statusCode };
            } else {
                // Body is a string, wrap it in error structure
                errorResponse = {
                    body: {
                        error: {
                            code: httpError.code || httpError.name || "Error",
                            message: httpError.body || httpError.message || "Unknown error",
                            name: httpError.name || "Error",
                        },
                    },
                    headers: httpError.headers,
                    statusCode: httpError.statusCode || 500,
                };
            }
        } else {
            // Format the error properties into a body.error structure
            errorResponse = {
                body: {
                    error: {
                        code: httpError.code || httpError.name || "Error",
                        message: httpError.message || "Unknown error",
                        name: httpError.name || "Error",
                    },
                },
                headers: httpError.headers,
                statusCode: httpError.statusCode || 500,
            };
        }

        this.send(response, errorResponse);
    }

    /**
     * Sends streaming response to client with proper backpressure handling and range request support.
     * @param response Node.js ServerResponse to stream data to.
     * @param stream Readable stream containing the file data.
     * @param options Streaming options including headers, range, size, and status code.
     */
    public sendStream(
        response: NodeResponse,
        stream: Readable,
        {
            headers = {},
            range,
            size,
            statusCode = 200,
        }: { headers?: Record<string, string | number>; range?: { end: number; start: number }; size?: number; statusCode?: number },
    ): void {
        // Set headers
        setHeaders(response, headers);

        // Set status code
        response.statusCode = statusCode;

        let finalStream = stream;

        // Handle range requests for partial content
        if (range && size) {
            response.statusCode = 206; // Partial Content
            response.setHeader("Content-Range", `bytes ${range.start}-${range.end}/${size}`);
            response.setHeader("Content-Length", range.end - range.start + 1);
            response.setHeader("Accept-Ranges", "bytes");

            // Create a range-limited stream
            finalStream = createRangeLimitedStream(stream, range.start, range.end);
        } else {
            // Set content length for full content
            if (size) {
                response.setHeader("Content-Length", size);
            }

            // Advertise that we accept range requests
            response.setHeader("Accept-Ranges", "bytes");
        }

        // Handle backpressure-aware piping (includes error handling)
        pipeWithBackpressure(finalStream, response, (resp, error) => this.sendError(resp, error));
    }

    /**
     * Finish upload by sending final response to client with completed file data.
     * @param _request HTTP request (unused parameter)
     * @param response HTTP response object to send final response to
     * @param uploadResponse Final upload response data containing body, headers, and status code
     */
    protected finish(_request: NodeRequest, response: NodeResponse, uploadResponse: UploadResponse | ResponseFile<TFile>): void {
        // Check if this is a ResponseFile (has 'id' property and 'headers' property) or UploadResponse
        const isResponseFile = "id" in uploadResponse && "headers" in uploadResponse && !("body" in uploadResponse);

        let body: unknown;
        let headers: Record<string, string | number>;
        let statusCode: number;

        if (isResponseFile) {
            // This is a ResponseFile - extract file properties for body and preserve headers
            const responseFile = uploadResponse as ResponseFile<TFile>;

            // Explicitly get headers and statusCode to ensure they're preserved
            const fileHeaders = responseFile.headers || {};
            const fileStatusCode = responseFile.statusCode || 200;

            // Extract file data (excluding headers and statusCode)
            const { headers: _headers, statusCode: _statusCode, ...fileData } = responseFile;

            body = fileData;
            // Create a new object to ensure headers are preserved
            headers = { ...fileHeaders };
            statusCode = fileStatusCode;
        } else {
            // This is an UploadResponse
            const uploadResp = uploadResponse as UploadResponse;

            body = uploadResp.body;
            headers = (uploadResp.headers as Record<string, string | number>) || {};
            statusCode = uploadResp.statusCode || 200;
        }

        if (body && typeof body === "object" && (body as TFile).content !== undefined) {
            const { content, contentType } = body as TFile;

            body = content;
            headers = {
                ...headers,
                "Content-Type": contentType,
            };
        }

        this.send(response, {
            body: (body || uploadResponse) as ResponseBody | undefined,
            headers,
            statusCode,
        });
    }

    /**
     * Build file URL from request and file data.
     * @param request HTTP request with optional originalUrl property
     * @param file File object containing ID and content type
     * @returns Constructed file URL with extension based on content type
     */
    protected buildFileUrl(request: NodeRequest & { originalUrl?: string }, file: TFile): string {
        return this.buildFileUrlFromString(request.originalUrl || (request.url as string), file);
    }

    /**
     * Negotiates content type based on Accept header and supported formats.
     * @param request HTTP request object containing Accept header.
     * @param supportedTypes Array of supported MIME types to match against.
     * @returns Best matching content type or undefined if no match found.
     */
    public negotiateContentType(request: NodeRequest, supportedTypes: string[]): string | undefined {
        return super.negotiateContentTypeFromHeader(request.headers.accept, supportedTypes);
    }

    /**
     * Default OPTIONS handler.
     * @param _request HTTP request (unused)
     * @param _response HTTP response (unused)
     * @returns Promise resolving to ResponseFile with CORS headers
     */
    public async options(_request: NodeRequest, _response: NodeResponse): Promise<ResponseFile<TFile>> {
        const child = this.constructor as typeof BaseHandlerNode;

        return {
            headers: {
                "Access-Control-Allow-Methods": (child.methods || BaseHandlerNode.methods).map((method) => method.toUpperCase()).join(", "),
            } as Record<string, string>,
            statusCode: 204,
        } as ResponseFile<TFile>;
    }

    /**
     * Retrieves a file or list of files based on the request path.
     * @param request Node.js IncomingMessage with optional originalUrl.
     * @param response Node.js ServerResponse.
     * @returns Promise resolving to a single file, paginated list, or array of files.
     * @throws {UploadError} When file is not found or storage error occurs.
     */
    // eslint-disable-next-line sonarjs/cognitive-complexity
    public async get(request: NodeRequest & { originalUrl?: string }, _response: NodeResponse): Promise<ResponseFile<TFile> | ResponseList<TFile>> {
        const pathMatch = filePathUrlMatcher(getRealPath(request));

        if (pathMatch && pathMatch.params.uuid) {
            const { ext, metadata, uuid: rawUuid } = pathMatch.params;
            // If ext is present, uuid includes the extension, so strip it
            const uuid = ext ? rawUuid.replace(new RegExp(String.raw`\.${ext}$`), "") : rawUuid;

            // Handle metadata requests (check this before UUID validation)
            if (metadata === "metadata" && getRealPath(request).endsWith("/metadata")) {
                try {
                    const file = await this.storage.getMeta(uuid);

                    return {
                        ...file,
                        content: JSON.stringify(file),
                        headers: {
                            "Content-Type": HeaderUtilities.createContentType({
                                charset: "utf8",
                                mediaType: "application/json",
                            }),
                            ...file.expiredAt === undefined ? {} : { "X-Upload-Expires": file.expiredAt.toString() },
                            ...file.modifiedAt === undefined ? {} : { "Last-Modified": file.modifiedAt.toString() },
                        } as Record<string, string>,
                        statusCode: 200,
                    } as ResponseFile<TFile>;
                } catch (error: unknown) {
                    const errorWithCode = error as { UploadErrorCode?: string };

                    if (errorWithCode.UploadErrorCode === ERRORS.FILE_NOT_FOUND || errorWithCode.UploadErrorCode === ERRORS.GONE) {
                        throw createHttpError(404, "File metadata not found");
                    }

                    throw error;
                }
            }

            // For non-metadata requests, validate UUID format
            if (!uuidRegex.test(uuid)) {
                // Invalid UUID format - treat as list request
                return this.list(request, _response);
            }

            // Handle regular file requests
            try {
                // Check if transformation parameters are present and media transformer is available
                const url = new URL(request.url || "", "http://localhost");
                const queryParameters = Object.fromEntries(url.searchParams.entries());
                const hasTransformationParameters = Object.keys(queryParameters).length > 0 && this.mediaTransformer;

                if (hasTransformationParameters && this.mediaTransformer) {
                    // Use media transformer for transformation
                    try {
                        const transformedResult = await this.mediaTransformer.handle(uuid, queryParameters);

                        return {
                            content: transformedResult.buffer,
                            headers: {
                                "Content-Length": String(transformedResult.size),
                                "Content-Type": `${transformedResult.mediaType}/${transformedResult.format}`,
                                "X-Media-Type": transformedResult.mediaType,
                                "X-Original-Format": transformedResult.originalFile?.contentType?.split("/")[1] || "",
                                "X-Transformed-Format": transformedResult.format,
                                ...transformedResult.originalFile?.expiredAt === undefined
                                    ? {}
                                    : { "X-Upload-Expires": transformedResult.originalFile.expiredAt.toString() },
                                ...transformedResult.originalFile?.modifiedAt === undefined
                                    ? {}
                                    : { "Last-Modified": transformedResult.originalFile.modifiedAt.toString() },
                                ...transformedResult.originalFile?.ETag === undefined ? {} : { ETag: transformedResult.originalFile.ETag },
                            } as Record<string, string>,
                            statusCode: 200,
                        } as ResponseFile<TFile>;
                    } catch (transformError: unknown) {
                        // If transformation fails, check if it's a validation error
                        if ((transformError as { name?: string }).name === "ValidationError") {
                            throw createHttpError(400, (transformError as Error).message);
                        }

                        // For other transformation errors, fall back to serving original file
                        this.logger?.warn(`Media transformation failed: ${(transformError as Error).message}`);
                    }
                }

                // Get file metadata first to determine if we should stream
                const fileMeta = await this.storage.getMeta(uuid);

                // Check if we should use streaming for large files
                const useStreaming = request.headers.range || (fileMeta.size && fileMeta.size > 1024 * 1024); // Stream files > 1MB

                if (useStreaming && this.storage.getStream) {
                    // Use streaming for better memory efficiency
                    try {
                        const streamResult = await this.storage.getStream({ id: uuid });
                        let contentType = streamResult.headers?.["Content-Type"] || fileMeta.contentType;

                        if (contentType.includes("image") && typeof ext === "string") {
                            contentType = mime.getType(ext) || contentType;
                        }

                        return {
                            headers: {
                                ...streamResult.headers,
                                "Accept-Ranges": "bytes", // Indicate we support range requests
                                "Content-Type": contentType,
                            } as Record<string, string>,
                            size: streamResult.size,
                            statusCode: 200,
                            stream: streamResult.stream,
                            ...fileMeta,
                            contentType,
                        } as ResponseFile<TFile>;
                    } catch (streamError) {
                        // Fall back to regular file serving if streaming fails
                        this.logger?.warn(`Streaming failed, falling back to buffer: ${streamError}`);
                    }
                }

                // Serve original file (fallback or no transformation requested)
                const file = await this.storage.get({ id: uuid });

                let { contentType } = file;

                if (contentType.includes("image") && typeof ext === "string") {
                    contentType = mime.getType(ext) || contentType;
                }

                const { ETag, expiredAt, modifiedAt, size } = file;

                return {
                    headers: {
                        "Accept-Ranges": "bytes", // Indicate we support range requests
                        "Content-Length": String(size),
                        "Content-Type": contentType,
                        ...expiredAt === undefined ? {} : { "X-Upload-Expires": expiredAt.toString() },
                        ...modifiedAt === undefined ? {} : { "Last-Modified": modifiedAt.toString() },
                        ...ETag === undefined ? {} : { ETag },
                    } as Record<string, string>,
                    statusCode: 200,
                    ...file,
                    contentType,
                } as ResponseFile<TFile>;
            } catch (error: unknown) {
                const errorWithCode = error as { UploadErrorCode?: string };

                if (errorWithCode.UploadErrorCode === ERRORS.FILE_NOT_FOUND || errorWithCode.UploadErrorCode === ERRORS.GONE) {
                    throw createHttpError(404, "File not found");
                }

                throw error;
            }
        }

        return this.list(request, _response);
    }

    /**
     * Returns a list of uploaded files with optional pagination support.
     * @param request Node.js IncomingMessage containing query parameters for pagination.
     * @param _response Node.js ServerResponse (unused).
     * @returns Promise resolving to a paginated or complete list of uploaded files.
     */
    public async list(request: NodeRequest, _response: NodeResponse): Promise<ResponseList<TFile>> {
        const url = new URL(request.url || "", "http://localhost");
        const limit = url.searchParams.get("limit");
        const page = url.searchParams.get("page");

        const list = await this.storage.list(Number(limit || 1000));

        if (list.length === 0) {
            return {
                data: [],
                headers: {},
                statusCode: 200,
            };
        }

        if (page !== undefined && limit !== undefined) {
            return {
                data: paginate(Number(page), Number(limit), list.length, list),
                headers: {},
                statusCode: 200,
            };
        }

        return {
            data: list,
            headers: {},
            statusCode: 200,
        };
    }

    /**
     * Streams download of a file with resumable support using HTTP range requests.
     * @param request Node.js IncomingMessage with optional originalUrl and range header.
     * @param response Node.js ServerResponse to stream the file to.
     * @throws {HttpError} When file is not found or streaming is not supported.
     */
    public async download(request: NodeRequest & { originalUrl?: string }, response: NodeResponse): Promise<void> {
        const pathMatch = filePathUrlMatcher(getRealPath(request));

        if (!pathMatch || !pathMatch.params.uuid || !uuidRegex.test(pathMatch.params.uuid)) {
            throw createHttpError(404, "File not found");
        }

        const { ext, uuid } = pathMatch.params;

        try {
            // Get file metadata first
            const fileMeta = await this.storage.getMeta(uuid);

            // Check if streaming is available
            if (!this.storage.getStream) {
                await this.sendError(response, createHttpError(501, "Streaming download not supported"));

                return;
            }

            // Use streaming for better performance
            const streamResult = await this.storage.getStream({ id: uuid });
            let contentType = streamResult.headers?.["Content-Type"] || fileMeta.contentType;

            if (contentType.includes("image") && typeof ext === "string") {
                contentType = mime.getType(ext) || contentType;
            }

            // Parse range header for resumable downloads
            const range = this.parseRangeHeader(request.headers.range, streamResult.size || 0);

            // Stream the file directly to response
            const headers = {
                ...streamResult.headers,
                "Accept-Ranges": "bytes",
                "Content-Disposition": HeaderUtilities.createContentDisposition({
                    filename: fileMeta.originalName || uuid,
                    type: "attachment",
                }),
                "Content-Type": contentType,
            };

            this.sendStream(response, streamResult.stream, {
                headers,
                range: range || undefined,
                size: streamResult.size,
                statusCode: range ? 206 : 200,
            });
        } catch (error: unknown) {
            const errorWithCode = error as { UploadErrorCode?: string };

            if (errorWithCode.UploadErrorCode === ERRORS.FILE_NOT_FOUND || errorWithCode.UploadErrorCode === ERRORS.GONE) {
                await this.sendError(response, createHttpError(404, "File not found"));

                return;
            }

            await this.sendError(response, error as Error);
        }
    }

    /**
     * Check if error is related to undefined ID or path and throw appropriate HTTP error.
     * @param error Error object to check
     */
    // eslint-disable-next-line class-methods-use-this
    protected override checkForUndefinedIdOrPath(error: unknown): void {
        if (error instanceof Error && ["Id is undefined", "Invalid request URL", "Path is undefined"].includes(error.message)) {
            throw createHttpError(404, "File not found");
        }
    }
}

export default BaseHandlerNode;
