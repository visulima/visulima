import { Readable } from "node:stream";

import type { UploadFile } from "../../storage/utils/file";
import type { UploadError } from "../../utils/errors";
import { ERRORS } from "../../utils/errors";
import { HeaderUtilities } from "../../utils/headers";
import pick from "../../utils/primitives/pick";
import type { UploadResponse } from "../../utils/types";
import type { Handlers, ResponseFile, ResponseList, UploadOptions } from "../types";
import { waitForStorage } from "../utils/storage-utils";
import { applyRange, rangeIfCurrent } from "../utils/stream-utils";
import BaseHandlerCore from "./base-handler-core";

/**
 * Base handler for Web API Fetch platform (Request/Response).
 * Extends BaseHandlerCore with Fetch-specific request/response handling.
 * @template TFile The file type used by this handler.
 */
abstract class BaseHandlerFetch<TFile extends UploadFile> extends BaseHandlerCore<TFile> {
    /**
     * Limiting enabled HTTP method handler.
     */
    public static readonly methods: Handlers[] = ["delete", "get", "head", "options", "patch", "post", "put"];

    /**
     * Map of registered HTTP method handlers.
     */
    protected registeredHandlers: Map<string, (request: Request) => Promise<ResponseFile<TFile> | ResponseList<TFile>>> = new Map<
        string,
        (request: Request) => Promise<ResponseFile<TFile> | ResponseList<TFile>>
    >();

    public constructor(options: UploadOptions<TFile>) {
        super(options);
        this.compose();
    }

    /**
     * Gets the registered handlers map.
     * @returns Map of registered handlers.
     */
    public get handlers(): Map<string, (request: Request) => Promise<ResponseFile<TFile> | ResponseList<TFile>>> {
        return this.registeredHandlers;
    }

    /**
     * Handles Web API Fetch requests (for Hono, Cloudflare Workers, etc.).
     * @param request Web API Request object.
     * @returns Promise resolving to Web API Response.
     */
    public async fetch(request: Request): Promise<globalThis.Response> {
        this.logger?.debug("[fetch request]: %s %s", request.method, request.url);

        try {
            request = this.normalizeRequest(request);
        } catch (error: unknown) {
            return this.createErrorResponse(error instanceof Error ? error : new Error(String(error)));
        }

        const handler = this.registeredHandlers.get(request.method || "GET");

        if (!handler) {
            return this.createErrorResponse({ UploadErrorCode: ERRORS.METHOD_NOT_ALLOWED } as UploadError);
        }

        try {
            await waitForStorage(this.storage);
        } catch (error: unknown) {
            this.logger?.error("Storage is not ready: %O", error);

            return this.createErrorResponse({ UploadErrorCode: ERRORS.STORAGE_ERROR } as UploadError);
        }

        try {
            const file = await handler.call(this, request);

            // Awaited, so a failure while building the response (an onComplete hook, an invalid header
            // value) still becomes an error response instead of a rejected fetch().
            return await this.handleFetchResponse(request, file);
        } catch (error: unknown) {
            const errorObject = error instanceof Error ? error : new Error(String(error));
            const uError = pick(errorObject, ["name", ...(Object.getOwnPropertyNames(errorObject) as (keyof Error)[])]) as UploadError;
            const errorEvent = {
                ...uError,
                request: {
                    headers: Object.fromEntries(request.headers.entries()),
                    method: request.method,
                    url: request.url,
                },
            };

            if (this.listenerCount("error") > 0) {
                this.emit("error", errorEvent);
            }

            this.logger?.error("[fetch error]: %O", errorEvent);

            return this.createErrorResponse(errorObject);
        }
    }

    /**
     * Adjusts a request before it is routed to a method handler (e.g. a protocol's method
     * override). Throw an HttpError to reject the request.
     * @param request Web API Request.
     * @returns The request to route.
     */
    // eslint-disable-next-line class-methods-use-this
    protected normalizeRequest(request: Request): Request {
        return request;
    }

    /**
     * Retrieves a file, its metadata (`/:id/metadata`) or - with `allowList` enabled - a list of files based on the request path.
     * Large files and `Range` requests are streamed.
     * @param request Web API Request.
     * @returns Promise resolving to a single file or a (paginated) list of files.
     * @throws {HttpError} When the file is not found.
     */
    public async get(request: Request): Promise<ResponseFile<TFile> | ResponseList<TFile>> {
        const url = new URL(request.url, "http://localhost");

        return this.resolveGet(url.pathname, url.searchParams, request.headers.has("range"), async () => this.list(request));
    }

    /**
     * Returns a list of uploaded files with optional pagination support (`limit` and `page` query parameters).
     * @param request Web API Request.
     * @returns Promise resolving to a paginated or complete list of uploaded files.
     */
    public async list(request: Request): Promise<ResponseList<TFile>> {
        return this.listFiles(new URL(request.url, "http://localhost").searchParams);
    }

    /**
     * Compose and register HTTP method handlers.
     * Subclasses should override this to register their specific handlers.
     */
    protected abstract compose(): void;

    /**
     * Handle the response from handlers for fetch requests and convert to Web API Response.
     * @param request Web API Request object
     * @param file Response file or list from handler
     * @returns Promise resolving to Web API Response object
     */
    protected async handleFetchResponse(request: Request, file: ResponseFile<TFile> | ResponseList<TFile>): Promise<globalThis.Response> {
        // Handle different response types
        if (request.method === "HEAD" || request.method === "OPTIONS") {
            const { headers, statusCode } = file as ResponseFile<TFile>;

            return new Response(undefined, {
                headers: this.convertHeaders({ ...headers }),
                status: statusCode,
            });
        }

        if (request.method === "GET") {
            const { headers, statusCode } = file;
            const responseHeaders: Record<string, number | string | string[]> = { ...headers };
            let body: BodyInit = "";
            let status = statusCode;

            if ("data" in file) {
                body = JSON.stringify(file.data);
            } else if (file.stream) {
                // Streaming response, with range support for partial content requests
                let range: { end: number; start: number } | undefined;

                try {
                    range = this.parseRangeHeader(
                        rangeIfCurrent(request.headers.get("range") ?? undefined, request.headers.get("if-range") ?? undefined, responseHeaders),
                        file.size || 0,
                    );
                } catch (error) {
                    file.stream.destroy();

                    throw error;
                }

                const ranged = applyRange(file.stream, file.size, range);

                Object.assign(responseHeaders, ranged.headers);
                status = ranged.partial ? 206 : statusCode;
                body = Readable.toWeb(ranged.stream) as ReadableStream<Uint8Array>;
            } else if (file.content !== undefined) {
                body = typeof file.content === "string" ? file.content : new Uint8Array(file.content);
            }

            return new Response(body, {
                headers: this.convertHeaders({
                    ...responseHeaders,
                }),
                status,
            });
        }

        // POST/PUT/PATCH/DELETE responses
        const { headers, statusCode, ...basicFile } = file as ResponseFile<TFile>;

        // Emit events if listeners exist
        if (basicFile.status !== undefined && this.listenerCount(basicFile.status) > 0) {
            this.emit(basicFile.status, {
                ...basicFile,
                request: {
                    headers: Object.fromEntries(request.headers.entries()),
                    method: request.method,
                    url: request.url,
                },
            });
        }

        if (basicFile.status === "completed") {
            // onComplete modifies the response object directly
            const responseFile = file as ResponseFile<TFile>;

            // Ensure headers and statusCode exist before calling onComplete
            if (responseFile.headers === undefined) {
                responseFile.headers = {};
            }

            if (responseFile.statusCode === undefined) {
                responseFile.statusCode = 200;
            }

            try {
                await this.storage.onComplete(basicFile as TFile, responseFile);
            } catch (error) {
                this.logger?.error("[onComplete error]: %O", error);
                throw error;
            }

            // Extract file data from responseFile (excluding headers and statusCode) for the body
            const { headers: responseFileHeaders, statusCode: responseFileStatusCode, ...fileData } = responseFile;

            // Remove non-serializable properties
            const { content, stream, ...cleanFileData } = fileData;

            return this.createResponse({
                body: cleanFileData,
                headers: responseFileHeaders || headers,
                statusCode: responseFileStatusCode || statusCode || 200,
            });
        }

        // Ensure Location header is present and properly exposed
        const allHeaders = {
            ...headers,
            ...(file as ResponseFile<TFile>).headers,
        };
        const convertedHeaders = this.convertHeaders({
            ...allHeaders,
            ...(basicFile.hash === undefined ? {} : { [`X-Range-${basicFile.hash?.algorithm.toUpperCase()}`]: basicFile.hash?.value }),
        });

        // Ensure Location header is present
        const responseFileHeaders = (file as ResponseFile<TFile>).headers || {};

        if (responseFileHeaders.Location && !convertedHeaders.location && !convertedHeaders.Location) {
            convertedHeaders.location = String(responseFileHeaders.Location);
        } else if (responseFileHeaders.location && !convertedHeaders.location && !convertedHeaders.Location) {
            convertedHeaders.location = String(responseFileHeaders.location);
        } else if (headers.Location && !convertedHeaders.location && !convertedHeaders.Location) {
            convertedHeaders.location = String(headers.Location);
        } else if (headers.location && !convertedHeaders.location && !convertedHeaders.Location) {
            convertedHeaders.location = String(headers.location);
        }

        // A list (batch delete) answers with its items, as on Node.
        if ("data" in file && Array.isArray(file.data) && statusCode !== 204) {
            return this.createResponse({
                body: JSON.stringify(file.data),
                headers: { ...convertedHeaders, "Content-Type": "application/json; charset=utf-8" },
                statusCode,
            });
        }

        // For successful responses, include the file data in the body
        let responseBody: Record<string, unknown> | undefined;

        if (statusCode >= 200 && statusCode < 300) {
            responseBody = Object.keys(basicFile).length > 0 ? { ...basicFile } : {};

            // Remove content property (Buffer) as it shouldn't be in JSON response
            if ("content" in responseBody) {
                delete responseBody.content;
            }

            // Remove stream property if present (not serializable)
            if ("stream" in responseBody) {
                delete responseBody.stream;
            }

            // Ensure we have at least an empty object for JSON serialization
            if (Object.keys(responseBody).length === 0) {
                responseBody = {};
            }
        }

        return this.createResponse({
            body: responseBody,
            headers: convertedHeaders,
            statusCode: statusCode || 200,
        });
    }

    /**
     * Convert headers to Web API Headers format by flattening arrays and converting to strings.
     * @param headers Headers object with potentially array values
     * @returns Headers object with all values as strings
     */
    // eslint-disable-next-line class-methods-use-this
    protected convertHeaders(headers: Record<string, number | string | string[]>): Record<string, string> {
        const result: Record<string, string> = {};
        const exposed: string[] = [];

        for (const [key, value] of Object.entries(headers)) {
            const text = Array.isArray(value) ? value.join(", ") : String(value);

            if (key.toLowerCase() === "access-control-expose-headers") {
                exposed.unshift(text);
            } else {
                result[key] = text;
                exposed.push(key.toLowerCase());
            }
        }

        // Expose every header the response sets, as the Node handlers do, so a cross-origin client
        // can read each one, the response that completes an upload included.
        if (exposed.length > 0) {
            result["Access-Control-Expose-Headers"] = exposed.join(",");
        }

        return result;
    }

    /**
     * Create Web API Response from UploadResponse object.
     * @param uploadResponse Upload response containing body, headers, and status code
     * @returns Web API Response object
     */
    protected createResponse(uploadResponse: UploadResponse): globalThis.Response {
        const { body, headers = {}, statusCode } = uploadResponse;

        let responseBody: BodyInit | null | undefined;

        // For 204 No Content, body must be null or undefined (Web API Response requirement)
        if (statusCode === 204) {
            responseBody = null;
        } else if (typeof body === "string") {
            responseBody = body;
        } else if (body instanceof Buffer) {
            responseBody = new Uint8Array(body);
        } else if (body && typeof body === "object") {
            responseBody = JSON.stringify(body);

            if (!headers["Content-Type"]) {
                headers["Content-Type"] = HeaderUtilities.createContentType({
                    charset: "utf8",
                    mediaType: "application/json",
                });
            }
        } else if (body === undefined && statusCode !== undefined && statusCode >= 200 && statusCode < 300) {
            // For successful responses without a body (except 204), return empty JSON object
            responseBody = "{}";

            if (!headers["Content-Type"]) {
                headers["Content-Type"] = HeaderUtilities.createContentType({
                    charset: "utf8",
                    mediaType: "application/json",
                });
            }
        }

        return new Response(responseBody, {
            headers: this.convertHeaders(headers),
            status: statusCode,
        });
    }

    /**
     * Create error Response from Error object with appropriate status code and message.
     * @param error Error object to convert to HTTP error response
     * @returns Web API Response object with error details
     */
    protected async createErrorResponse(error: Error): Promise<globalThis.Response> {
        return this.createResponse(await this.buildErrorResponse(error));
    }

    /**
     * Build file URL from request and file data.
     * @param request Web API Request object
     * @param file File object containing ID and content type
     * @returns Constructed file URL with extension based on content type
     */
    protected buildFileUrl(request: Request, file: TFile): string {
        return this.buildFileUrlFromString(request.url, file);
    }

    /**
     * Negotiates content type based on Accept header and supported formats.
     * @param request Web API Request object containing Accept header.
     * @param supportedTypes Array of supported MIME types to match against.
     * @returns Best matching content type or undefined if no match found.
     */
    public negotiateContentType(request: Request, supportedTypes: string[]): string | undefined {
        return super.negotiateContentTypeFromHeader(request.headers.get("accept") || undefined, supportedTypes);
    }
}

export default BaseHandlerFetch;
