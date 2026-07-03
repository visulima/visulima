import type { NotificationEvent } from "../types";

/**
 * Case-insensitive map of inbound request headers. Values may be a single string or
 * an array (mirroring `node:http` and `Headers`); verifiers normalise both forms.
 */
export type WebhookHeaders = Record<string, string | string[] | undefined>;

/**
 * A provider inbound-webhook verifier: validates the request signature and normalises
 * the body into a {@link NotificationEvent}.
 */
export interface WebhookVerifier {
    /**
     * Normalises a verified webhook body into a {@link NotificationEvent}.
     * @param body The raw request body (string).
     * @returns The normalised event, or `undefined` when the body is not a delivery event.
     */
    parse: (body: string) => NotificationEvent | undefined;

    /**
     * Verifies the request signature against the shared secret.
     * @param payload The raw request body (string).
     * @param headers The inbound request headers.
     * @param secret The provider signing secret / auth token.
     * @returns `true` when the signature is valid.
     */
    verify: (payload: string, headers: WebhookHeaders, secret: string) => Promise<boolean>;
}

/**
 * Safely parses a JSON body into a plain object, returning `undefined` on malformed
 * input or non-object JSON (arrays, primitives, `null`).
 * @param body The request body.
 * @returns The parsed object, or `undefined`.
 */
export const tryParseObject = (body: string): Record<string, unknown> | undefined => {
    try {
        const parsed: unknown = JSON.parse(body);

        if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>;
        }

        return undefined;
    } catch {
        return undefined;
    }
};

/**
 * Reads a header value case-insensitively, coercing array values to their first entry.
 * @param headers The inbound headers.
 * @param name The header name to read.
 * @returns The header value, or `undefined` when absent.
 */
export const getHeader = (headers: WebhookHeaders, name: string): string | undefined => {
    const target = name.toLowerCase();

    for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === target) {
            const value = headers[key];

            if (Array.isArray(value)) {
                return value[0];
            }

            return value;
        }
    }

    return undefined;
};
