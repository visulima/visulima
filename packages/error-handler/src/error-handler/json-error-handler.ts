import type { IncomingMessage, ServerResponse } from "node:http";

import { getReasonPhrase } from "http-status-codes";

import type { ErrorHandler } from "./types";
import { addStatusCodeToResponse } from "./utils/add-status-code-to-response";
import { sendJson } from "./utils/send-json";
import { setErrorHeaders } from "./utils/set-error-headers";

export type JsonErrorBody = Record<string, unknown> | unknown[];

export type JsonErrorFormatter = (params: {
    error: Error;
    request: IncomingMessage;
    response: ServerResponse;
    reasonPhrase: string;
    statusCode: number;
}) => JsonErrorBody | Promise<JsonErrorBody>;

export type JsonErrorHandlerOptions = {
    formatter?: JsonErrorFormatter;
};

export const jsonErrorHandler = (options: JsonErrorHandlerOptions = {}): ErrorHandler => {
    return async (error: Error, request: IncomingMessage, response: ServerResponse): Promise<void> => {
        addStatusCodeToResponse(response, error);

        setErrorHeaders(response, error);

        const statusCode = response.statusCode;
        const reasonPhrase = getReasonPhrase(statusCode) || "An error occurred";

        if (options.formatter) {
            const body = await options.formatter({ error, request, response, reasonPhrase, statusCode });
            sendJson(response, body);

            return;
        }

        const expose = (error as Error & { expose?: boolean }).expose;

        sendJson(response, {
            statusCode,
            // eslint-disable-next-line perfectionist/sort-objects
            error: reasonPhrase,
            // eslint-disable-next-line perfectionist/sort-objects
            message: (error as Error & { message?: string }).message || reasonPhrase,
            ...(expose ? { stack: error.stack } : {}),
        });
    };
};
