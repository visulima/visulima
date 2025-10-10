import type { BinaryToTextEncoding, Hash } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { Transform } from "node:stream";

import type { LRUCache as Cache } from "lru-cache";

/**
 * Transform that computes a rolling checksum for a stream while passing
 * data through unchanged.
 */
export interface RangeChecksum extends Transform {
    /** Return the current digest in the selected encoding. */
    digest: (encoding: BinaryToTextEncoding) => string;

    hash: Hash;

    path: string;

    reset: () => void;
}

/**
 * LRU-backed map of rolling hashers keyed by file path. Used to compute
 * hex/base64 digests and resume hashing from an offset.
 */
export interface RangeHasher extends Cache<string, Hash> {
    algorithm: "md5" | "sha1";

    base64: (path: string) => string;

    digester: (path: string) => RangeChecksum;

    hex: (path: string) => string;

    init: (path: string, start: number) => Promise<Hash>;

    updateFromFs: (path: string, start: number, initial?: Hash) => Promise<Hash>;
}

/**
 * Normalized HTTP error payload returned by handlers and storage backends.
 */
export interface HttpErrorBody {
    code: string;
    detail?: Record<string, any> | string;
    message: string;
    name?: string;
    retryable?: boolean;
    UploadErrorCode?: string;
}

/**
 * Rich HTTP error including status code and optional headers/body.
 */
export interface HttpError<T = HttpErrorBody> extends UploadResponse<T> {
    statusCode: number;
}

/**
 * Node.js IncomingMessage with an optional parsed body attached.
 */
export interface IncomingMessageWithBody<T = any> extends IncomingMessage {
    _body?: boolean;
    body?: T;
}

export type Header = string[] | number | string;
export type Headers = Record<string, Header>;

export type ResponseBody = Record<string, any> | string;
export type ResponseBodyType = "json" | "text";
/**
 * Tuple form for quick response definitions: [status, body, headers].
 */
export type ResponseTuple<T = ResponseBody> = [statusCode: number, body?: T, headers?: Headers];

/**
 * Structured response used across handlers and storage operations.
 */
export interface UploadResponse<T = ResponseBody> extends Record<string, any> {
    body?: T;
    headers?: Headers;
    statusCode?: number;
}

/**
 * Declarative validator configuration for a single rule.
 */
export interface ValidatorConfig<T> {
    isValid?: (t: T) => Promise<boolean> | boolean;
    response?: HttpError<any> | ResponseTuple<any>;
    value?: any;
}

/** Map of rule-name -> validator configuration. */
export type Validation<T> = Record<string, ValidatorConfig<T>>;

/** Narrowed error response shape for validation failures. */
export interface ValidationError extends HttpError {
    code: string;
    name: "ValidationError";
}

/** Minimal logger interface used by the library. */
export interface Logger {
    debug: (...data: any[]) => void;
    error: (...data: any[]) => void;
    info: (...data: any[]) => void;
    warn: (...data: any[]) => void;
}
