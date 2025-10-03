import type { IncomingMessage, ServerResponse } from "node:http";

import createHttpError from "http-errors";
import typeis from "type-is";

import type { Checksum, FileInit, UploadFile } from "../storage/utils/file";
import { Metadata } from "../storage/utils/file";
import type { Headers, UploadResponse } from "../utils";
import { getHeader, getIdFromRequest } from "../utils";
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
class Tus<TFile extends UploadFile, Request extends IncomingMessage = IncomingMessage, Response extends ServerResponse = ServerResponse> extends BaseHandler<
    TFile,
    Request,
    Response
> {
    /**
     * Limiting enabled http method handler
     * @example
     * ```ts
     * Tus.methods = ['post', 'put', 'delete'];
     * app.use('/upload', new Tus(opts).handle);
     * ```
     */
    public static override methods: Handlers[] = ["delete", "get", "head", "options", "patch", "post"];

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
            "Tus-Checksum-Algorithm": this.storage.checksumTypes.toString(),
            "Tus-Extension": this.storage.tusExtension.toString(),
            "Tus-Max-Size": this.storage.maxUploadSize,
            "Tus-Version": TUS_VERSION_VERSION,
        };

        return { headers: headers as Record<string, string | number>, statusCode: 204 } as ResponseFile<TFile>;
    }

    /**
     * Create a file and send url to client
     */
    public async post(request: Request): Promise<ResponseFile<TFile>> {
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
                body: request,
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
            headers["Upload-Offset"] = file.bytesWritten;
        }

        const statusCode = file.bytesWritten > 0 ? 200 : 201;

        return { ...file, headers: headers as Record<string, string | number>, statusCode };
    }

    /**
     * Write a chunk to file
     */
    // eslint-disable-next-line radar/cognitive-complexity
    public async patch(request: Request): Promise<ResponseFile<TFile>> {
        try {
            const id = getIdFromRequest(request);

            const metadataHeader = getHeader(request, "upload-metadata", true);
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            const metadata = metadataHeader && parseMetadata(metadataHeader);

            if (metadata) {
                await this.storage.update({ id }, { id, metadata });
            }

            // The request MUST include a Upload-Offset header
            if (request.headers["upload-offset"] === undefined) {
                throw createHttpError(412, "Missing Upload-Offset header");
            }

            // The request MUST include a Content-Type header
            if (request.headers["content-type"] === undefined) {
                throw createHttpError(412, "Content-Type header required");
            }

            const start = Number.parseInt(getHeader(request, "upload-offset"), 10);
            const contentLength = Number(getHeader(request, "content-length"));
            const { checksum, checksumAlgorithm } = this.extractChecksum(request);

            let file = await this.storage.write({
                body: request,
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

            throw error;
        }
    }

    /**
     * Return chunk offset
     */
    public async head(request: Request): Promise<ResponseFile<TFile>> {
        try {
            const id = getIdFromRequest(request);

            const file = await this.storage.getMeta(id);

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
                    // eslint-disable-next-line @typescript-eslint/no-use-before-define
                    "Upload-Metadata": serializeMetadata(file.metadata),
                    // The Server MUST always include the Upload-Offset header in
                    // the response for a HEAD request, even if the offset is 0
                    "Upload-Offset": file.bytesWritten,
                }),
            };

            return { headers: headers as Record<string, string>, statusCode: 200 } as ResponseFile<TFile>;
        } catch (error: any) {
            this.checkForUndefinedIdOrPath(error);

            throw error;
        }
    }

    /**
     * Delete upload
     */
    public async delete(request: Request): Promise<ResponseFile<TFile>> {
        try {
            const id = getIdFromRequest(request);

            const file = await this.storage.delete({ id });

            if (file.status === undefined) {
                
                throw createHttpError(404, "File not found");
            }

            return {
                ...file,
                headers: {} as Record<string, string>,
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

    public override send(response: Response, { body = "", headers = {}, statusCode = 200 }: UploadResponse): void {
        super.send(response, {
            body,
            headers: {
                ...headers,
                "Tus-Resumable": TUS_RESUMABLE_VERSION,
            },
            statusCode,
        });
    }

    // eslint-disable-next-line class-methods-use-this
    private extractChecksum(request: Request): Checksum {
        const [checksumAlgorithm, checksum] = getHeader(request, "upload-checksum").split(/\s+/).filter(Boolean);

        return { checksum, checksumAlgorithm };
    }

    private buildHeaders(file: UploadFile, headers: Headers = {}): Headers {
        if (this.storage.tusExtension.includes("expiration") && file.expiredAt !== undefined) {
            // eslint-disable-next-line no-param-reassign
            headers["Upload-Expires"] = new Date(file.expiredAt).toUTCString();
        }

        return headers;
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

export const serializeMetadata = (object: Metadata): string => Object.entries(object)
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

export default Tus;
