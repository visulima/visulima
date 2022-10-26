import { HttpError } from "http-errors";
import { getReasonPhrase } from "http-status-codes";
import { ErrorSerializer, JapiError } from "ts-japi";

import type { ErrorHandler } from "../types";
import { addStatusCodeToResponse, sendJson, setErrorHeaders } from "./util";

const defaultTitle = "An error occurred";

const JsonapiErrorHandler: ErrorHandler = (error: HttpError | JapiError | Error, _request, response) => {
    addStatusCodeToResponse(response, error);

    setErrorHeaders(response, error);

    if (error instanceof JapiError || JapiError.isLikeJapiError(error)) {
        const serializer = new ErrorSerializer();

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

export default JsonapiErrorHandler;
