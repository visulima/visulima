import type { SuppressionEntry, SuppressionReason, SuppressionStore } from "./types";

/**
 * Normalizes an address for case-insensitive matching.
 * @param address The raw address.
 * @returns The trimmed, lower-cased address.
 */
const normalize = (address: string): string => address.trim().toLowerCase();

/**
 * An in-memory {@link SuppressionStore}, suitable for tests, single-process apps, and as a write-through
 * cache in front of a durable store.
 */
class MemorySuppressionStore implements SuppressionStore {
    private readonly entries = new Map<string, SuppressionEntry>();

    /**
     * Seeds the store with existing entries.
     * @param initial Optional addresses to pre-suppress.
     */
    public constructor(initial?: Iterable<{ address: string; metadata?: Record<string, unknown>; reason: SuppressionReason }>) {
        if (initial) {
            for (const { address, metadata, reason } of initial) {
                this.add(address, reason, metadata);
            }
        }
    }

    /**
     * Adds or refreshes an address on the suppression list.
     * @param address The recipient address.
     * @param reason Why it is suppressed.
     * @param metadata Optional context to persist with the entry.
     */
    public add(address: string, reason: SuppressionReason, metadata?: Record<string, unknown>): void {
        const normalized = normalize(address);

        this.entries.set(normalized, {
            address: normalized,
            createdAt: new Date(),
            metadata,
            reason,
        });
    }

    /**
     * Returns the suppression entry for an address, if present.
     * @param address The recipient address.
     * @returns The entry, or `undefined` when not suppressed.
     */
    public get(address: string): SuppressionEntry | undefined {
        return this.entries.get(normalize(address));
    }

    /**
     * Reports whether an address is currently suppressed.
     * @param address The recipient address.
     * @returns `true` when the address is on the list.
     */
    public has(address: string): boolean {
        return this.entries.has(normalize(address));
    }

    /**
     * Lists every suppression entry.
     * @returns An iterable over the stored entries.
     */
    public list(): Iterable<SuppressionEntry> {
        return this.entries.values();
    }

    /**
     * Removes an address from the suppression list.
     * @param address The recipient address.
     * @returns `true` when an entry was removed.
     */
    public remove(address: string): boolean {
        return this.entries.delete(normalize(address));
    }

    /**
     * The number of suppressed addresses.
     */
    public get size(): number {
        return this.entries.size;
    }
}

export default MemorySuppressionStore;
