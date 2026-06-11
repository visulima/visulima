import type { IncomingMessage, ServerResponse } from "node:http";

import { getReasonPhrase } from "http-status-codes";

import type { ErrorHandler } from "./types";
import addStatusCodeToResponse from "./utils/add-status-code-to-response";
import setErrorHeaders from "./utils/set-error-headers";

const defaultCallbackParameter = "callback";

// A safe JS identifier path (e.g. `foo`, `foo.bar`) for the JSONP callback so the
// request-controlled value cannot inject executable JavaScript. Stateless (no
// g/y flag), so it is safe to share across invocations.
const safeCallbackName = /^[A-Za-z_$][\w$.]*$/u;

const jsonpErrorHandler
    = (options: JsonpErrorHandlerOptions = {}): ErrorHandler =>
        async (error: Error, request: IncomingMessage, response: ServerResponse): Promise<void> => {
            addStatusCodeToResponse(response, error);

            setErrorHeaders(response, error);

            const { statusCode } = response;
            const reasonPhrase = getReasonPhrase(statusCode);

            const url = new URL(request.url ?? "http://localhost", "http://localhost");
            const callbackParameterName = options.callbackParamName ?? defaultCallbackParameter;
            let callbackName = url.searchParams.get(callbackParameterName) ?? defaultCallbackParameter;

            let payload: JsonpErrorBody;

            if (options.formatter) {
                payload = await options.formatter({ error, reasonPhrase, request, response, statusCode });
            } else {
                const { expose } = error as Error & { expose?: boolean };

                payload = {
                    message: error.message || reasonPhrase,
                    // eslint-disable-next-line perfectionist/sort-objects
                    error: reasonPhrase,

                    statusCode,
                    ...expose ? { stack: error.stack } : {},
                };
            }

            // Restrict the JSONP callback to a safe JS identifier path so the
            // request-controlled value cannot inject executable JavaScript.
            if (callbackName.length > 64 || !safeCallbackName.test(callbackName)) {
                callbackName = defaultCallbackParameter;
            }

            response.setHeader("content-type", "application/javascript; charset=utf-8");
            // Prevent content-type sniffing so a browser cannot reinterpret the
            // JSONP payload as HTML, mirroring Express's `res.jsonp` hardening.
            response.setHeader("x-content-type-options", "nosniff");

            // The `/**/` prologue defeats Flash-based content-type confusion and
            // is what Express prepends to JSONP responses for the same reason.
            const body = JSON.stringify(payload)
            // Escape U+2028/U+2029 which are valid JSON but break JS string literals.
                .replaceAll("\u2028", String.raw`\u2028`)
                .replaceAll("\u2029", String.raw`\u2029`);

            response.end(`/**/ typeof ${callbackName} === 'function' && ${callbackName}(${body});`);
        };

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

export { jsonpErrorHandler };
