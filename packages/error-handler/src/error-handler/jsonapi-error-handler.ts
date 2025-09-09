import type { HttpError } from "http-errors";
import { isHttpError } from "http-errors";
import { getReasonPhrase } from "http-status-codes";
import tsJapi from "ts-japi";

import type { ErrorHandler } from "./types";
import { addStatusCodeToResponse } from "./utils/add-status-code-to-response";
import { sendJson } from "./utils/send-json";
import { setErrorHeaders } from "./utils/set-error-headers";

const defaultTitle = "An error occurred";

const jsonapiErrorHandler: ErrorHandler = (error: Error | HttpError | tsJapi.JapiError, _request, response) => {
    addStatusCodeToResponse(response, error);

    setErrorHeaders(response, error);

    if (error instanceof tsJapi.JapiError || tsJapi.JapiError.isLikeJapiError(error)) {
        const serializer = new tsJapi.ErrorSerializer();

        sendJson(response, serializer.serialize(error));
    } else if (isHttpError(error)) {
        const statusCode =
            "statusCode" in error && typeof (error as { statusCode?: unknown }).statusCode === "number"
                ? (error as { statusCode: number }).statusCode
                : "status" in error && typeof (error as { status?: unknown }).status === "number"
                  ? (error as { status: number }).status
                  : response.statusCode;
        const title = "title" in error && typeof (error as { title?: unknown }).title === "string" ? (error as { title?: string }).title : undefined;
        const message = "message" in error && typeof (error as { message?: unknown }).message === "string" ? (error as { message?: string }).message : "";

        sendJson(response, {
            errors: [
                {
                    code: statusCode ?? response.statusCode,
                    title: title || getReasonPhrase(statusCode) || defaultTitle,
                    // eslint-disable-next-line perfectionist/sort-objects
                    detail: message,
                },
            ],
        });
    } else {
        const { message } = error;

        sendJson(response, {
            errors: [
                {
                    code: "500",
                    title: getReasonPhrase(response.statusCode) || defaultTitle,
                    // eslint-disable-next-line perfectionist/sort-objects
                    detail: message,
                },
            ],
        });
    }
};

export default jsonapiErrorHandler;
