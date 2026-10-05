import type { IncomingMessage, ServerResponse } from "node:http";

import {
    MaxFileSizeExceededError,
    MaxPartsExceededError,
    MaxTotalSizeExceededError,
    MultipartParseError,
    parseMultipartRequest,
} from "@remix-run/multipart-parser/node";
import createHttpError from "http-errors";

import type { UploadFile } from "../../storage/utils/file";
import { getIdFromRequest } from "../../utils/http";
import ValidationError from "../../utils/validation-error";
import BaseHandlerNode from "../base/base-handler-node";
import type { Handlers, ResponseFile, UploadOptions } from "../types";
import MultipartBase, { collectParts, multipartLimits } from "./multipart-base";

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
    public static override readonly methods: Handlers[] = ["delete", "get", "options", "post"];

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

        this.multipartBase = new MultipartBase<TFile>({
            buildFileUrl: (source, file) => this.buildFileUrlFromString(source.url, file, source),
            storage: () => this.storage,
        });
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
            const { filePart, parts } = await collectParts(parseMultipartRequest(request, multipartLimits(this.maxFileSize, this.maxHeaderSize)));

            return this.multipartBase.handlePost(filePart, parts, this.locationOf(request));
        } catch (error) {
            if (error instanceof MaxFileSizeExceededError || error instanceof MaxTotalSizeExceededError || error instanceof MaxPartsExceededError) {
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

            // Awaited, so the catch below maps its errors.
            return await this.multipartBase.handleDelete(id);
        } catch (error: unknown) {
            this.checkForUndefinedIdOrPath(error);

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
