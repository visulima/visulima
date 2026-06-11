// http-errors is a CJS module that attaches named class exports as properties of its default
// `createHttpError` function. A named ESM import (`import { HttpError } from "http-errors"`)
// produces an ESM bundle that Node refuses to load with "Named export 'HttpError' not found".
// Read the class off the default import instead so packem emits a CJS-compatible shape.
import createHttpError from "http-errors";
import { getReasonPhrase } from "http-status-codes";
import tsJapi from "ts-japi";

import type { ErrorHandler } from "./types";
import { addStatusCodeToResponse, sendJson, setErrorHeaders } from "./utils";

// eslint-disable-next-line prefer-destructuring -- destructuring `const { HttpError } = createHttpError` infers `HttpError | undefined` when http-errors' default type does not enumerate static class properties exhaustively; the explicit type annotation preserves the narrow type.
const HttpError: typeof createHttpError.HttpError = createHttpError.HttpError;

type HttpError = InstanceType<typeof createHttpError.HttpError>;

const defaultTitle = "An error occurred";

const jsonapiErrorHandler: ErrorHandler = (error, _request, response) => {
    addStatusCodeToResponse(response, error);

    setErrorHeaders(response, error);

    if (error instanceof tsJapi.JapiError || tsJapi.JapiError.isLikeJapiError(error)) {
        const serializer = new tsJapi.ErrorSerializer();

        sendJson(response, serializer.serialize(error));
    } else if (error instanceof HttpError) {
        const { expose, message, statusCode } = error;
        const { title } = error as HttpError & { title?: string };

        sendJson(response, {
            errors: [
                {
                    code: statusCode,
                    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- intentional: getReasonPhrase returns "" for unknown codes; falsy fallback chain is required to skip empty strings
                    title: title || getReasonPhrase(statusCode) || defaultTitle,
                    // Only expose the raw message when http-errors marks it safe
                    // to (4xx by default); otherwise fall back to the reason
                    // phrase so 5xx internals don't leak to clients.
                    // eslint-disable-next-line perfectionist/sort-objects -- detail intentionally follows title
                    detail: expose ? message : getReasonPhrase(statusCode) || defaultTitle,
                },
            ],
        });
    } else {
        // Non-HttpError values default to a 500 with no `expose` flag, so the
        // raw message is suppressed unless the error explicitly opts in.
        const { message } = error as { message?: string };
        const expose = (error as { expose?: boolean }).expose === true;

        sendJson(response, {
            errors: [
                {
                    code: "500",
                    title: getReasonPhrase(response.statusCode) || defaultTitle,
                    // eslint-disable-next-line perfectionist/sort-objects -- detail intentionally follows title
                    detail: expose ? message : getReasonPhrase(response.statusCode) || defaultTitle,
                },
            ],
        });
    }
};

export default jsonapiErrorHandler;
