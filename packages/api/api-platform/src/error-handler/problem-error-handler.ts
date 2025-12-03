import { HttpError } from "http-errors";
import { getReasonPhrase } from "http-status-codes";

import type { ErrorHandler } from "./types";
import { addStatusCodeToResponse, sendJson, setErrorHeaders } from "./utils";

const defaultType = "https://tools.ietf.org/html/rfc2616#section-10";
const defaultTitle = "An error occurred";

/**
 * Normalizes errors according to the API Problem spec (RFC 7807).
 * @see https://tools.ietf.org/html/rfc7807
 */
const problemErrorHandler: ErrorHandler = (error: Error | HttpError, _request, response) => {
    const { message, stack } = error;

    if (error instanceof HttpError) {
        const { expose, statusCode, title, type } = error;

        response.statusCode = statusCode;

        setErrorHeaders(response, error);

        sendJson(response, {
            type: type || defaultType,
            // eslint-disable-next-line perfectionist/sort-objects
            title: title || getReasonPhrase(statusCode) || defaultTitle,
            // eslint-disable-next-line perfectionist/sort-objects
            details: message,
            ...expose ? { trace: stack } : {},
        });
    } else {
        addStatusCodeToResponse(response, error);

        sendJson(response, {
            type: defaultType,
            // eslint-disable-next-line perfectionist/sort-objects
            title: getReasonPhrase(response.statusCode) || defaultTitle,
            // eslint-disable-next-line perfectionist/sort-objects
            details: message,
            ...(error as Error & { expose: boolean }).expose ? { trace: stack } : {},
        });
    }
};

export default problemErrorHandler;
