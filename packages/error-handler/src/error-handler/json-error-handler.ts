import type { IncomingMessage, ServerResponse } from "node:http";

import { getReasonPhrase } from "http-status-codes";

import type { ErrorHandler } from "./types";
import { addStatusCodeToResponse } from "./utils/add-status-code-to-response";
import { sendJson } from "./utils/send-json";
import setErrorHeaders from "./utils/set-error-headers";

export type JsonErrorBody = Record<string, unknown> | unknown[];

export type JsonErrorFormatter = (parameters: {
    error: Error;
    reasonPhrase: string;
    request: IncomingMessage;
    response: ServerResponse;
    statusCode: number;
}) => JsonErrorBody | Promise<JsonErrorBody>;

export type JsonErrorHandlerOptions = {
    formatter?: JsonErrorFormatter;
};

export const jsonErrorHandler
    = (options: JsonErrorHandlerOptions = {}): ErrorHandler =>
        async (error: Error, request: IncomingMessage, response: ServerResponse): Promise<void> => {
            addStatusCodeToResponse(response, error);

            setErrorHeaders(response, error);

            const { statusCode } = response;
            const reasonPhrase = getReasonPhrase(statusCode) || "An error occurred";

            if (options.formatter) {
                const body = await options.formatter({ error, reasonPhrase, request, response, statusCode });

                sendJson(response, body);

                return;
            }

            const { expose } = error as Error & { expose?: boolean };

            sendJson(response, {
                message: (error as Error & { message?: string }).message || reasonPhrase,
                // eslint-disable-next-line perfectionist/sort-objects
                error: reasonPhrase,

                statusCode,
                ...expose ? { stack: error.stack } : {},
            });
        };
