import mem from "mem";

import type { HttpError } from "./types";

export enum ERRORS {
    BAD_REQUEST = "BadRequest",
    CHECKSUM_MISMATCH = "ChecksumMismatch",
    FILE_CONFLICT = "FileConflict",
    FILE_ERROR = "FileError",
    FILE_LOCKED = "FileLocked",
    FILE_NOT_ALLOWED = "FileNotAllowed",
    FILE_NOT_FOUND = "FileNotFound",
    FORBIDDEN = "Forbidden",
    GONE = "Gone",
    INVALID_CONTENT_TYPE = "InvalidContentType",
    INVALID_FILE_NAME = "InvalidFileName",
    INVALID_FILE_SIZE = "InvalidFileSize",
    INVALID_RANGE = "InvalidRange",
    METHOD_NOT_ALLOWED = "MethodNotAllowed",
    REQUEST_ABORTED = "RequestAborted",
    REQUEST_ENTITY_TOO_LARGE = "RequestEntityTooLarge",
    STORAGE_ERROR = "StorageError",
    TOO_MANY_REQUESTS = "TooManyRequests",
    UNKNOWN_ERROR = "UnknownError",
    UNPROCESSABLE_ENTITY = "UnprocessableEntity",
    // eslint-disable-next-line no-secrets/no-secrets
    UNSUPPORTED_CHECKSUM_ALGORITHM = "UnsupportedChecksumAlgorithm",
    UNSUPPORTED_MEDIA_TYPE = "UnsupportedMediaType",
}

export type ErrorResponses<T extends string = string> = {
    [K in T]: HttpError;
};

export const ErrorMap = mem((): ErrorResponses => {
    const errors: Record<string, [number, string]> = {
        BadRequest: [400, "Bad request"],
        ChecksumMismatch: [460, "Checksum mismatch"],
        FileConflict: [409, "File conflict"],
        FileError: [500, "Something went wrong writing the file"],
        FileLocked: [423, "File locked"],
        FileNotAllowed: [403, "File not allowed"],
        FileNotFound: [404, "Not found"],
        Forbidden: [403, "Authenticated user is not allowed access"],
        Gone: [410, "The file for this url no longer exists"],
        InvalidContentType: [400, "Invalid or missing \"content-type\" header"],
        InvalidFileName: [400, "Invalid file name or it cannot be retrieved"],
        InvalidFileSize: [400, "File size cannot be retrieved"],
        InvalidRange: [400, "Invalid or missing content-range header"],
        MethodNotAllowed: [405, "Method not allowed"],
        RequestAborted: [499, "Request aborted"],
        RequestEntityTooLarge: [413, "Request entity too large"],
        StorageError: [503, "Storage error"],
        TooManyRequests: [429, "Too many requests"],
        UnknownError: [500, "Something went wrong"],
        UnprocessableEntity: [422, "Validation failed"],
        UnsupportedChecksumAlgorithm: [400, "Unsupported checksum algorithm"],
        UnsupportedMediaType: [415, "Unsupported media type"],
    };

    const errorMap: ErrorResponses = {};

    (Object.keys(errors) as ERRORS[]).forEach((code) => {
        const [statusCode, message] = errors[code] as [number, string];

        errorMap[code] = { code, message, statusCode };
    });

    return errorMap;
})();

export class UploadError extends Error {
    public override name = "UploadError";

    public UploadErrorCode: ERRORS = ERRORS.UNKNOWN_ERROR;

    public detail?: unknown;
}

export const isUploadError = (error: unknown): error is UploadError => !!(error as UploadError).UploadErrorCode;

export const throwErrorCode = (UploadErrorCode: string, detail?: string): never => {
    const error = new UploadError(detail || (ErrorMap[UploadErrorCode] as HttpError).message);

    error.UploadErrorCode = UploadErrorCode as ERRORS;

    if (typeof detail === "string") {
        error.detail = detail;
    }

    throw error;
};
