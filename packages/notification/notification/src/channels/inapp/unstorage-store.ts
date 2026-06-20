import type { Storage } from "unstorage";

import generateMessageId from "../../providers/utils/id";
import type { InAppStore, ListOptions, StoredNotification } from "./store";

/**
 * An {@link InAppStore} backed by an [unstorage](https://unstorage.unjs.io) driver, giving durable,
 * multi-backend persistence (Redis, filesystem, Cloudflare KV, ...). `unstorage` is an optional peer
 * dependency — pass a configured `Storage` instance.
 *
 * Each notification is stored under `prefix:item:id`, and a per-subscriber index list is kept under
 * `prefix:index:subscriberId` so `list`/`unreadCount`/`markAllRead` avoid scanning every key.
 *
 * The per-subscriber index is eventually-consistent: the item and index keys are written
 * non-atomically, so a concurrent reader may briefly observe one without the other.
 *
 * Edge-safe: works on Cloudflare KV (and other edge runtimes) via the matching unstorage driver.
 */
export class UnstorageInAppStore implements InAppStore {
    readonly #storage: Storage;

    readonly #prefix: string;

    public constructor(storage: Storage, prefix = "notification:inapp") {
        this.#storage = storage;
        this.#prefix = prefix;
    }

    public async add(notification: Omit<StoredNotification, "createdAt" | "id" | "read"> & { id?: string }): Promise<StoredNotification> {
        const stored: StoredNotification = {
            ...notification,
            createdAt: Date.now(),
            id: notification.id ?? generateMessageId("inapp"),
            read: false,
        };

        await this.#storage.setItem(this.#itemKey(stored.id), stored as never);
        await this.#pushIndex(stored.subscriberId, stored.id);

        return stored;
    }

    public async list(subscriberId: string, options: ListOptions = {}): Promise<StoredNotification[]> {
        const items = await this.#items(subscriberId);

        const filtered = options.unreadOnly ? items.filter((item) => !item.read) : items;
        const sorted = filtered.toSorted((a, b) => b.createdAt - a.createdAt);

        return options.limit ? sorted.slice(0, options.limit) : sorted;
    }

    public async markRead(id: string): Promise<void> {
        const item = (await this.#storage.getItem(this.#itemKey(id))) as StoredNotification | null;

        if (!item) {
            return;
        }

        item.read = true;
        await this.#storage.setItem(this.#itemKey(id), item as never);
    }

    public async markAllRead(subscriberId: string): Promise<void> {
        const ids = await this.#index(subscriberId);

        await Promise.all(ids.map(async (id) => this.markRead(id)));
    }

    public async unreadCount(subscriberId: string): Promise<number> {
        const items = await this.#items(subscriberId);

        return items.filter((item) => !item.read).length;
    }

    public async remove(id: string): Promise<void> {
        const item = (await this.#storage.getItem(this.#itemKey(id))) as StoredNotification | null;

        await this.#storage.removeItem(this.#itemKey(id));

        if (item) {
            await this.#removeIndex(item.subscriberId, id);
        }
    }

    #itemKey(id: string): string {
        return `${this.#prefix}:item:${id}`;
    }

    #indexKey(subscriberId: string): string {
        return `${this.#prefix}:index:${subscriberId}`;
    }

    async #index(subscriberId: string): Promise<string[]> {
        return ((await this.#storage.getItem(this.#indexKey(subscriberId))) as string[] | null) ?? [];
    }

    async #items(subscriberId: string): Promise<StoredNotification[]> {
        const ids = await this.#index(subscriberId);
        const loaded = await Promise.all(ids.map(async (id) => (await this.#storage.getItem(this.#itemKey(id))) as StoredNotification | null));

        return loaded.filter((item): item is StoredNotification => item !== null);
    }

    async #pushIndex(subscriberId: string, id: string): Promise<void> {
        const ids = await this.#index(subscriberId);

        if (!ids.includes(id)) {
            ids.push(id);
            await this.#storage.setItem(this.#indexKey(subscriberId), ids as never);
        }
    }

    async #removeIndex(subscriberId: string, id: string): Promise<void> {
        const ids = await this.#index(subscriberId);
        const next = ids.filter((existing) => existing !== id);

        await this.#storage.setItem(this.#indexKey(subscriberId), next as never);
    }
}

/**
 * Convenience factory for {@link UnstorageInAppStore}.
 * @param storage A configured unstorage `Storage` instance (optional peer).
 * @param prefix Key prefix under which notifications are stored.
 * @returns A new {@link UnstorageInAppStore}.
 */
export const createUnstorageInAppStore = (storage: Storage, prefix?: string): UnstorageInAppStore => new UnstorageInAppStore(storage, prefix);
