import { describe, expect, it, vi } from "vitest";

import { createStateStore, getByPath, setByPath } from "../../src/json-view/state-store";

describe(getByPath, () => {
    it("reads a nested value", () => {
        expect.hasAssertions();

        expect(getByPath({ a: { b: 1 } }, "/a/b")).toBe(1);
    });

    it("reads an array index", () => {
        expect.hasAssertions();

        expect(getByPath({ expanded: [false, true] }, "/expanded/1")).toBe(true);
    });

    it("returns undefined for a path that does not exist", () => {
        expect.hasAssertions();

        expect(getByPath({}, "/expanded/3")).toBeUndefined();
        expect(getByPath({ a: 1 }, "/a/b/c")).toBeUndefined();
    });

    it("unescapes the pointer escapes for slash and tilde", () => {
        expect.hasAssertions();

        expect(getByPath({ "a/b": 1, "c~d": 2 }, "/a~1b")).toBe(1);
        expect(getByPath({ "a/b": 1, "c~d": 2 }, "/c~0d")).toBe(2);
    });
});

describe(setByPath, () => {
    it("writes a nested value, creating objects on the way", () => {
        expect.hasAssertions();

        const model = {};

        setByPath(model, "/a/b", 1);

        expect(model).toStrictEqual({ a: { b: 1 } });
    });

    it("creates an array for a numeric segment, so indexed state stays JSON-clean", () => {
        expect.hasAssertions();

        const model = {};

        setByPath(model, "/expanded/2", true);

        expect(Array.isArray((model as { expanded: unknown }).expanded)).toBe(true);
        // A JSON round trip, not a clone: the holes must serialise as null
        // rather than vanishing, which is what an object with a "2" key would do.
        // eslint-disable-next-line unicorn/prefer-structured-clone
        expect(JSON.parse(JSON.stringify(model))).toStrictEqual({ expanded: [null, null, true] });
    });

    it("overwrites a non-object standing where a container is needed", () => {
        expect.hasAssertions();

        const model: Record<string, unknown> = { a: 5 };

        setByPath(model, "/a/b", 1);

        expect(model).toStrictEqual({ a: { b: 1 } });
    });
});

describe(createStateStore, () => {
    it("copies the initial model rather than adopting the caller's object", () => {
        expect.hasAssertions();

        const initial = { a: 1 };
        const store = createStateStore(initial);

        // Identity, not just value: adopting the caller's object would let a
        // later mutation of `initial` change the store behind its back.
        expect(store.getSnapshot()).not.toBe(initial);

        store.set("/a", 2);

        expect(initial.a).toBe(1);
        expect(store.get("/a")).toBe(2);
    });

    it("notifies subscribers on a change", () => {
        expect.hasAssertions();

        const store = createStateStore({});
        const listener = vi.fn();

        store.subscribe(listener);
        store.set("/a", 1);

        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("does not notify when the value is unchanged", () => {
        expect.hasAssertions();

        const store = createStateStore({ a: 1 });
        const listener = vi.fn();

        store.subscribe(listener);
        store.set("/a", 1);

        expect(listener).not.toHaveBeenCalled();
    });

    it("publishes a new snapshot reference so a consumer comparing by identity sees the change", () => {
        expect.hasAssertions();

        const store = createStateStore({ a: 1 });
        const before = store.getSnapshot();

        store.set("/a", 2);

        expect(store.getSnapshot()).not.toBe(before);
    });

    it("stops notifying after unsubscribe", () => {
        expect.hasAssertions();

        const store = createStateStore({});
        const listener = vi.fn();
        const unsubscribe = store.subscribe(listener);

        unsubscribe();
        store.set("/a", 1);

        expect(listener).not.toHaveBeenCalled();
    });
});
