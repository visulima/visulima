import type { IncomingMessage, ServerResponse } from "node:http";

import createNegotiatedErrorHandler from "../../error-handler/create-negotiated-error-handler";
import type { HtmlErrorHandlerOptions } from "../../error-handler/html-error-handler";
import { htmlErrorHandler } from "../../error-handler/html-error-handler";
import type { ErrorHandlers } from "../../error-handler/types";

const nodeHandler = (
    error: Error,
    options: HtmlErrorHandlerOptions & {
        extraHandlers?: ErrorHandlers;
        // Callback to handle error logging
        onError?: (error: Error, request: IncomingMessage, response: ServerResponse) => void | Promise<void>;
        showTrace?: boolean;
    } = {},
): (request: IncomingMessage, response: ServerResponse) => Promise<void> => {
    const defaultHtml = htmlErrorHandler(options);

    // Default to exposing traces only outside production so stack traces are not
    // leaked into JSON/text/XML/JSONP response bodies by accident. Consumers can
    // still force traces on/off explicitly via `showTrace`.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- the optional chain keeps NODE_ENV a runtime read; without it packem's esbuild `define` inlines `process.env.NODE_ENV`, turning the `globalThis.`-prefixed chain into a syntax error at build time
    const showTrace = options.showTrace ?? globalThis.process?.env?.NODE_ENV !== "production";

    const negotiated = createNegotiatedErrorHandler(options.extraHandlers ?? [], showTrace, defaultHtml);

    return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
        if (options.onError) {
            await options.onError(error, request, response);
        }

        await negotiated(error, request, response);
    };
};

export default nodeHandler;
