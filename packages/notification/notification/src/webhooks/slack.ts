import type { NotificationEvent } from "../types";
import { hmacHex, isWithinReplayWindow, REPLAY_WINDOW_SECONDS, timingSafeEqual } from "./crypto";
import type { WebhookHeaders, WebhookVerifier } from "./types";
import { getHeader, tryParseObject } from "./types";

/**
 * Header carrying the Slack request signature (`v0=` followed by the hex digest).
 */
const SIGNATURE_HEADER = "X-Slack-Signature";

/**
 * Header carrying the Unix-seconds timestamp Slack signed.
 */
const TIMESTAMP_HEADER = "X-Slack-Request-Timestamp";

/**
 * Verifier + parser for Slack event/interaction webhooks.
 *
 * Verification follows Slack's v0 signing scheme: the signature is
 * `v0=` + hex HMAC-SHA256 (keyed by the signing secret) of `v0:{timestamp}:{body}`.
 * The request timestamp is checked against a 5-minute replay window. Edge-safe — uses
 * Web Crypto only.
 */
// eslint-disable-next-line import/prefer-default-export -- named export is re-exported by the ./webhooks barrel
export const slackWebhook: WebhookVerifier = {
    parse: (body: string): NotificationEvent | undefined => {
        const parsed = tryParseObject(body);

        if (parsed === undefined) {
            return undefined;
        }

        const event = (parsed.event as Record<string, unknown> | undefined) ?? parsed;
        const channel = typeof event.channel === "string" ? event.channel : undefined;
        const fallbackId = typeof event.ts === "string" ? event.ts : "";
        const messageId = typeof parsed.event_id === "string" ? parsed.event_id : fallbackId;

        return {
            channel: "chat",
            messageId,
            provider: "slack",
            recipient: channel,
            timestamp: new Date(),
            type: "delivered",
        };
    },
    verify: async (payload: string, headers: WebhookHeaders, secret: string): Promise<boolean> => {
        if (secret.trim() === "") {
            return false;
        }

        const provided = getHeader(headers, SIGNATURE_HEADER);
        const timestamp = getHeader(headers, TIMESTAMP_HEADER);

        if (provided === undefined || timestamp === undefined) {
            return false;
        }

        if (!isWithinReplayWindow(timestamp, REPLAY_WINDOW_SECONDS)) {
            return false;
        }

        const digest = await hmacHex(secret, `v0:${timestamp}:${payload}`, "SHA-256");

        return timingSafeEqual(`v0=${digest}`, provided);
    },
};
