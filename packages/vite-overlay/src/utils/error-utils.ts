// Error handling utilities for consistent patterns

import type { ViteServer } from "../types";

/**
 * Safely extract a string value with fallback
 */
export const safeString = (value: unknown, fallback = ""): string => (typeof value === "string" ? value : String(value ?? fallback));

/**
 * Safely extract error properties with fallbacks
 */
export const extractErrorInfo = (error: unknown) => {
    const error_ = error as any;

    return {
        message: safeString(error_?.message, "Runtime error"),
        name: safeString(error_?.name, "Error"),
        stack: safeString(error_?.stack, ""),
    };
};

/**
 * Safely log errors with consistent formatting
 */
export const logError = (server: ViteServer, prefix: string, error: unknown): void => {
    try {
        server.config.logger.error(`${prefix}: ${String(error)}`);
    } catch {
        // Fallback if logging fails
    }
};

/**
 * Execute an async operation with error handling and fallback
 */
export const safeAsync = async <T>(operation: () => Promise<T>, fallback: T, onError?: (error: unknown) => void): Promise<T> => {
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
export const safeSync = <T>(operation: () => T, fallback: T, onError?: (error: unknown) => void): T => {
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
 * Create a standardized error response
 */
export const createErrorResponse = (
    error: unknown,
    overrides: Partial<{
        message: string;
        name: string;
        stack: string;
    }> = {},
) => {
    const baseInfo = extractErrorInfo(error);

    return {
        ...baseInfo,
        ...overrides,
    };
};
