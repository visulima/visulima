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
const problemErrorHandler: ErrorHandler = (error, _request, response) => {
    // Preserves prior behavior: read .message/.stack directly off the value (often undefined for non-Error inputs); JSON.stringify drops undefined keys.
    const { message, stack } = error as { message?: string; stack?: string };

    if (error instanceof HttpError) {
        const { expose, statusCode } = error;
        const { title, type } = error as HttpError & { title?: string; type?: string };

        response.statusCode = statusCode;

        setErrorHeaders(response, error);

        sendJson(response, {
            type: type ?? defaultType,
            // eslint-disable-next-line perfectionist/sort-objects, @typescript-eslint/prefer-nullish-coalescing -- intentional: getReasonPhrase returns "" for unknown codes; falsy fallback chain is required to skip empty strings
            title: title || getReasonPhrase(statusCode) || defaultTitle,
            // eslint-disable-next-line perfectionist/sort-objects
            details: message,
            ...(expose ? { trace: stack } : {}),
        });
    } else {
        addStatusCodeToResponse(response, error);

        sendJson(response, {
            type: defaultType,
            // eslint-disable-next-line perfectionist/sort-objects
            title: getReasonPhrase(response.statusCode) || defaultTitle,
            // eslint-disable-next-line perfectionist/sort-objects
            details: message,
            ...((error as Error & { expose: boolean }).expose ? { trace: stack } : {}),
        });
    }
};

export default problemErrorHandler;
