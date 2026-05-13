import type { IncomingMessage, ServerResponse } from "node:http";

import type { FunctionLike, Nextable, Route, ValueOrPromise } from "@visulima/connect";
import createHttpError from "http-errors";

import JsonapiErrorHandler from "../error-handler/jsonapi-error-handler";
import ProblemErrorHandler from "../error-handler/problem-error-handler";
import type { ErrorHandler, ErrorHandlers } from "../error-handler/types";

/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters -- Request generic flows into the returned function's call signature for connect compatibility */
export const onError
    = <Request extends IncomingMessage, Response extends ServerResponse>(
        errorHandlers: ErrorHandlers,
        showTrace: boolean,
    ): (error: unknown, request: Request, response: Response, routes: Route<Nextable<FunctionLike>>[]) => Promise<Response | undefined> =>
    /* eslint-enable @typescript-eslint/no-unnecessary-type-parameters */
    // eslint-disable-next-line @typescript-eslint/require-await -- the returned handler must match the connect async signature even though no awaits occur
        async (error: unknown, request: Request, response: Response): Promise<Response | undefined> => {
            const apiFormat: string = request.headers.accept as string;

            let errorHandler: ErrorHandler = ProblemErrorHandler;

            if (apiFormat === "application/vnd.api+json") {
                errorHandler = JsonapiErrorHandler;
            }

            for (const { handler, regex } of errorHandlers) {
                if (regex.test(apiFormat)) {
                    errorHandler = handler;
                    break;
                }
            }

            // eslint-disable-next-line no-param-reassign
            (error as Error & { expose: boolean }).expose = showTrace;

            // eslint-disable-next-line no-void -- preserve fire-and-forget semantics; awaiting would change error propagation timing
            void errorHandler(error, request, response);

            return undefined;
        };

/* eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- Request/Response generics are required for compatibility with connect ValueOrPromise contract at call sites */
export const onNoMatch: <Request extends IncomingMessage, Response extends ServerResponse>(
    request: Request,
    response: Response,
    routes: Route<Nextable<FunctionLike>>[],
) => ValueOrPromise<Response | undefined>
    // eslint-disable-next-line @typescript-eslint/require-await -- onNoMatch must satisfy the async connect signature even though it only throws synchronously
    = async (request, response, routes) => {
        const uniqueMethods = [...new Set(routes.map((route) => route.method))].join(", ");

        response.setHeader("Allow", uniqueMethods);
        response.statusCode = 405;

        throw createHttpError(405, `No route with [${String(request.method)}] method found.`);
    };
