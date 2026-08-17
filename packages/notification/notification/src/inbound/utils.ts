import type { WebhookHeaders } from "../webhooks/types";
import type { InboundErrorReason, InboundReply, InboundResponse, ReceiverOptions } from "./types";

/**
 * Returns `value` when it is a string, otherwise `undefined`. Narrows the untyped fields of
 * a parsed provider payload without repeating `typeof` guards or nesting ternaries.
 * @param value The candidate value.
 * @returns The string, or `undefined`.
 */
export const asString = (value: unknown): string | undefined => {
    if (typeof value === "string") {
        return value;
    }

    return undefined;
};

/**
 * Coerces a provider id that may arrive as a string or a number (Telegram sends numeric ids)
 * into a string, or `undefined` when it is neither.
 * @param value The candidate id.
 * @returns The stringified id, or `undefined`.
 */
export const asId = (value: unknown): string | undefined => {
    if (typeof value === "string") {
        return value;
    }

    if (typeof value === "number") {
        return String(value);
    }

    return undefined;
};

/**
 * Parses a provider-supplied timestamp, falling back to now when it is missing or malformed.
 *
 * `new Date("not a date")` produces an `Invalid Date` that passes silently through assignment and
 * only throws once a consumer calls `toISOString()` on it — far from the payload that caused it.
 * @param value The timestamp string, if the payload carried one.
 * @returns A valid {@link Date}.
 */
export const asDate = (value: string | undefined): Date => {
    const parsed = value === undefined ? Number.NaN : Date.parse(value);

    return Number.isNaN(parsed) ? new Date() : new Date(parsed);
};

/**
 * Reads a web-standard {@link Headers} object into a plain, case-insensitive
 * {@link WebhookHeaders} map so the existing webhook verifiers can consume it.
 * @param headers The request headers.
 * @returns A plain header map.
 */
export const headersToRecord = (headers: Headers): WebhookHeaders => {
    const record: Record<string, string> = {};

    headers.forEach((value, key) => {
        record[key] = value;
    });

    return record;
};

/**
 * Builds a JSON {@link Response} with the given status.
 * @param body The JSON-serialisable body.
 * @param status The HTTP status (defaults to `200`).
 * @returns A response with the JSON body and `content-type` header set.
 */
export const jsonResponse = (body: unknown, status = 200): Response =>
    Response.json(body, { headers: { "content-type": "application/json" }, status });

/**
 * An empty `204 No Content` acknowledgement — the default success response when a handler
 * returns nothing.
 * @returns The response.
 */
export const noContent = (): Response => new Response(undefined, { status: 204 });

/**
 * Resolves the default rejection response for a given reason, giving {@link
 * ReceiverOptions.onError} the chance to override it first.
 * @param reason Why the request was rejected.
 * @param request The originating request.
 * @param onError The optional consumer error hook.
 * @returns The response to send back to the provider.
 */
export const rejectionResponse = async (
    reason: InboundErrorReason,
    request: Request,
    onError: ReceiverOptions["onError"],
): Promise<Response> => {
    const override = await onError?.(reason, request);

    if (override instanceof Response) {
        return override;
    }

    const status = reason === "invalid_body" ? 400 : 401;

    return jsonResponse({ error: reason }, status);
};

/**
 * Narrows a handler's {@link InboundResponse} to a raw {@link Response} when it returned one.
 * @param response The handler result.
 * @returns The response, or `undefined` when the handler returned a reply or nothing.
 */
export const asRawResponse = (response: InboundResponse): Response | undefined => {
    if (response instanceof Response) {
        return response;
    }

    return undefined;
};

/**
 * Narrows a handler's {@link InboundResponse} to a normalised {@link InboundReply}.
 * @param response The handler result.
 * @returns The reply, or `undefined` when the handler returned a raw response or nothing.
 */
export const asReply = (response: InboundResponse): InboundReply | undefined => {
    if (response === undefined || response instanceof Response) {
        return undefined;
    }

    return response;
};
