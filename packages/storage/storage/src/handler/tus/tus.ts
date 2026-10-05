import type { IncomingMessage, ServerResponse } from "node:http";
import { format } from "node:url";

import type { UploadFile } from "../../storage/utils/file";
import { getHeader, getIdFromRequest, getRequestStream } from "../../utils/http";
import type { UploadResponse } from "../../utils/types";
import type { LocationSource } from "../base/base-handler-core";
import BaseHandlerNode from "../base/base-handler-node";
import type { Handlers, ResponseFile, UploadOptions } from "../types";
import type { TusRequest } from "./tus-base";
import { TUS_RESUMABLE, TusBase } from "./tus-base";
import { resolveMethodOverride } from "./tus-protocol";

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
    public static override readonly methods: Handlers[] = ["delete", "get", "head", "options", "patch", "post"];

    public override disableTerminationForFinishedUploads = false;

    private readonly allowMethodOverride: boolean;

    private readonly tusBase: TusBase<TFile>;

    public constructor(options: UploadOptions<TFile>) {
        super(options);
        this.disableTerminationForFinishedUploads = options.disableTerminationForFinishedUploads ?? false;
        this.allowMethodOverride = options.allowMethodOverride ?? true;
        this.tusBase = new TusBase<TFile>({
            buildFileUrl: (request, file) => this.buildFileUrlForTus(request, file),
            disableTerminationForFinishedUploads: () => this.disableTerminationForFinishedUploads,
            maxChecksumBufferSize: options.maxChecksumBufferSize,
            storage: () => this.storage,
        });
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
        return this.tusBase.handlePost(this.toTusRequest(request));
    }

    /**
     * Write a chunk of data to an existing TUS upload.
     * @param request Node.js IncomingMessage with chunk data and TUS headers
     * @returns Promise resolving to ResponseFile with updated offset
     */
    public async patch(request: NodeRequest): Promise<ResponseFile<TFile>> {
        return this.tusBase.handlePatch(this.toTusRequest(request));
    }

    /**
     * Get current upload offset and metadata for TUS resumable uploads.
     * @param request Node.js IncomingMessage with upload ID
     * @returns Promise resolving to ResponseFile with upload-offset and metadata headers
     */
    public async head(request: NodeRequest): Promise<ResponseFile<TFile>> {
        return this.tusBase.handleHead(this.toTusRequest(request));
    }

    /**
     * Get TUS upload metadata and current status.
     * @param request Node.js IncomingMessage with upload ID
     * @returns Promise resolving to ResponseFile with file metadata as JSON
     */
    public override async get(request: NodeRequest): Promise<ResponseFile<TFile>> {
        return this.tusBase.handleGet(this.toTusRequest(request));
    }

    /**
     * Delete a TUS upload and its associated data.
     * @param request Node.js IncomingMessage with upload ID
     * @returns Promise resolving to ResponseFile with deletion confirmation
     */
    public async delete(request: NodeRequest): Promise<ResponseFile<TFile>> {
        return this.tusBase.handleDelete(this.toTusRequest(request));
    }

    /**
     * Send TUS protocol response with required headers.
     * @param response Node.js ServerResponse to send response to
     * @param uploadResponse Response data with body, headers, and status code
     */
    public override send(response: NodeResponse, { body = "", headers = {}, statusCode = 200 }: UploadResponse): void {
        const uploadResponse: UploadResponse = {
            body,
            headers: {
                ...headers,
                "Access-Control-Expose-Headers":
                    "location,upload-expires,upload-offset,upload-length,upload-metadata,upload-defer-length,upload-concat,tus-resumable,tus-extension,tus-max-size,tus-version,tus-checksum-algorithm,cache-control",
                "Tus-Resumable": TUS_RESUMABLE,
            },
            statusCode: statusCode || 200,
        };

        super.send(response, uploadResponse);
    }

    /**
     * TUS core: X-HTTP-Method-Override "MUST be interpreted as the request's method by the
     * Server, if the header is presented. The actual method of the request MUST be ignored."
     * @param request Node.js IncomingMessage
     */
    protected override normalizeRequest(request: NodeRequest): void {
        if (!this.allowMethodOverride) {
            return;
        }

        const override = resolveMethodOverride(getHeader(request, "x-http-method-override") || undefined);

        if (override !== undefined) {
            request.method = override;
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
     * @param request Request the upload was created by
     * @param file File object containing ID
     * @returns Constructed file URL for TUS protocol
     */
    protected buildFileUrlForTus(request: LocationSource, file: TFile): string {
        const url = new URL(request.url, "http://localhost");
        const query = Object.fromEntries(url.searchParams.entries());

        return this.locationOrigin(request.url, request) + format({ pathname: `${url.pathname}/${file.id}`, query });
    }

    /**
     * Adapts a Node.js request to the runtime-independent {@link TusRequest}.
     * @param request Node.js IncomingMessage
     * @returns TUS request
     */
    private toTusRequest(request: NodeRequest): TusRequest {
        return {
            ...this.locationOf(request),
            get body() {
                return getRequestStream(request);
            },
            header: (name) => {
                const value = request.headers[name];

                return Array.isArray(value) ? value.join(", ") : value;
            },
            resolveId: () => {
                try {
                    return getIdFromRequest(request);
                } catch (error: unknown) {
                    this.checkForUndefinedIdOrPath(error);

                    throw error;
                }
            },
        };
    }
}
