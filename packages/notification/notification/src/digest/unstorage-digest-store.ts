import type { DigestEvent, DigestStore, DigestWindow } from "./types";

/**
 * Minimal structural view of an [unstorage](https://unstorage.unjs.io) instance,
 * declared locally so the package needs no hard `unstorage` dependency.
 */
interface UnstorageLike {
    getItem: <T = unknown>(key: string) => Promise<T | null>;
    removeItem: (key: string) => Promise<void>;
    setItem: (key: string, value: unknown) => Promise<void>;
}

// Window keys live under a dedicated `w:` sub-namespace so no application-supplied
// digest key can collide with the metadata index document (a key of "index" would
// otherwise map to the same storage key as INDEX_KEY).
const WINDOW_PREFIX = "digest:w:";
const INDEX_KEY = "digest:index";

/**
 * {@link DigestStore} backed by [unstorage](https://unstorage.unjs.io), for durable,
 * edge-friendly digest windows over any unstorage driver. A small index document
 * tracks wake-at times so `due` does not scan every window. Operations are
 * not transactional; for high-contention multi-writer setups prefer a store with
 * atomic guarantees.
 */
class UnstorageDigestStore<PayloadT> implements DigestStore<PayloadT> {
    readonly #storage: UnstorageLike;

    public constructor(storage: UnstorageLike) {
        this.#storage = storage;
    }

    public async append(key: string, event: DigestEvent<PayloadT>, wakeAt: number): Promise<boolean> {
        const found = await this.#storage.getItem<DigestWindow<PayloadT>>(WINDOW_PREFIX + key);
        const existing = found ?? undefined;

        if (existing !== undefined) {
            existing.events.push(event);
            await this.#storage.setItem(WINDOW_PREFIX + key, existing);

            return false;
        }

        const index = await this.#readIndex();

        index[key] = wakeAt;
        await this.#storage.setItem(INDEX_KEY, index);
        await this.#storage.setItem(WINDOW_PREFIX + key, { events: [event], key, wakeAt } satisfies DigestWindow<PayloadT>);

        return true;
    }

    public async drain(key: string): Promise<DigestWindow<PayloadT> | undefined> {
        const found = await this.#storage.getItem<DigestWindow<PayloadT>>(WINDOW_PREFIX + key);
        const window = found ?? undefined;

        await this.#storage.removeItem(WINDOW_PREFIX + key);

        const index = await this.#readIndex();

        if (key in index) {
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- removing a window from the wake index by its dynamic key
            delete index[key];
            await this.#storage.setItem(INDEX_KEY, index);
        }

        return window;
    }

    public async due(now: number, limit: number): Promise<string[]> {
        const index = await this.#readIndex();

        return Object.entries(index)
            .filter(([, wakeAt]) => wakeAt <= now)
            .toSorted((a, b) => a[1] - b[1])
            .slice(0, limit)
            .map(([key]) => key);
    }

    async #readIndex(): Promise<Record<string, number>> {
        const index = await this.#storage.getItem<Record<string, number>>(INDEX_KEY);

        return index ?? {};
    }
}

export default UnstorageDigestStore;
