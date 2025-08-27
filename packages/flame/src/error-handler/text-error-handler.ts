import type { IncomingMessage, ServerResponse } from "node:http";

import { getReasonPhrase } from "http-status-codes";

import type { ErrorHandler } from "./types";
import { addStatusCodeToResponse, setErrorHeaders } from "./utils";

export type TextErrorFormatter = (params: {
    error: Error;
    request: IncomingMessage;
    response: ServerResponse;
    reasonPhrase: string;
    statusCode: number;
}) => string | Promise<string>;

export type TextErrorHandlerOptions = {
    formatter?: TextErrorFormatter;
};

export const textErrorHandler = (options: TextErrorHandlerOptions = {}): ErrorHandler => {
    return async (error: Error, request: IncomingMessage, response: ServerResponse): Promise<void> => {
        addStatusCodeToResponse(response, error);

        setErrorHeaders(response, error);

        const statusCode = response.statusCode;
        const reasonPhrase = getReasonPhrase(statusCode) || "Error";

        response.setHeader("content-type", "text/plain; charset=utf-8");

        if (options.formatter) {
            const text = await options.formatter({ error, request, response, reasonPhrase, statusCode });

            response.end(text);

            return;
        }

        const message = (error as Error & { message?: string }).message || reasonPhrase;
        const expose = (error as Error & { expose?: boolean }).expose;
        const stack = expose ? error.stack : undefined;

        response.end(stack ? `${message}\n\n${stack}` : message);
    };
};

export default textErrorHandler;


