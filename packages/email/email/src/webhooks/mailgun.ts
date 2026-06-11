import { createHmac } from "node:crypto";

import type { TimestampToleranceOptions, WebhookVerificationResult } from "./types";
import { isTimestampWithinTolerance, timingSafeStringEqual } from "./utils";

/**
 * Options for {@link verifyMailgunWebhook}.
 *
 * Mailgun nests these three fields under a `signature` object in the webhook JSON body.
 */
export interface MailgunWebhookOptions extends TimestampToleranceOptions {
    /**
     * Override the current time (milliseconds) — primarily for testing.
     */
    now?: number;

    /**
     * The HMAC value from `signature.signature`.
     */
    signature: string;

    /**
     * Your Mailgun HTTP webhook signing key (Settings → Webhooks).
     */
    signingKey: string;

    /**
     * The timestamp from `signature.timestamp` (unix seconds, as a string or number).
     */
    timestamp: number | string;

    /**
     * The token from `signature.token`.
     */
    token: string;
}

/**
 * Verifies a [Mailgun](https://documentation.mailgun.com/docs/mailgun/user-manual/tracking-messages/#webhooks) webhook.
 *
 * Mailgun computes `HMAC-SHA256(key = signingKey, message = timestamp + token)` and sends the hex
 * digest as `signature.signature`.
 * @param options Verification inputs. See {@link MailgunWebhookOptions}.
 * @returns The verification result.
 */
export const verifyMailgunWebhook = (options: MailgunWebhookOptions): WebhookVerificationResult => {
    const { now, signature, signingKey, timestamp, token, tolerance = 300 } = options;

    const timestampSeconds = typeof timestamp === "number" ? timestamp : Number.parseInt(timestamp, 10);

    if (!isTimestampWithinTolerance(timestampSeconds, tolerance, now)) {
        return { reason: "timestamp-out-of-tolerance", valid: false };
    }

    const expected = createHmac("sha256", signingKey)
        .update(`${String(timestamp)}${token}`)
        .digest("hex");

    if (!timingSafeStringEqual(signature, expected)) {
        return { reason: "signature-mismatch", valid: false };
    }

    return { valid: true };
};
