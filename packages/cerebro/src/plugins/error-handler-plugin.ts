import type { Plugin } from "../types/plugin";
import type { Toolbox } from "../types/toolbox";

/**
 * Format additional error properties for logging.
 * Extracts non-standard properties from an error object.
 * @param error The error object to extract properties from
 * @returns Record of additional properties excluding standard error fields
 */
const formatAdditionalProps = (error: Error): Record<string, unknown> => {
    const standardProps = new Set(["code", "message", "name", "stack"]);
    const result: Record<string, unknown> = {};

    for (const key of Object.keys(error)) {
        if (!standardProps.has(key)) {
            result[key] = (error as unknown as Record<string, unknown>)[key];
        }
    }

    return result;
};

/**
 * Log detailed error information with structured output.
 * Outputs error name, message, code, stack trace, and additional properties.
 * @param error The error object to log
 * @param toolbox The command toolbox containing the logger
 * @param useCriticalLevel Whether to use critical log level instead of error
 */
const logDetailedError = (error: Error, toolbox: Toolbox, useCriticalLevel: boolean): void => {
    const { logger } = toolbox;
    const logMethod = useCriticalLevel ? logger.critical.bind(logger) : logger.error.bind(logger);

    logger.error(""); // Empty line for better readability
    logMethod("An error occurred:");

    // Error name and message
    logger.error(`  Name: ${error.name}`);
    logger.error(`  Message: ${error.message}`);

    // Error code (for Node.js errors)
    if ("code" in error) {
        logger.error(`  Code: ${(error as NodeJS.ErrnoException).code}`);
    }

    // Stack trace
    if (error.stack) {
        logger.error("  Stack trace:");

        const stackLines = error.stack.split("\n").slice(1); // Skip first line (error message)

        for (const line of stackLines) {
            logger.error(`    ${line.trim()}`);
        }
    }

    // Additional error properties
    const additionalProps = formatAdditionalProps(error);
    const propKeys = Object.keys(additionalProps);

    if (propKeys.length > 0) {
        logger.error("  Additional properties:");

        for (const prop of propKeys) {
            logger.error(`    ${prop}: ${JSON.stringify(additionalProps[prop])}`);
        }
    }

    logger.error(""); // Empty line for better readability
};

export type ErrorHandlerOptions = {
    /** Show detailed error information including stack traces (default: false) */
    detailed?: boolean;
    /** Exit process after handling error (default: true) */
    exitOnError?: boolean;
    /** Custom error formatter function */
    formatter?: (error: Error) => string;
    /** Whether to log errors (default: true) */
    logErrors?: boolean;
    /** Use critical log level for errors (default: false) */
    useCriticalLevel?: boolean;
};

/**
 * Create an error handler plugin for enhanced error reporting.
 * @param options Error handler configuration options
 * @returns Plugin instance
 */
export const errorHandlerPlugin = (options: ErrorHandlerOptions = {}): Plugin => {
    const handleError = async (error: Error, toolbox: Toolbox) => {
        const { logger } = toolbox;
        const { detailed = false, exitOnError = true, formatter, logErrors = true, useCriticalLevel = false } = options;

        if (!logErrors) {
            return;
        }

        if (formatter) {
            // Use custom formatter
            const logMethod = useCriticalLevel ? logger.critical.bind(logger) : logger.error.bind(logger);

            logMethod(formatter(error));
        } else if (detailed) {
            // Show detailed error information with structured logging
            logDetailedError(error, toolbox, useCriticalLevel);
        } else {
            // Simple error logging (default behavior)
            const logMethod = useCriticalLevel ? logger.critical.bind(logger) : logger.error.bind(logger);

            logMethod(error);
        }

        // Exit process if configured
        if (exitOnError) {
            // eslint-disable-next-line unicorn/no-process-exit
            process.exit(1);
        }
    };

    return {
        description: "Enhanced error handling and reporting",
        name: "error-handler",
        onError: handleError,
        version: "1.0.0",
    };
};
