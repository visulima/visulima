import { HttpError } from "http-errors";
import { getReasonPhrase } from "http-status-codes";
import tsJapi from "ts-japi";

import type { ErrorHandler } from "./types";
import { addStatusCodeToResponse, sendJson, setErrorHeaders } from "./utils";

const defaultTitle = "An error occurred";

const jsonapiErrorHandler: ErrorHandler = (error: HttpError | tsJapi.JapiError | Error, _request, response) => {
    addStatusCodeToResponse(response, error);

    setErrorHeaders(response, error);

    if (error instanceof tsJapi.JapiError || tsJapi.JapiError.isLikeJapiError(error)) {
        const serializer = new tsJapi.ErrorSerializer();

        sendJson(response, serializer.serialize(error));
    } else if (error instanceof HttpError) {
        const { statusCode, title, message } = error;

        sendJson(response, {
            errors: [
                {
                    code: statusCode,
                    title: title || getReasonPhrase(statusCode) || defaultTitle,
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
                    detail: message,
                },
            ],
        });
    }
};

export default jsonapiErrorHandler;
