import type { EventEmitter } from "node:events";
import type { IncomingMessage } from "node:http";
import type { Readable } from "node:stream";

import type { PaginationResult } from "@visulima/pagination";

import type BaseStorage from "../storage/storage";
import type { UploadEventType, UploadFile } from "../storage/utils/file";
import type MediaTransformer from "../transformer/media-transformer";
import type { UploadError } from "../utils/errors";

// Web API types for fetch method
type WebRequest = globalThis.Request;
type WebResponse = globalThis.Response;

interface BaseResponse {
    headers: Record<string, number | string>;
    statusCode: number;
}

export interface StreamingResponse extends BaseResponse {
    /** Total size of the stream (for Content-Length header) */
    size?: number;
    /** Stream of data to send */
    stream: Readable;
}

export interface RequestEvent {
    request: Pick<IncomingMessage, "headers" | "method" | "url">;
}

export type AsyncHandler<Request, Response> = (
    request: Request,
    response: Response,
) => Promise<void | ResponseFile<UploadFile> | ResponseList<UploadFile> | StreamingResponse>;

export type Handlers = "delete" | "download" | "get" | "head" | "options" | "patch" | "post" | "put";

export type MethodHandler<Request, Response> = {
    [h in Handlers]?: AsyncHandler<Request, Response>;
};

export type UploadEvent<TFile extends UploadFile> = RequestEvent & TFile;

export type UploadErrorEvent = RequestEvent & UploadError;

export type ResponseFile<TFile extends UploadFile> = BaseResponse
    & TFile & {
        /** Optional stream for streaming responses instead of content buffer */
        stream?: Readable;
    };

export type ResponseList<TFile extends UploadFile> = BaseResponse & { data: PaginationResult<TFile> | TFile[] };

export interface BaseHandler<TFile extends UploadFile> extends EventEmitter {
    emit: ((event: "error", error: UploadErrorEvent) => boolean) & ((event: UploadEventType, payload: UploadEvent<TFile>) => boolean);

    fetch: (request: WebRequest) => Promise<WebResponse>;

    off: ((event: "error", listener: (error: UploadErrorEvent) => void) => this)
        & ((event: UploadEventType, listener: (payload: UploadEvent<TFile>) => void) => this);

    on: ((event: "error", listener: (error: UploadErrorEvent) => void) => this)
        & ((event: UploadEventType, listener: (payload: UploadEvent<TFile>) => void) => this);
}

export interface UploadOptions<TFile extends UploadFile> {
    disableTerminationForFinishedUploads?: boolean;
    /** Maximum file size for multipart parser (default: min(storage.maxUploadSize, 1GB)) */
    maxFileSize?: number;
    /** Maximum header size for multipart parser (default: 64KB) */
    maxHeaderSize?: number;
    mediaTransformer?: MediaTransformer;
    storage: BaseStorage<TFile>;
}
