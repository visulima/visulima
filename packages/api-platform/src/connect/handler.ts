import type {
    FunctionLike, Nextable, Route, ValueOrPromise,
} from "@visulima/connect";
import createHttpError from "http-errors";
import type { IncomingMessage, ServerResponse } from "node:http";

import JsonapiErrorHandler from "../error-handler/jsonapi-error-handler";
import ProblemErrorHandler from "../error-handler/problem-error-handler";
import type { ErrorHandler, ErrorHandlers } from "../types";

// eslint-disable-next-line unicorn/consistent-function-scoping,max-len
export const onError = <Request extends IncomingMessage, Response extends ServerResponse>(errorHandlers: ErrorHandlers) => (error: unknown, request: Request, response: Response): ValueOrPromise<void> => {
    const apiFormat: string = request.headers.accept as string;

    let errorHandler: ErrorHandler = ProblemErrorHandler;

    if (apiFormat === "application/vnd.api+json") {
        errorHandler = JsonapiErrorHandler;
    }

    // eslint-disable-next-line no-restricted-syntax
    for (const { regex, handler } of errorHandlers) {
        if (regex.test(apiFormat)) {
            errorHandler = handler;
            break;
        }
    }

    return errorHandler(error, request, response);
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
