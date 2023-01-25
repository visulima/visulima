import { HttpError } from "http-errors";
import { getReasonPhrase } from "http-status-codes";

import type { ErrorHandler } from "./types";
import { addStatusCodeToResponse, sendJson, setErrorHeaders } from "./utils";

const defaultType = "https://tools.ietf.org/html/rfc2616#section-10";
const defaultTitle = "An error occurred";
/**
 * Normalizes errors according to the API Problem spec (RFC 7807).
 *
 * @see https://tools.ietf.org/html/rfc7807
 */
const problemErrorHandler: ErrorHandler = (error: Error | HttpError, _request, response) => {
    const { stack, message } = error;

    if (error instanceof HttpError) {
        const {
            statusCode, expose, title, type,
        } = error;

        response.statusCode = statusCode;

        setErrorHeaders(response, error);

        sendJson(response, {
            type: type || defaultType,
            title: title || getReasonPhrase(statusCode) || defaultTitle,
            details: message,
            ...(expose ? { trace: stack } : {}),
        });
    } else {
        addStatusCodeToResponse(response, error);

        sendJson(response, {
            type: defaultType,
            title: getReasonPhrase(response.statusCode) || defaultTitle,
            details: message,
            ...((error as Error & { expose: boolean }).expose ? { trace: stack } : {}),
        });
    }
};

export default problemErrorHandler;
