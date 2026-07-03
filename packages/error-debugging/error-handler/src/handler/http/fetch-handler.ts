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
    // still force traces on/off explicitly via `showTrace`. The optional chain keeps
    // NODE_ENV a runtime read (so it works on edge runtimes where `process` is absent)
    // and stops packem's esbuild `define` from inlining `process.env.NODE_ENV` — which
    // would both bake in the build-time value and break the `globalThis.`-prefixed chain.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- see comment above; the `?.` is load-bearing for runtime reads and the build
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
