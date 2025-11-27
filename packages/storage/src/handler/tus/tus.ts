/* eslint-disable max-classes-per-file */
import type { IncomingMessage, ServerResponse } from "node:http";
import { format } from "node:url";

// eslint-disable-next-line import/no-extraneous-dependencies
import createHttpError from "http-errors";

import type { FileInit, UploadFile } from "../../storage/utils/file";
import { getBaseUrl, getHeader, getIdFromRequest, getRequestStream } from "../../utils/http";
import type { ResponseBody, UploadResponse } from "../../utils/types";
import BaseHandlerNode from "../base/base-handler-node";
import type { Handlers, ResponseFile, UploadOptions } from "../types";
import { TusBase } from "./tus-base";

export { TUS_RESUMABLE, TUS_VERSION } from "./tus-base";

/**
 * TUS resumable upload protocol handler (Node.js version).
 *
 * [tus resumable upload protocol](https://github.com/tus/tus-resumable-upload-protocol/blob/master/protocol.md)
 * @example
 * ```ts
 * const tus = new Tus({storage});
 *
 * app.all('/files', tus.handle);
 * ```
 */
export class Tus<
    TFile extends UploadFile,
    NodeRequest extends IncomingMessage = IncomingMessage,
    NodeResponse extends ServerResponse = ServerResponse,
> extends BaseHandlerNode<TFile, NodeRequest, NodeResponse> {
    /**
     * Limiting enabled http method handler
     */
    public static override readonly methods: Handlers[] = ["delete", "download", "get", "head", "options", "patch", "post"];

    public override disableTerminationForFinishedUploads = false;

    private readonly tusBase: TusBase<TFile>;

    public constructor(options: UploadOptions<TFile>) {
        super(options);
        this.disableTerminationForFinishedUploads = options.disableTerminationForFinishedUploads ?? false;
        // Create TusBase instance with access to this Tus instance
        const tusInstance = this;

        this.tusBase = new class extends TusBase<TFile> {
            // eslint-disable-next-line class-methods-use-this
            protected override get storage() {
                return tusInstance.storage as unknown as {
                    checkIfExpired: (file: TFile) => Promise<void>;
                    checksumTypes: string[];
                    config: { useRelativeLocation?: boolean };
                    create: (config: FileInit) => Promise<TFile>;
                    delete: (options: { id: string }) => Promise<TFile>;
                    getMeta: (id: string) => Promise<TFile>;
                    maxUploadSize: number;
                    tusExtension: string[];
                    update: (options: { id: string }, updates: { id?: string; metadata?: Record<string, unknown>; size?: number }) => Promise<TFile>;
                    write: (options: { body: unknown; checksum?: string; checksumAlgorithm?: string; contentLength: number; id: string; start: number }) => Promise<TFile>;
                };
            }

            // eslint-disable-next-line class-methods-use-this
            protected override get disableTerminationForFinishedUploads() {
                return tusInstance.disableTerminationForFinishedUploads;
            }

            // eslint-disable-next-line class-methods-use-this
            protected override buildFileUrl(requestUrl: string, file: TFile): string {
                return tusInstance.buildFileUrlForTus(requestUrl, file);
            }
        }();
    }

    /**
     * Handle OPTIONS requests with TUS protocol capabilities.
     * @returns Promise resolving to ResponseFile with TUS headers
     */
    public override async options(): Promise<ResponseFile<TFile>> {
        return this.tusBase.handleOptions(Tus.methods);
    }

    /**
     * Creates a new TUS upload and optionally starts uploading data.
     * @param request Node.js IncomingMessage with TUS headers.
     * @returns Promise resolving to ResponseFile with upload location and offset.
     */
    public async post(request: NodeRequest): Promise<ResponseFile<TFile>> {
        this.tusBase.validateTusResumableHeader(getHeader(request, "tus-resumable"));

        const uploadLength = request.headers["upload-length"] as string | undefined;
        const uploadDeferLength = request.headers["upload-defer-length"] as string | undefined;
        const uploadConcat = request.headers["upload-concat"] as string | undefined;
        const metadataHeader = getHeader(request, "upload-metadata", true);
        const contentType = getHeader(request, "content-type") || "";
        const contentLength = Number.parseInt(getHeader(request, "content-length") || "0", 10);
        const requestUrl = (request as NodeRequest & { originalUrl?: string }).originalUrl || (request.url as string);
        const bodyStream = getRequestStream(request);

        return this.tusBase.handlePost(uploadLength, uploadDeferLength, uploadConcat, metadataHeader, requestUrl, bodyStream, contentLength, contentType);
    }

    /**
     * Write a chunk of data to an existing TUS upload.
     * @param request Node.js IncomingMessage with chunk data and TUS headers
     * @returns Promise resolving to ResponseFile with updated offset
     */
    public async patch(request: NodeRequest): Promise<ResponseFile<TFile>> {
        this.tusBase.validateTusResumableHeader(getHeader(request, "tus-resumable"));

        try {
            const id = getIdFromRequest(request);

            // Validate required headers
            if (request.headers["upload-offset"] === undefined) {
                throw createHttpError(412, "Missing Upload-Offset header");
            }

            if (request.headers["content-type"] === undefined) {
                throw createHttpError(412, "Content-Type header required");
            }

            if (request.headers["content-type"] !== "application/offset+octet-stream") {
                throw createHttpError(415, "Unsupported Media Type");
            }

            const uploadOffset = Number.parseInt(getHeader(request, "upload-offset"), 10);
            const uploadLength = request.headers["upload-length"] as string | undefined;
            const metadataHeader = getHeader(request, "upload-metadata", true);
            const contentLength = Number(getHeader(request, "content-length"));
            const checksumHeader = getHeader(request, "upload-checksum");
            const { checksum, checksumAlgorithm } = this.tusBase.extractChecksum(checksumHeader);
            const requestUrl = (request as NodeRequest & { originalUrl?: string }).originalUrl || (request.url as string);
            const bodyStream = getRequestStream(request);

            return this.tusBase.handlePatch(id, uploadOffset, uploadLength, metadataHeader, checksum, checksumAlgorithm, requestUrl, bodyStream, contentLength);
        } catch (error: unknown) {
            this.checkForUndefinedIdOrPath(error);

            const errorWithCode = error as { UploadErrorCode?: string };

            if (errorWithCode.UploadErrorCode === "GONE" || errorWithCode.UploadErrorCode === "FILE_NOT_FOUND") {
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
        this.tusBase.validateTusResumableHeader(getHeader(request, "tus-resumable"));

        try {
            const id = getIdFromRequest(request);

            return this.tusBase.handleHead(id);
        } catch (error: unknown) {
            this.checkForUndefinedIdOrPath(error);

            const errorWithCode = error as { UploadErrorCode?: string };

            if (errorWithCode.UploadErrorCode === "GONE" || errorWithCode.UploadErrorCode === "FILE_NOT_FOUND") {
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
        this.tusBase.validateTusResumableHeader(getHeader(request, "tus-resumable"));

        try {
            const id = getIdFromRequest(request);

            return this.tusBase.handleGet(id);
        } catch (error: unknown) {
            this.checkForUndefinedIdOrPath(error);

            const errorWithCode = error as { UploadErrorCode?: string };

            if (errorWithCode.UploadErrorCode === "GONE") {
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
        this.tusBase.validateTusResumableHeader(getHeader(request, "tus-resumable"));

        try {
            const id = getIdFromRequest(request);

            return this.tusBase.handleDelete(id);
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
     * Send TUS protocol response with required headers.
     * @param response Node.js ServerResponse to send response to
     * @param uploadResponse Response data with body, headers, and status code
     */
    public override send(
        response: NodeResponse,
        { body = "", headers = {}, statusCode = 200 }: { body?: unknown; headers?: Record<string, string | number>; statusCode?: number },
    ): void {
        const uploadResponse: UploadResponse = {
            body: body as ResponseBody | undefined,
            headers: {
                ...headers,
                "Access-Control-Expose-Headers":
                    "location,upload-expires,upload-offset,upload-length,upload-metadata,upload-defer-length,tus-resumable,tus-extension,tus-max-size,tus-version,tus-checksum-algorithm,cache-control",
                "Tus-Resumable": "1.0.0",
            },
            statusCode: statusCode || 200,
        };

        super.send(response, uploadResponse);
    }

    /**
     * Compose and register HTTP method handlers.
     */
    protected compose(): void {
        this.registeredHandlers.set("POST", this.post.bind(this));
        this.registeredHandlers.set("PATCH", this.patch.bind(this));
        this.registeredHandlers.set("HEAD", this.head.bind(this));
        this.registeredHandlers.set("GET", this.get.bind(this));
        this.registeredHandlers.set("DELETE", this.delete.bind(this));
        this.registeredHandlers.set("OPTIONS", this.options.bind(this));

        this.logger?.debug("Registered handler: %s", [...this.registeredHandlers.keys()].join(", "));
    }

    /**
     * Build file URL for TUS uploads (without file extension).
     * @param requestUrl Request URL string
     * @param file File object containing ID
     * @returns Constructed file URL for TUS protocol
     */
    protected buildFileUrlForTus(requestUrl: string, file: TFile): string {
        const url = new URL(requestUrl, "http://localhost");
        const { pathname } = url;
        const query = Object.fromEntries(url.searchParams.entries());
        const relative = format({ pathname: `${pathname}/${file.id}`, query });

        return `${this.storage.config.useRelativeLocation ? relative : getBaseUrl({ url: requestUrl } as NodeRequest) + relative}`;
    }
}
