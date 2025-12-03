import type { IncomingMessage, ServerResponse } from "node:http";

import { getReasonPhrase } from "http-status-codes";

import type { ErrorHandler } from "./types";
import { addStatusCodeToResponse } from "./utils/add-status-code-to-response";
import setErrorHeaders from "./utils/set-error-headers";

export type TextErrorFormatter = (parameters: {
    error: Error;
    reasonPhrase: string;
    request: IncomingMessage;
    response: ServerResponse;
    statusCode: number;
}) => string | Promise<string>;

export type TextErrorHandlerOptions = {
    formatter?: TextErrorFormatter;
};

export const textErrorHandler
    = (options: TextErrorHandlerOptions = {}): ErrorHandler =>
        async (error: Error, request: IncomingMessage, response: ServerResponse): Promise<void> => {
            addStatusCodeToResponse(response, error);

            setErrorHeaders(response, error);

            const { statusCode } = response;
            const reasonPhrase = getReasonPhrase(statusCode) || "Error";

            response.setHeader("content-type", "text/plain; charset=utf-8");

            if (options.formatter) {
                const text = await options.formatter({ error, reasonPhrase, request, response, statusCode });

                response.end(text);

                return;
            }

            const message = (error as Error & { message?: string }).message || reasonPhrase;
            const { expose } = error as Error & { expose?: boolean };
            const stack = expose ? error.stack : undefined;

            response.end(stack ? `${message}\n\n${stack}` : message);
        };
