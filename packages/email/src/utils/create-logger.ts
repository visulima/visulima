/**
 * Logger interface with debug, error, info, and warn methods.
 */
type Logger = {
    debug: (message: string, ...args: unknown[]) => void;
    error: (message: string, ...args: unknown[]) => void;
    info: (message: string, ...args: unknown[]) => void;
    warn: (message: string, ...args: unknown[]) => void;
};

/**
 * Creates a logger instance for a provider with optional console output.
 * @param providerName The name of the provider (used as prefix in log messages).
 * @param logger Optional Console instance. If provided, logs will be displayed with prefixes. If not provided, returns a no-op logger.
 * @returns A logger instance with debug, error, info, and warn methods.
 */
const createLogger = (providerName: string, logger?: Console): Logger => {
    const noop = (): void => {
        // No-op logger when no logger is provided
    };

    if (!logger) {
        return {
            debug: noop,
            error: noop,
            info: noop,
            warn: noop,
        };
    }

    return {
        debug: (message: string, ...args: unknown[]): void => {
            logger.log(`[${providerName}] ${message}`, ...args);
        },
        error: (message: string, ...args: unknown[]): void => {
            logger.error(`[${providerName}] ${message}`, ...args);
        },
        info: (message: string, ...args: unknown[]): void => {
            logger.info(`[${providerName}] ${message}`, ...args);
        },
        warn: (message: string, ...args: unknown[]): void => {
            logger.warn(`[${providerName}] ${message}`, ...args);
        },
    };
};

export default createLogger;
