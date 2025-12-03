import type { HttpError } from "./types";

/**
 * Canonical error codes used across handlers and storage adapters.
 * These codes map to standardized HTTP status codes and error messages.
 */
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
    INVALID_FILE_NAME = "InvalidFileName",
    INVALID_FILE_SIZE = "InvalidFileSize",
    INVALID_RANGE = "InvalidRange",
    INVALID_TYPE = "Invalidtype",
    METHOD_NOT_ALLOWED = "MethodNotAllowed",
    REQUEST_ABORTED = "RequestAborted",
    REQUEST_ENTITY_TOO_LARGE = "RequestEntityTooLarge",
    STORAGE_BUSY = "StorageBusy",
    STORAGE_ERROR = "StorageError",
    TOO_MANY_REQUESTS = "TooManyRequests",
    UNKNOWN_ERROR = "UnknownError",
    UNPROCESSABLE_ENTITY = "UnprocessableEntity",
    // eslint-disable-next-line no-secrets/no-secrets
    UNSUPPORTED_CHECKSUM_ALGORITHM = "UnsupportedChecksumAlgorithm",
    UNSUPPORTED_MEDIA_TYPE = "UnsupportedMediaType",
}

/**
 * Type mapping of error codes to standardized HTTP error responses.
 * @template T - The error code type (defaults to string)
 */
export type ErrorResponses<T extends string = string> = {
    [K in T]: HttpError;
};

/**
 * Mapping of error codes to HttpError response objects.
 * @returns Map of error codes to standardized HTTP error responses
 */
export const ErrorMap: ErrorResponses<ERRORS> = (() => {
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
        InvalidFileName: [400, "Invalid file name or it cannot be retrieved"],
        InvalidFileSize: [400, "File size cannot be retrieved"],
        InvalidRange: [400, "Invalid or missing content-range header"],
        Invalidtype: [400, "Invalid or missing \"content-type\" header"],
        MethodNotAllowed: [405, "Method not allowed"],
        RequestAborted: [499, "Request aborted"],
        RequestEntityTooLarge: [413, "Request entity too large"],
        StorageBusy: [503, "Storage is busy"],
        StorageError: [503, "Storage error"],
        TooManyRequests: [429, "Too many requests"],
        UnknownError: [500, "Something went wrong"],
        UnprocessableEntity: [422, "Validation failed"],
        UnsupportedChecksumAlgorithm: [400, "Unsupported checksum algorithm"],
        UnsupportedMediaType: [415, "Unsupported media type"],
    };

    const errorMap = {} as ErrorResponses<ERRORS>;

    (Object.keys(errors) as ERRORS[]).forEach((code) => {
        const [statusCode, message] = errors[code] as [number, string];

        errorMap[code] = { code, message, statusCode };
    });

    return errorMap;
})();

/**
 * Error subclass carrying a stable error code and optional detail.
 * Provides structured error information for upload operations.
 */
export class UploadError extends Error {
    public override name = "UploadError";

    /** The standardized error code from the ERRORS enum */
    public UploadErrorCode: ERRORS = ERRORS.UNKNOWN_ERROR;

    /** Optional additional error details */
    public detail?: unknown;

    /**
     * Creates a new UploadError instance.
     * @param code Standardized error code (defaults to UNKNOWN_ERROR)
     * @param message Human-readable error message (defaults to the code)
     * @param detail Optional additional error details
     */
    public constructor(code: ERRORS = ERRORS.UNKNOWN_ERROR, message?: string, detail?: unknown) {
        super(message || code);
        this.name = "UploadError";
        this.detail = detail;

        if (Object.values(ERRORS).includes(code)) {
            this.UploadErrorCode = code;
        }
    }
}

/**
 * Type guard to check if an error is an UploadError instance.
 * @param error Error to check
 * @returns True if the error is an UploadError with a valid error code
 */
export const isUploadError = (error: unknown): error is UploadError => !!(error as UploadError).UploadErrorCode;

/**
 * Convenience function to throw an UploadError from a string error code.
 * Looks up the appropriate error message from ErrorMap.
 * @param UploadErrorCode String error code to convert to UploadError
 * @param detail Optional additional error details
 * @throws UploadError with the specified code and message
 */
export const throwErrorCode = (UploadErrorCode: ERRORS | string, detail?: string): never => {
    const errorCode = UploadErrorCode as ERRORS;
    let errorResponse: HttpError | undefined;

    if (errorCode && typeof errorCode === "string" && errorCode in ErrorMap) {
        errorResponse = ErrorMap[errorCode];
    }

    const message
        = detail
            || (errorResponse?.body && typeof errorResponse.body === "object" && "message" in errorResponse.body
                ? (errorResponse.body as { message: string }).message
                : undefined)
            || (errorResponse?.message as string | undefined)
            || ERRORS.UNKNOWN_ERROR;
    const error = new UploadError(errorCode, message);

    error.UploadErrorCode = errorCode;

    if (typeof detail === "string") {
        error.detail = detail;
    }

    throw error;
};
