import type { Logger } from "../types";

/**
 * Creates a logger from options
 * If a custom logger is provided, it will be used
 * Otherwise, creates a logger based on debug flag
 */
export const createLogger = (providerName: string, debug?: boolean, logger?: Logger): Logger => {
    if (logger) {
        return logger;
    }

    const noop = (): void => {
        // No-op logger when debug is disabled
    };

    if (!debug) {
        return {
            debug: noop,
            error: noop,
            info: noop,
            warn: noop,
        };
    }

    return {
        debug: (message: string, ...args: unknown[]): void => {
            console.log(`[${providerName}] ${message}`, ...args);
        },
        error: (message: string, ...args: unknown[]): void => {
            console.error(`[${providerName}] ${message}`, ...args);
        },
        info: (message: string, ...args: unknown[]): void => {
            console.info(`[${providerName}] ${message}`, ...args);
        },
        warn: (message: string, ...args: unknown[]): void => {
            console.warn(`[${providerName}] ${message}`, ...args);
        },
    };
};
