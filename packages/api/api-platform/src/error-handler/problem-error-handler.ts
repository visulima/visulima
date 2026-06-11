// http-errors is a CJS module that attaches named class exports as properties of its default
// `createHttpError` function. A named ESM import (`import { HttpError } from "http-errors"`)
// produces an ESM bundle that Node refuses to load with "Named export 'HttpError' not found".
// Read the class off the default import instead so packem emits a CJS-compatible shape.
import createHttpError from "http-errors";
import { getReasonPhrase } from "http-status-codes";

import type { ErrorHandler } from "./types";
import { addStatusCodeToResponse, sendJson, setErrorHeaders } from "./utils";

// eslint-disable-next-line prefer-destructuring -- destructuring `const { HttpError } = createHttpError` infers `HttpError | undefined` when http-errors' default type does not enumerate static class properties exhaustively; the explicit type annotation preserves the narrow type.
const HttpError: typeof createHttpError.HttpError = createHttpError.HttpError;

type HttpError = InstanceType<typeof createHttpError.HttpError>;

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
            // Only surface the raw message when http-errors marks the error as
            // safe to expose. Unexposed 5xx messages may leak SQL errors, file
            // paths, etc. — fall back to the generic reason phrase instead.
            // eslint-disable-next-line perfectionist/sort-objects -- details intentionally follows title
            details: expose ? message : getReasonPhrase(statusCode) || defaultTitle,
            ...expose ? { trace: stack } : {},
        });
    } else {
        addStatusCodeToResponse(response, error);

        // Non-HttpError values default to a 500 with no `expose` flag, so the
        // raw message is suppressed unless the error explicitly opts in.
        const expose = (error as Error & { expose?: boolean }).expose === true;

        sendJson(response, {
            type: defaultType,
            // eslint-disable-next-line perfectionist/sort-objects
            title: getReasonPhrase(response.statusCode) || defaultTitle,
            // eslint-disable-next-line perfectionist/sort-objects -- details intentionally follows title
            details: expose ? message : getReasonPhrase(response.statusCode) || defaultTitle,
            ...expose ? { trace: stack } : {},
        });
    }
};

export default problemErrorHandler;
