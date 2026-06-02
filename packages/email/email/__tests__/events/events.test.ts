import { describe, expect, it, vi } from "vitest";

import type { EmailEvent } from "../../src/events";
import { ALL_EVENTS, EventBus, MemoryEventStore } from "../../src/events";

const makeEvent = (overrides: Partial<EmailEvent>): EmailEvent => {
    return {
        id: "e1",
        timestamp: new Date(0),
        type: "queued",
        ...overrides,
    };
};

describe("events", () => {
    describe(EventBus, () => {
        it("dispatches to type-specific and wildcard listeners", () => {
            expect.assertions(2);

            const bus = new EventBus();
            const typed = vi.fn();
            const all = vi.fn();

            bus.on("sent", typed);
            bus.on(ALL_EVENTS, all);

            bus.emit(makeEvent({ type: "sent" }));
            bus.emit(makeEvent({ type: "bounced" }));

            expect(typed).toHaveBeenCalledTimes(1);
            expect(all).toHaveBeenCalledTimes(2);
        });

        it("supports once and unsubscribe", () => {
            expect.assertions(2);

            const bus = new EventBus();
            const once = vi.fn();
            const off = vi.fn();

            bus.once("opened", once);
            const unsubscribe = bus.on("opened", off);

            bus.emit(makeEvent({ type: "opened" }));
            unsubscribe();
            bus.emit(makeEvent({ type: "opened" }));

            expect(once).toHaveBeenCalledTimes(1);
            expect(off).toHaveBeenCalledTimes(1);
        });
    });

    describe(MemoryEventStore, () => {
        it("reconstructs a per-message timeline in timestamp order", () => {
            expect.assertions(2);

            const store = new MemoryEventStore();

            store.append(makeEvent({ id: "2", messageId: "<m@x>", timestamp: new Date(2000), type: "delivered" }));
            store.append(makeEvent({ id: "1", messageId: "<m@x>", timestamp: new Date(1000), type: "sent" }));
            store.append(makeEvent({ id: "3", messageId: "<other@x>", timestamp: new Date(500), type: "queued" }));

            const timeline = store.timeline("<m@x>");

            expect(timeline.map((event) => event.id)).toStrictEqual(["1", "2"]);
            expect(store.all()).toHaveLength(3);
        });
    });
});
