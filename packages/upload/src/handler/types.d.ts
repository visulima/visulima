import type { PaginationResult } from "@visulima/pagination";
import { EventEmitter } from "node:events";
import type { IncomingMessage } from "node:http";

import BaseStorage from "../storage/storage";
import type { UploadEventType, UploadFile } from "../storage/utils/file";
import { UploadError } from "../utils";

type BaseResponse = {
    headers: Record<string, string | number>;
    statusCode: number;
};

export type RequestEvent = { request: Pick<IncomingMessage, "url" | "headers" | "method"> };

export type AsyncHandler = <Request, Response>(request: Request, response: Response) => Promise<any>;

export type Handlers = "delete" | "get" | "head" | "options" | "patch" | "post" | "put";

export type MethodHandler<Request, Response> = {
    [h in Handlers]?: AsyncHandler<Request, Response>;
};

export type UploadEvent<TFile extends UploadFile> = TFile & RequestEvent;

export type UploadErrorEvent = UploadError & RequestEvent;

export type ResponseFile<TFile extends UploadFile> = TFile & BaseResponse;

export type ResponseList<TFile extends UploadFile> = { data: PaginationResult<TFile> | TFile[]; } & BaseResponse;

export interface BaseHandler<TFile extends UploadFile> extends EventEmitter {
    on(event: "error", listener: (error: UploadErrorEvent) => void): this;

    on(event: UploadEventType, listener: (payload: UploadEvent<TFile>) => void): this;

    off(event: UploadEventType, listener: (payload: UploadEvent<TFile>) => void): this;

    off(event: "error", listener: (error: UploadErrorEvent) => void): this;

    emit(event: UploadEventType, payload: UploadEvent<TFile>): boolean;

    emit(event: "error", error: UploadErrorEvent): boolean;
}

export interface UploadOptions<TFile extends UploadFile> {
    storage: BaseStorage<TFile>
}
