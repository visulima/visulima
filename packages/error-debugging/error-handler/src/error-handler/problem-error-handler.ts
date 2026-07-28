import type { HttpError } from "http-errors";
import { isHttpError } from "http-errors";

import type { ErrorHandler } from "./types";
import addStatusCodeToResponse from "./utils/add-status-code-to-response";
import safeReasonPhrase from "./utils/safe-reason-phrase";
import sendJson from "./utils/send-json";
import setErrorHeaders from "./utils/set-error-headers";

const defaultType = "about:blank";

/**
 * Normalizes errors according to the API Problem spec (RFC 7807).
 * @see https://tools.ietf.org/html/rfc7807
 */
const problemErrorHandler: ErrorHandler = (error: Error | HttpError, _request, response) => {
    const { message, stack } = error;

    if (isHttpError(error)) {
        const expose = "expose" in error ? (error as { expose?: boolean }).expose : undefined;
        const title = "title" in error && typeof (error as { title?: unknown }).title === "string" ? (error as { title?: string }).title : undefined;
        const type = "type" in error && typeof (error as { type?: unknown }).type === "string" ? (error as { type?: string }).type : undefined;

        // Validate and clamp the resolved status code to the 4xx/5xx window
        // (falling back to 500) so a duck-typed http-error carrying an
        // out-of-range status cannot produce a 200-OK problem response or make
        // node throw ERR_HTTP_INVALID_STATUS_CODE.
        addStatusCodeToResponse(response, error);

        const { statusCode } = response;

        setErrorHeaders(response, error);

        sendJson(
            response,
            {
                type: type ?? defaultType,
                // eslint-disable-next-line perfectionist/sort-objects
                title: title ?? safeReasonPhrase(statusCode),
                // eslint-disable-next-line perfectionist/sort-objects
                status: statusCode,
                // eslint-disable-next-line perfectionist/sort-objects
                detail: message,
                ...expose ? { trace: stack } : {},
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
                title: safeReasonPhrase(response.statusCode),
                // eslint-disable-next-line perfectionist/sort-objects
                status: response.statusCode,
                // eslint-disable-next-line perfectionist/sort-objects
                detail: message,
                ...(error as Error & { expose: boolean }).expose ? { trace: stack } : {},
            },
            "application/problem+json",
        );
    }
};

export default problemErrorHandler;
