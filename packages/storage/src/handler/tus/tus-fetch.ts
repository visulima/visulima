/* eslint-disable max-classes-per-file */
// eslint-disable-next-line import/no-extraneous-dependencies
import createHttpError from "http-errors";

import type { FileInit, UploadFile } from "../../storage/utils/file";
import BaseHandlerFetch from "../base/base-handler-fetch";
import type { Handlers, ResponseFile, UploadOptions } from "../types";
import { TusBase } from "./tus-base";

/**
 * Extract file ID from request URL.
 */
const getIdFromRequestUrl = (url: string): string | undefined => {
    try {
        const urlObject = new URL(url);
        const pathParts = urlObject.pathname.split("/").filter(Boolean);

        return pathParts[pathParts.length - 1] || undefined;
    } catch {
        return undefined;
    }
};

export { TUS_RESUMABLE, TUS_VERSION } from "./tus-base";

/**
 * TUS resumable upload protocol handler (Web API Fetch version).
 *
 * [tus resumable upload protocol](https://github.com/tus/tus-resumable-upload-protocol/blob/master/protocol.md)
 * @example
 * ```ts
 * const tus = new TusFetch({storage});
 *
 * // Use with Hono, Cloudflare Workers, etc.
 * app.all('/files/*', async (c) => {
 *   return tus.fetch(c.req.raw);
 * });
 * ```
 */
export class Tus<TFile extends UploadFile> extends BaseHandlerFetch<TFile> {
    /**
     * Limiting enabled http method handler
     */
    public static override readonly methods: Handlers[] = ["delete", "download", "get", "head", "options", "patch", "post"];

    private readonly tusBase: TusBase<TFile>;

    public constructor(options: UploadOptions<TFile>) {
        super(options);
        this.disableTerminationForFinishedUploads = options.disableTerminationForFinishedUploads ?? false;
        // Create TusBase instance with access to this TusFetch instance
        const tusInstance = this;

        this.tusBase = new class extends TusBase<TFile> {
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

            protected override get disableTerminationForFinishedUploads() {
                return tusInstance.disableTerminationForFinishedUploads;
            }

            protected override buildFileUrl(requestUrl: string, file: TFile): string {
                return tusInstance.buildFileUrlForTus(requestUrl, file);
            }
        }();
    }

    /**
     * Handle OPTIONS requests with TUS protocol capabilities.
     * @returns Promise resolving to ResponseFile with TUS headers
     */
    public async options(): Promise<ResponseFile<TFile>> {
        return this.tusBase.handleOptions(Tus.methods);
    }

    /**
     * Creates a new TUS upload and optionally starts uploading data.
     * @param request Web API Request with TUS headers.
     * @returns Promise resolving to ResponseFile with upload location and offset.
     */
    public async post(request: Request): Promise<ResponseFile<TFile>> {
        const tusResumable = request.headers.get("tus-resumable");

        this.tusBase.validateTusResumableHeader(tusResumable || undefined);

        const uploadLength = request.headers.get("upload-length") || undefined;
        const uploadDeferLength = request.headers.get("upload-defer-length") || undefined;
        const uploadConcat = request.headers.get("upload-concat") || undefined;
        const metadataHeader = request.headers.get("upload-metadata") || undefined;
        const contentType = request.headers.get("content-type") || "";
        const contentLengthHeader = request.headers.get("content-length");
        const contentLength = contentLengthHeader ? Number.parseInt(contentLengthHeader, 10) : 0;
        const requestUrl = request.url;
        const bodyStream = request.body;

        return this.tusBase.handlePost(uploadLength, uploadDeferLength, uploadConcat, metadataHeader, requestUrl, bodyStream, contentLength, contentType);
    }

    /**
     * Write a chunk of data to an existing TUS upload.
     * @param request Web API Request with chunk data and TUS headers
     * @returns Promise resolving to ResponseFile with updated offset
     */
    public async patch(request: Request): Promise<ResponseFile<TFile>> {
        const tusResumable = request.headers.get("tus-resumable");

        this.tusBase.validateTusResumableHeader(tusResumable || undefined);

        const id = getIdFromRequestUrl(request.url);

        if (!id) {
            throw createHttpError(404, "File not found");
        }

        // Validate required headers
        const uploadOffsetHeader = request.headers.get("upload-offset");

        if (!uploadOffsetHeader) {
            throw createHttpError(412, "Missing Upload-Offset header");
        }

        const contentType = request.headers.get("content-type");

        if (!contentType) {
            throw createHttpError(412, "Content-Type header required");
        }

        if (contentType !== "application/offset+octet-stream") {
            throw createHttpError(415, "Unsupported Media Type");
        }

        const uploadOffset = Number.parseInt(uploadOffsetHeader, 10);
        const uploadLength = request.headers.get("upload-length") || undefined;
        const metadataHeader = request.headers.get("upload-metadata") || undefined;
        const contentLengthHeader = request.headers.get("content-length");
        const contentLength = contentLengthHeader ? Number.parseInt(contentLengthHeader, 10) : 0;
        const checksumHeader = request.headers.get("upload-checksum") || undefined;
        const { checksum, checksumAlgorithm } = this.tusBase.extractChecksum(checksumHeader);
        const requestUrl = request.url;
        const bodyStream = request.body;

        try {
            return this.tusBase.handlePatch(id, uploadOffset, uploadLength, metadataHeader, checksum, checksumAlgorithm, requestUrl, bodyStream, contentLength);
        } catch (error: unknown) {
            const errorWithCode = error as { UploadErrorCode?: string };

            if (errorWithCode.UploadErrorCode === "GONE" || errorWithCode.UploadErrorCode === "FILE_NOT_FOUND") {
                throw createHttpError(410, "Upload expired");
            }

            throw error;
        }
    }

    /**
     * Get current upload offset and metadata for TUS resumable uploads.
     * @param request Web API Request with upload ID
     * @returns Promise resolving to ResponseFile with upload-offset and metadata headers
     */
    public async head(request: Request): Promise<ResponseFile<TFile>> {
        const tusResumable = request.headers.get("tus-resumable");

        this.tusBase.validateTusResumableHeader(tusResumable || undefined);

        const id = getIdFromRequestUrl(request.url);

        if (!id) {
            throw createHttpError(404, "File not found");
        }

        try {
            return this.tusBase.handleHead(id);
        } catch (error: unknown) {
            const errorWithCode = error as { UploadErrorCode?: string };

            if (errorWithCode.UploadErrorCode === "GONE" || errorWithCode.UploadErrorCode === "FILE_NOT_FOUND") {
                throw createHttpError(410, "Upload expired");
            }

            throw error;
        }
    }

    /**
     * Get TUS upload metadata and current status.
     * @param request Web API Request with upload ID
     * @returns Promise resolving to ResponseFile with file metadata as JSON
     */
    public async get(request: Request): Promise<ResponseFile<TFile>> {
        const tusResumable = request.headers.get("tus-resumable");

        this.tusBase.validateTusResumableHeader(tusResumable || undefined);

        const id = getIdFromRequestUrl(request.url);

        if (!id) {
            throw createHttpError(404, "File not found");
        }

        try {
            return this.tusBase.handleGet(id);
        } catch (error: unknown) {
            const errorWithCode = error as { UploadErrorCode?: string };

            if (errorWithCode.UploadErrorCode === "GONE") {
                throw createHttpError(410, "Upload expired");
            }

            throw error;
        }
    }

    /**
     * Delete a TUS upload and its associated data.
     * @param request Web API Request with upload ID
     * @returns Promise resolving to ResponseFile with deletion confirmation
     */
    public async delete(request: Request): Promise<ResponseFile<TFile>> {
        const tusResumable = request.headers.get("tus-resumable");

        this.tusBase.validateTusResumableHeader(tusResumable || undefined);

        const id = getIdFromRequestUrl(request.url);

        if (!id) {
            throw createHttpError(404, "File not found");
        }

        try {
            return this.tusBase.handleDelete(id);
        } catch (error: unknown) {
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
        const url = new URL(requestUrl);
        const { pathname, search } = url;
        const relative = `${pathname}/${file.id}${search}`;

        return this.storage.config.useRelativeLocation ? relative : url.origin + relative;
    }
}
