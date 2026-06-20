import generateMessageId from "../../providers/utils/id";

/**
 * A persisted in-app notification.
 */
export interface StoredNotification {
    actions?: { label: string; url?: string }[];
    body: string;
    createdAt: number;
    data?: Record<string, unknown>;
    id: string;
    read: boolean;
    subscriberId: string;
    title?: string;
}

export interface ListOptions {
    /** Max items to return. */
    limit?: number;
    /** Only return unread items. */
    unreadOnly?: boolean;
}

/**
 * Backing store for the in-app channel. The default {@link MemoryInAppStore} is
 * in-process; back it with a persistent store for production feeds.
 */
export interface InAppStore {
    add: (notification: Omit<StoredNotification, "createdAt" | "id" | "read"> & { id?: string }) => Promise<StoredNotification>;
    list: (subscriberId: string, options?: ListOptions) => Promise<StoredNotification[]>;
    markAllRead: (subscriberId: string) => Promise<void>;
    markRead: (id: string) => Promise<void>;
    remove: (id: string) => Promise<void>;
    unreadCount: (subscriberId: string) => Promise<number>;
}

/**
 * In-memory {@link InAppStore}.
 */
export class MemoryInAppStore implements InAppStore {
    readonly #items = new Map<string, StoredNotification>();

    public add(notification: Omit<StoredNotification, "createdAt" | "id" | "read"> & { id?: string }): Promise<StoredNotification> {
        const stored: StoredNotification = {
            ...notification,
            createdAt: Date.now(),
            id: notification.id ?? generateMessageId("inapp"),
            read: false,
        };

        this.#items.set(stored.id, stored);

        return Promise.resolve(stored);
    }

    public list(subscriberId: string, options: ListOptions = {}): Promise<StoredNotification[]> {
        let items = [...this.#items.values()].filter((item) => item.subscriberId === subscriberId);

        if (options.unreadOnly) {
            items = items.filter((item) => !item.read);
        }

        items.sort((a, b) => b.createdAt - a.createdAt);

        return Promise.resolve(options.limit ? items.slice(0, options.limit) : items);
    }

    public markRead(id: string): Promise<void> {
        const item = this.#items.get(id);

        if (item) {
            item.read = true;
        }

        return Promise.resolve();
    }

    public markAllRead(subscriberId: string): Promise<void> {
        for (const item of this.#items.values()) {
            if (item.subscriberId === subscriberId) {
                item.read = true;
            }
        }

        return Promise.resolve();
    }

    public unreadCount(subscriberId: string): Promise<number> {
        let count = 0;

        for (const item of this.#items.values()) {
            if (item.subscriberId === subscriberId && !item.read) {
                count += 1;
            }
        }

        return Promise.resolve(count);
    }

    public remove(id: string): Promise<void> {
        this.#items.delete(id);

        return Promise.resolve();
    }
}
