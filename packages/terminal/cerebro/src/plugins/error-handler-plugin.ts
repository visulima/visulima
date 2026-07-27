import type { RenderErrorOptions } from "@visulima/error";
// eslint-disable-next-line import/no-extraneous-dependencies
import { renderError } from "@visulima/error";

import type { Plugin } from "../types/plugin";
import type { Toolbox } from "../types/toolbox";
import { exitProcess } from "../util/general/runtime-process";

export type ErrorHandlerOptions = {
    /**
     * Predicate marking an error as an *expected* user-facing failure — a
     * bad flag, a missing file, a non-zero task exit. Matching errors are
     * logged as their message alone, with no stack trace, because the
     * frames point into CLI internals the user cannot act on.
     *
     * Ignored when `detailed` is true, so a debug flag still surfaces the
     * full stack for every error. `formatter`, when set, wins over this.
     * @default undefined (every error renders with its stack)
     */
    concise?: (error: Error) => boolean;

    /** Show detailed error information including stack traces and code frames (default: false) */
    detailed?: boolean;
    /** Exit process after handling error (default: true) */
    exitOnError?: boolean;
    /** Custom error formatter function */
    formatter?: (error: Error) => string;
    /** Whether to log errors (default: true) */
    logErrors?: boolean;
    /** Options for renderError from \@visulima/error (only used when detailed is true) */
    renderOptions?: Partial<RenderErrorOptions>;
};

/**
 * Create an error handler plugin for enhanced error reporting.
 * Uses \@visulima/error for beautiful error formatting with code frames and stack traces.
 * @param options Error handler configuration options
 * @returns Plugin instance
 */
export const errorHandlerPlugin = (options: ErrorHandlerOptions = {}): Plugin => {
    const handleError = (error: Error, toolbox: Toolbox) => {
        const { logger, runtime } = toolbox;
        const { concise, detailed = false, exitOnError = true, formatter, logErrors = true, renderOptions = {} } = options;

        // Log error if logging is enabled
        if (logErrors) {
            if (formatter) {
                // Use custom formatter
                logger.error(formatter(error));
            } else if (!detailed && concise?.(error)) {
                // Expected failure: the message is the whole diagnostic, and
                // a stack would only bury it under CLI-internal frames.
                logger.error(error.message);
            } else if (detailed) {
                const cwd = runtime.getCwd();
                const renderedError = renderError(error, {
                    cwd,
                    hideErrorCodeView: false,
                    hideErrorTitle: false,
                    hideMessage: false,
                    linesAbove: 2,
                    linesBelow: 3,
                    ...renderOptions,
                });

                logger.error(renderedError);
            } else {
                // Simple error logging (default behavior)
                logger.error(error);
            }
        }

        // Exit process if configured (always evaluated, regardless of logErrors)
        if (exitOnError) {
            exitProcess(1);
        }
    };

    return {
        description: "Enhanced error handling and reporting with beautiful code frames",
        name: "error-handler",
        onError: handleError,
        version: "1.0.0",
    };
};
