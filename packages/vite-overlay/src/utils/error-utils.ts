import type { ErrorHandler, ErrorLike, SafeAsyncOperation, SafeSyncOperation, ViteServer } from "../types";

/**
 * Safely extract a string value with fallback
 */
export const safeString = (value: unknown, fallback = ""): string => (typeof value === "string" ? value : String(value ?? fallback));

/**
 * Safely extract error properties with fallbacks
 */
export const extractErrorInfo = (error: unknown) => {
    const errorLike = error as ErrorLike;

    return {
        message: safeString(errorLike?.message, "Runtime error"),
        name: safeString(errorLike?.name, "Error"),
        stack: safeString(errorLike?.stack, ""),
    } as const;
};

/**
 * Safely log errors with consistent formatting
 */
export const logError = (server: ViteServer, prefix: string, error: unknown): void => {
    try {
        const message = error instanceof Error ? error.message : String(error);

        server.config.logger.error(`${prefix}: ${message}`, { clear: true, timestamp: true });
    } catch {
        // Silent fallback if logging fails
    }
};

/**
 * Execute an async operation with error handling and fallback
 */
export const safeAsync = async <T>(operation: SafeAsyncOperation<T>, fallback: T, onError?: ErrorHandler): Promise<T> => {
    try {
        return await operation();
    } catch (error) {
        if (onError) {
            onError(error);
        }

        return fallback;
    }
};

/**
 * Execute a sync operation with error handling and fallback
 */
export const safeSync = <T>(operation: SafeSyncOperation<T>, fallback: T, onError?: ErrorHandler): T => {
    try {
        return operation();
    } catch (error) {
        if (onError) {
            onError(error);
        }

        return fallback;
    }
};

/**
 * Create a standardized error response object
 */
export const createErrorResponse = (error: unknown, overrides: Partial<ErrorLike> = {}) => {
    const baseInfo = extractErrorInfo(error);

    return {
        ...baseInfo,
        ...overrides,
    } as const;
};

/**
 * Type guard to check if a value is an Error-like object
 */
export const isErrorLike = (value: unknown): value is ErrorLike =>
    typeof value === "object" && value !== null && ("message" in value || "name" in value || "stack" in value);

/**
 * Safely get error message from any value
 */
export const getErrorMessage = (error: unknown): string => {
    if (isErrorLike(error) && typeof error.message === "string") {
        return error.message;
    }

    if (typeof error === "string") {
        return error;
    }

    return "An unknown error occurred";
};

/**
 * Safely get error name from any value
 */
export const getErrorName = (error: unknown): string => {
    if (isErrorLike(error) && typeof error.name === "string") {
        return error.name;
    }

    return "Error";
};

/**
 * Safely get error stack from any value
 */
export const getErrorStack = (error: unknown): string => {
    if (isErrorLike(error) && typeof error.stack === "string") {
        return error.stack;
    }

    return "";
};
