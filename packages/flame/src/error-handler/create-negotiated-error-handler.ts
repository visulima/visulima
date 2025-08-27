import type { IncomingMessage, ServerResponse } from "node:http";

import type { ErrorHandler, ErrorHandlers } from "./types";
import JsonapiErrorHandler from "./jsonapi-error-handler";
import ProblemErrorHandler from "./problem-error-handler";
import { Accepts } from "@tinyhttp/accepts";

const createNegotiatedErrorHandler =
    <Request extends IncomingMessage, Response extends ServerResponse>(errorHandlers: ErrorHandlers, showTrace: boolean, defaultHtmlHandler?: ErrorHandler) =>
    async (error: unknown, request: Request, response: Response): Promise<void> => {
        const accept = new Accepts(request);

        // Server preference order
        const chosenType = accept.type(["text/html", "application/vnd.api+json", "application/problem+json", "application/json"]) as string | false;

        let errorHandler: ErrorHandler = defaultHtmlHandler || ProblemErrorHandler;

        if (chosenType === "text/html" && defaultHtmlHandler) {
            errorHandler = defaultHtmlHandler;
        } else if (chosenType === "application/vnd.api+json") {
            errorHandler = JsonapiErrorHandler;
        } else if (chosenType === "application/problem+json" || chosenType === "application/json") {
            errorHandler = ProblemErrorHandler;
        }

        // Allow consumer overrides via regex
        // eslint-disable-next-line no-restricted-syntax,no-loops/no-loops
        for (const { handler, regex } of errorHandlers) {
            const headerVal = request.headers.accept ?? "";
            const headerStr = Array.isArray(headerVal) ? headerVal.join(",") : headerVal;
            if (regex.test(headerStr)) {
                errorHandler = handler;
                break;
            }
        }

        // eslint-disable-next-line no-param-reassign
        (error as Error & { expose: boolean }).expose = showTrace;

        await errorHandler(error, request, response);
    };

export default createNegotiatedErrorHandler;
