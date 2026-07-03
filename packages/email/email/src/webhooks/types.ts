/**
 * Result of verifying an inbound webhook signature.
 */
export interface WebhookVerificationResult {
    /**
     * Machine-readable reason when {@link WebhookVerificationResult.valid} is `false`.
     */
    reason?: string;

    /**
     * Whether the signature (and, when applicable, the timestamp) is valid.
     */
    valid: boolean;
}

/**
 * Headers passed to a webhook verifier. Either a plain record or a `Headers` instance.
 *
 * Lookups are case-insensitive.
 */
export type WebhookHeaders = Headers | Record<string, string | string[] | undefined>;

/**
 * Shared options for verifiers that enforce a timestamp tolerance to guard against replay attacks.
 */
export interface TimestampToleranceOptions {
    /**
     * Maximum allowed difference, in seconds, between the signed timestamp and the current time.
     *
     * Set to `0` to disable the replay-protection window.
     * @default 300
     */
    tolerance?: number;
}
