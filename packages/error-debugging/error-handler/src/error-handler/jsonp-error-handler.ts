import type { IncomingMessage, ServerResponse } from "node:http";

import { getReasonPhrase } from "http-status-codes";

import type { ErrorHandler } from "./types";
import { addStatusCodeToResponse } from "./utils/add-status-code-to-response";
import setErrorHeaders from "./utils/set-error-headers";

export type JsonpErrorBody = Record<string, unknown> | unknown[];

export type JsonpErrorFormatter = (parameters: {
    error: Error;
    reasonPhrase: string;
    request: IncomingMessage;
    response: ServerResponse;
    statusCode: number;
}) => JsonpErrorBody | Promise<JsonpErrorBody>;

export type JsonpErrorHandlerOptions = {
    callbackParamName?: string;
    formatter?: JsonpErrorFormatter;
};

const defaultCallbackParameter = "callback";

export const jsonpErrorHandler
    = (options: JsonpErrorHandlerOptions = {}): ErrorHandler =>
        async (error: Error, request: IncomingMessage, response: ServerResponse): Promise<void> => {
            addStatusCodeToResponse(response, error);

            setErrorHeaders(response, error);

            const { statusCode } = response;
            const reasonPhrase = getReasonPhrase(statusCode) || "An error occurred";

            const url = new URL(request.url ?? "http://localhost", "http://localhost");
            const callbackParameterName = options.callbackParamName || defaultCallbackParameter;
            const callbackName = url.searchParams.get(callbackParameterName) || "callback";

            let payload: JsonpErrorBody;

            if (options.formatter) {
                payload = await options.formatter({ error, reasonPhrase, request, response, statusCode });
            } else {
                const { expose } = error as Error & { expose?: boolean };

                payload = {
                    message: (error as Error & { message?: string }).message || reasonPhrase,
                    // eslint-disable-next-line perfectionist/sort-objects
                    error: reasonPhrase,

                    statusCode,
                    ...expose ? { stack: error.stack } : {},
                };
            }

            response.setHeader("content-type", "application/javascript; charset=utf-8");
            response.end(`${callbackName}(${JSON.stringify(payload)});`);
        };
