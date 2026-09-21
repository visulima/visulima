import { describe, expect, it } from "vitest";

import baseActions from "../../src/json-view/actions";
import { createStateStore } from "../../src/json-view/state-store";

describe("toggle", () => {
    it("flips a false value to true", () => {
        expect.hasAssertions();

        const store = createStateStore({ open: false });

        baseActions["toggle"]?.({ path: "/open" }, store);

        expect(store.get("/open")).toBe(true);
    });

    it("flips an unset path to true, so a spec need not seed every index", () => {
        expect.hasAssertions();

        const store = createStateStore({});

        baseActions["toggle"]?.({ path: "/expanded/2" }, store);

        expect(store.get("/expanded/2")).toBe(true);
    });

    it("flips back on a second call", () => {
        expect.hasAssertions();

        const store = createStateStore({ open: true });

        baseActions["toggle"]?.({ path: "/open" }, store);

        expect(store.get("/open")).toBe(false);
    });

    it("ignores a call with no usable path rather than writing to undefined", () => {
        expect.hasAssertions();

        const store = createStateStore({ open: false });

        baseActions["toggle"]?.({}, store);
        baseActions["toggle"]?.({ path: 42 }, store);

        expect(store.getSnapshot()).toStrictEqual({ open: false });
    });
});
