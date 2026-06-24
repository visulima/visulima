import type { NotificationEvent, NotificationEventType } from "../types";
import { hmacBase64, hmacHex, isWithinReplayWindow, REPLAY_WINDOW_SECONDS, timingSafeEqual } from "./crypto";
import type { WebhookHeaders, WebhookVerifier } from "./types";
import { getHeader, tryParseObject } from "./types";

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
 * Known normalised event types, used to coerce a body `type` field.
 */
const EVENT_TYPES = new Set<NotificationEventType>(["bounced", "clicked", "delivered", "failed", "interacted", "queued", "read", "sent"]);

/**
 * Decodes a standard base64 string into raw bytes (edge-safe, no `node:Buffer`).
 * @param value The base64-encoded string.
 * @returns The decoded bytes.
 */
const base64ToBytes = (value: string): Uint8Array => {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.codePointAt(index) ?? 0;
    }

    return bytes;
};

/**
 * Verifier + parser implementing the generic
 * [Standard Webhooks](https://www.standardwebhooks.com/) HMAC scheme.
 *
 * The signed content is `{id}.{timestamp}.{body}`; the signature is the base64
 * HMAC-SHA256 prefixed with `v1,`. The `webhook-signature` header may carry several
 * space-separated signatures (key rotation) — verification passes when any matches.
 * If the secret begins with `whsec_`, the base64 remainder is decoded to raw key bytes
 * and the HMAC is keyed with those bytes (per the spec); otherwise the raw secret string
 * is used directly. A hex digest is also accepted as a fallback for non-conformant
 * senders. Edge-safe — uses Web Crypto only.
 */
// eslint-disable-next-line import/prefer-default-export -- named export is re-exported by the ./webhooks barrel
export const standardWebhook: WebhookVerifier = {
    parse: (body: string): NotificationEvent | undefined => {
        const parsed = tryParseObject(body);

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
        if (secret.trim() === "") {
            return false;
        }

        const id = getHeader(headers, ID_HEADER);
        const timestamp = getHeader(headers, TIMESTAMP_HEADER);
        const signatureHeader = getHeader(headers, SIGNATURE_HEADER);

        if (id === undefined || timestamp === undefined || signatureHeader === undefined) {
            return false;
        }

        if (!isWithinReplayWindow(timestamp, REPLAY_WINDOW_SECONDS)) {
            return false;
        }

        const key: string | Uint8Array = secret.startsWith("whsec_") ? base64ToBytes(secret.slice("whsec_".length)) : secret;
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
