import createFetchNegotiatedErrorHandler from "../../error-handler/fetch-create-negotiated-error-handler";
import fetchHtmlErrorHandler from "../../error-handler/fetch-html-error-handler";
import type { HtmlErrorHandlerOptions } from "../../error-handler/html-error-handler";
import type { FetchErrorHandlers } from "../../error-handler/types";

const fetchHandler = (
    error: Error,
    options: HtmlErrorHandlerOptions & {
        extraHandlers?: FetchErrorHandlers;
        onError?: (error: Error, request: Request) => void | Promise<void>;
        showTrace?: boolean;
    } = {},
): (request: Request) => Promise<Response> => {
    const defaultHtml = fetchHtmlErrorHandler(options);

    // Default to exposing traces only outside production so stack traces are not
    // leaked into JSON/text/XML/JSONP response bodies by accident. Consumers can
    // still force traces on/off explicitly via `showTrace`. Reading `env` into a
    // local keeps NODE_ENV a runtime read (so it works on edge runtimes where
    // `process` is absent) and stops packem's esbuild `define` from inlining
    // `process.env.NODE_ENV`. On edge/worker runtimes where the environment
    // cannot be determined at all we fail closed (traces off) rather than leak
    // them by accident — NODE_ENV is almost never set there.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- see comment above; the `?.` is load-bearing for runtime reads and the build
    const environment = globalThis.process?.env;
    const showTrace = options.showTrace ?? (environment === undefined ? false : environment.NODE_ENV !== "production");

    const negotiated = createFetchNegotiatedErrorHandler(options.extraHandlers ?? [], showTrace, defaultHtml);

    return async (request: Request): Promise<Response> => {
        if (options.onError) {
            // A throwing logging callback must not prevent the negotiated error
            // response from being produced.
            try {
                await options.onError(error, request);
            } catch (onErrorError) {
                // eslint-disable-next-line no-console
                console.error(onErrorError);
            }
        }

        return negotiated(error, request);
    };
};

export default fetchHandler;
