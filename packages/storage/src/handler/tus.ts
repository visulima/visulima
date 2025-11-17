import type { IncomingMessage, ServerResponse } from "node:http";
import { format } from "node:url";

// eslint-disable-next-line import/no-extraneous-dependencies
import createHttpError from "http-errors";
// eslint-disable-next-line import/no-extraneous-dependencies
import typeis from "type-is";

import type { Checksum, FileInit, UploadFile } from "../storage/utils/file";
import { Metadata } from "../storage/utils/file";
import type { UploadError } from "../utils/errors";
import { ERRORS } from "../utils/errors";
import { HeaderUtilities } from "../utils/headers";
import { getBaseUrl, getHeader, getIdFromRequest, getRequestStream } from "../utils/http";
import pick from "../utils/primitives/pick";
import type { Headers, UploadResponse } from "../utils/types";
import BaseHandler from "./base-handler";
import type { Handlers, ResponseFile } from "./types";

const TUS_RESUMABLE_VERSION = "1.0.0";
const TUS_VERSION_VERSION = "1.0.0";

/**
 * [tus resumable upload protocol](https://github.com/tus/tus-resumable-upload-protocol/blob/master/protocol.md)
 *
 * Express wrapper
 *
 * - express ***should*** respond to the client when the upload complete and handle errors and GET requests
 * @example
 * ```ts
 * const tus = new Tus(storage);
 *
 * app.all('/files', tus.upload, (req, response, next) => {
 *   if (req.method === 'GET') return response.sendStatus(404);
 *   console.log('File upload complete: ', req.body.name);
 *   return response.sendStatus(204);
 * });
 * ```
 *
 * Basic express wrapper
 * @example
 * ```ts
 * const tus = new Tus({directory: '/tmp', maxUploadSize: '250GB'});
 *
 * app.use('/files', tus.handle);
 * ```
 */
export class Tus<
    TFile extends UploadFile,
    NodeRequest extends IncomingMessage = IncomingMessage,
    NodeResponse extends ServerResponse = ServerResponse,
> extends BaseHandler<TFile, NodeRequest, NodeResponse> {
    /**
     * Limiting enabled http method handler
     * @example
     * ```ts
     * Tus.methods = ['post', 'put', 'delete'];
     * app.use('/upload', new Tus(opts).handle);
     * ```
     */
    public static override readonly methods: Handlers[] = ["delete", "download", "get", "head", "options", "patch", "post"];

    /**
     * Handle OPTIONS requests with TUS protocol capabilities.
     * Returns supported extensions, max size, and checksum algorithms.
     * @returns Promise resolving to ResponseFile with TUS headers
     */
    public override async options(): Promise<ResponseFile<TFile>> {
        const headers = {
            "Access-Control-Allow-Headers":
                "Authorization, Content-Type, Location, Tus-Extension, Tus-Max-Size, Tus-Resumable, Tus-Version, Upload-Concat, Upload-Defer-Length, Upload-Length, Upload-Metadata, Upload-Offset, X-HTTP-Method-Override, X-Requested-With",
            "Access-Control-Allow-Methods": Tus.methods.map((method) => method.toUpperCase()).join(", "),
            "Access-Control-Max-Age": 86_400,
            "Tus-Checksum-Algorithm": this.storage.checksumTypes.join(","),
            "Tus-Extension": this.storage.tusExtension.toString(),
            "Tus-Max-Size": this.storage.maxUploadSize,
            "Tus-Version": TUS_VERSION_VERSION,
        };

        return { headers: headers as Record<string, string | number>, statusCode: 204 } as ResponseFile<TFile>;
    }

    /**
     * Create a new TUS upload and optionally start uploading data.
     * @param request Node.js IncomingMessage with TUS headers
     * @returns Promise resolving to ResponseFile with upload location and offset
     */
    public async post(request: NodeRequest): Promise<ResponseFile<TFile>> {
        this.validateTusResumableHeader(request);

        if ("upload-concat" in request.headers && !this.storage.tusExtension.includes("concatentation")) {
            throw createHttpError(501, "Concatenation extension is not (yet) supported. Disable parallel upload in the tus client.");
        }

        const uploadDeferLength = request.headers["upload-defer-length"] as string | undefined;

        if (
            uploadDeferLength !== undefined // Throw error if extension is not supported
            && !this.storage.tusExtension.includes("creation-defer-length")
        ) {
            throw createHttpError(501, "creation-defer-length extension is not (yet) supported.");
        }

        const uploadLength = request.headers["upload-length"] as string | undefined;

        if (uploadLength === undefined && uploadDeferLength === undefined && uploadLength === uploadDeferLength) {
            throw createHttpError(400, "Either upload-length or upload-defer-length must be specified.");
        }

        if (uploadLength !== undefined && Number.isNaN(Number(uploadLength))) {
            throw createHttpError(400, "Invalid upload-length");
        }

        const metadataHeader = getHeader(request, "upload-metadata", true);
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        const metadata = parseMetadata(metadataHeader);
        const config: FileInit = { metadata, size: uploadLength };

        let file = await this.storage.create(request, config);

        // 'creation-with-upload' block
        if (typeis(request, ["application/offset+octet-stream"])) {
            const contentLength = +getHeader(request, "content-length");

            file = await this.storage.write({
                ...file,
                body: getRequestStream(request),
                contentLength,
                start: 0,
            });
        }

        let headers: Headers = {};

        // The Upload-Expires response header indicates the time after which the unfinished upload expires.
        // If expiration is known at creation time, Upload-Expires header MUST be included in the response
        if (
            this.storage.tusExtension.includes("expiration")
            && typeof file.expiredAt === "number"
            && file.bytesWritten !== Number.parseInt(uploadLength as string, 10)
        ) {
            headers = { "Upload-Expires": new Date(file.expiredAt).toUTCString() };
        }

        // Build TUS headers and ensure Location header is set (required by TUS protocol)
        const locationUrl = this.buildFileUrl(request, file);

        headers = { ...headers, ...this.buildHeaders(file, { Location: locationUrl }) };

        // Ensure Location header is present (TUS protocol requirement)
        if (!headers.Location) {
            headers.Location = locationUrl;
        }

        if (file.bytesWritten > 0) {
            headers["Upload-Offset"] = file.bytesWritten.toString();
        }

        const statusCode = file.bytesWritten > 0 ? 200 : 201;

        return { ...file, headers: headers as Record<string, string | number>, statusCode };
    }

    /**
     * Write a chunk of data to an existing TUS upload.
     * @param request Node.js IncomingMessage with chunk data and TUS headers
     * @returns Promise resolving to ResponseFile with updated offset
     */
    public async patch(request: NodeRequest): Promise<ResponseFile<TFile>> {
        this.validateTusResumableHeader(request);

        try {
            const id = getIdFromRequest(request);

            const metadataHeader = getHeader(request, "upload-metadata", true);
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            const metadata = metadataHeader && parseMetadata(metadataHeader);

            if (metadata) {
                try {
                    await this.storage.update({ id }, { id, metadata });
                } catch (error: any) {
                    // Handle file not found errors as potential expiration
                    if (error.UploadErrorCode === "FILE_NOT_FOUND") {
                        throw createHttpError(410, "Upload expired");
                    }

                    throw error;
                }
            }

            // Check if file is expired before processing
            let currentFile;

            try {
                currentFile = await this.storage.getMeta(id);
                await this.storage.checkIfExpired(currentFile);
            } catch (error: any) {
                // Handle expiration errors
                if (error.UploadErrorCode === "GONE") {
                    throw createHttpError(410, "Upload expired");
                }

                // Handle file not found errors as potential expiration
                if (error.UploadErrorCode === "FILE_NOT_FOUND") {
                    throw createHttpError(410, "Upload expired");
                }

                throw error;
            }

            // The request MUST include a Upload-Offset header
            if (request.headers["upload-offset"] === undefined) {
                throw createHttpError(412, "Missing Upload-Offset header");
            }

            // The request MUST include a Content-Type header
            if (request.headers["content-type"] === undefined) {
                throw createHttpError(412, "Content-Type header required");
            }

            // The Content-Type must be application/offset+octet-stream for PATCH requests
            if (request.headers["content-type"] !== "application/offset+octet-stream") {
                throw createHttpError(412, "Invalid Content-Type for PATCH request");
            }

            const start = Number.parseInt(getHeader(request, "upload-offset"), 10);
            const contentLength = Number(getHeader(request, "content-length"));
            const { checksum, checksumAlgorithm } = this.extractChecksum(request);

            let file = await this.storage.write({
                body: getRequestStream(request),
                checksum,
                checksumAlgorithm,
                contentLength,
                id,
                start,
            });

            // The request MUST validate upload-length related headers
            const uploadLength = request.headers["upload-length"] as string | undefined;

            if (uploadLength !== undefined) {
                // Throw error if extension is not supported
                if (!this.storage.tusExtension.includes("creation-defer-length")) {
                    throw createHttpError(501, "creation-defer-length extension is not (yet) supported.");
                }

                // Throw error if upload-length is already set.
                if (file.size !== undefined) {
                    throw createHttpError(412, "Upload-Length or Upload-Defer-Length header required");
                }

                const size = Number.parseInt(uploadLength, 10);

                if (size < file.bytesWritten) {
                    throw createHttpError(400, "Upload-Length is smaller than the current offset");
                }

                file = await this.storage.update({ id }, { size });
            }

            return {
                ...file,
                headers: this.buildHeaders(file, {
                    "Upload-Offset": file.bytesWritten,
                }) as Record<string, string | number>,
                statusCode: file.status === "completed" ? 200 : 204,
            };
        } catch (error: any) {
            this.checkForUndefinedIdOrPath(error);

            // Handle expiration errors
            if (error.UploadErrorCode === "GONE" || error.UploadErrorCode === "FILE_NOT_FOUND") {
                throw createHttpError(410, "Upload expired");
            }

            throw error;
        }
    }

    /**
     * Get TUS upload metadata and current status.
     * @param request Node.js IncomingMessage with upload ID
     * @returns Promise resolving to ResponseFile with file metadata as JSON
     */
    public override async get(request: NodeRequest): Promise<ResponseFile<TFile>> {
        this.validateTusResumableHeader(request);

        try {
            const id = getIdFromRequest(request);

            const file = await this.storage.getMeta(id);

            return {
                ...file,
                body: file, // Return file metadata as JSON
                headers: this.buildHeaders(file, {
                    "Content-Type": HeaderUtilities.createContentType({
                        mediaType: "application/json",
                    }),
                }) as Record<string, string | number>,
                statusCode: 200,
            };
        } catch (error: any) {
            this.checkForUndefinedIdOrPath(error);

            // Handle expiration errors
            if (error.UploadErrorCode === "GONE") {
                throw createHttpError(410, "Upload expired");
            }

            throw error;
        }
    }

    /**
     * Get current upload offset and metadata for TUS resumable uploads.
     * @param request Node.js IncomingMessage with upload ID
     * @returns Promise resolving to ResponseFile with upload-offset and metadata headers
     */
    public async head(request: NodeRequest): Promise<ResponseFile<TFile>> {
        this.validateTusResumableHeader(request);

        try {
            const id = getIdFromRequest(request);

            const file = await this.storage.getMeta(id);

            await this.storage.checkIfExpired(file);

            const headers = {
                ...typeof file.size === "number" && !Number.isNaN(file.size)
                    ? {
                        // If the size of the upload is known, the Server MUST include
                        // the Upload-Length header in the response.
                        "Upload-Length": file.size,
                    }
                    : {
                        // As long as the length of the upload is not known, the Server
                        // MUST set Upload-Defer-Length: 1 in all responses to HEAD requests.
                        "Upload-Defer-Length": "1",
                    },
                ...this.buildHeaders(file, {
                    "Cache-Control": HeaderUtilities.createCacheControlPreset("no-store"),
                    "Upload-Metadata": serializeMetadata(file.metadata),
                    // The Server MUST always include the Upload-Offset header in
                    // the response for a HEAD request, even if the offset is 0
                    "Upload-Offset": file.bytesWritten,
                }),
            };

            return { headers: headers as Record<string, string>, statusCode: 200 } as ResponseFile<TFile>;
        } catch (error: any) {
            this.checkForUndefinedIdOrPath(error);

            // Handle expiration errors
            if (error.UploadErrorCode === "GONE" || error.UploadErrorCode === "FILE_NOT_FOUND") {
                throw createHttpError(410, "Upload expired");
            }

            throw error;
        }
    }

    /**
     * Delete a TUS upload and its associated data.
     * @param request Node.js IncomingMessage with upload ID
     * @returns Promise resolving to ResponseFile with deletion confirmation
     */
    public async delete(request: NodeRequest): Promise<ResponseFile<TFile>> {
        this.validateTusResumableHeader(request);

        try {
            const id = getIdFromRequest(request);

            // Check if termination is disabled for finished uploads
            if (this.disableTerminationForFinishedUploads) {
                const file = await this.storage.getMeta(id);

                if (file.status === "completed") {
                    throw createHttpError(400, "Termination of finished uploads is disabled");
                }
            }

            const file = await this.storage.delete({ id });

            if (file.status === undefined) {
                throw createHttpError(404, "File not found");
            }

            return {
                ...file,
                headers: this.buildHeaders(file) as Record<string, string>,
                statusCode: 204,
            } as ResponseFile<TFile>;
        } catch (error: any) {
            this.checkForUndefinedIdOrPath(error);

            if (error.code === "ENOENT") {
                throw createHttpError(404, "File not found");
            }

            throw error;
        }
    }

    /**
     * Handle Web API Fetch requests for TUS protocol (for Hono, Cloudflare Workers, etc.).
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
     * Send TUS protocol response with required headers.
     * @param response Node.js ServerResponse to send response to
     * @param uploadResponse Response data with body, headers, and status code
     * @param uploadResponse.body Response body content
     * @param uploadResponse.headers HTTP headers to include in response
     * @param uploadResponse.statusCode HTTP status code for the response
     */
    public override send(response: NodeResponse, { body = "", headers = {}, statusCode = 200 }: UploadResponse): void {
        super.send(response, {
            body,
            headers: {
                ...headers,
                "Access-Control-Expose-Headers":
                    "location,upload-expires,upload-offset,upload-length,upload-metadata,upload-defer-length,tus-resumable,tus-extension,tus-max-size,tus-version,tus-checksum-algorithm,cache-control",
                "Tus-Resumable": TUS_RESUMABLE_VERSION,
            },
            statusCode,
        });
    }

    /**
     * Extract checksum algorithm and value from Upload-Checksum header.
     * @param request Node.js IncomingMessage with checksum header
     * @returns Object containing checksum algorithm and value
     */
    // eslint-disable-next-line class-methods-use-this
    private extractChecksum(request: NodeRequest): Checksum {
        const [checksumAlgorithm, checksum] = getHeader(request, "upload-checksum").split(/\s+/).filter(Boolean);

        return { checksum, checksumAlgorithm };
    }

    /**
     * Validate Tus-Resumable header in client requests.
     * According to TUS spec, clients MUST include Tus-Resumable in all requests except OPTIONS.
     * @param request Node.js IncomingMessage
     * @throws {Error} 412 if version doesn't match or header is missing
     */
    // eslint-disable-next-line class-methods-use-this
    private validateTusResumableHeader(request: NodeRequest): void {
        const tusResumable = getHeader(request, "tus-resumable");

        if (!tusResumable) {
            throw createHttpError(412, "Missing Tus-Resumable header");
        }

        if (tusResumable !== TUS_RESUMABLE_VERSION) {
            throw createHttpError(412, `Unsupported TUS version: ${tusResumable}. Server supports: ${TUS_RESUMABLE_VERSION}`);
        }
    }

    /**
     * Build TUS protocol headers including required Tus-Resumable and optional Upload-Expires.
     * @param file Upload file object with metadata
     * @param headers Additional headers to include
     * @returns Headers object with TUS protocol headers
     */
    private buildHeaders(file: UploadFile, headers: Headers = {}): Headers {
        // All TUS responses must include Tus-Resumable header
        headers["Tus-Resumable"] = TUS_RESUMABLE_VERSION;

        if (this.storage.tusExtension.includes("expiration") && file.expiredAt !== undefined) {
            // eslint-disable-next-line no-param-reassign
            headers["Upload-Expires"] = new Date(file.expiredAt).toUTCString();
        }

        return headers;
    }

    /**
     * Build file URL for TUS uploads (without file extension).
     * @param request HTTP request with optional originalUrl
     * @param file File object containing ID
     * @returns Constructed file URL for TUS protocol
     */
    protected override buildFileUrl(request: NodeRequest & { originalUrl?: string }, file: TFile): string {
        const url = new URL(request.originalUrl || (request.url as string), "http://localhost");
        const { pathname } = url;
        const query = Object.fromEntries(url.searchParams.entries());
        const relative = format({ pathname: `${pathname}/${file.id}`, query });

        return `${this.storage.config.useRelativeLocation ? relative : getBaseUrl(request) + relative}`;
    }

    /**
     * Check if error is related to undefined ID or path and throw appropriate HTTP error.
     * @param error Error object to check
     */
    // eslint-disable-next-line class-methods-use-this
    private checkForUndefinedIdOrPath(error: any): void {
        if (["Id is undefined", "Invalid request URL", "Path is undefined"].includes(error.message)) {
            throw createHttpError(404, "File not found");
        }
    }
}

export const TUS_RESUMABLE: string = TUS_RESUMABLE_VERSION;
export const TUS_VERSION: string = TUS_VERSION_VERSION;

/**
 * Serialize metadata object to TUS protocol format.
 * @param object Metadata object to serialize
 * @returns Base64-encoded metadata string in TUS format
 */
export const serializeMetadata = (object: Metadata): string =>
    Object.entries(object)
        .map(([key, value]) => {
            if (value === undefined) {
                return key;
            }

            return `${key} ${Buffer.from(String(value)).toString("base64")}`;
        })
        .toString();

/**
 * Parse TUS protocol metadata string into object.
 * @param encoded Base64-encoded metadata string (optional, defaults to empty string)
 * @returns Parsed metadata object with decoded values
 */
export const parseMetadata = (encoded = ""): Metadata => {
    const kvPairs = encoded.split(",").map((kv) => kv.split(" "));
    const metadata = Object.create(Metadata.prototype) as Record<string, string>;

    Object.values(kvPairs).forEach(([key, value]) => {
        if (key) {
            metadata[key] = value ? Buffer.from(value, "base64").toString() : "";
        }
    });

    return metadata;
};
