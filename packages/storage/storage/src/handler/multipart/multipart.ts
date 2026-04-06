/* eslint-disable max-classes-per-file */
import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";

import type { MultipartPart } from "@remix-run/multipart-parser";
import { MaxFileSizeExceededError, MultipartParseError, parseMultipartRequest } from "@remix-run/multipart-parser/node";
// eslint-disable-next-line import/no-extraneous-dependencies
import createHttpError from "http-errors";

import type { UploadFile } from "../../storage/utils/file";
import { getIdFromRequest } from "../../utils/http";
import ValidationError from "../../utils/validation-error";
import BaseHandlerNode from "../base/base-handler-node";
import type { Handlers, ResponseFile, UploadOptions } from "../types";
import MultipartBase from "./multipart-base";

// eslint-disable-next-line sonarjs/anchor-precedence
const RE_MIME = /^multipart\/.+|application\/x-www-form-urlencoded$/i;

/**
 * Multipart/form-data upload handler (Node.js version).
 * @example
 * ```ts
 * const multipart = new Multipart({
 *   storage,
 *   maxFileSize: 100 * 1024 * 1024, // 100MB
 * });
 *
 * app.use('/files', multipart.handle);
 * ```
 */
class Multipart<
    TFile extends UploadFile,
    NodeRequest extends IncomingMessage = IncomingMessage,
    NodeResponse extends ServerResponse = ServerResponse,
> extends BaseHandlerNode<TFile, NodeRequest, NodeResponse> {
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

        // Create MultipartBase instance with access to this Multipart instance
        const multipartInstance = this;

        this.multipartBase = new (class extends MultipartBase<TFile> {
            // eslint-disable-next-line class-methods-use-this
            protected override get storage() {
                return multipartInstance.storage;
            }

            // eslint-disable-next-line class-methods-use-this
            protected override get maxFileSize() {
                return multipartInstance.maxFileSize;
            }

            // eslint-disable-next-line class-methods-use-this
            protected override get maxHeaderSize() {
                return multipartInstance.maxHeaderSize;
            }

            // eslint-disable-next-line class-methods-use-this
            protected override buildFileUrl(requestUrl: string, file: TFile): string {
                return multipartInstance.buildFileUrl({ url: requestUrl } as NodeRequest & { originalUrl?: string }, file);
            }

            // eslint-disable-next-line class-methods-use-this
            protected override createStreamFromBytes(bytes: unknown): unknown {
                if (bytes instanceof Uint8Array || Buffer.isBuffer(bytes)) {
                    return Readable.from(Buffer.from(bytes));
                }

                if (typeof bytes === "number") {
                    return Readable.from(Buffer.alloc(0));
                }

                return Readable.from(Buffer.from(String(bytes)));
            }

            // eslint-disable-next-line class-methods-use-this
            protected createEmptyStream(): unknown {
                return Readable.from(new Uint8Array(0));
            }
        })();
    }

    /**
     * Handles multipart/form-data POST requests for file uploads.
     * @param request Node.js IncomingMessage containing multipart data.
     * @returns Promise resolving to ResponseFile with upload result.
     */

    public async post(request: NodeRequest): Promise<ResponseFile<TFile>> {
        if (!RE_MIME.test(request.headers["content-type"]?.split(";")[0] ?? "")) {
            throw createHttpError(400, "Invalid content-type");
        }

        try {
            const parts: MultipartPart[] = [];

            // First, collect all parts with size limits
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

            const requestUrl = (request as NodeRequest & { originalUrl?: string }).originalUrl || (request.url as string);

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
     * @param request Node.js IncomingMessage with file ID
     * @returns Promise resolving to ResponseFile with deletion result
     */
    public async delete(request: NodeRequest): Promise<ResponseFile<TFile>> {
        try {
            const id = getIdFromRequest(request);

            return this.multipartBase.handleDelete(id);
        } catch (error: unknown) {
            this.checkForUndefinedIdOrPath(error);

            const errorWithCode = error as { code?: string };

            if (errorWithCode.code === "ENOENT") {
                throw createHttpError(404, "File not found");
            }

            throw error;
        }
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
}

export default Multipart;
