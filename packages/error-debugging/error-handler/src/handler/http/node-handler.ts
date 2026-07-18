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
    // still force traces on/off explicitly via `showTrace`. Reading `env` into a
    // local keeps NODE_ENV a runtime read; without it packem's esbuild `define`
    // inlines `process.env.NODE_ENV`, turning the `globalThis.`-prefixed chain
    // into a syntax error at build time. When the environment cannot be
    // determined we fail closed (traces off) rather than leak them by accident.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- see comment above; the `?.` is load-bearing for runtime reads and the build
    const environment = globalThis.process?.env;
    const showTrace = options.showTrace ?? (environment === undefined ? false : environment.NODE_ENV !== "production");

    const negotiated = createNegotiatedErrorHandler(options.extraHandlers ?? [], showTrace, defaultHtml);

    return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
        if (options.onError) {
            // A throwing logging callback must not prevent the negotiated error
            // response from being written.
            try {
                await options.onError(error, request, response);
            } catch (onErrorError) {
                // eslint-disable-next-line no-console
                console.error(onErrorError);
            }
        }

        await negotiated(error, request, response);
    };
};

export default nodeHandler;
