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
        Invalidtype: [400, 'Invalid or missing "content-type" header'],
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
 * Best-effort extraction of an HTTP status from a native SDK error.
 *
 * Covers the shapes used by the consumer-provider SDKs:
 * - Dropbox `DropboxResponseError` → `error.status`
 * - Box `BoxAPIError` / Microsoft Graph errors → `error.statusCode`
 * - googleapis errors → `error.code` (numeric) or `error.response.status`
 * - Supabase / fetch-style errors → `error.status` or `error.response.status`
 */
export const extractHttpStatus = (error: unknown): number | undefined => {
    if (!error || typeof error !== "object") {
        return undefined;
    }

    const object = error as Record<string, unknown>;

    if (typeof object.status === "number") {
        return object.status;
    }

    if (typeof object.statusCode === "number") {
        return object.statusCode;
    }

    if (typeof object.code === "number") {
        return object.code;
    }

    const response = object.response as { status?: unknown; statusCode?: unknown } | undefined;

    if (typeof response?.status === "number") {
        return response.status;
    }

    if (typeof response?.statusCode === "number") {
        return response.statusCode;
    }

    return undefined;
};

/**
 * Map an HTTP status code to the closest canonical ERRORS value.
 *
 * Returns STORAGE_ERROR for unknown/5xx and BAD_REQUEST for unmapped 4xx.
 * 401 (unauthenticated) collapses to FORBIDDEN because the ERRORS enum has
 * no dedicated UNAUTHORIZED value; callers needing to distinguish the two
 * should inspect the native error on `UploadError.detail`.
 */
export const mapStatusToErrorCode = (status?: number): ERRORS => {
    if (status === undefined) {
        return ERRORS.STORAGE_ERROR;
    }

    switch (status) {
        case 400: {
            return ERRORS.BAD_REQUEST;
        }
        case 401:
        case 403: {
            return ERRORS.FORBIDDEN;
        }
        case 404: {
            return ERRORS.FILE_NOT_FOUND;
        }
        case 405: {
            return ERRORS.METHOD_NOT_ALLOWED;
        }
        case 409: {
            return ERRORS.FILE_CONFLICT;
        }
        case 410: {
            return ERRORS.GONE;
        }
        case 413: {
            return ERRORS.REQUEST_ENTITY_TOO_LARGE;
        }
        case 415: {
            return ERRORS.UNSUPPORTED_MEDIA_TYPE;
        }
        case 422: {
            return ERRORS.UNPROCESSABLE_ENTITY;
        }
        case 423: {
            return ERRORS.FILE_LOCKED;
        }
        case 429: {
            return ERRORS.TOO_MANY_REQUESTS;
        }
        case 503: {
            return ERRORS.STORAGE_BUSY;
        }
        default: {
            if (status >= 500 && status < 600) {
                return ERRORS.STORAGE_ERROR;
            }

            if (status >= 400 && status < 500) {
                return ERRORS.BAD_REQUEST;
            }

            return ERRORS.UNKNOWN_ERROR;
        }
    }
};

const composeWrappedMessage = (adapter: string, operation: string, detail: string | undefined, status: number | undefined): string => {
    const prefix = `${adapter}: ${operation} failed`;

    if (detail) {
        return `${prefix} — ${detail}`;
    }

    if (status !== undefined) {
        return `${prefix} (HTTP ${status})`;
    }

    return prefix;
};

/**
 * Normalize a native storage-SDK error into an `UploadError`.
 *
 * The native error is preserved on `.detail` so advanced callers can drop down
 * to provider-specific shapes when needed. Already-wrapped `UploadError`
 * instances pass through unchanged.
 * @example
 * ```ts
 * try {
 *     await client.filesCopyV2({ from_path, to_path });
 * } catch (error) {
 *     throw wrapStorageError(error, { adapter: "Dropbox", operation: "copy" });
 * }
 * ```
 */
export const wrapStorageError = (
    error: unknown,
    options: {
        adapter: string;
        code?: ERRORS;
        message?: string;
        operation: string;
        status?: number;
    },
): UploadError => {
    if (isUploadError(error)) {
        return error;
    }

    const status = options.status ?? extractHttpStatus(error);
    const code = options.code ?? mapStatusToErrorCode(status);
    const nativeMessage = (error as { message?: unknown } | null)?.message;
    const detail = typeof nativeMessage === "string" && nativeMessage.length > 0 ? nativeMessage : undefined;
    const message = options.message ?? composeWrappedMessage(options.adapter, options.operation, detail, status);

    return new UploadError(code, message, error);
};

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

    const message =
        detail ||
        (errorResponse?.body && typeof errorResponse.body === "object" && "message" in errorResponse.body
            ? (errorResponse.body as { message: string }).message
            : undefined) ||
        (errorResponse?.message as string | undefined) ||
        ERRORS.UNKNOWN_ERROR;
    const error = new UploadError(errorCode, message);

    error.UploadErrorCode = errorCode;

    if (typeof detail === "string") {
        error.detail = detail;
    }

    throw error;
};
