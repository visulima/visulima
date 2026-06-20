import { createStorage } from "unstorage";
import { beforeEach, describe, expect, it } from "vitest";

import type { UnstorageInAppStore } from "../src/channels/inapp/unstorage-store";
import { createUnstorageInAppStore } from "../src/channels/inapp/unstorage-store";

describe("unstorageInAppStore", () => {
    let store: UnstorageInAppStore;

    beforeEach(() => {
        store = createUnstorageInAppStore(createStorage());
    });

    it("adds and lists notifications for a subscriber", async () => {
        expect.assertions(3);

        const stored = await store.add({ body: "hello", subscriberId: "user-1", title: "Hi" });

        expect(stored.id).toBeDefined();
        expect(stored.read).toBe(false);

        const items = await store.list("user-1");

        expect(items).toHaveLength(1);
    });

    it("orders newest first and respects limit", async () => {
        expect.assertions(3);

        await store.add({ body: "1", id: "a", subscriberId: "user-1" });
        await new Promise((resolve) => {
            setTimeout(resolve, 2);
        });
        await store.add({ body: "3", id: "c", subscriberId: "user-1" });

        const items = await store.list("user-1", { limit: 1 });

        expect(items).toHaveLength(1);
        expect(items[0]?.id).toBe("c");

        const all = await store.list("user-1");

        expect(all).toHaveLength(2);
    });

    it("isolates notifications by subscriber", async () => {
        expect.assertions(2);

        await store.add({ body: "a", subscriberId: "user-1" });
        await store.add({ body: "b", subscriberId: "user-2" });

        await expect(store.list("user-1")).resolves.toHaveLength(1);
        await expect(store.list("user-2")).resolves.toHaveLength(1);
    });

    it("marks a single notification as read", async () => {
        expect.assertions(2);

        const stored = await store.add({ body: "x", subscriberId: "user-1" });

        await expect(store.unreadCount("user-1")).resolves.toBe(1);

        await store.markRead(stored.id);

        await expect(store.unreadCount("user-1")).resolves.toBe(0);
    });

    it("marks all notifications read and filters unread", async () => {
        expect.assertions(2);

        await store.add({ body: "1", subscriberId: "user-1" });
        await store.add({ body: "2", subscriberId: "user-1" });

        await store.markAllRead("user-1");

        await expect(store.unreadCount("user-1")).resolves.toBe(0);
        await expect(store.list("user-1", { unreadOnly: true })).resolves.toHaveLength(0);
    });

    it("removes a notification and updates the index", async () => {
        expect.assertions(2);

        const stored = await store.add({ body: "gone", subscriberId: "user-1" });

        await store.remove(stored.id);

        await expect(store.list("user-1")).resolves.toHaveLength(0);
        await expect(store.unreadCount("user-1")).resolves.toBe(0);
    });
});
