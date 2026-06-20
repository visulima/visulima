import type { NotificationEvent, NotificationEventType } from "../types";
import { hmacBase64, hmacHex, timingSafeEqual } from "./crypto";
import type { WebhookHeaders, WebhookVerifier } from "./types";
import { getHeader } from "./types";

/**
 * Header carrying the unique message id ([Standard Webhooks](https://www.standardwebhooks.com/)).
 */
const ID_HEADER = "webhook-id";

/**
 * Header carrying the Unix-seconds timestamp.
 */
const TIMESTAMP_HEADER = "webhook-timestamp";

/**
 * Header carrying the space-separated list of `v1,` base64 signatures.
 */
const SIGNATURE_HEADER = "webhook-signature";

/**
 * Replay window in seconds for the signed timestamp.
 */
const REPLAY_WINDOW_SECONDS = 60 * 5;

/**
 * Known normalised event types, used to coerce a body `type` field.
 */
const EVENT_TYPES = new Set<NotificationEventType>(["bounced", "clicked", "delivered", "failed", "interacted", "queued", "read", "sent"]);

/**
 * Safely parses a JSON body, returning `undefined` on malformed input.
 * @param body The request body.
 * @returns The parsed object, or `undefined`.
 */
const tryParseJson = (body: string): Record<string, unknown> | undefined => {
    try {
        const parsed: unknown = JSON.parse(body);

        if (typeof parsed === "object" && parsed !== null) {
            return parsed as Record<string, unknown>;
        }

        return undefined;
    } catch {
        return undefined;
    }
};

/**
 * Verifier + parser implementing the generic
 * [Standard Webhooks](https://www.standardwebhooks.com/) HMAC scheme.
 *
 * The signed content is `{id}.{timestamp}.{body}`; the signature is the base64
 * HMAC-SHA256 prefixed with `v1,`. The `webhook-signature` header may carry several
 * space-separated signatures (key rotation) — verification passes when any matches.
 * If the secret begins with `whsec_`, the base64 remainder is used as the key bytes;
 * otherwise the raw secret is used directly. A hex digest is also accepted as a
 * fallback for non-conformant senders. Edge-safe — uses Web Crypto only.
 */
export const standardWebhook: WebhookVerifier = {
    parse: (body: string): NotificationEvent | undefined => {
        const parsed = tryParseJson(body);

        if (parsed === undefined) {
            return undefined;
        }

        const rawType = typeof parsed.type === "string" ? parsed.type : undefined;
        const isKnown = rawType !== undefined && EVENT_TYPES.has(rawType as NotificationEventType);
        const type: NotificationEventType = isKnown ? (rawType as NotificationEventType) : "delivered";

        return {
            messageId: typeof parsed.id === "string" ? parsed.id : "",
            provider: "standard-webhooks",
            recipient: typeof parsed.recipient === "string" ? parsed.recipient : undefined,
            timestamp: new Date(),
            type,
        };
    },
    verify: async (payload: string, headers: WebhookHeaders, secret: string): Promise<boolean> => {
        const id = getHeader(headers, ID_HEADER);
        const timestamp = getHeader(headers, TIMESTAMP_HEADER);
        const signatureHeader = getHeader(headers, SIGNATURE_HEADER);

        if (id === undefined || timestamp === undefined || signatureHeader === undefined) {
            return false;
        }

        const timestampSeconds = Number.parseInt(timestamp, 10);

        if (Number.isNaN(timestampSeconds)) {
            return false;
        }

        const nowSeconds = Math.floor(Date.now() / 1000);

        if (Math.abs(nowSeconds - timestampSeconds) > REPLAY_WINDOW_SECONDS) {
            return false;
        }

        const key = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
        const signedContent = `${id}.${timestamp}.${payload}`;
        const expectedBase64 = await hmacBase64(key, signedContent, "SHA-256");
        const expectedHex = await hmacHex(key, signedContent, "SHA-256");
        const candidates = signatureHeader.split(" ");

        for (const candidate of candidates) {
            const value = candidate.includes(",") ? candidate.split(",")[1] ?? "" : candidate;

            if (timingSafeEqual(expectedBase64, value) || timingSafeEqual(expectedHex, value)) {
                return true;
            }
        }

        return false;
    },
};

export default standardWebhook;
