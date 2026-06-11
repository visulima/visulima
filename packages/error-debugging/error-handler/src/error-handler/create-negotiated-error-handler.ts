import type { IncomingMessage, ServerResponse } from "node:http";

import { Accepts } from "@tinyhttp/accepts";

import { jsonErrorHandler } from "./json-error-handler";
import jsonapiErrorHandler from "./jsonapi-error-handler";
import { jsonpErrorHandler } from "./jsonp-error-handler";
import problemErrorHandler from "./problem-error-handler";
import { textErrorHandler } from "./text-error-handler";
import type { ErrorHandler, ErrorHandlers } from "./types";
import { xmlErrorHandler } from "./xml-error-handler";

// These formatters take no options, so their handler factories are pure and can
// be instantiated once at module load rather than on every request.
const defaultJsonpHandler = jsonpErrorHandler();
const defaultJsonHandler = jsonErrorHandler();
const defaultXmlHandler = xmlErrorHandler();
const defaultTextHandler = textErrorHandler();

/**
 * Apply the `expose` flag (which controls whether stack traces leak into the
 * response body) without permanently mutating the caller's error object. The
 * original `expose` state is captured and restored once the handler resolves,
 * so the flag cannot leak into later logging or a second handler invocation
 * configured with different `showTrace` settings.
 */
const withExpose = async (error: Error, showTrace: boolean, run: () => Promise<void> | void): Promise<void> => {
    const hadOwnExpose = Object.hasOwn(error, "expose");
    const previousExpose = (error as Error & { expose?: boolean }).expose;

    if (!showTrace) {
        // eslint-disable-next-line no-param-reassign -- enriching the passed-in error
        (error as Error & { expose: boolean }).expose = false;
    } else if (!("expose" in error)) {
        // eslint-disable-next-line no-param-reassign -- enriching the passed-in error
        (error as Error & { expose: boolean }).expose = true;
    }

    try {
        await run();
    } finally {
        if (hadOwnExpose) {
            // eslint-disable-next-line no-param-reassign -- restoring the passed-in error
            (error as Error & { expose?: boolean }).expose = previousExpose;
        } else {
            // eslint-disable-next-line no-param-reassign -- restoring the passed-in error
            delete (error as Error & { expose?: boolean }).expose;
        }
    }
};

const createNegotiatedErrorHandler
    = (errorHandlers: ErrorHandlers, showTrace: boolean, defaultHtmlHandler?: ErrorHandler) =>
        async (error: Error, request: IncomingMessage, response: ServerResponse): Promise<void> => {
            const accept = new Accepts(request);

            // Server preference order. `@tinyhttp/accepts` already honours the
            // client's q-values when picking among these.
            const chosenType = accept.type([
                "text/html",
                "application/vnd.api+json",
                "application/problem+json",
                "application/json",
                "text/plain",
                "application/javascript",
                "text/javascript",
                "application/xml",
                "text/xml",
            ]) as string | false;

            let errorHandler: ErrorHandler = defaultHtmlHandler ?? problemErrorHandler;

            if (chosenType === "text/html" && defaultHtmlHandler) {
                errorHandler = defaultHtmlHandler;
            } else {
                switch (chosenType) {
                    case "application/javascript":
                    case "text/javascript": {
                        errorHandler = defaultJsonpHandler;

                        break;
                    }
                    case "application/json": {
                        errorHandler = defaultJsonHandler;

                        break;
                    }
                    case "application/problem+json": {
                        errorHandler = problemErrorHandler;

                        break;
                    }
                    case "application/vnd.api+json": {
                        errorHandler = jsonapiErrorHandler;

                        break;
                    }
                    case "application/xml":
                    case "text/xml": {
                        errorHandler = defaultXmlHandler;

                        break;
                    }
                    case "text/plain": {
                        errorHandler = defaultTextHandler;

                        break;
                    }
                    default: {
                    // Use the default errorHandler already set above
                        break;
                    }
                }
            }

            // Allow consumer overrides via regex
            for (const { handler, regex } of errorHandlers) {
                const headerValue = request.headers.accept ?? "";
                const headerString = Array.isArray(headerValue) ? headerValue.join(",") : headerValue;

                if (regex.test(headerString)) {
                    errorHandler = handler;
                    break;
                }
            }

            await withExpose(error, showTrace, () => errorHandler(error, request, response));
        };

export default createNegotiatedErrorHandler;
