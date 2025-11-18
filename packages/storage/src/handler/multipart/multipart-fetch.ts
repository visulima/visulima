import type { MultipartPart } from "@remix-run/multipart-parser";
import { MaxFileSizeExceededError, MultipartParseError, parseMultipartRequest } from "@remix-run/multipart-parser";
import createHttpError from "http-errors";

import type { UploadFile } from "../../storage/utils/file";
import { ERRORS } from "../../utils/errors";
import ValidationError from "../../utils/validation-error";
import { BaseHandlerFetch } from "../base/base-handler-fetch";
import type { Handlers, ResponseFile, UploadOptions } from "../types";
import { MultipartBase } from "./multipart-base";

// eslint-disable-next-line sonarjs/anchor-precedence
const RE_MIME = /^multipart\/.+|application\/x-www-form-urlencoded$/i;

/**
 * Extract file ID from request URL.
 */
const getIdFromRequestUrl = (url: string): string | null => {
    try {
        const urlObject = new URL(url);
        const pathParts = urlObject.pathname.split("/").filter(Boolean);
        const lastPart = pathParts[pathParts.length - 1];

        return lastPart || null;
    } catch {
        return null;
    }
};

/**
 * Multipart/form-data upload handler (Web API Fetch version).
 * @example
 * ```ts
 * const multipart = new MultipartFetch({
 *   storage,
 *   maxFileSize: 100 * 1024 * 1024, // 100MB
 * });
 *
 * // Use with Hono, Cloudflare Workers, etc.
 * app.all('/files/*', async (c) => {
 *   return multipart.fetch(c.req.raw);
 * });
 * ```
 */
class Multipart<TFile extends UploadFile> extends BaseHandlerFetch<TFile> {
    /**
     * Limiting enabled http method handler
     */
    public static override readonly methods: Handlers[] = ["delete", "download", "get", "options", "post"];

    private readonly multipartBase: MultipartBase<TFile>;

    /**
     * Maximum file size allowed for multipart uploads
     */
    private maxFileSize: number;

    /**
     * Maximum header size allowed for multipart parser
     */
    private maxHeaderSize: number;

    public constructor(options: UploadOptions<TFile>) {
        super(options);

        // Set multipart parser options with defaults
        this.maxFileSize = options.maxFileSize ?? Math.min(this.storage.maxUploadSize, 1024 * 1024 * 1024);
        this.maxHeaderSize = options.maxHeaderSize ?? 64 * 1024; // 64KB default

        // Create MultipartBase instance with access to this MultipartFetch instance
        const multipartInstance = this;

        this.multipartBase = new class extends MultipartBase<TFile> {
            protected get storage() {
                return multipartInstance.storage;
            }

            protected get maxFileSize() {
                return multipartInstance.maxFileSize;
            }

            protected get maxHeaderSize() {
                return multipartInstance.maxHeaderSize;
            }

            protected buildFileUrl(requestUrl: string, file: TFile): string {
                return multipartInstance.buildFileUrl({ url: requestUrl } as Request, file);
            }

            protected createStreamFromBytes(bytes: unknown): unknown {
                // For Fetch API, convert to Node.js Readable stream for storage.write
                // storage.write expects a Node.js Readable stream, not Uint8Array
                const { Readable } = require("node:stream");
                
                if (bytes instanceof Uint8Array) {
                    return Readable.from(Buffer.from(bytes));
                }

                if (bytes instanceof ArrayBuffer) {
                    return Readable.from(Buffer.from(bytes));
                }

                // For other types, convert to empty stream
                return Readable.from(new Uint8Array(0));
            }

            protected createEmptyStream(): unknown {
                // Return Node.js Readable stream, not Uint8Array
                const { Readable } = require("node:stream");
                return Readable.from(new Uint8Array(0));
            }
        }();
    }

    /**
     * Compose and register HTTP method handlers.
     */
    protected compose(): void {
        this.registeredHandlers.set("POST", this.post.bind(this));
        this.registeredHandlers.set("DELETE", this.delete.bind(this));
        this.registeredHandlers.set("GET", this.get.bind(this));
        this.registeredHandlers.set("OPTIONS", this.options.bind(this));

        this.logger?.debug("Registered handler: %s", [...this.registeredHandlers.keys()].join(", "));
    }

    /**
     * Handles multipart/form-data POST requests for file uploads.
     * @param request Web API Request containing multipart data.
     * @returns Promise resolving to ResponseFile with upload result.
     */

    public async post(request: Request): Promise<ResponseFile<TFile>> {
        const contentType = request.headers.get("content-type") || "";

        if (!RE_MIME.test(contentType.split(";")[0])) {
            throw createHttpError(400, "Invalid content-type");
        }

        try {
            const parts: MultipartPart[] = [];

            // Parse multipart using web API with size limits
            for await (const part of parseMultipartRequest(request, {
                maxFileSize: this.maxFileSize,
                maxHeaderSize: this.maxHeaderSize,
            })) {
                parts.push(part);
            }

            // Find the file part and validate it
            const filePart = parts.find((part) => part.isFile);

            if (!filePart) {
                throw createHttpError(400, "No file found in multipart request");
            }

            const requestUrl = request.url;

            return this.multipartBase.handlePost(filePart, parts, requestUrl);
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
     * Delete an uploaded file.
     * @param request Web API Request with file ID
     * @returns Promise resolving to ResponseFile with deletion result
     */
    public async delete(request: Request): Promise<ResponseFile<TFile>> {
        const id = getIdFromRequestUrl(request.url);

        if (!id) {
            throw createHttpError(404, "File not found");
        }

        try {
            return this.multipartBase.handleDelete(id);
        } catch (error: unknown) {
            const errorWithCode = error as { code?: string };

            if (errorWithCode.code === "ENOENT") {
                throw createHttpError(404, "File not found");
            }

            throw error;
        }
    }

    /**
     * Handle OPTIONS requests with CORS headers.
     * @param _request Web API Request (unused)
     * @returns Promise resolving to ResponseFile with CORS headers
     */
    public async options(_request: Request): Promise<ResponseFile<TFile>> {
        const child = this.constructor as typeof Multipart;

        return {
            headers: {
                "Access-Control-Allow-Methods": (child.methods || Multipart.methods).map((method) => method.toUpperCase()).join(", "),
            } as Record<string, string>,
            statusCode: 204,
        } as ResponseFile<TFile>;
    }

    /**
     * Retrieves a file or list of files based on the request path.
     * Delegates to BaseHandlerFetch.fetch() method.
     * @param request Web API Request
     * @returns Promise resolving to Web API Response
     */
    public async get(request: Request): Promise<ResponseFile<TFile>> {
        // For Fetch version, get is handled by the fetch() method
        // This method signature exists for consistency but shouldn't be called directly
        throw createHttpError(500, "GET requests should be handled via fetch() method");
    }
}

export default Multipart;
