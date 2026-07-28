import type { IncomingMessage, ServerResponse } from "node:http";

import { Accepts } from "@tinyhttp/accepts";

import { jsonErrorHandler } from "./json-error-handler";
import { jsonpErrorHandler } from "./jsonp-error-handler";
import problemErrorHandler from "./problem-error-handler";
import { textErrorHandler } from "./text-error-handler";
import type { ErrorHandler, ErrorHandlers } from "./types";
import withExpose from "./utils/with-expose";

// These formatters take no options, so their handler factories are pure and can
// be instantiated once at module load rather than on every request.
const defaultJsonpHandler = jsonpErrorHandler();
const defaultJsonHandler = jsonErrorHandler();
const defaultTextHandler = textErrorHandler();

// The JSON:API and XML formatters pull in `ts-japi` and `jstoxml` respectively.
// They are loaded lazily — only when a request actually negotiates one of those
// content types — so a JSON-only consumer of this handler never pays the
// startup cost of parsing those libraries (notably on Cloudflare/Deno cold
// starts). The resolved singleton is memoised after the first use.
let jsonapiHandlerPromise: Promise<ErrorHandler> | undefined;
let xmlHandlerPromise: Promise<ErrorHandler> | undefined;

const loadJsonapiHandler = async (): Promise<ErrorHandler> => {
    jsonapiHandlerPromise ??= import("./jsonapi-error-handler").then((module) => module.default);

    return jsonapiHandlerPromise;
};

const loadXmlHandler = async (): Promise<ErrorHandler> => {
    xmlHandlerPromise ??= import("./xml-error-handler").then((module) => module.xmlErrorHandler());

    return xmlHandlerPromise;
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
                        errorHandler = await loadJsonapiHandler();

                        break;
                    }
                    case "application/xml":
                    case "text/xml": {
                        errorHandler = await loadXmlHandler();

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
