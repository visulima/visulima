import { HttpError } from "http-errors";
import { getReasonPhrase } from "http-status-codes";
import tsJapi from "ts-japi";

import type { ErrorHandler } from "./types";
import { addStatusCodeToResponse, sendJson, setErrorHeaders } from "./utils";

const defaultTitle = "An error occurred";

const jsonapiErrorHandler: ErrorHandler = (error, _request, response) => {
    addStatusCodeToResponse(response, error);

    setErrorHeaders(response, error);

    if (error instanceof tsJapi.JapiError || tsJapi.JapiError.isLikeJapiError(error)) {
        const serializer = new tsJapi.ErrorSerializer();

        sendJson(response, serializer.serialize(error));
    } else if (error instanceof HttpError) {
        const { message, statusCode } = error;
        const { title } = error as HttpError & { title?: string };

        sendJson(response, {
            errors: [
                {
                    code: statusCode,
                    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- intentional: getReasonPhrase returns "" for unknown codes; falsy fallback chain is required to skip empty strings
                    title: title || getReasonPhrase(statusCode) || defaultTitle,
                    // eslint-disable-next-line perfectionist/sort-objects
                    detail: message,
                },
            ],
        });
    } else {
        // Preserves prior behavior: detail is whatever .message property exists on the value (often undefined for non-Error inputs); JSON.stringify drops the key when undefined.
        const { message } = error as { message?: string };

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
