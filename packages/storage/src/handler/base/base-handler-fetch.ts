import { isHttpError } from "http-errors";

import type { UploadFile } from "../../storage/utils/file";
import type { UploadError } from "../../utils/errors";
import { ERRORS, isUploadError } from "../../utils/errors";
import { HeaderUtilities } from "../../utils/headers";
import pick from "../../utils/primitives/pick";
import type { HttpError, UploadResponse } from "../../utils/types";
import { isValidationError } from "../../utils/validator";
import type { Handlers, ResponseFile, ResponseList, UploadOptions } from "../types";
import { waitForStorage } from "../utils/storage-utils";
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

        const handler = this.registeredHandlers.get(request.method || "GET");

        if (!handler) {
            return this.createErrorResponse({ UploadErrorCode: ERRORS.METHOD_NOT_ALLOWED } as UploadError);
        }

        try {
            await waitForStorage(this.storage);
        } catch (error: unknown) {
            return this.createErrorResponse({ UploadErrorCode: ERRORS.STORAGE_ERROR } as UploadError);
        }

        try {
            const file = await handler.call(this, request);

            return this.handleFetchResponse(request, file);
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
            const cleanFileData = { ...fileData };

            if ("content" in cleanFileData) {
                delete cleanFileData.content;
            }

            if ("stream" in cleanFileData) {
                delete cleanFileData.stream;
            }

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
            "Access-Control-Expose-Headers":
                "location,upload-expires,upload-offset,upload-length,upload-metadata,upload-defer-length,tus-resumable,tus-extension,tus-max-size,tus-version,tus-checksum-algorithm,cache-control",
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

        for (const [key, value] of Object.entries(headers)) {
            result[key] = Array.isArray(value) ? value.join(", ") : String(value);
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
            responseBody = body;
        } else if (body && typeof body === "object") {
            responseBody = JSON.stringify(body);

            if (!headers["Content-Type"]) {
                headers["Content-Type"] = HeaderUtilities.createContentType({
                    charset: "utf8",
                    mediaType: "application/json",
                });
            }
        } else if (body === undefined && statusCode >= 200 && statusCode < 300) {
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
                errorResponse = { body: httpError.body, headers: httpError.headers, statusCode: httpError.statusCode };
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

        return this.createResponse(errorResponse);
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
    public override negotiateContentType(request: Request, supportedTypes: string[]): string | undefined {
        return super.negotiateContentType(request.headers.get("accept") || undefined, supportedTypes);
    }
}

export default BaseHandlerFetch;
