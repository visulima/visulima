import type { DigestEvent, DigestStore, DigestWindow } from "./types";

/**
 * Minimal structural view of an [unstorage](https://unstorage.unjs.io) instance,
 * declared locally so the package needs no hard `unstorage` dependency.
 */
interface UnstorageLike {
    getItem: <T = unknown>(key: string) => Promise<T | null>;
    getKeys: (base?: string) => Promise<string[]>;
    removeItem: (key: string) => Promise<void>;
    setItem: (key: string, value: unknown) => Promise<void>;
}

// Window keys live under a dedicated `w:` sub-namespace so no application-supplied
// digest key can collide with any other key this store might use.
const WINDOW_PREFIX = "digest:w:";

/**
 * {@link DigestStore} backed by [unstorage](https://unstorage.unjs.io), for durable,
 * edge-friendly digest windows over any unstorage driver.
 *
 * Each window is a single self-contained document keyed by `digest:w:` plus the
 * digest key; there is no shared index, so concurrent `add`s for different keys cannot
 * lose-update each other. `due` scans the window documents under the prefix — fine for the
 * transient, bounded set of open windows. Individual reads/writes are still not
 * transactional, so concurrent writers on the *same* key (or a sweep racing an
 * `add` for that key) can drop an event or double-flush; for that level of
 * contention prefer a store with atomic guarantees, or sweep from one instance.
 */
class UnstorageDigestStore<PayloadT> implements DigestStore<PayloadT> {
    readonly #storage: UnstorageLike;

    public constructor(storage: UnstorageLike) {
        this.#storage = storage;
    }

    public async append(key: string, event: DigestEvent<PayloadT>, wakeAt: number): Promise<boolean> {
        const found = await this.#storage.getItem<DigestWindow<PayloadT>>(WINDOW_PREFIX + key);

        if (found !== null) {
            found.events.push(event);
            await this.#storage.setItem(WINDOW_PREFIX + key, found);

            return false;
        }

        await this.#storage.setItem(WINDOW_PREFIX + key, { events: [event], key, wakeAt } satisfies DigestWindow<PayloadT>);

        return true;
    }

    public async read(key: string): Promise<DigestWindow<PayloadT> | undefined> {
        const found = await this.#storage.getItem<DigestWindow<PayloadT>>(WINDOW_PREFIX + key);

        return found ?? undefined;
    }

    public async remove(key: string): Promise<void> {
        await this.#storage.removeItem(WINDOW_PREFIX + key);
    }

    public async due(now: number, limit: number): Promise<string[]> {
        const storageKeys = await this.#storage.getKeys(WINDOW_PREFIX);
        const windows = await Promise.all(storageKeys.map(async (storageKey) => this.#storage.getItem<DigestWindow<PayloadT>>(storageKey)));

        return windows
            .filter((window): window is DigestWindow<PayloadT> => window !== null && window.wakeAt <= now)
            .toSorted((a, b) => a.wakeAt - b.wakeAt)
            .slice(0, limit)
            .map((window) => window.key);
    }
}

export default UnstorageDigestStore;
