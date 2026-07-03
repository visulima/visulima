import type { Middleware } from "./types";

export interface LoggingMiddlewareOptions {
    /** Console-like logger (default `console`). */
    logger?: Console;
}

/**
 * Logs each send attempt and its outcome.
 * @param options Provide a custom console-like `logger` (defaults to the global console).
 * @returns A middleware.
 */
export const loggingMiddleware = (options: LoggingMiddlewareOptions = {}): Middleware => {
    const logger = options.logger ?? console;

    return async (context, next) => {
        logger.debug(`[@visulima/notification] sending via "${context.provider}" (${context.channel})`);

        const result = await next(context);

        if (result.success) {
            logger.debug(`[@visulima/notification] sent ${result.data?.messageId ?? ""} via "${context.provider}"`);
        } else {
            const message = result.error instanceof Error ? result.error.message : String(result.error);

            logger.warn(`[@visulima/notification] send failed via "${context.provider}": ${message}`);
        }

        return result;
    };
};
