import { Buffer } from "node:buffer";
import { createPublicKey, verify as cryptoVerify } from "node:crypto";

import EmailError from "../errors/email-error";
import type { WebhookVerificationResult } from "./types";

/**
 * Normalizes a SendGrid verification key into a `KeyObject`.
 * @param publicKey The base64 DER or PEM-encoded ECDSA public key.
 * @returns A crypto `KeyObject`.
 */
const toKeyObject = (publicKey: string) => {
    if (publicKey.includes("-----BEGIN")) {
        return createPublicKey(publicKey);
    }

    return createPublicKey({ format: "der", key: Buffer.from(publicKey, "base64"), type: "spki" });
};

/**
 * Options for {@link verifySendGridWebhook}.
 */
export interface SendGridWebhookOptions {
    /**
     * The raw, unparsed request body exactly as received.
     */
    payload: string;

    /**
     * The verification key from the SendGrid Event Webhook settings.
     *
     * Either the base64-encoded DER (SPKI) string SendGrid displays, or a full PEM block.
     */
    publicKey: string;

    /**
     * The value of the `X-Twilio-Email-Event-Webhook-Signature` header (base64 DER ECDSA signature).
     */
    signature: string;

    /**
     * The value of the `X-Twilio-Email-Event-Webhook-Timestamp` header.
     */
    timestamp: string;
}

/**
 * Verifies a [SendGrid Event Webhook](https://www.twilio.com/docs/sendgrid/for-developers/tracking-events/getting-started-event-webhook-security-features)
 * using its ECDSA (prime256v1) signature.
 *
 * The signed message is `timestamp + payload`. The signature header is the base64-encoded DER
 * ECDSA signature.
 * @param options Verification inputs. See {@link SendGridWebhookOptions}.
 * @returns The verification result.
 * @throws {EmailError} When the supplied public key cannot be parsed.
 */
export const verifySendGridWebhook = (options: SendGridWebhookOptions): WebhookVerificationResult => {
    const { payload, publicKey, signature, timestamp } = options;

    if (!signature || !timestamp) {
        return { reason: "missing-headers", valid: false };
    }

    let keyObject;

    try {
        keyObject = toKeyObject(publicKey);
    } catch (error) {
        throw new EmailError("webhooks", "Failed to parse SendGrid verification key", { cause: error });
    }

    const data = Buffer.from(timestamp + payload, "utf8");

    let valid: boolean;

    try {
        valid = cryptoVerify("sha256", data, { dsaEncoding: "der", key: keyObject }, Buffer.from(signature, "base64"));
    } catch {
        return { reason: "signature-malformed", valid: false };
    }

    if (!valid) {
        return { reason: "signature-mismatch", valid: false };
    }

    return { valid: true };
};
