import type { HttpError } from "http-errors";
import { isHttpError } from "http-errors";
import tsJapi from "ts-japi";

import type { ErrorHandler } from "./types";
import addStatusCodeToResponse from "./utils/add-status-code-to-response";
import extractStatusCode from "./utils/extract-status-code";
import safeReasonPhrase from "./utils/safe-reason-phrase";
import sendJson from "./utils/send-json";
import setErrorHeaders from "./utils/set-error-headers";

// Servers MUST send the JSON:API media type per the JSON:API spec.
const JSONAPI_CONTENT_TYPE = "application/vnd.api+json; charset=utf-8";

const jsonapiErrorHandler: ErrorHandler = (error: Error | HttpError | tsJapi.JapiError, _request, response) => {
    addStatusCodeToResponse(response, error);

    setErrorHeaders(response, error);

    if (error instanceof tsJapi.JapiError || tsJapi.JapiError.isLikeJapiError(error)) {
        const serializer = new tsJapi.ErrorSerializer();

        sendJson(response, serializer.serialize(error), JSONAPI_CONTENT_TYPE);
    } else if (isHttpError(error)) {
        // Clamp to the code already validated onto the response so a duck-typed
        // http-error with an out-of-range status cannot desync the body from the
        // HTTP status.
        const statusCode = extractStatusCode(error, response.statusCode);
        const title = "title" in error && typeof (error as { title?: unknown }).title === "string" ? (error as { title?: string }).title : undefined;
        const message = "message" in error && typeof (error as { message?: unknown }).message === "string" ? (error as { message?: string }).message : "";

        sendJson(
            response,
            {
                errors: [
                    {
                        code: statusCode,
                        title: title ?? safeReasonPhrase(statusCode),
                        // eslint-disable-next-line perfectionist/sort-objects
                        detail: message,
                    },
                ],
            },
            JSONAPI_CONTENT_TYPE,
        );
    } else {
        const { message } = error;
        // Use the status code already resolved onto the response by
        // addStatusCodeToResponse rather than a hardcoded 500, and emit it as a
        // number so the shape matches the http-error branch above.
        const { statusCode } = response;

        sendJson(
            response,
            {
                errors: [
                    {
                        code: statusCode,
                        title: safeReasonPhrase(statusCode),
                        // eslint-disable-next-line perfectionist/sort-objects
                        detail: message,
                    },
                ],
            },
            JSONAPI_CONTENT_TYPE,
        );
    }
};

export default jsonapiErrorHandler;
