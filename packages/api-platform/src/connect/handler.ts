import type { IncomingMessage, ServerResponse } from "node:http";

import type { FunctionLike, Nextable, Route, ValueOrPromise } from "@visulima/connect";
import createHttpError from "http-errors";

import JsonapiErrorHandler from "../error-handler/jsonapi-error-handler";
import ProblemErrorHandler from "../error-handler/problem-error-handler";
import type { ErrorHandler, ErrorHandlers } from "../error-handler/types";

export const onError
    = <Request extends IncomingMessage, Response extends ServerResponse>(errorHandlers: ErrorHandlers, showTrace: boolean) =>
        async (error: unknown, request: Request, response: Response): Promise<void> => {
            const apiFormat: string = request.headers.accept as string;

            let errorHandler: ErrorHandler = ProblemErrorHandler;

            if (apiFormat === "application/vnd.api+json") {
                errorHandler = JsonapiErrorHandler;
            }

            // eslint-disable-next-line no-loops/no-loops
            for (const { handler, regex } of errorHandlers) {
                if (regex.test(apiFormat)) {
                    errorHandler = handler;
                    break;
                }
            }

            // eslint-disable-next-line no-param-reassign
            (error as Error & { expose: boolean }).expose = showTrace;

            errorHandler(error, request, response);
        };

export const onNoMatch: <Request extends IncomingMessage, Response extends ServerResponse>(
    request: Request,
    response: Response,
    routes: Route<Nextable<FunctionLike>>[],
) => ValueOrPromise<void> = async (request, response, routes) => {
    const uniqueMethods = [...new Set(routes.map((route) => route.method))].join(", ");

    response.setHeader("Allow", uniqueMethods);
    response.statusCode = 405;

    throw createHttpError(405, `No route with [${request.method}] method found.`);
};
