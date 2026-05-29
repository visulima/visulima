// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const HOOK_KEY = "__DEV_TOOLBAR_HOOK__";

const importFresh = async () => {
    vi.resetModules();

    return import("../../src/hooks/global-hook");
};

describe("hooks/global-hook", () => {
    beforeEach(() => {
        delete (globalThis as Record<string, unknown>)[HOOK_KEY];
    });

    afterEach(() => {
        delete (globalThis as Record<string, unknown>)[HOOK_KEY];
    });

    describe("setupGlobalHook", () => {
        it("creates a hook instance and exposes it on window", async () => {
            expect.assertions(2);

            const { setupGlobalHook } = await importFresh();
            const hook = setupGlobalHook();

            expect(hook).toBeDefined();
            expect((globalThis as Record<string, unknown>)[HOOK_KEY]).toBe(hook);
        });

        it("returns the same singleton on a second call (ignores new callbacks)", async () => {
            expect.assertions(1);

            const { setupGlobalHook } = await importFresh();
            const first = setupGlobalHook();
            const second = setupGlobalHook(vi.fn(), vi.fn());

            expect(second).toBe(first);
        });

        it("forwards register/timeline callbacks to the created hook", async () => {
            expect.assertions(2);

            const { setupGlobalHook } = await importFresh();
            const onRegisterApp = vi.fn();
            const onTimelineEvent = vi.fn();
            const hook = setupGlobalHook(onRegisterApp, onTimelineEvent);

            hook.registerApp({ icon: "<svg/>", id: "a", name: "A" });
            hook.addTimelineEvent("group", { id: "e", time: 0, title: "T" });

            expect(onRegisterApp).toHaveBeenCalledTimes(1);
            expect(onTimelineEvent).toHaveBeenCalledTimes(1);
        });
    });

    describe("getGlobalHook", () => {
        it("returns undefined before any hook is set up", async () => {
            expect.assertions(1);

            const { getGlobalHook } = await importFresh();

            expect(getGlobalHook()).toBeUndefined();
        });

        it("returns the hook from the window global once set up", async () => {
            expect.assertions(1);

            const { getGlobalHook, setupGlobalHook } = await importFresh();
            const hook = setupGlobalHook();

            expect(getGlobalHook()).toBe(hook);
        });

        it("falls back to the module singleton when the window global is missing", async () => {
            expect.assertions(1);

            const { getGlobalHook, setupGlobalHook } = await importFresh();
            const hook = setupGlobalHook();

            // Remove the window global; getGlobalHook should still return the module-level instance.
            delete (globalThis as Record<string, unknown>)[HOOK_KEY];

            expect(getGlobalHook()).toBe(hook);
        });
    });
});
