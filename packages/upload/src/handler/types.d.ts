import type { EventEmitter } from "node:events";
import type { IncomingMessage } from "node:http";

import type { PaginationResult } from "@visulima/pagination";

import type BaseStorage from "../storage/storage";
import type { UploadEventType, UploadFile } from "../storage/utils/file";
import type { UploadError } from "../utils";

interface BaseResponse {
    headers: Record<string, number | string>;
    statusCode: number;
}

export interface RequestEvent {
    request: Pick<IncomingMessage, "headers" | "method" | "url">;
}

export type AsyncHandler = <Request, Response>(request: Request, response: Response) => Promise<any>;

export type Handlers = "delete" | "get" | "head" | "options" | "patch" | "post" | "put";

export type MethodHandler<Request, Response> = {
    [h in Handlers]?: AsyncHandler<Request, Response>;
};

export type UploadEvent<TFile extends UploadFile> = RequestEvent & TFile;

export type UploadErrorEvent = RequestEvent & UploadError;

export type ResponseFile<TFile extends UploadFile> = BaseResponse & TFile;

export type ResponseList<TFile extends UploadFile> = { data: PaginationResult<TFile> | TFile[] } & BaseResponse;

export interface BaseHandler<TFile extends UploadFile> extends EventEmitter {
    emit: ((event: "error", error: UploadErrorEvent) => boolean) & ((event: UploadEventType, payload: UploadEvent<TFile>) => boolean);

    off: ((event: "error", listener: (error: UploadErrorEvent) => void) => this) &
        ((event: UploadEventType, listener: (payload: UploadEvent<TFile>) => void) => this);

    on: ((event: "error", listener: (error: UploadErrorEvent) => void) => this) &
        ((event: UploadEventType, listener: (payload: UploadEvent<TFile>) => void) => this);
}

export interface UploadOptions<TFile extends UploadFile> {
    storage: BaseStorage<TFile>;
}
