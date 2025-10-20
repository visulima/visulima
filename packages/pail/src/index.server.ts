/* eslint-disable jsdoc/match-description */
import { env, stderr, stdout } from "node:process";

import type { PailServerType } from "./pail.server";
import { PailServer } from "./pail.server";
import MessageFormatterProcessor from "./processor/message-formatter-processor";
import { PrettyReporter } from "./reporter/pretty/pretty-reporter.server";
import type { ConstructorOptions, ExtendedRfc5424LogLevels } from "./types";

/**
 * Determines the default log level based on environment variables.
 *
 * This function checks common environment variables to set appropriate default log levels:
 * - Returns "debug" if NODE_ENV is "debug" or DEBUG is set
 * - Returns "warning" if NODE_ENV is "test"
 * - Returns "informational" otherwise
 * @returns The default log level for the current environment
 * @example
 * ```typescript
 * // In development with DEBUG=1
 * console.log(getDefaultLogLevel()); // "debug"
 *
 * // In test environment
 * console.log(getDefaultLogLevel()); // "warning"
 *
 * // In production
 * console.log(getDefaultLogLevel()); // "informational"
 * ```
 */
const getDefaultLogLevel = (): ExtendedRfc5424LogLevels => {
    if (env.NODE_ENV === "debug" || env.DEBUG !== undefined) {
        return "debug";
    }

    if (env.NODE_ENV === "test") {
        return "warning";
    }

    return "informational";
};

/**
 * Creates a new Pail logger instance configured for server environments.
 *
 * This factory function creates a server-compatible logger with default processors
 * and reporters suitable for Node.js environments. It automatically configures
 * log levels based on environment variables and sets up pretty printing.
 * @template T - Custom logger types
 * @template L - Log level types
 * @param options Configuration options for the logger
 * @returns A new PailServer instance
 * @example
 * ```typescript
 * import { createPail } from "@visulima/pail";
 *
 * const logger = createPail({
 *   logLevel: "debug",
 *   types: {
 *     http: {
 *       color: "blue",
 *       label: "HTTP",
 *       logLevel: "info"
 *     }
 *   }
 * });
 *
 * logger.info("Server started on port 3000");
 * logger.http("GET /api/users 200");
 * ```
 * @example
 * ```bash
 * # Control log level via environment variable
 * PAIL_LOG_LEVEL=debug node app.js
 * ```
 */
export const createPail = <T extends string = string, L extends string = string>(options?: ConstructorOptions<T, L>): PailServerType<T, L> => {
    let logLevel: ExtendedRfc5424LogLevels = getDefaultLogLevel();

    if (env.PAIL_LOG_LEVEL !== undefined) {
        logLevel = env.PAIL_LOG_LEVEL as ExtendedRfc5424LogLevels;
    }

    return new PailServer<T, L>({
        logLevel,
        processors: [new MessageFormatterProcessor<L>()],
        reporters: [new PrettyReporter()],
        stderr,
        stdout,
        ...options,
    });
};

/**
 * Default Pail logger instance for server environments.
 *
 * A pre-configured logger instance ready for immediate use in Node.js environments.
 * Uses default configuration with pretty reporter, message formatter processor,
 * and automatic log level detection based on environment variables.
 * @example
 * ```typescript
 * import { pail } from "@visulima/pail";
 *
 * pail.info("Server listening on port 3000");
 * pail.error("Database connection failed", error);
 * pail.success("Migration completed successfully");
 * ```
 * @example
 * ```bash
 * # Set log level via environment
 * NODE_ENV=production node app.js
 * PAIL_LOG_LEVEL=debug node app.js
 * ```
 */
export const pail = createPail();

export type { PailServerType as Pail } from "./pail.server";
export type { MultiBarOptions, ProgressBarOptions, ProgressBarPayload, ProgressBarStyle, SingleBarOptions } from "./progress-bar";
export { getBarChar, MultiProgressBar, ProgressBar } from "./progress-bar";
export type {
    ConstructorOptions,
    DefaultLoggerTypes,
    DefaultLogTypes,
    ExtendedRfc5424LogLevels,
    LoggerConfiguration,
    LoggerFunction,
    LoggerTypesAwareReporter,
    LoggerTypesConfig,
    Processor,
    Reporter,
    StreamAwareReporter,
} from "./shared";
