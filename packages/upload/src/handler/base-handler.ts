import { EventEmitter } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";
import { format, parse } from "node:url";

import { paginate } from "@visulima/pagination";
import createHttpError, { isHttpError } from "http-errors";
import mime from "mime";

import type BaseStorage from "../storage/storage";
import type { UploadFile } from "../storage/utils/file";
import type { ErrorResponses, HttpError, IncomingMessageWithBody, Logger, ResponseBodyType,     UploadError,UploadResponse } from "../utils";
import {
    ErrorMap,
    ERRORS,
    filePathUrlMatcher,
    getBaseUrl,
    getRealPath,
    isUploadError,
    isValidationError,
    pick,
    setHeaders,
    uuidRegex,
} from "../utils";
import type { AsyncHandler, Handlers, MethodHandler, ResponseFile, ResponseList, UploadOptions } from "./types";

const CONTENT_TYPE = "Content-Type";

abstract class BaseHandler<TFile extends UploadFile, Request extends IncomingMessage = IncomingMessage, Response extends ServerResponse = ServerResponse>
    extends EventEmitter
    implements MethodHandler<Request, Response>
{
    /**
     * Limiting enabled http method handler
     * @example
     * ```ts
     * Upload.methods = ['post', 'put', 'delete'];
     * app.use('/upload', Upload(opts));
     * ```
     */
    public static methods: Handlers[] = ["delete", "get", "head", "options", "patch", "post", "put"];

    responseType: ResponseBodyType = "json";

    public storage: BaseStorage<TFile>;

    protected registeredHandlers = new Map<string, AsyncHandler>();

    protected logger?: Logger;

    protected internalErrorResponses = {} as ErrorResponses;

    constructor({ storage }: UploadOptions<TFile>) {
        super();

        this.storage = storage;
        this.logger = this.storage?.logger;

        this.assembleErrors();
        this.compose();
    }

    /**
     *  Override error responses
     *  @example
     * ```ts
     *  const Upload = new Upload({ storage });
     *  Upload.errorResponses = {
     *    FileNotFound: { message: 'Not Found!', statusCode: 404 },
     *  }
     * ```
     */
    public set errorResponses(value: Partial<ErrorResponses>) {
        this.assembleErrors(value);
    }

    protected compose = (): void => {
        const child = this.constructor as typeof BaseHandler;

        (child.methods || BaseHandler.methods).forEach((method) => {
            const handler = (this as MethodHandler<Request, Response>)[method];

            if (handler) {
                this.registeredHandlers.set(method.toUpperCase(), handler);
            }
        });

        this.logger?.debug("Registered handler: %s", [...this.registeredHandlers.keys()].join(", "));
    };

    protected assembleErrors = (customErrors = {}): void => {

        this.internalErrorResponses = {
            ...ErrorMap,

            ...this.internalErrorResponses,
            ...this.storage.errorResponses,
            ...customErrors,
        };
    };

    public handle = (request: Request, response: Response): void => this.upload(request, response);

    // eslint-disable-next-line radar/cognitive-complexity
    public upload = (request: Request, response: Response, next?: () => void): void => {
        request.on("error", (error) => this.logger?.error("[request error]: %O", error));

        this.logger?.debug("[request]: %s %s", request.method, request.url);

        const handler = this.registeredHandlers.get(request.method as string);

        if (!handler) {
            this.sendError(response, { UploadErrorCode: ERRORS.METHOD_NOT_ALLOWED } as UploadError);

            return;
        }

        if (!this.storage.isReady) {
            this.sendError(response, { UploadErrorCode: ERRORS.STORAGE_ERROR } as UploadError);

            return;
        }

        handler
            .call(this, request, response)
            .then(async (file: ResponseFile<TFile> | ResponseList<TFile>): Promise<void> => {
                // eslint-disable-next-line promise/always-return
                if (["HEAD", "OPTIONS"].includes(request.method as string)) {
                    const { headers, statusCode } = file as ResponseFile<TFile>;

                    this.send(response, { headers, statusCode });
                } else if (request.method === "GET") {
                    (request as IncomingMessageWithBody).body = (file as ResponseList<TFile>)?.data === undefined ? file : (file as ResponseList<TFile>).data;

                    const { headers, statusCode } = file as ResponseFile<TFile>;

                    let body: Buffer | ResponseList<TFile>["data"] | string = "";

                    if ((file as ResponseFile<TFile>).content !== undefined) {
                        body = (file as ResponseFile<TFile>).content as Buffer;
                    } else if (typeof file === "object" && "data" in file) {
                        body = (file).data;
                    }

                    if (typeof next === "function") {
                        // eslint-disable-next-line promise/no-callback-in-promise
                        next();
                    } else {
                        this.send(response, { body, headers, statusCode });
                    }
                } else {
                    const { headers, statusCode, ...basicFile } = file as ResponseFile<TFile>;

                    this.logger?.debug("[%s]: %s: %d/%d", basicFile.status, basicFile.name, basicFile.bytesWritten, basicFile.size);

                    if (basicFile.status !== undefined && this.listenerCount(basicFile.status) > 0) {
                        this.emit(basicFile.status, {
                            ...basicFile,
                            request: pick(request, ["headers", "method", "url"]),
                        });
                    }

                    if (basicFile.status === "completed") {
                        if (typeof next === "function") {
                            // eslint-disable-next-line no-underscore-dangle
                            (request as IncomingMessageWithBody)._body = true;
                            (request as IncomingMessageWithBody).body = basicFile;

                            // eslint-disable-next-line promise/no-callback-in-promise
                            next();
                        } else {
                            const completed = await this.storage.onComplete(file as TFile);

                            if (completed.headers === undefined) {
                                throw new TypeError("onComplete must return the key headers");
                            }

                            if (completed.statusCode === undefined) {
                                throw new TypeError("onComplete must return the key statusCode");
                            }

                            this.finish(request, response, completed);
                        }
                    } else {
                        this.send(response, {
                            headers: {
                                ...headers,
                                ...((file as TFile).hash === undefined
                                    ? {}
                                    : { [`X-Range-${(file as TFile).hash?.algorithm.toUpperCase()}`]: (file as TFile).hash?.value }),
                            } as Record<string, string>,
                            statusCode,
                        });
                    }
                }
            })
            .catch((error: Error) => {
                const uError = pick(error, ["name", ...(Object.getOwnPropertyNames(error) as (keyof Error)[])]) as UploadError;
                const errorEvent = { ...uError, request: pick(request, ["headers", "method", "url"]) };

                if (this.listenerCount("error") > 0) {
                    this.emit("error", errorEvent);
                }

                this.logger?.error("[error]: %O", errorEvent);

                if (request.aborted !== undefined && request.aborted) {
                    return;
                }

                // eslint-disable-next-line consistent-return
                return this.sendError(response, error);
            });
    };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public async options(_request: Request, _response: Response): Promise<ResponseFile<TFile>> {
        const child = this.constructor as typeof BaseHandler;

        return {
            headers: {
                "Access-Control-Allow-Methods": (child.methods || BaseHandler.methods).map((method) => method.toUpperCase()).join(", "),
            } as Record<string, string>,
            statusCode: 204,
        } as ResponseFile<TFile>;
    }

    /**
     * @param {Request} request
     * @param {Response}response
     *
     * @throws {UploadError}
     *
     * @returns {Promise<ResponseFile<TFile> | PaginationResult<TFile> | TFile[]>}
     */
    public async get(request: Request, response: Response): Promise<ResponseFile<TFile> | ResponseList<TFile>>;

    // eslint-disable-next-line radar/cognitive-complexity
    public async get(request: Request & { originalUrl?: string }, _response: Response): Promise<ResponseFile<TFile> | ResponseList<TFile>> {
        const pathMatch = filePathUrlMatcher(getRealPath(request));

        if (pathMatch && pathMatch.params.uuid && uuidRegex.test(pathMatch.params.uuid)) {
            const { ext, uuid } = pathMatch.params;

            try {
                const file = await this.storage.get({ id: uuid });

                let { contentType } = file;

                if (contentType.includes("image") && typeof ext === "string") {
                    contentType = mime.getType(ext) || contentType;
                }

                const { ETag, expiredAt, modifiedAt, size } = file;

                return {
                    headers: {
                        "Content-Length": String(size),
                        "Content-Type": contentType,
                        ...(expiredAt === undefined ? {} : { "X-Upload-Expires": expiredAt.toString() }),
                        ...(modifiedAt === undefined ? {} : { "Last-Modified": modifiedAt.toString() }),
                        ...(ETag === undefined ? {} : { ETag }),
                    } as Record<string, string>,
                    statusCode: 200,
                    ...file,
                    contentType,
                } as ResponseFile<TFile>;
            } catch (error: any) {
                if (error.code === "ENOENT") {
                    throw createHttpError(404, "File not found");
                }

                throw error;
            }
        }

        return this.list(request, _response);
    }

    /**
     * Returns user upload list
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public async list(request: Request, _response: Response): Promise<ResponseList<TFile>> {
        const { limit, page } = parse(request.url || "", true).query as Record<string, string>;

        const list = await this.storage.list(Number(limit || 1000));

        if (list.length === 0) {
            return {
                data: [],
                headers: {},
                statusCode: 200,
            };
        }

        if (page !== undefined && limit !== undefined) {
            return {
                data: paginate(Number(page), Number(limit), list.length, list),
                headers: {},
                statusCode: 200,
            };
        }

        return {
            data: list,
            headers: {},
            statusCode: 200,
        };
    }

    // eslint-disable-next-line class-methods-use-this
    public send(response: Response, { body = "", headers = {}, statusCode = 200 }: UploadResponse): void {
        let data: Buffer | string;

        if (typeof body === "string") {
            data = body;

            if (headers[CONTENT_TYPE] === undefined) {
                // eslint-disable-next-line no-param-reassign
                headers[CONTENT_TYPE] = "text/plain";
            }

            if (headers["Content-Length"] === undefined) {
                // eslint-disable-next-line no-param-reassign
                headers["Content-Length"] = Buffer.byteLength(body);
            }
        } else if (body instanceof Buffer) {
            data = body;
        } else {
            data = JSON.stringify(body);

            if (!headers[CONTENT_TYPE]) {
                // eslint-disable-next-line no-param-reassign
                headers[CONTENT_TYPE] = "application/json;charset=utf-8";
            }
        }

        setHeaders(response, headers);

        response.statusCode = statusCode;

        response.end(data);
    }

    /**
     * Send Error to client
     */
    public sendError(response: Response, error: Error): void {
        let httpError: HttpError;

        if (isUploadError(error)) {
            httpError = this.internalErrorResponses[error.UploadErrorCode] as HttpError;
        } else if (!isValidationError(error) && !isHttpError(error)) {
            httpError = this.storage.normalizeError(error);
        } else {
            httpError = error;
        }

        this.send(response, this.storage.onError(httpError));
    }

    /**
     * Build file url from request
     */
    protected buildFileUrl(request: Request & { originalUrl?: string }, file: TFile): string {
        const { pathname = "", query } = parse(request.originalUrl || (request.url as string), true);
        const relative = format({ pathname: `${pathname as string}/${file.id}`, query });

        return `${this.storage.config.useRelativeLocation ? relative : getBaseUrl(request) + relative}.${mime.getExtension(file.contentType)}`;
    }

    protected finish(_request: Request, response: Response, uploadResponse: UploadResponse): void {
        const { statusCode } = uploadResponse;

        let { body, headers } = uploadResponse;

        if ((body as TFile).content !== undefined) {
            const { content, contentType } = body as TFile;

            body = content;
            headers = {
                ...headers,
                "Content-Type": contentType,
            };
        }

        this.send(response, {
            body,
            headers,
            statusCode,
        });
    }
}

export default BaseHandler;
