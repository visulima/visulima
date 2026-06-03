import type { EmailAddress } from "../../types";
import MemorySuppressionStore from "./memory-suppression-store";
import type { SuppressionReason, SuppressionStore } from "./types";

export { default as MemorySuppressionStore } from "./memory-suppression-store";
export type { SuppressionEntry, SuppressionReason, SuppressionStore } from "./types";

/**
 * Result of {@link filterSuppressed}.
 */
export interface FilterSuppressedResult {
    /**
     * Recipients that are allowed (not suppressed).
     */
    allowed: EmailAddress[];

    /**
     * Recipients that were suppressed and removed.
     */
    suppressed: EmailAddress[];
}

/**
 * Partitions a recipient list into allowed and suppressed addresses.
 * @param recipients One or more recipients.
 * @param store The suppression store to check against.
 * @returns The allowed and suppressed recipients. See {@link FilterSuppressedResult}.
 */
export const filterSuppressed = async (recipients: EmailAddress | EmailAddress[], store: SuppressionStore): Promise<FilterSuppressedResult> => {
    const list = Array.isArray(recipients) ? recipients : [recipients];

    const allowed: EmailAddress[] = [];
    const suppressed: EmailAddress[] = [];

    for (const recipient of list) {
        // eslint-disable-next-line no-await-in-loop
        if (await store.has(recipient.email)) {
            suppressed.push(recipient);
        } else {
            allowed.push(recipient);
        }
    }

    return { allowed, suppressed };
};

/**
 * Convenience factory for an in-memory suppression store.
 * @param initial Optional addresses to pre-suppress.
 * @returns A new {@link MemorySuppressionStore}.
 */
export const createSuppressionStore = (
    initial?: Iterable<{ address: string; metadata?: Record<string, unknown>; reason: SuppressionReason }>,
): MemorySuppressionStore => new MemorySuppressionStore(initial);
