import type { ErrorLike, ViteServer } from "../types";

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
