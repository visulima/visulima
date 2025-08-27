import type { HttpError } from "http-errors";
import { isHttpError } from "http-errors";
import { getReasonPhrase } from "http-status-codes";

import type { ErrorHandler } from "./types";
import { addStatusCodeToResponse, sendJson, setErrorHeaders } from "./utils";

const defaultType = "about:blank";
const defaultTitle = "An error occurred";
/**
 * Normalizes errors according to the API Problem spec (RFC 7807).
 *
 * @see https://tools.ietf.org/html/rfc7807
 */
const problemErrorHandler: ErrorHandler = (error: Error | HttpError, _request, response) => {
    const { message, stack } = error;

    if (isHttpError(error)) {
        const expose = ("expose" in error ? (error as { expose?: boolean }).expose : undefined) as boolean | undefined;
        const statusCode =
            "statusCode" in error && typeof (error as { statusCode?: unknown }).statusCode === "number"
                ? (error as { statusCode: number }).statusCode
                : "status" in error && typeof (error as { status?: unknown }).status === "number"
                  ? (error as { status: number }).status
                  : response.statusCode;
        const title = "title" in error && typeof (error as { title?: unknown }).title === "string" ? (error as { title?: string }).title : undefined;
        const type = "type" in error && typeof (error as { type?: unknown }).type === "string" ? (error as { type?: string }).type : undefined;

        response.statusCode = statusCode;

        setErrorHeaders(response, error);

        sendJson(
            response,
            {
                type: type || defaultType,
                // eslint-disable-next-line perfectionist/sort-objects
                title: title || getReasonPhrase(statusCode) || defaultTitle,
                // eslint-disable-next-line perfectionist/sort-objects
                status: statusCode,
                // eslint-disable-next-line perfectionist/sort-objects
                detail: message,
                ...(expose ? { trace: stack } : {}),
            },
            "application/problem+json",
        );
    } else {
        addStatusCodeToResponse(response, error);

        sendJson(
            response,
            {
                type: defaultType,
                // eslint-disable-next-line perfectionist/sort-objects
                title: getReasonPhrase(response.statusCode) || defaultTitle,
                // eslint-disable-next-line perfectionist/sort-objects
                status: response.statusCode,
                // eslint-disable-next-line perfectionist/sort-objects
                detail: message,
                ...((error as Error & { expose: boolean }).expose ? { trace: stack } : {}),
            },
            "application/problem+json",
        );
    }
};

export default problemErrorHandler;
