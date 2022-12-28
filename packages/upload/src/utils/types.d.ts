import Cache from "lru-cache";
import type { BinaryToTextEncoding, Hash } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { Transform } from "node:stream";

export interface RangeChecksum extends Transform {
    hash: Hash;

    path: string;

    reset(): void;

    digest(encoding: BinaryToTextEncoding = "hex"): string;
}

export interface RangeHasher extends Cache<string, Hash> {
    algorithm: "sha1" | "md5";

    hex(path: string): string;

    base64(path: string): string;

    init(path: string, start = 0): Promise<Hash>;

    digester(path: string): RangeChecksum;

    updateFromFs(path: string, start = 0, initial?: Hash): Promise<Hash>;
}

export interface HttpErrorBody {
    message: string;
    code: string;
    UploadErrorCode?: string;
    name?: string;
    retryable?: boolean;
    detail?: Record<string, any> | string;
}

export interface HttpError<T = HttpErrorBody> extends UploadResponse<T> {
    statusCode: number;
}

export interface IncomingMessageWithBody<T = any> extends IncomingMessage {
    body?: T;
    _body?: boolean;
}

export type Header = number | string | string[];
export type Headers = Record<string, Header>;

export type ResponseBody = string | Record<string, any>;
export type ResponseBodyType = "text" | "json";
export type ResponseTuple<T = ResponseBody> = [statusCode: number, body?: T, headers?: Headers];

export interface UploadResponse<T = ResponseBody> extends Record<string, any> {
    statusCode?: number;
    headers?: Headers;
    body?: T;
}

export interface ValidatorConfig<T> {
    value?: any;
    isValid?: (t: T) => boolean | Promise<boolean>;
    response?: ResponseTuple<any> | HttpError<any>;
}

export type Validation<T> = Record<string, ValidatorConfig<T>>;

export interface ValidationError extends HttpError {
    name: "ValidationError";
    code: string;
}

export interface Logger {
    debug(...data: any[]): void;
    info(...data: any[]): void;
    warn(...data: any[]): void;
    error(...data: any[]): void;
}
