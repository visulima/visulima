import { EventEmitter } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";
import { PassThrough, Readable } from "node:stream";
import { format } from "node:url";

import { paginate } from "@visulima/pagination";
import createHttpError, { isHttpError } from "http-errors";
import mime from "mime";

import type BaseStorage from "../storage/storage";
import type { UploadFile } from "../storage/utils/file";
import type MediaTransformer from "../transformer/media-transformer";
import type { ErrorResponses, HttpError, IncomingMessageWithBody, Logger, ResponseBodyType, UploadError, UploadResponse } from "../utils";
import { ErrorMap, ERRORS, filePathUrlMatcher, getBaseUrl, getRealPath, isUploadError, isValidationError, pick, setHeaders, uuidRegex } from "../utils";
import type { AsyncHandler, Handlers, MethodHandler, ResponseFile, ResponseList, UploadOptions } from "./types";

const CONTENT_TYPE = "Content-Type";

abstract class BaseHandler<
    TFile extends UploadFile,
    NodeRequest extends IncomingMessage = IncomingMessage,
    NodeResponse extends ServerResponse = ServerResponse,
>
    // eslint-disable-next-line unicorn/prefer-event-target
    extends EventEmitter
    implements MethodHandler<NodeRequest, NodeResponse> {
    /**
     * Limiting enabled http method handler
     * @example
     * ```ts
     * Upload.methods = ['post', 'put', 'delete'];
     * app.use('/upload', Upload(opts));
     * ```
     */
    public static readonly methods: Handlers[] = ["delete", "get", "head", "options", "patch", "post", "put"];

    public responseType: ResponseBodyType = "json";

    public storage: BaseStorage<TFile>;

    public mediaTransformer?: MediaTransformer;

    public disableTerminationForFinishedUploads?: boolean;

    protected registeredHandlers = new Map<string, AsyncHandler<NodeRequest, NodeResponse>>();

    public get handlers(): Map<string, AsyncHandler<NodeRequest, NodeResponse>> {
        return this.registeredHandlers;
    }

    protected logger?: Logger;

    public get loggerInstance(): Logger | undefined {
        return this.logger;
    }

    protected internalErrorResponses = {} as ErrorResponses;

    public get errorResponses(): ErrorResponses {
        return this.internalErrorResponses;
    }

    public constructor({ mediaTransformer, storage, disableTerminationForFinishedUploads }: UploadOptions<TFile>) {
        super();

        this.storage = storage;
        this.mediaTransformer = mediaTransformer;
        this.disableTerminationForFinishedUploads = disableTerminationForFinishedUploads;
        this.logger = this.storage?.logger;

        this.assembleErrors();
        this.compose();
    }

    /**
     *  Override error responses
     *  @example
     * ```ts
     *  const Upload = new Upload({ storage });
     *  Upload.errorResponses = {
     *    FileNotFound: { message: 'Not Found!', statusCode: 404 },
     *  }
     * ```
     */
    public set errorResponses(value: Partial<ErrorResponses>) {
        this.assembleErrors(value);
    }

    public handle = async (request: NodeRequest, response: NodeResponse): Promise<void> => this.upload(request, response);

    /**
     * Handle Web API Fetch requests (for Hono, Cloudflare Workers, etc.)
     */
    public fetch = async (request: Request): Promise<globalThis.Response> => {
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
        } catch (error: any) {
            const uError = pick(error, ["name", ...(Object.getOwnPropertyNames(error) as (keyof Error)[])]) as UploadError;
            const errorEvent = {
                ...uError,
                request: {
                    headers: Object.fromEntries((request.headers as any)?.entries?.() || []),
                    method: request.method,
                    url: request.url,
                },
            };

            if (this.listenerCount("error") > 0) {
                this.emit("error", errorEvent);
            }

            this.logger?.error("[fetch error]: %O", errorEvent);

            return this.createErrorResponse(error) as any;
        }
    };

    public upload = async (request: NodeRequest, response: NodeResponse, next?: () => void): Promise<void> => {
        request.on("error", (error) => this.logger?.error("[request error]: %O", error));

        this.logger?.debug("[request]: %s %s", request.method, request.url);

        const handler = this.registeredHandlers.get(request.method as string);

        if (!handler) {
            this.sendError(response, { UploadErrorCode: ERRORS.METHOD_NOT_ALLOWED } as UploadError);

            return;
        }

        if (!this.storage.isReady) {
            this.sendError(response, { UploadErrorCode: ERRORS.STORAGE_ERROR } as UploadError);

            return;
        }

        try {
            const file = await handler.call(this, request, response);

            if (["HEAD", "OPTIONS"].includes(request.method as string)) {
                const { headers, statusCode } = file as ResponseFile<TFile>;

                this.send(response, { headers, statusCode });
            } else if (request.method === "GET") {
                (request as IncomingMessageWithBody).body = (file as ResponseList<TFile>)?.data === undefined ? file : (file as ResponseList<TFile>).data;

                const { headers, statusCode } = file as ResponseFile<TFile>;

                // Check if this is a streaming response
                const streamingFile = file as ResponseFile<TFile> & { size?: number; stream?: Readable };

                if (streamingFile.stream) {
                    // Handle streaming response
                    if (typeof next === "function") {
                        next();
                    } else {
                        // Parse range header for partial content requests
                        const range = this.parseRangeHeader(request.headers.range, streamingFile.size || 0);

                        // Stream the response directly
                        this.sendStream(response, streamingFile.stream, {
                            headers,
                            range: range || undefined,
                            size: streamingFile.size,
                            statusCode,
                        });
                    }
                } else {
                    // Handle regular buffer-based response
                    let body: Buffer | ResponseList<TFile>["data"] | string = "";

                    if ((file as ResponseFile<TFile>).content !== undefined) {
                        body = (file as ResponseFile<TFile>).content as Buffer;
                    } else if (typeof file === "object" && "data" in file) {
                        body = file.data;
                    }

                    if (typeof next === "function") {
                        next();
                    } else {
                        this.send(response, { body, headers, statusCode });
                    }
                }
            } else {
                const { headers, statusCode, ...basicFile } = file as ResponseFile<TFile>;

                this.logger?.debug("[%s]: %s: %d/%d", basicFile.status, basicFile.name, basicFile.bytesWritten, basicFile.size);

                if (basicFile.status !== undefined && this.listenerCount(basicFile.status) > 0) {
                    this.emit(basicFile.status, {
                        ...basicFile,
                        request: pick(request, ["headers", "method", "url"]),
                    });
                }

                if (basicFile.status === "completed") {
                    if (typeof next === "function") {
                        // eslint-disable-next-line no-underscore-dangle
                        (request as IncomingMessageWithBody)._body = true;
                        (request as IncomingMessageWithBody).body = basicFile;

                        next();
                    } else {
                        const completed = await this.storage.onComplete(file as TFile);

                        if (completed.headers === undefined) {
                            throw new TypeError("onComplete must return the key headers");
                        }

                        if (completed.statusCode === undefined) {
                            throw new TypeError("onComplete must return the key statusCode");
                        }

                        this.finish(request, response, completed);
                    }
                } else {
                    this.send(response, {
                        headers: {
                            ...headers,
                            ...(file as TFile).hash === undefined
                                ? {}
                                : { [`X-Range-${(file as TFile).hash?.algorithm.toUpperCase()}`]: (file as TFile).hash?.value },
                        } as Record<string, string>,
                        statusCode,
                    });
                }
            }
        } catch (error: any) {
            const uError = pick(error, ["name", ...(Object.getOwnPropertyNames(error) as (keyof Error)[])]) as UploadError;
            const errorEvent = { ...uError, request: pick(request, ["headers", "method", "url"]) };

            if (this.listenerCount("error") > 0) {
                this.emit("error", errorEvent);
            }

            this.logger?.error("[error]: %O", errorEvent);

            if (request.destroyed) {
                return;
            }

            this.sendError(response, error);
        }
    };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public async options(_request: NodeRequest, _response: NodeResponse): Promise<ResponseFile<TFile>> {
        const child = this.constructor as typeof BaseHandler;

        return {
            headers: {
                "Access-Control-Allow-Methods": (child.methods || BaseHandler.methods).map((method) => method.toUpperCase()).join(", "),
            } as Record<string, string>,
            statusCode: 204,
        } as ResponseFile<TFile>;
    }

    /**
     * @param {Request} request
     * @param {Response}response
     * @throws {UploadError}
     * @returns {Promise<ResponseFile<TFile> | PaginationResult<TFile> | TFile[]>}
     */
    public async get(request: NodeRequest, response: NodeResponse): Promise<ResponseFile<TFile> | ResponseList<TFile>>;

    // eslint-disable-next-line sonarjs/cognitive-complexity
    public async get(request: NodeRequest & { originalUrl?: string }, _response: NodeResponse): Promise<ResponseFile<TFile> | ResponseList<TFile>> {
        const pathMatch = filePathUrlMatcher(getRealPath(request));

        if (pathMatch && pathMatch.params.uuid) {
            const { ext, metadata, uuid: rawUuid } = pathMatch.params;
            // If ext is present, uuid includes the extension, so strip it
            const uuid = ext ? rawUuid.replace(new RegExp(`\\.${ext}$`), "") : rawUuid;

            // Handle metadata requests (check this before UUID validation)
            if (metadata === "metadata") {
                try {
                    const file = await this.storage.getMeta(uuid);

                    return {
                        content: JSON.stringify(file),
                        headers: {
                            "Content-Type": "application/json;charset=utf-8",
                            ...file.expiredAt === undefined ? {} : { "X-Upload-Expires": file.expiredAt.toString() },
                            ...file.modifiedAt === undefined ? {} : { "Last-Modified": file.modifiedAt.toString() },
                        } as Record<string, string>,
                        statusCode: 200,
                    } as ResponseFile<TFile>;
                } catch (error: any) {
                    if (error.UploadErrorCode === ERRORS.FILE_NOT_FOUND || error.UploadErrorCode === ERRORS.GONE) {
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
                                "Content-Type": this.getContentTypeForFormat(transformedResult.format),
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
                    } catch (transformError: any) {
                        // If transformation fails, check if it's a validation error
                        if (transformError.name === "ValidationError") {
                            throw createHttpError(400, transformError.message);
                        }

                        // For other transformation errors, fall back to serving original file
                        this.logger?.warn(`Media transformation failed: ${transformError.message}`);
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
            } catch (error: any) {
                if (error.UploadErrorCode === ERRORS.FILE_NOT_FOUND || error.UploadErrorCode === ERRORS.GONE) {
                    throw createHttpError(404, "File not found");
                }

                throw error;
            }
        }

        return this.list(request, _response);
    }

    /**
     * Returns user upload list
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
     * Stream download a file with resumable support
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
                this.sendError(response, createHttpError(501, "Streaming download not supported"));

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
                "Content-Disposition": `attachment; filename="${fileMeta.originalName || uuid}"`,
                "Content-Type": contentType,
            };

            this.sendStream(response, streamResult.stream, {
                headers,
                range: range || undefined,
                size: streamResult.size,
                statusCode: range ? 206 : 200,
            });
        } catch (error: any) {
            if (error.UploadErrorCode === ERRORS.FILE_NOT_FOUND || error.UploadErrorCode === ERRORS.GONE) {
                this.sendError(response, createHttpError(404, "File not found"));

                return;
            }

            this.sendError(response, error);
        }
    }

    // eslint-disable-next-line class-methods-use-this
    public send(response: NodeResponse, { body = "", headers = {}, statusCode = 200 }: UploadResponse): void {
        let data: Buffer | string;

        if (typeof body === "string") {
            data = body;

            if (headers[CONTENT_TYPE] === undefined) {
                // eslint-disable-next-line no-param-reassign
                headers[CONTENT_TYPE] = "text/plain";
            }

            if (headers["Content-Length"] === undefined) {
                // eslint-disable-next-line no-param-reassign
                headers["Content-Length"] = Buffer.byteLength(body);
            }
        } else if (body instanceof Buffer) {
            data = body;
        } else {
            data = JSON.stringify(body);

            if (!headers[CONTENT_TYPE]) {
                // eslint-disable-next-line no-param-reassign
                headers[CONTENT_TYPE] = "application/json;charset=utf-8";
            }
        }

        setHeaders(response, headers);

        response.statusCode = statusCode;

        response.end(data);
    }

    /**
     * Send Error to client
     */
    public sendError(response: NodeResponse, error: Error): void {
        let httpError: HttpError;

        if (isUploadError(error)) {
            httpError = this.internalErrorResponses[error.UploadErrorCode] as HttpError;
        } else if (!isValidationError(error) && !isHttpError(error)) {
            httpError = this.storage.normalizeError(error);
        } else {
            httpError = error;
        }

        this.send(response, this.storage.onError(httpError));
    }

    /**
     * Parse HTTP Range header and return start/end positions
     */
    public parseRangeHeader(rangeHeader: string | undefined, fileSize: number): { end: number; start: number } | null {
        if (!rangeHeader || !rangeHeader.startsWith("bytes=")) {
            return null;
        }

        const ranges = rangeHeader.slice(6).split(",");

        if (ranges.length !== 1) {
            // Multiple ranges not supported
            return null;
        }

        const range = ranges[0].trim();
        const parts = range.split("-");

        if (parts.length !== 2) {
            return null;
        }

        const [startString, endString] = parts;
        let start: number;
        let end: number;

        if (startString && endString) {
            // bytes=start-end
            start = Number.parseInt(startString, 10);
            end = Number.parseInt(endString, 10);
        } else if (startString && !endString) {
            // bytes=start-
            start = Number.parseInt(startString, 10);
            end = fileSize - 1;
        } else if (!startString && endString) {
            // bytes=-end (suffix range)
            start = fileSize - Number.parseInt(endString, 10);
            end = fileSize - 1;
        } else {
            return null; // Invalid range
        }

        // Validate range
        if (Number.isNaN(start) || Number.isNaN(end) || start >= fileSize || end >= fileSize || start > end) {
            return null;
        }

        return { end, start };
    }

    /**
     * Send streaming response to client with proper backpressure handling
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
            finalStream = this.createRangeLimitedStream(stream, range.start, range.end);
        } else {
            // Set content length for full content
            if (size) {
                response.setHeader("Content-Length", size);
            }

            // Advertise that we accept range requests
            response.setHeader("Accept-Ranges", "bytes");
        }

        // Handle backpressure-aware piping (includes error handling)
        this.pipeWithBackpressure(finalStream, response);
    }

    /**
     * Create a range-limited stream that properly handles backpressure
     */
    private createRangeLimitedStream(sourceStream: Readable, start: number, end: number): Readable {
        let bytesRead = 0;
        let bytesSent = 0;
        const contentLength = end - start + 1;

        return new PassThrough({
            // Use appropriate high water mark for better backpressure handling
            highWaterMark: Math.min(64 * 1024, contentLength), // 64KB or content length, whichever is smaller
            transform(chunk: Buffer, encoding, callback) {
                const chunkSize = chunk.length;
                const currentPos = bytesRead;
                const endPos = currentPos + chunkSize - 1;

                bytesRead += chunkSize;

                // Check if this chunk contains data we need
                if (endPos < start) {
                    // Chunk is entirely before the range we want
                    callback();

                    return;
                }

                if (currentPos > end) {
                    // Chunk is entirely after the range we want
                    this.end();
                    callback();

                    return;
                }

                // Calculate which part of this chunk to send
                const chunkStart = Math.max(0, start - currentPos);
                const chunkEnd = Math.min(chunkSize, end - currentPos + 1);

                if (chunkStart < chunkEnd) {
                    const dataToSend = chunk.subarray(chunkStart, chunkEnd);

                    bytesSent += dataToSend.length;

                    // Push the data and handle backpressure
                    const canContinue = this.push(dataToSend);

                    if (!canContinue) {
                        // Backpressure: pause the source stream
                        sourceStream.pause();
                    }
                }

                // Check if we've sent all the requested data
                if (bytesSent >= contentLength) {
                    this.end();
                    sourceStream.destroy();
                }

                callback();
            },
        });
    }

    /**
     * Pipe streams with proper backpressure handling
     */
    private pipeWithBackpressure(source: Readable, destination: NodeResponse): void {
        let isDestroyed = false;

        const cleanup = () => {
            if (isDestroyed)
                return;

            isDestroyed = true;
            source.destroy();
        };

        // Handle destination backpressure
        destination.on("drain", () => {
            source.resume();
        });

        destination.on("close", cleanup);
        destination.on("finish", cleanup);
        destination.on("error", cleanup);

        // Handle source stream
        source.on("end", () => {
            destination.end();
        });

        source.on("error", (error) => {
            if (!isDestroyed) {
                this.sendError(destination as any, error);
                cleanup();
            }
        });

        source.on("data", (chunk) => {
            const canContinue = destination.write(chunk);

            if (!canContinue) {
                // Backpressure: pause the source stream
                source.pause();
            }
        });

        // Handle response abortion (client disconnect)
        if (typeof destination.listeners === "function" && destination.listeners("close")?.length === 0) {
            destination.on("close", cleanup);
        }
    }

    /**
     * Build file url from request
     */
    protected buildFileUrl(request: NodeRequest & { originalUrl?: string }, file: TFile): string {
        const url = new URL(request.originalUrl || (request.url as string), "http://localhost");
        const { pathname } = url;
        const query = Object.fromEntries(url.searchParams.entries());
        const relative = format({ pathname: `${pathname}/${file.id}`, query });

        return `${this.storage.config.useRelativeLocation ? relative : getBaseUrl(request) + relative}.${mime.getExtension(file.contentType)}`;
    }

    protected finish(_request: NodeRequest, response: NodeResponse, uploadResponse: UploadResponse): void {
        const { statusCode } = uploadResponse;

        let { body, headers } = uploadResponse;

        if ((body as TFile).content !== undefined) {
            const { content, contentType } = body as TFile;

            body = content;
            headers = {
                ...headers,
                "Content-Type": contentType,
            };
        }

        this.send(response, {
            body,
            headers,
            statusCode,
        });
    }

    protected compose = (): void => {
        const child = this.constructor as typeof BaseHandler;

        // Add download method to available methods if not already included
        const methods = child.methods || BaseHandler.methods;
        const extendedMethods = methods.includes("download" as any) ? methods : [...methods, "download"];

        extendedMethods.forEach((method) => {
            const handler = (this as MethodHandler<NodeRequest, NodeResponse>)[method];

            if (handler) {
                this.registeredHandlers.set(method.toUpperCase(), handler);
            }
        });

        this.logger?.debug("Registered handler: %s", [...this.registeredHandlers.keys()].join(", "));
    };

    public assembleErrors = (customErrors = {}): void => {
        this.internalErrorResponses = {
            ...ErrorMap,

            ...this.internalErrorResponses,
            ...this.storage.errorResponses,
            ...customErrors,
        };
    };

    /**
     * Convert Web API Request to Node.js IncomingMessage for handler compatibility
     */
    protected async convertRequestToNode(request: Request): Promise<IncomingMessage> {
        const url = new URL(request.url || "/");
        let bodyBuffer = new Uint8Array();

        // Check if request has body and arrayBuffer method (Web API Request)
        if ("body" in request && "arrayBuffer" in request && typeof (request as any).arrayBuffer === "function") {
            try {
                bodyBuffer = new Uint8Array(await (request as any).arrayBuffer());
            } catch {
                // Ignore errors, bodyBuffer remains empty
            }
        }

        let readableStream: Readable;

        if (bodyBuffer.length > 0) {
            // Create a PassThrough stream and write the buffer to it
            // This ensures the stream behaves like a real HTTP request stream
            readableStream = new PassThrough();
            (readableStream as PassThrough).write(bodyBuffer);
            (readableStream as PassThrough).end();
        } else {
            readableStream = Readable.from(new Uint8Array(0));
        }

        // Copy headers and ensure content-type is preserved for multipart data
        const headers = Object.fromEntries((request.headers as any)?.entries?.() || []);

        const nodeRequest = Object.assign(readableStream, {
            destroy: () => {},
            destroyed: false,
            headers,
            httpVersion: "1.1",
            httpVersionMajor: 1,
            httpVersionMinor: 1,
            method: request.method,
            url: url.pathname + url.search,
        }) as any as NodeRequest;

        // Add body data if present
        if (bodyBuffer.length > 0) {
            (nodeRequest as IncomingMessageWithBody).body = bodyBuffer;
        }

        return nodeRequest;
    }

    /**
     * Handle the response from handlers for fetch requests
     */
    protected async handleFetchResponse(request: Request, file: ResponseFile<TFile> | ResponseList<TFile>): Promise<globalThis.Response> {
        // Handle different response types
        if (request.method === "HEAD" || request.method === "OPTIONS") {
            const { headers, statusCode } = file as ResponseFile<TFile>;

            return new Response(undefined, {
                headers: this.convertHeaders({
                    ...headers,
                    "Access-Control-Expose-Headers":
                        "location,upload-expires,upload-offset,upload-length,upload-metadata,upload-defer-length,tus-resumable,tus-extension,tus-max-size,tus-version,tus-checksum-algorithm,cache-control",
                }),
                status: statusCode,
            });
        }

        if (request.method === "GET") {
            const { headers, statusCode } = file as ResponseFile<TFile>;
            let body: BodyInit = "";

            if ((file as ResponseFile<TFile>).content !== undefined) {
                body = new Uint8Array((file as ResponseFile<TFile>).content as Buffer);
            } else if (typeof file === "object" && "data" in file) {
                body = JSON.stringify((file as ResponseList<TFile>).data);
            }

            return new Response(body, {
                headers: this.convertHeaders({
                    ...headers,
                    "Access-Control-Expose-Headers":
                        "location,upload-expires,upload-offset,upload-length,upload-metadata,upload-defer-length,tus-resumable,tus-extension,tus-max-size,tus-version,tus-checksum-algorithm,cache-control",
                }),
                status: statusCode,
            });
        }

        // POST/PUT/PATCH/DELETE responses
        const { headers, statusCode, ...basicFile } = file as ResponseFile<TFile>;

        // Emit events if listeners exist
        if (basicFile.status !== undefined && this.listenerCount(basicFile.status) > 0) {
            this.emit(basicFile.status, {
                ...basicFile,
                request: {
                    headers: Object.fromEntries((request.headers as any)?.entries?.() || []),
                    method: request.method,
                    url: request.url,
                },
            });
        }

        if (basicFile.status === "completed") {
            const completed = await this.storage.onComplete(file as TFile);

            if (completed.headers === undefined) {
                throw new TypeError("onComplete must return the key headers");
            }

            if (completed.statusCode === undefined) {
                throw new TypeError("onComplete must return the key statusCode");
            }

            return this.createResponse(completed);
        }

        return new Response(undefined, {
            headers: this.convertHeaders({
                ...headers,
                "Access-Control-Expose-Headers":
                    "location,upload-expires,upload-offset,upload-length,upload-metadata,upload-defer-length,tus-resumable,tus-extension,tus-max-size,tus-version,tus-checksum-algorithm,cache-control",
                ...basicFile.hash === undefined ? {} : { [`X-Range-${basicFile.hash?.algorithm.toUpperCase()}`]: basicFile.hash?.value },
            }),
            status: statusCode,
        });
    }

    /**
     * Create a mock ServerResponse for handlers to write to
     */
    protected createMockResponse(): ServerResponse {
        let responseStatus = 200;
        let responseHeaders: Record<string, string | string[]> = {};

        return {
            end: () => {},
            flushHeaders: () => {},
            getHeader: (name: string) => responseHeaders[name],
            headersSent: false,
            removeHeader: (name: string) => delete responseHeaders[name],
            setHeader: (name: string, value: string | string[]) => {
                responseHeaders[name] = value;
            },
            statusCode: responseStatus,
            write: (_data: any) => {
                // Mock implementation
            },
            writeContinue: () => {},
            writeEarlyHints: () => {},
            writeHead: (status: number, headers?: Record<string, string | string[]>) => {
                responseStatus = status;

                if (headers) {
                    responseHeaders = { ...responseHeaders, ...headers };
                }
            },
            writeProcessing: () => {},
        } as any as ServerResponse;
    }

    /**
     * Convert headers to Web API Headers format
     */
    protected convertHeaders(headers: Record<string, number | string | string[]>): Record<string, string> {
        const result: Record<string, string> = {};

        for (const [key, value] of Object.entries(headers)) {
            result[key] = Array.isArray(value) ? value.join(", ") : String(value);
        }

        return result;
    }

    /**
     * Create Response from UploadResponse
     */
    protected createResponse(uploadResponse: UploadResponse): globalThis.Response {
        const { body, headers = {}, statusCode } = uploadResponse;

        let responseBody: BodyInit = "";

        if (typeof body === "string") {
            responseBody = body;
        } else if (body instanceof Buffer) {
            responseBody = body;
        } else if (body && typeof body === "object") {
            responseBody = JSON.stringify(body);

            if (!headers["Content-Type"]) {
                headers["Content-Type"] = "application/json;charset=utf-8";
            }
        }

        return new Response(responseBody, {
            headers: this.convertHeaders(headers),
            status: statusCode,
        });
    }

    /**
     * Create error Response
     */

    /**
     * Get appropriate content type for a format
     */
    protected getContentTypeForFormat(format: string): string {
        const contentTypes: Record<string, string> = {
            aac: "audio/aac",
            aiff: "audio/aiff",
            avi: "video/x-msvideo",
            avif: "image/avif",
            flac: "audio/flac",
            flv: "video/x-flv",
            gif: "image/gif",
            jpeg: "image/jpeg",
            jpg: "image/jpeg",
            m4a: "audio/mp4",
            mkv: "video/x-matroska",
            mov: "video/quicktime",
            mp3: "audio/mpeg",
            mp4: "video/mp4",
            ogg: "audio/ogg",
            png: "image/png",
            svg: "image/svg+xml",
            tiff: "image/tiff",
            wav: "audio/wav",
            webm: "video/webm",
            webp: "image/webp",
            wma: "audio/x-ms-wma",
            wmv: "video/x-ms-wmv",
        };

        return contentTypes[format.toLowerCase()] || "application/octet-stream";
    }

    protected createErrorResponse(error: Error): globalThis.Response {
        let httpError: HttpError;

        if (isUploadError(error)) {
            httpError = this.internalErrorResponses[error.UploadErrorCode] as HttpError;
        } else if (!isValidationError(error) && !isHttpError(error)) {
            httpError = this.storage.normalizeError(error);
        } else {
            httpError = error;
        }

        const errorResponse = this.storage.onError(httpError);

        return this.createResponse(errorResponse);
    }
}

export default BaseHandler;
