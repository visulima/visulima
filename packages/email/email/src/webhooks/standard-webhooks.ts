import { Buffer } from "node:buffer";
import { createHmac } from "node:crypto";

import type { TimestampToleranceOptions, WebhookHeaders, WebhookVerificationResult } from "./types";
import { getHeader, isTimestampWithinTolerance, timingSafeStringEqual } from "./utils";

const SIGNATURE_VERSION = "v1";

/**
 * Decodes a Standard Webhooks signing secret into key bytes.
 * @param secret The secret, optionally `whsec_`-prefixed and base64-encoded.
 * @returns The key bytes used for the HMAC.
 */
const resolveSecretKey = (secret: string): Buffer => {
    if (secret.startsWith("whsec_")) {
        return Buffer.from(secret.slice("whsec_".length), "base64");
    }

    return Buffer.from(secret, "utf8");
};

/**
 * Options for {@link verifyStandardWebhook}.
 */
export interface StandardWebhookOptions extends TimestampToleranceOptions {
    /**
     * The request headers, or the three signature headers as a plain record.
     *
     * Recognized header names (case-insensitive): `webhook-id` / `svix-id`,
     * `webhook-timestamp` / `svix-timestamp`, and `webhook-signature` / `svix-signature`.
     */
    headers: WebhookHeaders;

    /**
     * Override the current time (milliseconds) — primarily for testing.
     */
    now?: number;

    /**
     * The raw, unparsed request body exactly as received.
     *
     * Parsing and re-serializing the body changes the bytes and breaks verification.
     */
    payload: string;

    /**
     * The signing secret. Supports the `whsec_`-prefixed, base64-encoded form used by Svix/Resend,
     * or a raw secret string.
     */
    secret: string;
}

/**
 * Verifies a webhook signed according to the [Standard Webhooks](https://www.standardwebhooks.com/) spec.
 *
 * This is the scheme used by Svix and, by extension, Resend. The signed content is
 * `${id}.${timestamp}.${payload}`, HMAC-SHA256'd with the (base64-decoded) secret and base64-encoded.
 * The `webhook-signature` header may contain multiple space-separated `v1,&lt;sig>` entries; a match
 * against any one of them passes.
 * @param options Verification inputs. See {@link StandardWebhookOptions}.
 * @returns The verification result.
 */
export const verifyStandardWebhook = (options: StandardWebhookOptions): WebhookVerificationResult => {
    const { headers, now, payload, secret, tolerance = 300 } = options;

    const id = getHeader(headers, "webhook-id") ?? getHeader(headers, "svix-id");
    const timestamp = getHeader(headers, "webhook-timestamp") ?? getHeader(headers, "svix-timestamp");
    const signatureHeader = getHeader(headers, "webhook-signature") ?? getHeader(headers, "svix-signature");

    if (!id || !timestamp || !signatureHeader) {
        return { reason: "missing-headers", valid: false };
    }

    const timestampSeconds = Number.parseInt(timestamp, 10);

    if (!isTimestampWithinTolerance(timestampSeconds, tolerance, now)) {
        return { reason: "timestamp-out-of-tolerance", valid: false };
    }

    const signedContent = `${id}.${timestamp}.${payload}`;
    const expected = createHmac("sha256", resolveSecretKey(secret)).update(signedContent).digest("base64");

    // The header is a space-separated list of `version,signature` pairs.
    const passed = signatureHeader.split(" ").some((part) => {
        const [version, signature] = part.split(",");

        if (version !== SIGNATURE_VERSION || !signature) {
            return false;
        }

        return timingSafeStringEqual(signature, expected);
    });

    if (!passed) {
        return { reason: "signature-mismatch", valid: false };
    }

    return { valid: true };
};

/**
 * Verifies a [Resend](https://resend.com/docs/dashboard/webhooks/verify-webhooks-requests) webhook.
 *
 * Resend uses Svix, so this is an alias for {@link verifyStandardWebhook} that accepts the
 * `svix-*` headers.
 * @param options Verification inputs. See {@link StandardWebhookOptions}.
 * @returns The verification result.
 */
export const verifyResendWebhook = (options: StandardWebhookOptions): WebhookVerificationResult => verifyStandardWebhook(options);
