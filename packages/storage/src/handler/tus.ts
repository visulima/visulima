/**
 * @packageDocumentation
 * TUS resumable upload handler implementing creation, chunked PATCH, HEAD,
 * GET metadata, and DELETE with protocol headers and checksum support.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { format } from "node:url";

import createHttpError from "http-errors";
// eslint-disable-next-line import/no-extraneous-dependencies
import typeis from "type-is";

import type { Checksum, FileInit, UploadFile } from "../storage/utils/file";
import { Metadata } from "../storage/utils/file";
import type { Headers, UploadResponse } from "../utils";
import { getBaseUrl, getHeader, getIdFromRequest, getRequestStream } from "../utils";
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
     *  A successful response indicated by the 204 No Content status MUST contain
     *  the Tus-Version header. It MAY include the Tus-Extension and Tus-Max-Size headers.
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
     * Create a file and send url to client
     */
    public async post(request: NodeRequest): Promise<ResponseFile<TFile>> {
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
        const config: FileInit = { metadata };

        config.size = uploadLength;

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

        headers = { ...headers, ...this.buildHeaders(file, { Location: this.buildFileUrl(request, file) }) };

        if (file.bytesWritten > 0) {
            headers["Upload-Offset"] = file.bytesWritten.toString();
        }

        const statusCode = file.bytesWritten > 0 ? 200 : 201;

        return { ...file, headers: headers as Record<string, string | number>, statusCode };
    }

    /**
     * Write a chunk to file
     */
    public async patch(request: NodeRequest): Promise<ResponseFile<TFile>> {
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

            // Handle expiration errors (but not "Id is undefined" which should be 404)
            if (error.UploadErrorCode === "GONE" || error.UploadErrorCode === "FILE_NOT_FOUND") {
                throw createHttpError(410, "Upload expired");
            }

            // Handle "Id is undefined" as 404
            if (error.message === "Id is undefined") {
                throw createHttpError(404, "File not found");
            }

            throw error;
        }
    }

    /**
     * Get file metadata
     */
    public override async get(request: NodeRequest): Promise<ResponseFile<TFile>> {
        try {
            const id = getIdFromRequest(request);

            const file = await this.storage.getMeta(id);

            return {
                ...file,
                body: file, // Return file metadata as JSON
                headers: this.buildHeaders(file, {
                    "Content-Type": "application/json",
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
     * Return chunk offset
     */
    public async head(request: NodeRequest): Promise<ResponseFile<TFile>> {
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
                    "Cache-Control": "no-store",
                    "Upload-Metadata": serializeMetadata(file.metadata),
                    // The Server MUST always include the Upload-Offset header in
                    // the response for a HEAD request, even if the offset is 0
                    "Upload-Offset": file.bytesWritten,
                }),
            };

            return { headers: headers as Record<string, string>, statusCode: 200 } as ResponseFile<TFile>;
        } catch (error: any) {
            this.checkForUndefinedIdOrPath(error);

            // Handle expiration errors (but not "Id is undefined" which should be 404)
            if (error.UploadErrorCode === "GONE" || error.UploadErrorCode === "FILE_NOT_FOUND") {
                throw createHttpError(410, "Upload expired");
            }

            // Handle "Id is undefined" as 404
            if (error.message === "Id is undefined") {
                throw createHttpError(404, "File not found");
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

    // eslint-disable-next-line class-methods-use-this
    private extractChecksum(request: NodeRequest): Checksum {
        const [checksumAlgorithm, checksum] = getHeader(request, "upload-checksum").split(/\s+/).filter(Boolean);

        return { checksum, checksumAlgorithm };
    }

    private buildHeaders(file: UploadFile, headers: Headers = {}): Headers {
        // All TUS responses must include Tus-Resumable header
        headers["Tus-Resumable"] = TUS_RESUMABLE_VERSION;

        if (this.storage.tusExtension.includes("expiration") && file.expiredAt !== undefined) {
            // eslint-disable-next-line no-param-reassign
            headers["Upload-Expires"] = new Date(file.expiredAt).toUTCString();
        }

        return headers;
    }

    protected override buildFileUrl(request: NodeRequest & { originalUrl?: string }, file: TFile): string {
        const url = new URL(request.originalUrl || (request.url as string), "http://localhost");
        const { pathname } = url;
        const query = Object.fromEntries(url.searchParams.entries());
        const relative = format({ pathname: `${pathname}/${file.id}`, query });

        return `${this.storage.config.useRelativeLocation ? relative : getBaseUrl(request) + relative}`;
    }

    // eslint-disable-next-line class-methods-use-this
    private checkForUndefinedIdOrPath(error: any): void {
        if (["Id is undefined", "Path is undefined"].includes(error.message)) {
            throw createHttpError(404, "File not found");
        }
    }
}

export const TUS_RESUMABLE = TUS_RESUMABLE_VERSION;
export const TUS_VERSION = TUS_VERSION_VERSION;

export const serializeMetadata = (object: Metadata): string =>
    Object.entries(object)
        .map(([key, value]) => {
            if (value === undefined) {
                return key;
            }

            return `${key} ${Buffer.from(String(value)).toString("base64")}`;
        })
        .toString();

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
