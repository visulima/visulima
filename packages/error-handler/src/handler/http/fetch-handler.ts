import createFetchNegotiatedErrorHandler from "../../error-handler/fetch-create-negotiated-error-handler";
import fetchHtmlErrorHandler from "../../error-handler/fetch-html-error-handler";
import type { HtmlErrorHandlerOptions } from "../../error-handler/html-error-handler";
import type { FetchErrorHandlers } from "../../error-handler/types";

const fetchHandler = async (
    error: Error,
    options: HtmlErrorHandlerOptions & {
        extraHandlers?: FetchErrorHandlers;
        onError?: (error: Error, request: Request) => void | Promise<void>;
        showTrace?: boolean;
    } = {},
): Promise<(request: Request) => Promise<Response>> => {
    const defaultHtml = fetchHtmlErrorHandler(options);

    const negotiated = createFetchNegotiatedErrorHandler(options.extraHandlers ?? [], options.showTrace ?? true, defaultHtml);

    return async (request: Request): Promise<Response> => {
        if (options?.onError) {
            await options.onError(error, request);
        }

        return negotiated(error, request);
    };
};

export default fetchHandler;
