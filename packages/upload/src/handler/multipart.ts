import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";

import { MaxFileSizeExceededError, MultipartParseError, parseMultipartRequest } from "@mjackson/multipart-parser/node";
import createHttpError from "http-errors";

import type { FileInit, UploadFile } from "../storage/utils/file";
import { getIdFromRequest } from "../utils";
import BaseHandler from "./base-handler";
import type { Handlers, ResponseFile } from "./types";

const RE_MIME = /^multipart\/.+|application\/x-www-form-urlencoded$/i;

/**
 * Express wrapper
 *
 * - express ***should*** respond to the client when the upload complete and handle errors and GET requests
 * @example
 * ```ts
 * const multipart = new Multipart({ storage });
 *
 * app.use('/files', multipart.upload, (req, response, next) => {
 *   if (req.method === 'GET') return response.sendStatus(404);
 *   console.log('File upload complete: ', req.body.name);
 *   return response.sendStatus(200);
 * });
 * ```
 *
 * Basic express wrapper
 * @example
 * ```ts
 * const multipart = new Multipart({directory: '/tmp', maxUploadSize: '250GB'});
 *
 * app.use('/files', multipart.handle);
 * ```
 */
class Multipart<
    TFile extends UploadFile,
    Request extends IncomingMessage = IncomingMessage,
    Response extends ServerResponse = ServerResponse,
> extends BaseHandler<TFile, Request, Response> {
    /**
     * Limiting enabled http method handler
     * @example
     * ```ts
     * Multipart.methods = ['post', 'put', 'delete'];
     * app.use('/upload', new Multipart(opts).handle);
     * ```
     */
    public static override readonly methods: Handlers[] = ["delete", "get", "options", "post"];

    // eslint-disable-next-line sonarjs/cognitive-complexity
    public async post(request: Request): Promise<ResponseFile<TFile>> {
        if (!RE_MIME.test(request.headers["content-type"]?.split(";")[0] ?? "")) {
            throw createHttpError(400, "Invalid content-type");
        }

        try {
            const config: FileInit = { metadata: {}, size: 0 };

            for await (const part of parseMultipartRequest(request)) {
                if (part.isFile) {
                    // Handle file upload
                    config.size = part.size;
                    config.originalName = part.filename;
                    config.contentType = part.mediaType;

                    const file = await this.storage.create(request, config);

                    // Create a Readable stream from the Uint8Array
                    const stream = Readable.from(part.bytes);

                    await this.storage.write({
                        body: stream,
                        contentLength: part.size,
                        id: file.id,
                        start: 0,
                    });

                    // Wait for the file to be completed
                    const completedFile = await this.storage.write({
                        body: Readable.from(new Uint8Array(0)), // Empty buffer to signal completion
                        contentLength: 0,
                        id: file.id,
                        start: part.size,
                    });

                    if (completedFile.status === "completed") {
                        return {
                            ...completedFile,
                            headers: {
                                Location: this.buildFileUrl(request, completedFile),
                                ...completedFile.expiredAt === undefined ? {} : { "X-Upload-Expires": completedFile.expiredAt.toString() },
                                ...completedFile.ETag === undefined ? {} : { ETag: completedFile.ETag },
                            },
                            statusCode: 200,
                        };
                    }

                    return { ...completedFile, headers: {}, statusCode: 201 };
                }

                // Handle form field
                let data = {};

                if (part.name === "metadata" && part.text) {
                    try {
                        data = JSON.parse(part.text);
                    } catch {
                        // ignore
                    }
                } else if (part.name) {
                    data = { [part.name]: part.text };
                }

                Object.assign(config.metadata, data);
            }

            // If we reach here without processing a file, something went wrong
            throw createHttpError(400, "No file found in multipart request");
        } catch (error) {
            if (error instanceof MaxFileSizeExceededError) {
                throw createHttpError(413, "File size limit exceeded");
            }

            if (error instanceof MultipartParseError) {
                throw createHttpError(400, "Invalid multipart request");
            }

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

            return { ...file, headers: {}, statusCode: 204 } as ResponseFile<TFile>;
        } catch (error: any) {
            this.checkForUndefinedIdOrPath(error);

            if (error.code === "ENOENT") {
                throw createHttpError(404, "File not found");
            }

            throw error;
        }
    }

    // eslint-disable-next-line class-methods-use-this
    private checkForUndefinedIdOrPath(error: any): void {
        if (["Id is undefined", "Path is undefined"].includes(error.message)) {
            throw createHttpError(404, "File not found");
        }
    }
}

export default Multipart;
