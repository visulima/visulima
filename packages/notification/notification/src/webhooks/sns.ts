import type { NotificationEvent } from "../types";
import type { WebhookVerifier } from "./types";
import { tryParseObject } from "./types";

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
 * Safely parses an SNS message envelope.
 * @param body The request body.
 * @returns The parsed envelope, or `undefined`.
 */
const parseEnvelope = (body: string): SnsMessage | undefined => tryParseObject(body);

/**
 * Verifier + parser for AWS SNS HTTP/S subscription deliveries.
 *
 * NOTE: signature verification is NOT yet implemented. Real verification requires
 * fetching the X.509 certificate at `SigningCertURL`, validating its cert chain back to
 * an Amazon root, and checking the RSA-SHA1/RSA-SHA256 signature over the canonical
 * string-to-sign (SignatureVersion 1 and 2). Until that lands, {@link snsWebhook.verify}
 * fails closed and always returns `false` — accepting a payload purely on its structure
 * (a `Signature` field plus an `sns.*.amazonaws.com` `SigningCertURL`) is an auth bypass,
 * since both are attacker-controllable. `parse` remains available for callers that have
 * verified the message out-of-band. Callers handling `SubscriptionConfirmation` should
 * confirm the subscription by requesting the `SubscribeURL` from the parsed metadata.
 * Edge-safe — performs no `node:*` work.
 *
 * TODO: implement RSA-SHA1/RSA-SHA256 verification of the canonical string-to-sign
 * against the fetched signing certificate (SignatureVersion 1 and 2).
 */
// eslint-disable-next-line import/prefer-default-export -- named export is re-exported by the ./webhooks barrel
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
    verify: (): Promise<boolean> =>
        // Fail closed: cert-chain + RSA signature verification is not implemented (see the
        // verifier-level NOTE/TODO). Returning anything other than `false` would be an auth
        // bypass, so always reject.
        Promise.resolve(false),
};
