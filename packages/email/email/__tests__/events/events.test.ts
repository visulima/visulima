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

        it("isolates a throwing subscriber so the others still receive the event", () => {
            expect.assertions(2);

            const bus = new EventBus();
            const before = vi.fn(() => {
                throw new Error("subscriber blew up");
            });
            const after = vi.fn();
            const wildcard = vi.fn();

            bus.on("sent", before);
            bus.on("sent", after);
            bus.on(ALL_EVENTS, wildcard);

            // emit must not throw even though `before` does.
            expect(() => {
                bus.emit(makeEvent({ type: "sent" }));
            }).not.toThrow();
            // The throwing listener does not drop the type-specific sibling or the wildcard listener.
            expect(after).toHaveBeenCalledTimes(1);
        });

        it("removes a specific listener via off without affecting others", () => {
            expect.assertions(2);

            const bus = new EventBus();
            const keep = vi.fn();
            const drop = vi.fn();

            bus.on("delivered", keep);
            bus.on("delivered", drop);
            bus.off("delivered", drop);

            bus.emit(makeEvent({ type: "delivered" }));

            expect(keep).toHaveBeenCalledTimes(1);
            expect(drop).not.toHaveBeenCalled();
        });

        it("clear() removes all listeners (or only one type's) so they stop receiving events", () => {
            expect.assertions(3);

            const bus = new EventBus();
            const opened = vi.fn();
            const clicked = vi.fn();

            bus.on("opened", opened);
            bus.on("clicked", clicked);

            bus.clear("opened"); // only the opened listeners go
            bus.emit(makeEvent({ type: "opened" }));
            bus.emit(makeEvent({ type: "clicked" }));

            expect(opened).not.toHaveBeenCalled();
            expect(clicked).toHaveBeenCalledTimes(1);

            bus.clear(); // everything goes
            bus.emit(makeEvent({ type: "clicked" }));

            expect(clicked).toHaveBeenCalledTimes(1);
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

        it("returns an empty timeline for an unknown message", () => {
            expect.assertions(1);

            const store = new MemoryEventStore();

            store.append(makeEvent({ id: "1", messageId: "<known@x>", type: "sent" }));

            expect(store.timeline("<missing@x>")).toStrictEqual([]);
        });

        it("retains events that have no messageId in all() under a shared bucket", () => {
            expect.assertions(2);

            const store = new MemoryEventStore();

            store.append(makeEvent({ id: "u1", timestamp: new Date(100), type: "queued" }));
            store.append(makeEvent({ id: "u2", timestamp: new Date(200), type: "failed" }));

            // Unkeyed events are not silently dropped — they surface in all(), time-ordered.
            expect(store.all().map((event) => event.id)).toStrictEqual(["u1", "u2"]);
            // …but a keyed timeline lookup doesn't return them.
            expect(store.timeline("u1")).toStrictEqual([]);
        });

        it("orders all() across messages strictly by timestamp", () => {
            expect.assertions(1);

            const store = new MemoryEventStore();

            store.append(makeEvent({ id: "late", messageId: "<a@x>", timestamp: new Date(3000), type: "delivered" }));
            store.append(makeEvent({ id: "early", messageId: "<b@x>", timestamp: new Date(1000), type: "queued" }));
            store.append(makeEvent({ id: "mid", messageId: "<a@x>", timestamp: new Date(2000), type: "sent" }));

            expect(store.all().map((event) => event.id)).toStrictEqual(["early", "mid", "late"]);
        });

        it("clear() empties the store", () => {
            expect.assertions(2);

            const store = new MemoryEventStore();

            store.append(makeEvent({ id: "1", messageId: "<m@x>", type: "sent" }));

            expect(store.all()).toHaveLength(1);

            store.clear();

            expect(store.all()).toStrictEqual([]);
        });
    });
});
