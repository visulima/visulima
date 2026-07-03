import { Buffer } from "node:buffer";

import type { WebhookVerificationResult } from "./types";
import { timingSafeStringEqual } from "./utils";

/**
 * Options for {@link verifyPostmarkWebhook}.
 *
 * Postmark does not sign webhook payloads; instead it supports HTTP Basic Auth credentials embedded
 * in the webhook URL (and IP allow-listing). This verifier checks the Basic Auth credentials.
 */
export interface PostmarkWebhookOptions {
    /**
     * The value of the incoming `Authorization` header (e.g. `Basic dXNlcjpwYXNz`).
     */
    authorization: string | undefined;

    /**
     * The password configured on the Postmark webhook URL.
     */
    password: string;

    /**
     * The username configured on the Postmark webhook URL.
     */
    username: string;
}

/**
 * Verifies a [Postmark](https://postmarkapp.com/support/article/1213-securing-inbound-and-open-webhooks)
 * webhook by validating its HTTP Basic Auth credentials.
 * @param options Verification inputs. See {@link PostmarkWebhookOptions}.
 * @returns The verification result.
 */
export const verifyPostmarkWebhook = (options: PostmarkWebhookOptions): WebhookVerificationResult => {
    const { authorization, password, username } = options;

    if (!authorization?.startsWith("Basic ")) {
        return { reason: "missing-credentials", valid: false };
    }

    const decoded = Buffer.from(authorization.slice("Basic ".length), "base64").toString("utf8");
    const expected = `${username}:${password}`;

    if (!timingSafeStringEqual(decoded, expected)) {
        return { reason: "credentials-mismatch", valid: false };
    }

    return { valid: true };
};
