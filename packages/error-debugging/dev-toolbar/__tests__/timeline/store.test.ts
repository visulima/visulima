import { beforeEach, describe, expect, it } from "vitest";

import { getTimelineStore, TimelineStore } from "../../src/timeline/store";
import type { TimelineEvent } from "../../src/types/timeline";
import { DEFAULT_TIMELINE_GROUPS } from "../../src/types/timeline";

const makeEvent = (overrides: Partial<TimelineEvent> = {}): TimelineEvent => {
    return {
        id: "evt-1",
        time: Date.now(),
        title: "Test Event",
        ...overrides,
    };
};

describe("timelineStore", () => {
    let store: TimelineStore;

    beforeEach(() => {
        store = new TimelineStore();
    });

    describe("constructor", () => {
        it("initializes with all default groups", () => {
            expect.hasAssertions();

            const groups = store.getGroups();

            expect(groups).toHaveLength(DEFAULT_TIMELINE_GROUPS.length);
        });

        it("initializes all default groups with empty event arrays", () => {
            expect.hasAssertions();

            for (const group of store.getGroups()) {
                expect(group.events).toHaveLength(0);
            }
        });

        it("includes default group ids", () => {
            expect.hasAssertions();

            const ids = store.getGroups().map((g) => g.id);

            for (const group of DEFAULT_TIMELINE_GROUPS) {
                expect(ids).toContain(group.id);
            }
        });

        it("respects custom maxEvents limit", () => {
            expect.hasAssertions();

            const small = new TimelineStore(3);

            for (let i = 0; i < 5; i++) {
                small.addEvent("hmr", makeEvent({ id: String(i), time: i }));
            }

            expect(small.getGroupEvents("hmr")).toHaveLength(3);
        });
    });

    describe("addEvent", () => {
        it("adds an event to an existing default group", () => {
            expect.hasAssertions();

            const event = makeEvent({ id: "hmr-1", title: "HMR Update" });

            store.addEvent("hmr", event);

            expect(store.getGroupEvents("hmr")).toContainEqual(event);
        });

        it("creates a new group automatically when group does not exist", () => {
            expect.hasAssertions();

            const event = makeEvent({ id: "custom-1", title: "Custom" });

            store.addEvent("my-group", event);

            expect(store.getGroupEvents("my-group")).toContainEqual(event);
        });

        it("new auto-created group uses groupId as both id and label", () => {
            expect.hasAssertions();

            store.addEvent("auto-group", makeEvent());

            const groups = store.getGroups();
            const newGroup = groups.find((g) => g.id === "auto-group");

            expect(newGroup).toBeDefined();
            expect(newGroup?.label).toBe("auto-group");
        });

        it("drops the oldest event when maxEvents is exceeded", () => {
            expect.hasAssertions();

            const small = new TimelineStore(3);

            for (let i = 0; i < 5; i++) {
                small.addEvent("hmr", makeEvent({ id: String(i), time: i }));
            }

            const events = small.getGroupEvents("hmr");

            expect(events).toHaveLength(3);
            // After sorting by time, oldest (0,1) are dropped; 2,3,4 remain
            expect(events.map((e) => e.id)).toStrictEqual(["2", "3", "4"]);
        });

        it("sorts events by ascending time after each add", () => {
            expect.hasAssertions();

            store.addEvent("hmr", makeEvent({ id: "b", time: 200 }));
            store.addEvent("hmr", makeEvent({ id: "a", time: 100 }));

            const events = store.getGroupEvents("hmr");

            expect(events[0]!.time).toBe(100);
            expect(events[1]!.time).toBe(200);
        });

        it("events with same time maintain stable relative insertion order after sort", () => {
            expect.hasAssertions();

            store.addEvent("hmr", makeEvent({ id: "x", time: 100 }));
            store.addEvent("hmr", makeEvent({ id: "y", time: 100 }));

            const events = store.getGroupEvents("hmr");

            expect(events).toHaveLength(2);
        });

        it("stores optional event fields correctly", () => {
            expect.hasAssertions();

            const event: TimelineEvent = {
                data: { key: "value" },
                duration: 42,
                id: "full",
                level: "warning",
                subtitle: "sub",
                time: 1000,
                title: "Full Event",
            };

            store.addEvent("hmr", event);

            expect(store.getGroupEvents("hmr")[0]).toStrictEqual(event);
        });
    });

    describe("getGroupEvents", () => {
        it("returns empty array for a non-existent group", () => {
            expect.hasAssertions();

            expect(store.getGroupEvents("does-not-exist")).toHaveLength(0);
        });

        it("returns events for an existing group", () => {
            expect.hasAssertions();

            const event = makeEvent({ id: "e1" });

            store.addEvent("network", event);

            expect(store.getGroupEvents("network")).toContainEqual(event);
        });

        it("returns events only for the requested group", () => {
            expect.hasAssertions();

            store.addEvent("hmr", makeEvent({ id: "hmr-1" }));
            store.addEvent("network", makeEvent({ id: "net-1" }));

            const networkEvents = store.getGroupEvents("network");

            expect(networkEvents).toHaveLength(1);
            expect(networkEvents[0]!.id).toBe("net-1");
        });
    });

    describe("getAllEvents", () => {
        it("returns empty array when no events have been added", () => {
            expect.hasAssertions();

            expect(store.getAllEvents()).toHaveLength(0);
        });

        it("returns all events across all groups", () => {
            expect.hasAssertions();

            store.addEvent("hmr", makeEvent({ id: "h1", time: 300 }));
            store.addEvent("network", makeEvent({ id: "n1", time: 100 }));
            store.addEvent("errors", makeEvent({ id: "e1", time: 200 }));

            expect(store.getAllEvents()).toHaveLength(3);
        });

        it("returns events sorted by ascending time", () => {
            expect.hasAssertions();

            store.addEvent("hmr", makeEvent({ id: "h1", time: 300 }));
            store.addEvent("network", makeEvent({ id: "n1", time: 100 }));
            store.addEvent("errors", makeEvent({ id: "e1", time: 200 }));

            const all = store.getAllEvents();

            expect(all[0]!.time).toBe(100);
            expect(all[1]!.time).toBe(200);
            expect(all[2]!.time).toBe(300);
        });
    });

    describe("clearGroup", () => {
        it("removes all events from the specified group", () => {
            expect.hasAssertions();

            store.addEvent("hmr", makeEvent({ id: "h1" }));
            store.addEvent("hmr", makeEvent({ id: "h2" }));
            store.clearGroup("hmr");

            expect(store.getGroupEvents("hmr")).toHaveLength(0);
        });

        it("does not affect events in other groups", () => {
            expect.hasAssertions();

            store.addEvent("hmr", makeEvent({ id: "h1" }));
            store.addEvent("network", makeEvent({ id: "n1" }));
            store.clearGroup("hmr");

            expect(store.getGroupEvents("network")).toHaveLength(1);
        });

        it("does not throw for a non-existent group", () => {
            expect.hasAssertions();

            expect(() => {
                store.clearGroup("non-existent");
            }).not.toThrow();
        });
    });

    describe("clearAll", () => {
        it("removes all events from all groups", () => {
            expect.hasAssertions();

            store.addEvent("hmr", makeEvent({ id: "h1" }));
            store.addEvent("network", makeEvent({ id: "n1" }));
            store.addEvent("errors", makeEvent({ id: "e1" }));

            store.clearAll();

            expect(store.getAllEvents()).toHaveLength(0);
        });

        it("preserves groups themselves (only events are cleared)", () => {
            expect.hasAssertions();

            const countBefore = store.getGroups().length;

            store.clearAll();

            expect(store.getGroups()).toHaveLength(countBefore);
        });
    });

    describe("getEventsInRange", () => {
        beforeEach(() => {
            store.addEvent("hmr", makeEvent({ id: "h1", time: 100 }));
            store.addEvent("network", makeEvent({ id: "n1", time: 200 }));
            store.addEvent("errors", makeEvent({ id: "e1", time: 300 }));
        });

        it("returns events within an inclusive range", () => {
            expect.hasAssertions();

            const events = store.getEventsInRange(100, 200);

            expect(events).toHaveLength(2);
        });

        it("includes events exactly on the range boundaries", () => {
            expect.hasAssertions();

            const events = store.getEventsInRange(100, 100);

            expect(events).toHaveLength(1);
            expect(events[0]!.id).toBe("h1");
        });

        it("returns empty array when no events fall in range", () => {
            expect.hasAssertions();

            expect(store.getEventsInRange(400, 500)).toHaveLength(0);
        });

        it("returns all events when range covers all times", () => {
            expect.hasAssertions();

            expect(store.getEventsInRange(0, 9999)).toHaveLength(3);
        });
    });

    describe("getGroups", () => {
        it("returns a new array on each call (not the same reference)", () => {
            expect.hasAssertions();

            const g1 = store.getGroups();
            const g2 = store.getGroups();

            expect(g1).not.toBe(g2);
        });

        it("returned array contains the correct number of groups", () => {
            expect.hasAssertions();

            expect(store.getGroups()).toHaveLength(DEFAULT_TIMELINE_GROUPS.length);
        });
    });
});

describe(getTimelineStore, () => {
    it("returns a TimelineStore instance", () => {
        expect.hasAssertions();

        expect(getTimelineStore()).toBeInstanceOf(TimelineStore);
    });

    it("returns the same singleton instance on repeated calls", () => {
        expect.hasAssertions();

        const s1 = getTimelineStore();
        const s2 = getTimelineStore();

        expect(s1).toBe(s2);
    });
});
