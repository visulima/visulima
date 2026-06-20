import type { ChannelType, NotificationEvent, NotificationEventType } from "../types";
import { hmacBase64, timingSafeEqual } from "./crypto";
import type { WebhookHeaders, WebhookVerifier } from "./types";
import { getHeader } from "./types";

/**
 * Header carrying the Twilio request signature.
 */
const SIGNATURE_HEADER = "X-Twilio-Signature";

/**
 * Maps Twilio `MessageStatus` / `CallStatus` values to normalised event types.
 */
const STATUS_MAP: Record<string, NotificationEventType> = {
    delivered: "delivered",
    failed: "failed",
    queued: "queued",
    sending: "queued",
    sent: "sent",
    undelivered: "failed",
};

/**
 * Builds the Twilio signature base string: the request URL with each form parameter
 * appended in lexicographic key order as `key + value` (no separators).
 * @param url The full request URL Twilio signed (scheme, host, path and query).
 * @param parameters The decoded form body parameters.
 * @returns The string Twilio computes the HMAC over.
 */
const buildSignatureBase = (url: string, parameters: Record<string, string>): string => {
    const keys = Object.keys(parameters).toSorted((a, b) => a.localeCompare(b));
    let base = url;

    for (const key of keys) {
        base += `${key}${parameters[key] ?? ""}`;
    }

    return base;
};

/**
 * Parses a URL-encoded form body into a flat string map.
 * @param body The `application/x-www-form-urlencoded` request body.
 * @returns The decoded parameters.
 */
const parseForm = (body: string): Record<string, string> => {
    const parameters: Record<string, string> = {};
    const search = new URLSearchParams(body);

    search.forEach((value, key) => {
        parameters[key] = value;
    });

    return parameters;
};

/**
 * Verifier + parser for Twilio status-callback webhooks.
 *
 * Verification follows Twilio's scheme: `X-Twilio-Signature` is the base64 HMAC-SHA1
 * (keyed by the auth token) of the request URL concatenated with the form parameters
 * sorted by key. The full request URL must be provided via the
 * `x-twilio-signature-url` header (the verifier cannot reconstruct it from the body).
 * Edge-safe — uses Web Crypto only.
 */
export const twilioWebhook: WebhookVerifier = {
    parse: (body: string): NotificationEvent | undefined => {
        const parameters = parseForm(body);
        const status = parameters.MessageStatus ?? parameters.SmsStatus ?? parameters.CallStatus;

        if (status === undefined) {
            return undefined;
        }

        const type = STATUS_MAP[status.toLowerCase()];

        if (type === undefined) {
            return undefined;
        }

        const channel: ChannelType = "sms";

        return {
            channel,
            messageId: parameters.MessageSid ?? parameters.SmsSid ?? parameters.CallSid ?? "",
            provider: "twilio",
            recipient: parameters.To,
            timestamp: new Date(),
            type,
        };
    },
    verify: async (payload: string, headers: WebhookHeaders, secret: string): Promise<boolean> => {
        const provided = getHeader(headers, SIGNATURE_HEADER);
        const url = getHeader(headers, "x-twilio-signature-url");

        if (provided === undefined || url === undefined) {
            return false;
        }

        const parameters = parseForm(payload);
        const base = buildSignatureBase(url, parameters);
        const expected = await hmacBase64(secret, base, "SHA-1");

        return timingSafeEqual(expected, provided);
    },
};

export default twilioWebhook;
