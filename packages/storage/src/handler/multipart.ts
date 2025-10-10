/**
 * @packageDocumentation
 * Multipart upload handler for standard HTML forms and XHR uploads. Provides
 * Express-compatible middleware and fetch handler.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";

import { parseMultipartRequest as parseMultipartRequestWeb } from "@remix-run/multipart-parser";
import { MaxFileSizeExceededError, MultipartParseError, parseMultipartRequest } from "@remix-run/multipart-parser/node";
import createHttpError from "http-errors";

import type { FileInit, UploadFile } from "../storage/utils/file";
import type { UploadError } from "../utils/errors";
import { ERRORS } from "../utils/errors";
import { getIdFromRequest } from "../utils/http";
import pick from "../utils/primitives/pick";
import ValidationError from "../utils/validation-error";
import BaseHandler from "./base-handler";
import type { Handlers, ResponseFile } from "./types";

const RE_MIME = /^multipart\/.+|application\/x-www-form-urlencoded$/i;

/**
 * Express wrapper
 *
 * - express ***should*** respond to the client when the upload complete and handle errors and GET requests
 * @example
 * ```ts
 * const multipart = new Multipart({ storage });
 *
 * app.use('/files', multipart.upload, (req, response, next) => {
 *   if (req.method === 'GET') return response.sendStatus(404);
 *   console.log('File upload complete: ', req.body.name);
 *   return response.sendStatus(200);
 * });
 * ```
 *
 * Basic express wrapper
 * @example
 * ```ts
 * const multipart = new Multipart({directory: '/tmp', maxUploadSize: '250GB'});
 *
 * app.use('/files', multipart.handle);
 * ```
 */
class Multipart<
    TFile extends UploadFile,
    NodeRequest extends IncomingMessage = IncomingMessage,
    NodeResponse extends ServerResponse = ServerResponse,
> extends BaseHandler<TFile, NodeRequest, NodeResponse> {
    /**
     * Limiting enabled http method handler
     * @example
     * ```ts
     * Multipart.methods = ['post', 'put', 'delete'];
     * app.use('/upload', new Multipart(opts).handle);
     * ```
     */
    public static override readonly methods: Handlers[] = ["delete", "download", "get", "options", "post"];

    // eslint-disable-next-line sonarjs/cognitive-complexity
    public async post(request: NodeRequest): Promise<ResponseFile<TFile>> {
        if (!RE_MIME.test(request.headers["content-type"]?.split(";")[0] ?? "")) {
            throw createHttpError(400, "Invalid content-type");
        }

        try {
            const config: FileInit = { metadata: {}, size: 0 };
            const parts: any[] = [];

            // First, collect all parts
            for await (const part of parseMultipartRequest(request)) {
                parts.push(part);
            }

            // Find the file part and validate it
            const filePart = parts.find((part) => part.isFile);

            if (!filePart) {
                throw createHttpError(400, "No file found in multipart request");
            }

            // Handle file upload
            config.size = filePart.size;
            config.originalName = filePart.filename;
            config.contentType = filePart.mediaType;

            const file = await this.storage.create(request, config);

            // Create a Readable stream from the bytes data
            let stream: Readable;

            if (filePart.bytes instanceof Uint8Array || Buffer.isBuffer(filePart.bytes)) {
                // Ensure we create a stream that emits Buffer objects for compatibility
                stream = Readable.from(Buffer.from(filePart.bytes));
            } else if (typeof filePart.bytes === "number") {
                // If part.bytes is a number, it might be the size - create empty buffer
                stream = Readable.from(Buffer.alloc(0));
            } else {
                // Fallback for other types
                stream = Readable.from(Buffer.from(String(filePart.bytes)));
            }

            await this.storage.write({
                body: stream,
                contentLength: filePart.size,
                id: file.id,
                start: 0,
            });

            // Wait for the file to be completed
            const completedFile = await this.storage.write({
                body: Readable.from(new Uint8Array(0)), // Empty buffer to signal completion
                contentLength: 0,
                id: file.id,
                start: filePart.size,
            });

            if (completedFile.status === "completed") {
                return {
                    ...completedFile,
                    headers: {
                        Location: this.buildFileUrl(request, completedFile),
                        ...completedFile.expiredAt === undefined ? {} : { "X-Upload-Expires": completedFile.expiredAt.toString() },
                        ...completedFile.ETag === undefined ? {} : { ETag: completedFile.ETag },
                    },
                    statusCode: 200,
                };
            }

            // Process metadata parts
            for (const part of parts) {
                if (!part.isFile && part.name) {
                    let data = {};

                    if (part.name === "metadata" && part.text) {
                        try {
                            data = JSON.parse(part.text);
                        } catch {
                            // ignore
                        }
                    } else if (part.name) {
                        data = { [part.name]: part.text };
                    }

                    Object.assign(config.metadata, data);
                }
            }
        } catch (error) {
            if (error instanceof MaxFileSizeExceededError) {
                throw createHttpError(413, "File size limit exceeded");
            }

            if (error instanceof MultipartParseError) {
                throw createHttpError(400, "Invalid multipart request");
            }

            if (error instanceof ValidationError && error.statusCode) {
                throw createHttpError(error.statusCode, error.message || error.body || "Validation failed");
            }

            throw error;
        }
    }

    /**
     * Delete upload
     */
    public async delete(request: NodeRequest): Promise<ResponseFile<TFile>> {
        try {
            const id = getIdFromRequest(request);

            const file = await this.storage.delete({ id });

            if (file.status === undefined) {
                throw createHttpError(404, "File not found");
            }

            return { ...file, headers: {}, statusCode: 204 } as ResponseFile<TFile>;
        } catch (error: any) {
            this.checkForUndefinedIdOrPath(error);

            if (error.code === "ENOENT") {
                throw createHttpError(404, "File not found");
            }

            throw error;
        }
    }

    /**
     * Handle Web API Fetch requests (for Hono, Cloudflare Workers, etc.)
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
            // For multipart POST requests, handle directly with web API to avoid conversion issues
            if (request.method === "POST" && request.headers.get("content-type")?.startsWith("multipart/")) {
                const file = await this.postFetch(request);

                return this.handleFetchResponse(request, file);
            }

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

    /**
     * Handle multipart POST requests using web API (for fetch handler)
     */
    private async postFetch(request: Request): Promise<ResponseFile<TFile>> {
        // Validate content type
        if (!RE_MIME.test(request.headers.get("content-type")?.split(";")[0] ?? "")) {
            throw createHttpError(400, "Invalid content-type");
        }

        try {
            const config: FileInit = { metadata: {}, size: 0 };
            const parts: any[] = [];

            // Parse multipart using web API
            for await (const part of parseMultipartRequestWeb(request)) {
                parts.push(part);
            }

            // Find the file part and validate it
            const filePart = parts.find((part) => part.isFile);

            if (!filePart) {
                throw createHttpError(400, "No file found in multipart request");
            }

            // Handle file upload
            config.size = filePart.size;
            config.originalName = filePart.filename;
            config.contentType = filePart.mediaType;

            const file = await this.storage.create({} as any, config);

            // Create a Readable stream from the bytes data
            let stream: Readable;

            if (filePart.bytes instanceof Uint8Array || Buffer.isBuffer(filePart.bytes)) {
                // Ensure we create a stream that emits Buffer objects for compatibility
                stream = Readable.from(Buffer.from(filePart.bytes));
            } else if (typeof filePart.bytes === "number") {
                // If part.bytes is a number, it might be the size - create empty buffer
                stream = Readable.from(Buffer.alloc(0));
            } else {
                // Fallback for other types
                stream = Readable.from(Buffer.from(String(filePart.bytes)));
            }

            await this.storage.write({
                body: stream,
                contentLength: filePart.size,
                id: file.id,
                start: 0,
            });

            // Wait for the file to be completed
            const completedFile = await this.storage.write({
                body: Readable.from(new Uint8Array(0)), // Empty buffer to signal completion
                contentLength: 0,
                id: file.id,
                start: filePart.size,
            });

            if (completedFile.status === "completed") {
                return {
                    ...completedFile,
                    headers: {
                        Location: this.buildFileUrl({} as any, completedFile),
                        ...completedFile.expiredAt === undefined ? {} : { "X-Upload-Expires": completedFile.expiredAt.toString() },
                        ...completedFile.ETag === undefined ? {} : { ETag: completedFile.ETag },
                    },
                    statusCode: 200,
                };
            }

            // Process metadata parts
            for (const part of parts) {
                if (!part.isFile && part.name) {
                    let data = {};

                    if (part.name === "metadata" && part.text) {
                        try {
                            data = JSON.parse(part.text);
                        } catch {
                            // ignore
                        }
                    } else if (part.name) {
                        data = { [part.name]: part.text };
                    }

                    Object.assign(config.metadata, data);
                }
            }
        } catch (error) {
            if (error instanceof MaxFileSizeExceededError) {
                throw createHttpError(413, "File size limit exceeded");
            }

            if (error instanceof MultipartParseError) {
                throw createHttpError(400, "Invalid multipart request");
            }

            if (error instanceof ValidationError) {
                throw createHttpError(error.statusCode || 400, error.message || error.body || "Validation failed");
            }

            throw error;
        }
    }

    // eslint-disable-next-line class-methods-use-this
    private checkForUndefinedIdOrPath(error: any): void {
        if (["Id is undefined", "Path is undefined"].includes(error.message)) {
            throw createHttpError(404, "File not found");
        }
    }
}

export default Multipart;
