import type { IncomingMessage, ServerResponse } from "node:http";

import type { HtmlErrorHandlerOptions } from "../../error-handler/html-error-handler";
import type { ErrorHandlers } from "../../error-handler/types";
import nodeHandler from "./node-handler";

type ErrorMiddlewareOptions = HtmlErrorHandlerOptions & {
    extraHandlers?: ErrorHandlers;
    /** Callback to handle error logging. */
    onError?: (error: Error, request: IncomingMessage, response: ServerResponse) => void | Promise<void>;
    /** Include stack traces in responses. Defaults to `NODE_ENV !== "production"`. */
    showTrace?: boolean;
};

type ErrorMiddleware = (error: Error, request: IncomingMessage, response: ServerResponse, next?: (error?: unknown) => void) => Promise<void>;

/**
 * Express/Connect-style error middleware.
 *
 * Unlike {@link nodeHandler}, which takes the error at construction time and so
 * has to be rebuilt inside every `catch` block, this returns a four-argument
 * error middleware you register once:
 *
 * ```ts
 * import { createErrorMiddleware } from "@visulima/error-handler";
 *
 * app.use(createErrorMiddleware({ showTrace: process.env.NODE_ENV !== "production" }));
 * ```
 *
 * The returned function matches the Express/Connect `(err, req, res, next)`
 * signature. If the response has already started streaming
 * (`response.headersSent`), it delegates to `next(error)` so the framework's
 * default handler can close the connection rather than double-writing.
 */
const createErrorMiddleware = (options: ErrorMiddlewareOptions = {}): ErrorMiddleware =>
    async (error: Error, request: IncomingMessage, response: ServerResponse, next?: (error?: unknown) => void): Promise<void> => {
        if (response.headersSent) {
            if (next) {
                next(error);
            }

            return;
        }

        await nodeHandler(error, options)(request, response);
    };

export type { ErrorMiddleware, ErrorMiddlewareOptions };
export default createErrorMiddleware;
