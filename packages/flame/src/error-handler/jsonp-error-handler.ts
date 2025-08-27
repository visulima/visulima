import type { IncomingMessage, ServerResponse } from "node:http";

import { getReasonPhrase } from "http-status-codes";

import type { ErrorHandler } from "./types";
import { addStatusCodeToResponse, setErrorHeaders } from "./utils";

export type JsonpErrorBody = Record<string, unknown> | unknown[];

export type JsonpErrorFormatter = (params: {
    error: Error;
    request: IncomingMessage;
    response: ServerResponse;
    reasonPhrase: string;
    statusCode: number;
}) => JsonpErrorBody | Promise<JsonpErrorBody>;

export type JsonpErrorHandlerOptions = {
    callbackParamName?: string;
    formatter?: JsonpErrorFormatter;
};

const defaultCallbackParam = "callback";

export const jsonpErrorHandler = (options: JsonpErrorHandlerOptions = {}): ErrorHandler => {
    return async (error: Error, request: IncomingMessage, response: ServerResponse): Promise<void> => {
        addStatusCodeToResponse(response, error);

        setErrorHeaders(response, error);

        const statusCode = response.statusCode;
        const reasonPhrase = getReasonPhrase(statusCode) || "An error occurred";

        const url = new URL(request.url ?? "http://localhost", "http://localhost");
        const callbackParamName = options.callbackParamName || defaultCallbackParam;
        const callbackName = url.searchParams.get(callbackParamName) || "callback";

        let payload: JsonpErrorBody;
        if (options.formatter) {
            payload = await options.formatter({ error, request, response, reasonPhrase, statusCode });
        } else {
            const expose = (error as Error & { expose?: boolean }).expose;
            payload = {
                statusCode,
                // eslint-disable-next-line perfectionist/sort-objects
                error: reasonPhrase,
                // eslint-disable-next-line perfectionist/sort-objects
                message: (error as Error & { message?: string }).message || reasonPhrase,
                ...(expose ? { stack: error.stack } : {}),
            };
        }

        response.setHeader("content-type", "application/javascript; charset=utf-8");
        response.end(`${callbackName}(${JSON.stringify(payload)});`);
    };
};

export default jsonpErrorHandler;


