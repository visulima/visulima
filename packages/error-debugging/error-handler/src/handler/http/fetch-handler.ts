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
    // still force traces on/off explicitly via `showTrace`. `globalThis.process`
    // may be undefined on edge runtimes, hence the optional chaining.
    const showTrace = options.showTrace ?? globalThis.process?.env?.NODE_ENV !== "production";

    const negotiated = createFetchNegotiatedErrorHandler(options.extraHandlers ?? [], showTrace, defaultHtml);

    return async (request: Request): Promise<Response> => {
        if (options.onError) {
            await options.onError(error, request);
        }

        return negotiated(error, request);
    };
};

export default fetchHandler;
