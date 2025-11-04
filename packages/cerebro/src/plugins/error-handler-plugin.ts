import type { RenderErrorOptions } from "@visulima/error";
// eslint-disable-next-line import/no-extraneous-dependencies
import { renderError } from "@visulima/error";

import type { Plugin } from "../types/plugin";
import type { Toolbox } from "../types/toolbox";
import { exitProcess } from "../util/general/runtime-process";

export type ErrorHandlerOptions = {
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
    const handleError = async (error: Error, toolbox: Toolbox) => {
        const { logger, runtime } = toolbox;
        const { detailed = false, exitOnError = true, formatter, logErrors = true, renderOptions = {} } = options;

        if (!logErrors) {
            return;
        }

        if (formatter) {
            // Use custom formatter
            logger.error(formatter(error));
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

        // Exit process if configured
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
