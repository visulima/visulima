import type { HttpError } from "http-errors";
import { isHttpError } from "http-errors";
import { getReasonPhrase } from "http-status-codes";
import tsJapi from "ts-japi";

import type { ErrorHandler } from "./types";
import addStatusCodeToResponse from "./utils/add-status-code-to-response";
import sendJson from "./utils/send-json";
import setErrorHeaders from "./utils/set-error-headers";

const resolveStatusCode = (error: HttpError, fallback: number): number => {
    if ("statusCode" in error && typeof (error as { statusCode?: unknown }).statusCode === "number") {
        return (error as { statusCode: number }).statusCode;
    }

    if ("status" in error && typeof (error as { status?: unknown }).status === "number") {
        return (error as { status: number }).status;
    }

    return fallback;
};

const jsonapiErrorHandler: ErrorHandler = (error: Error | HttpError | tsJapi.JapiError, _request, response) => {
    addStatusCodeToResponse(response, error);

    setErrorHeaders(response, error);

    if (error instanceof tsJapi.JapiError || tsJapi.JapiError.isLikeJapiError(error)) {
        const serializer = new tsJapi.ErrorSerializer();

        sendJson(response, serializer.serialize(error));
    } else if (isHttpError(error)) {
        const statusCode = resolveStatusCode(error, response.statusCode);
        const title = "title" in error && typeof (error as { title?: unknown }).title === "string" ? (error as { title?: string }).title : undefined;
        const message = "message" in error && typeof (error as { message?: unknown }).message === "string" ? (error as { message?: string }).message : "";

        sendJson(response, {
            errors: [
                {
                    code: statusCode,
                    title: title ?? getReasonPhrase(statusCode),
                    // eslint-disable-next-line perfectionist/sort-objects
                    detail: message,
                },
            ],
        });
    } else {
        const { message } = error;
        // Use the status code already resolved onto the response by
        // addStatusCodeToResponse rather than a hardcoded 500, and emit it as a
        // number so the shape matches the http-error branch above.
        const { statusCode } = response;

        sendJson(response, {
            errors: [
                {
                    code: statusCode,
                    title: getReasonPhrase(statusCode),
                    // eslint-disable-next-line perfectionist/sort-objects
                    detail: message,
                },
            ],
        });
    }
};

export default jsonapiErrorHandler;
