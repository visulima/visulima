import type { BinaryToTextEncoding, Hash } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { Transform } from "node:stream";

import type { LRUCache as Cache } from "lru-cache";

export interface RangeChecksum extends Transform {
    digest: (encoding: BinaryToTextEncoding = "hex") => string;

    hash: Hash;

    path: string;

    reset: () => void;
}

export interface RangeHasher extends Cache<string, Hash> {
    algorithm: "md5" | "sha1";

    base64: (path: string) => string;

    digester: (path: string) => RangeChecksum;

    hex: (path: string) => string;

    init: (path: string, start = 0) => Promise<Hash>;

    updateFromFs: (path: string, start = 0, initial?: Hash) => Promise<Hash>;
}

export interface HttpErrorBody {
    UploadErrorCode?: string;
    code: string;
    detail?: Record<string, any> | string;
    message: string;
    name?: string;
    retryable?: boolean;
}

export interface HttpError<T = HttpErrorBody> extends UploadResponse<T> {
    statusCode: number;
}

export interface IncomingMessageWithBody<T = any> extends IncomingMessage {
    _body?: boolean;
    body?: T;
}

export type Header = string[] | number | string;
export type Headers = Record<string, Header>;

export type ResponseBody = Record<string, any> | string;
export type ResponseBodyType = "json" | "text";
export type ResponseTuple<T = ResponseBody> = [statusCode: number, body?: T, headers?: Headers];

export interface UploadResponse<T = ResponseBody> extends Record<string, any> {
    body?: T;
    headers?: Headers;
    statusCode?: number;
}

export interface ValidatorConfig<T> {
    isValid?: (t: T) => Promise<boolean> | boolean;
    response?: HttpError<any> | ResponseTuple<any>;
    value?: any;
}

export type Validation<T> = Record<string, ValidatorConfig<T>>;

export interface ValidationError extends HttpError {
    code: string;
    name: "ValidationError";
}

export interface Logger {
    debug: (...data: any[]) => void;
    error: (...data: any[]) => void;
    info: (...data: any[]) => void;
    warn: (...data: any[]) => void;
}
