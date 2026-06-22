import type { DigestEvent, DigestStore, DigestWindow } from "./types";

/**
 * In-process {@link DigestStore}. Ideal for tests and single-instance apps; swap
 * for the unstorage adapter for durability across restarts and instances.
 */
class MemoryDigestStore<PayloadT> implements DigestStore<PayloadT> {
    readonly #windows = new Map<string, DigestWindow<PayloadT>>();

    public append(key: string, event: DigestEvent<PayloadT>, wakeAt: number): Promise<boolean> {
        const existing = this.#windows.get(key);

        if (existing === undefined) {
            this.#windows.set(key, { events: [event], key, wakeAt });

            return Promise.resolve(true);
        }

        existing.events.push(event);

        return Promise.resolve(false);
    }

    public drain(key: string): Promise<DigestWindow<PayloadT> | undefined> {
        const window = this.#windows.get(key);

        this.#windows.delete(key);

        return Promise.resolve(window);
    }

    public due(now: number, limit: number): Promise<string[]> {
        const due = [...this.#windows.values()].filter((window) => window.wakeAt <= now);

        const keys = due
            .toSorted((a, b) => a.wakeAt - b.wakeAt)
            .slice(0, limit)
            .map((window) => window.key);

        return Promise.resolve(keys);
    }
}

export default MemoryDigestStore;
