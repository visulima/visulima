import type { IncomingMessage, ServerResponse } from "node:http";

import { Accepts } from "@tinyhttp/accepts";

import { jsonErrorHandler as JsonErrorHandler } from "./json-error-handler";
import JsonapiErrorHandler from "./jsonapi-error-handler";
import { jsonpErrorHandler as JsonpErrorHandler } from "./jsonp-error-handler";
import ProblemErrorHandler from "./problem-error-handler";
import { textErrorHandler as TextErrorHandler } from "./text-error-handler";
import type { ErrorHandler, ErrorHandlers } from "./types";
import { xmlErrorHandler as XmlErrorHandler } from "./xml-error-handler";

const createNegotiatedErrorHandler
    = <Request extends IncomingMessage, Response extends ServerResponse>(errorHandlers: ErrorHandlers, showTrace: boolean, defaultHtmlHandler?: ErrorHandler) =>
        async (error: Error, request: Request, response: Response): Promise<void> => {
            const accept = new Accepts(request);

            // Server preference order
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

            let errorHandler: ErrorHandler = defaultHtmlHandler || ProblemErrorHandler;

            if (chosenType === "text/html" && defaultHtmlHandler) {
                errorHandler = defaultHtmlHandler;
            } else {
                switch (chosenType) {
                    case "application/javascript":
                    case "text/javascript": {
                        errorHandler = JsonpErrorHandler();

                        break;
                    }
                    case "application/json": {
                        errorHandler = JsonErrorHandler();

                        break;
                    }
                    case "application/problem+json": {
                        errorHandler = ProblemErrorHandler;

                        break;
                    }
                    case "application/vnd.api+json": {
                        errorHandler = JsonapiErrorHandler;

                        break;
                    }
                    case "application/xml":
                    case "text/xml": {
                        errorHandler = XmlErrorHandler();

                        break;
                    }
                    case "text/plain": {
                        errorHandler = TextErrorHandler();

                        break;
                    }
                // No default
                }
            }

            // Allow consumer overrides via regex
            // eslint-disable-next-line no-loops/no-loops
            for (const { handler, regex } of errorHandlers) {
                const headerValue = request.headers.accept ?? "";
                const headerString = Array.isArray(headerValue) ? headerValue.join(",") : headerValue;

                if (regex.test(headerString)) {
                    errorHandler = handler;
                    break;
                }
            }

            // eslint-disable-next-line no-param-reassign
            (error as Error & { expose: boolean }).expose = showTrace;

            await errorHandler(error, request, response);
        };

export default createNegotiatedErrorHandler;
