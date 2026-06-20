import type { NotificationEvent } from "../types";
import type { WebhookVerifier } from "./types";

/**
 * SNS message envelope (the relevant subset).
 */
interface SnsMessage {
    Message?: string;
    MessageId?: string;
    Signature?: string;
    SignatureVersion?: string;
    SigningCertURL?: string;
    SubscribeURL?: string;
    Timestamp?: string;
    TopicArn?: string;
    Type?: string;
}

/**
 * Matches a valid Amazon SNS signing-cert hostname, e.g. `sns.us-east-1.amazonaws.com`.
 */
const SNS_HOST_PATTERN = /^sns\.[\w-]+\.amazonaws\.com$/;

/**
 * Safely parses an SNS message envelope.
 * @param body The request body.
 * @returns The parsed envelope, or `undefined`.
 */
const parseEnvelope = (body: string): SnsMessage | undefined => {
    try {
        const parsed: unknown = JSON.parse(body);

        if (typeof parsed === "object" && parsed !== null) {
            // The cast narrows the parsed JSON to the known SNS envelope shape.
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            return parsed as SnsMessage;
        }

        return undefined;
    } catch {
        return undefined;
    }
};

/**
 * Validates that a signing-cert URL is an HTTPS Amazon SNS host. This is a structural
 * defence against spoofed `SigningCertURL` values, not a substitute for full
 * verification.
 * @param url The `SigningCertURL` from the envelope.
 * @returns `true` when the URL is a plausible AWS SNS cert URL.
 */
const isAmazonCertUrl = (url: string): boolean => {
    try {
        const parsed = new URL(url);

        return parsed.protocol === "https:" && SNS_HOST_PATTERN.test(parsed.hostname) && parsed.pathname.endsWith(".pem");
    } catch {
        return false;
    }
};

/**
 * Verifier + parser for AWS SNS HTTP/S subscription deliveries.
 *
 * NOTE: full RSA signature verification requires fetching and validating the X.509
 * certificate at `SigningCertURL` and checking the canonical string-to-sign — that
 * cert-chain step is a documented TODO. This implementation performs the
 * structural checks that are safe and edge-friendly: it requires a well-formed
 * envelope, a `Signature`, and a `SigningCertURL` hosted on an `sns.*.amazonaws.com`
 * HTTPS endpoint. Callers handling `SubscriptionConfirmation` should additionally
 * confirm the subscription by requesting the `SubscribeURL` exposed in the parsed
 * event metadata. Edge-safe — performs no `node:*` work.
 *
 * TODO: implement RSA-SHA1/RSA-SHA256 verification of the canonical string-to-sign
 * against the fetched signing certificate (SignatureVersion 1 and 2).
 */
export const snsWebhook: WebhookVerifier = {
    parse: (body: string): NotificationEvent | undefined => {
        const envelope = parseEnvelope(body);

        if (envelope?.Type === undefined) {
            return undefined;
        }

        const metadata: Record<string, unknown> = { type: envelope.Type };

        if (envelope.Type === "SubscriptionConfirmation" || envelope.Type === "UnsubscribeConfirmation") {
            metadata.subscribeUrl = envelope.SubscribeURL;
        } else if (envelope.Message !== undefined) {
            metadata.message = envelope.Message;
        }

        return {
            messageId: envelope.MessageId ?? "",
            metadata,
            provider: "sns",
            timestamp: envelope.Timestamp === undefined ? new Date() : new Date(envelope.Timestamp),
            type: "delivered",
        };
    },
    verify: (payload: string): Promise<boolean> => {
        const envelope = parseEnvelope(payload);

        if (envelope?.Signature === undefined || envelope.SigningCertURL === undefined) {
            return Promise.resolve(false);
        }

        // Structural check only — see the verifier-level TODO for full cert-chain verification.
        return Promise.resolve(isAmazonCertUrl(envelope.SigningCertURL));
    },
};

export default snsWebhook;
