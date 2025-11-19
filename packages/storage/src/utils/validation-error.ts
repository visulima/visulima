import type { Headers, HttpErrorBody, ValidationError as IValidationError } from "./types";

/**
 * Error class for validation failures with detailed error information.
 * Implements the ValidationError interface for consistent error handling.
 */
class ValidationError extends Error implements IValidationError {
    /**
     * Creates a new ValidationError instance.
     * @param code Machine-readable error code
     * @param statusCode HTTP status code for the error
     * @param body Error response body (string or structured object)
     * @param headers HTTP headers to include in error response
     */
    public constructor(
        public code: string,
        public statusCode: number,
        public body: HttpErrorBody,
        public headers: Headers,
    ) {
        super(typeof body === "string" ? body : body?.message);

        this.name = "ValidationError" as const;
    }
}

export default ValidationError;
