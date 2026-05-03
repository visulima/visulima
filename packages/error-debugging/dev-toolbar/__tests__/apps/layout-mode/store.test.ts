import { afterEach, describe, expect, it } from "vitest";

import {
    getLayoutModeState,
    resetLayoutMode,
    setLayoutModeState,
    subscribeLayoutMode,
} from "../../../src/apps/layout-mode/store";

describe("layout-mode store", () => {
    afterEach(() => {
        resetLayoutMode();
    });

    it("returns the initial state shape", () => {
        expect.hasAssertions();

        const state = getLayoutModeState();

        expect(state.activeComponent).toBeNull();
        expect(state.placements).toEqual([]);
        expect(state.rearrange.sections).toEqual([]);
        expect(state.detailLevel).toBe("standard");
        expect(state.blankCanvas).toBe(false);
    });

    it("merges partial updates without losing other fields", () => {
        expect.hasAssertions();

        setLayoutModeState({ blankCanvas: true });
        const state = getLayoutModeState();

        expect(state.blankCanvas).toBe(true);
        expect(state.detailLevel).toBe("standard");
        expect(state.placements).toEqual([]);
    });

    it("supports functional updates that derive from previous state", () => {
        expect.hasAssertions();

        setLayoutModeState({ deselectSignal: 1 });
        setLayoutModeState((p) => { return { deselectSignal: p.deselectSignal + 1 }; });

        expect(getLayoutModeState().deselectSignal).toBe(2);
    });

    it("notifies subscribers when state changes", () => {
        expect.hasAssertions();

        const seen: string[] = [];
        const unsubscribe = subscribeLayoutMode((s) => {
            seen.push(s.activeComponent ?? "null");
        });

        setLayoutModeState({ activeComponent: "card" });
        setLayoutModeState({ activeComponent: null });

        expect(seen).toEqual(["card", "null"]);

        unsubscribe();
    });

    it("stops notifying after unsubscribe", () => {
        expect.hasAssertions();

        let calls = 0;
        const unsubscribe = subscribeLayoutMode(() => {
            calls += 1;
        });

        setLayoutModeState({ deselectSignal: 1 });
        unsubscribe();
        setLayoutModeState({ deselectSignal: 2 });

        expect(calls).toBe(1);
    });

    it("isolates subscriber errors from each other", () => {
        expect.hasAssertions();

        let goodCalls = 0;
        const unsubscribeBad = subscribeLayoutMode(() => {
            throw new Error("listener exploded");
        });
        const unsubscribeGood = subscribeLayoutMode(() => {
            goodCalls += 1;
        });

        expect(() => {
            setLayoutModeState({ deselectSignal: 1 });
        }).not.toThrow();
        expect(goodCalls).toBe(1);

        unsubscribeBad();
        unsubscribeGood();
    });

    it("resetLayoutMode restores the initial state", () => {
        expect.hasAssertions();

        setLayoutModeState({
            activeComponent: "hero",
            blankCanvas: true,
            placements: [{ height: 100, id: "x", scrollY: 0, timestamp: 0, type: "hero", width: 100, x: 0, y: 0 }],
        });
        resetLayoutMode();

        const state = getLayoutModeState();

        expect(state.activeComponent).toBeNull();
        expect(state.blankCanvas).toBe(false);
        expect(state.placements).toEqual([]);
    });
});
