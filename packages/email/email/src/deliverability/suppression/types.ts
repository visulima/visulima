/**
 * Why a recipient address is suppressed from future sends.
 */
export type SuppressionReason = "bounce" | "complaint" | "manual" | "unsubscribe";

/**
 * A suppression-list entry.
 */
export interface SuppressionEntry {
    /**
     * The normalized (lower-cased) email address.
     */
    address: string;

    /**
     * When the address was added.
     */
    createdAt: Date;

    /**
     * Optional free-form context (e.g. the bounce sub-type, or who suppressed it manually).
     */
    metadata?: Record<string, unknown>;

    /**
     * Why the address was suppressed.
     */
    reason: SuppressionReason;
}

/**
 * A pluggable suppression store. Implementations back the in-memory default with a durable store
 * (Redis, Postgres, `unstorage`, a provider's native suppression API, etc.).
 *
 * Addresses must be matched case-insensitively; implementations are expected to normalize on write.
 */
export interface SuppressionStore {
    /**
     * Adds (or refreshes) an address on the suppression list.
     * @param address The recipient address.
     * @param reason Why it is suppressed.
     * @param metadata Optional context to persist with the entry.
     */
    add: (address: string, reason: SuppressionReason, metadata?: Record<string, unknown>) => Promise<void> | void;

    /**
     * Returns the suppression entry for an address, or `undefined` when it is not suppressed.
     * @param address The recipient address.
     */
    get: (address: string) => (SuppressionEntry | undefined) | Promise<SuppressionEntry | undefined>;

    /**
     * Returns whether an address is currently suppressed.
     * @param address The recipient address.
     */
    has: (address: string) => boolean | Promise<boolean>;

    /**
     * Lists all suppression entries. Optional — stores backed by huge datasets may omit it.
     */
    list?: () => Iterable<SuppressionEntry> | Promise<Iterable<SuppressionEntry>>;

    /**
     * Removes an address from the suppression list.
     * @param address The recipient address.
     * @returns `true` when an entry was removed.
     */
    remove: (address: string) => boolean | Promise<boolean>;
}
