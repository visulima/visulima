import type { IncomingMessage, ServerResponse } from "node:http";

import { htmlErrorHandler, type HtmlErrorHandlerOptions } from "../../error-handler/html-error-handler";
import createNegotiatedErrorHandler from "../../error-handler/create-negotiated-error-handler";
import type { ErrorHandlers } from "../../error-handler/types";

const httpHandler = async (
    error: Error,
    options: HtmlErrorHandlerOptions & {
        showTrace?: boolean;
        extraHandlers?: ErrorHandlers, 
        // Callback to handle error logging
        onError?: (error: Error, request: IncomingMessage, response: ServerResponse) => void | Promise<void>;
    } = {},
): Promise<(request: IncomingMessage, response: ServerResponse) => Promise<void>> => {
    const defaultHtml = htmlErrorHandler(options);

    const negotiated = createNegotiatedErrorHandler(options.extraHandlers ?? [], options.showTrace ?? true, defaultHtml);

    return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
        if (options?.onError) {
            await options.onError(error, request, response);
        }
        
        await negotiated(error, request, response);
    };
};

export default httpHandler;
