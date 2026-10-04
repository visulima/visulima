import { Readable } from "node:stream";

import createHttpError from "http-errors";

import type { UploadFile } from "../../storage/utils/file";
import { getIdFromRequestUrl, getRequestStream } from "../../utils/http";
import BaseHandlerFetch from "../base/base-handler-fetch";
import type { Handlers, ResponseFile, UploadOptions } from "../types";
import type { TusRequest } from "./tus-base";
import { TUS_RESUMABLE, TusBase } from "./tus-base";
import { resolveMethodOverride } from "./tus-protocol";

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

    private readonly allowMethodOverride: boolean;

    private readonly tusBase: TusBase<TFile>;

    public constructor(options: UploadOptions<TFile>) {
        super(options);
        this.disableTerminationForFinishedUploads = options.disableTerminationForFinishedUploads ?? false;
        this.allowMethodOverride = options.allowMethodOverride ?? true;
        this.tusBase = new TusBase<TFile>({
            buildFileUrl: (requestUrl, file) => this.buildFileUrlForTus(requestUrl, file),
            disableTerminationForFinishedUploads: () => this.disableTerminationForFinishedUploads ?? false,
            maxChecksumBufferSize: options.maxChecksumBufferSize,
            storage: () => this.storage,
        });
    }

    /**
     * Web API fetch entrypoint. Wraps the base implementation to ensure every TUS
     * response — success and error alike — carries the `Tus-Resumable` header,
     * which the protocol requires on all responses.
     * @param request Web API Request
     * @returns Web API Response
     */
    public override async fetch(request: Request): Promise<globalThis.Response> {
        const response = await super.fetch(request);

        if (response.headers.has("Tus-Resumable")) {
            return response;
        }

        const headers = new Headers(response.headers);

        headers.set("Tus-Resumable", TUS_RESUMABLE);
        headers.append("Access-Control-Expose-Headers", "tus-resumable");

        return new Response(response.body, {
            headers,
            status: response.status,
            statusText: response.statusText,
        });
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
        return this.tusBase.handlePost(Tus.toTusRequest(request));
    }

    /**
     * Write a chunk of data to an existing TUS upload.
     * @param request Web API Request with chunk data and TUS headers
     * @returns Promise resolving to ResponseFile with updated offset
     */
    public async patch(request: Request): Promise<ResponseFile<TFile>> {
        return this.tusBase.handlePatch(Tus.toTusRequest(request));
    }

    /**
     * Get current upload offset and metadata for TUS resumable uploads.
     * @param request Web API Request with upload ID
     * @returns Promise resolving to ResponseFile with upload-offset and metadata headers
     */
    public async head(request: Request): Promise<ResponseFile<TFile>> {
        return this.tusBase.handleHead(Tus.toTusRequest(request));
    }

    /**
     * Get TUS upload metadata and current status.
     * @param request Web API Request with upload ID
     * @returns Promise resolving to ResponseFile with file metadata as JSON
     */
    public override async get(request: Request): Promise<ResponseFile<TFile>> {
        return this.tusBase.handleGet(Tus.toTusRequest(request));
    }

    /**
     * Delete a TUS upload and its associated data.
     * @param request Web API Request with upload ID
     * @returns Promise resolving to ResponseFile with deletion confirmation
     */
    public async delete(request: Request): Promise<ResponseFile<TFile>> {
        return this.tusBase.handleDelete(Tus.toTusRequest(request));
    }

    /**
     * TUS core: X-HTTP-Method-Override "MUST be interpreted as the request's method by the
     * Server, if the header is presented. The actual method of the request MUST be ignored."
     * @param request Web API Request
     * @returns The request with the overridden method
     */
    protected override normalizeRequest(request: Request): Request {
        const override = this.allowMethodOverride ? resolveMethodOverride(request.headers.get("x-http-method-override") ?? undefined) : undefined;

        if (override === undefined || override === request.method) {
            return request;
        }

        const hasBody = override !== "GET" && override !== "HEAD";

        return new Request(request.url, {
            body: hasBody ? request.body : null,
            headers: request.headers,
            method: override,
            signal: request.signal,
            ...(hasBody && request.body ? { duplex: "half" } : {}),
        });
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

    /**
     * Adapts a Web API request to the runtime-independent {@link TusRequest}.
     * @param request Web API Request
     * @returns TUS request
     */
    private static toTusRequest(request: Request): TusRequest {
        let body: Readable | undefined;

        return {
            // Storages read Node streams; an empty PATCH (finishing a deferred upload) has no body at all.
            get body() {
                body ??= request.body ? getRequestStream(request) : Readable.from([]);

                return body;
            },
            header: (name) => request.headers.get(name) ?? undefined,
            resolveId: () => {
                const id = getIdFromRequestUrl(request.url);

                if (!id) {
                    throw createHttpError(404, "File not found");
                }

                return id;
            },
            url: request.url,
        };
    }
}
