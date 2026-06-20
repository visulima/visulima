import { describe, expect, it } from "vitest";

import { MemoryEventStore } from "../src/events";
import type { NotificationEvent } from "../src/types";

const event = (messageId: string, type: NotificationEvent["type"]): NotificationEvent => {
    return { messageId, timestamp: new Date(), type };
};

describe("memoryEventStore", () => {
    it("returns appended events in insertion order", () => {
        expect.assertions(2);

        const store = new MemoryEventStore();

        store.append(event("m1", "queued"));
        store.append(event("m1", "sent"));
        store.append(event("m1", "delivered"));

        const timeline = store.timeline("m1");

        expect(timeline).toHaveLength(3);
        expect(timeline.map((entry) => entry.type)).toStrictEqual(["queued", "sent", "delivered"]);
    });

    it("returns an empty array for an unknown message id", () => {
        expect.assertions(1);

        const store = new MemoryEventStore();

        expect(store.timeline("missing")).toStrictEqual([]);
    });

    it("isolates timelines per message id", () => {
        expect.assertions(3);

        const store = new MemoryEventStore();

        store.append(event("m1", "sent"));
        store.append(event("m2", "failed"));
        store.append(event("m2", "bounced"));

        expect(store.timeline("m1")).toHaveLength(1);
        expect(store.timeline("m2")).toHaveLength(2);
        expect(store.timeline("m1")[0]?.type).toBe("sent");
    });
});
