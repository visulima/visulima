import { isHttpError } from "http-errors";

import type { BaseStorage } from "../../storage/storage";
import type { UploadFile } from "../../storage/utils/file";
import type { ErrorResponses } from "../../utils/errors";
import { isUploadError } from "../../utils/errors";
import type { HttpError, UploadResponse } from "../../utils/types";
import { isValidationError } from "../../utils/validator";
import { buildErrorResponseBody } from "../utils/response-builder";

/**
 * Service for handling and formatting errors consistently across handlers.
 */
class ErrorHandlerService<TFile extends UploadFile> {
    private readonly storage: BaseStorage<TFile>;

    private readonly errorResponses: ErrorResponses;

    public constructor(storage: BaseStorage<TFile>, errorResponses: ErrorResponses) {
        this.storage = storage;
        this.errorResponses = errorResponses;
    }

    /**
     * Normalizes an error to HttpError format.
     * @param error The error to normalize
     * @returns Normalized HTTP error
     */
    public normalizeError(error: Error): HttpError {
        if (isUploadError(error)) {
            return this.errorResponses[error.UploadErrorCode] as HttpError;
        }

        if (!isValidationError(error) && !isHttpError(error)) {
            return this.storage.normalizeError(error);
        }

        // For http-errors, pass through without body - onError will format it
        return {
            ...error,
            code: (error as HttpError).code || error.name,
            headers: (error as HttpError).headers || {},
            message: error.message,
            name: error.name,
            statusCode: (error as HttpError).statusCode || 500,
        } as HttpError;
    }

    /**
     * Formats an error into an UploadResponse.
     * @param error The error to format
     * @returns UploadResponse with error details
     */
    public async formatErrorResponse(error: Error): Promise<UploadResponse> {
        const httpError = this.normalizeError(error);

        // Call onError hook - user can modify the error object in place
        await this.storage.onError(httpError);

        // Format error response - if body is not set, format it into body.error structure
        if (httpError.body) {
            return {
                body: httpError.body,
                headers: httpError.headers,
                statusCode: httpError.statusCode,
            };
        }

        // Format the error properties into a body.error structure
        return {
            body: buildErrorResponseBody(httpError),
            headers: httpError.headers,
            statusCode: httpError.statusCode || 500,
        };
    }

    /**
     * Handles upload-specific errors with proper status codes.
     * @param error The error to handle
     * @returns Normalized error with appropriate status code
     */
    public handleUploadError(error: unknown): HttpError {
        const errorObject = error instanceof Error ? error : new Error(String(error));

        return this.normalizeError(errorObject);
    }
}

export default ErrorHandlerService;
