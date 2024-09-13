import type { IncomingMessage, ServerResponse } from "node:http";

import createHttpError from "http-errors";
import multiparty from "multiparty";

import type { FileInit, UploadFile } from "../storage/utils/file";
import { getIdFromRequest } from "../utils";
import BaseHandler from "./base-handler";
import type { Handlers, ResponseFile } from "./types.d";

const RE_MIME = /^multipart\/.+|application\/x-www-form-urlencoded$/i;

interface MultipartyPart extends multiparty.Part {
    headers: {
        [key: string]: any;
        // eslint-disable-next-line radar/no-duplicate-string
        "content-type": string;
    };
}

/**
 * Express wrapper
 *
 * - express ***should*** respond to the client when the upload complete and handle errors and GET requests
 *
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
    public static override methods: Handlers[] = ["delete", "get", "options", "post"];

    // eslint-disable-next-line radar/cognitive-complexity
    public async post(request: Request): Promise<ResponseFile<TFile>> {
        if (!RE_MIME.test(request.headers["content-type"]?.split(";")[0] ?? "")) {
            throw createHttpError(400, "Invalid content-type");
        }

        // eslint-disable-next-line compat/compat
        return new Promise((resolve, reject) => {
            const form = new multiparty.Form();

            const config: FileInit = { metadata: {}, size: 0 };

            form.on("field", (key, value) => {
                let data = {};

                if (key === "metadata" && typeof value === "string") {
                    try {
                        data = JSON.parse(value);
                    } catch {
                        // ignore
                    }
                } else {
                    data = { [key]: value };
                }

                Object.assign(config.metadata, data);
            });

            form.on("error", async (error) => {
                if (typeof error !== "object") {
                    return;
                }

                try {
                    const file = await this.storage.create(request, config);

                    await this.storage.delete({ id: file.id });
                } catch (storageError: any) {
                    reject(storageError);
                }

                reject(error);
            });

            form.on("part", (part: MultipartyPart) => {
                config.size = part.byteCount;
                config.originalName = part.filename;
                config.contentType = part.headers["content-type"];

                part.on("error", () => null);

                this.storage
                    .create(request, config)
                    .then(({ id }) =>
                        this.storage.write({
                            body: part,
                            contentLength: part.byteCount,
                            id,
                            start: 0,
                        }),
                    )
                    .then((file) => {
                        if (file.status === "completed") {
                            return resolve({
                                ...file,
                                headers: {
                                    Location: this.buildFileUrl(request, file),
                                    ...(file.expiredAt === undefined ? {} : { "X-Upload-Expires": file.expiredAt.toString() }),
                                    ...(file.ETag === undefined ? {} : { ETag: file.ETag }),
                                },
                                statusCode: 200,
                            });
                        }

                        return resolve({ ...file, headers: {}, statusCode: 201 });
                    })
                    .catch((error) => reject(error));
            });

            form.parse(request);
        });
    }

    /**
     * Delete upload
     */
    public async delete(request: Request): Promise<ResponseFile<TFile>> {
        try {
            const id = getIdFromRequest(request);

            const file = await this.storage.delete({ id });

            if (file.status === undefined) {
                // eslint-disable-next-line radar/no-duplicate-string
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
