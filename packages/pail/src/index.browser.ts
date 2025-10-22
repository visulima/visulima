import type { PailBrowserType } from "./pail.browser";
import { PailBrowser } from "./pail.browser";
import MessageFormatterProcessor from "./processor/message-formatter-processor";
import JsonReporter from "./reporter/json/json-reporter.browser";
import type { ConstructorOptions } from "./types";

/**
 * Creates a new Pail logger instance configured for browser environments.
 *
 * This factory function creates a browser-compatible logger with default processors
 * and reporters suitable for client-side logging.
 * @template T - Custom logger types
 * @template L - Log level types
 * @param options Configuration options for the logger
 * @returns A new PailBrowser instance
 * @example
 * ```typescript
 * import { createPail } from "@visulima/pail";
 *
 * const logger = createPail({
 *   logLevel: "debug",
 *   types: {
 *     custom: {
 *       color: "blue",
 *       label: "CUSTOM",
 *       logLevel: "info"
 *     }
 *   }
 * });
 *
 * logger.info("Hello world!");
 * logger.custom("Custom message");
 * ```
 */
export const createPail = <T extends string = string, L extends string = string>(options?: ConstructorOptions<T, L>): PailBrowserType<T, L> =>
    new PailBrowser<T, L>({
        processors: [new MessageFormatterProcessor<L>()],
        reporters: [new JsonReporter<L>()],
        ...options,
    });

/**
 * Default Pail logger instance for browser environments.
 *
 * A pre-configured logger instance ready for immediate use in browser environments.
 * Uses default configuration with JSON reporter and message formatter processor.
 * @example
 * ```typescript
 * import { pail } from "@visulima/pail";
 *
 * pail.info("Application started");
 * pail.error("Something went wrong", new Error("Test error"));
 * ```
 */
export const pail = createPail();

export type { ObjectTreeOptions, TreeRenderFn, TreeSortFn } from "./object-tree";
export { renderObjectTree } from "./object-tree";
export type { PailBrowserType as Pail } from "./pail.browser";
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
