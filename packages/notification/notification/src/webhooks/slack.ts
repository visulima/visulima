import type { NotificationEvent } from "../types";
import { hmacHex, timingSafeEqual } from "./crypto";
import type { WebhookHeaders, WebhookVerifier } from "./types";
import { getHeader } from "./types";

/**
 * Header carrying the Slack request signature (`v0=` followed by the hex digest).
 */
const SIGNATURE_HEADER = "X-Slack-Signature";

/**
 * Header carrying the Unix-seconds timestamp Slack signed.
 */
const TIMESTAMP_HEADER = "X-Slack-Request-Timestamp";

/**
 * Replay window in seconds. Requests older than this are rejected.
 */
const REPLAY_WINDOW_SECONDS = 60 * 5;

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
 * Verifier + parser for Slack event/interaction webhooks.
 *
 * Verification follows Slack's v0 signing scheme: the signature is
 * `v0=` + hex HMAC-SHA256 (keyed by the signing secret) of `v0:{timestamp}:{body}`.
 * The request timestamp is checked against a 5-minute replay window. Edge-safe — uses
 * Web Crypto only.
 */
export const slackWebhook: WebhookVerifier = {
    parse: (body: string): NotificationEvent | undefined => {
        const parsed = tryParseJson(body);

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
        const provided = getHeader(headers, SIGNATURE_HEADER);
        const timestamp = getHeader(headers, TIMESTAMP_HEADER);

        if (provided === undefined || timestamp === undefined) {
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

        const digest = await hmacHex(secret, `v0:${timestamp}:${payload}`, "SHA-256");

        return timingSafeEqual(`v0=${digest}`, provided);
    },
};

export default slackWebhook;
