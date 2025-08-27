import type { IncomingMessage, ServerResponse } from "node:http";

import type { SolutionFinder } from "../types";
import { htmlErrorHandler, type HtmlErrorHandlerOptions } from "../error-handler/html-error-handler";
import createNegotiatedErrorHandler from "../error-handler/create-negotiated-error-handler";
import type { ErrorHandlers } from "../error-handler/types";

const httpDisplayer = async (
    error: Error,
    solutionFinders: SolutionFinder[],
    options: HtmlErrorHandlerOptions & { showTrace?: boolean; extraHandlers?: ErrorHandlers } = {},
): Promise<(request: IncomingMessage, response: ServerResponse) => Promise<void>> => {
    const defaultHtml = htmlErrorHandler(solutionFinders, options);

    const negotiated = createNegotiatedErrorHandler(
        options.extraHandlers ?? [],
        options.showTrace ?? true,
        defaultHtml,
    );

    return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
        await negotiated(error, request, response);
    };
};

export default httpDisplayer;
