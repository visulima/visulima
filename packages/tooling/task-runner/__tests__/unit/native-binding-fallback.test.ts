import { afterEach, describe, expect, it, vi } from "vitest";

// These tests force the native addon to fail to load (by mocking
// `node:module`'s `createRequire` so the generated `../index.js` require
// throws), then assert the loader HARD-FAILS with a clear, actionable error
// instead of degrading silently. The addon is required on every supported
// platform, so a load failure is a broken install/binary, not an env we
// tolerate.
//
// A bare `vi.resetModules()` + dynamic import gives each test a fresh copy
// of native-binding.ts (it caches the load result at module scope).

const mockRequireFailure = (): void => {
    vi.doMock(import("node:module"), () => {
        return {
            createRequire: () => () => {
                throw new Error("Cannot find native binding (mocked)");
            },
        };
    });
};

describe("native-binding hard-fail", () => {
    afterEach(() => {
        vi.doUnmock("node:module");
        vi.resetModules();
    });

    it("throws an actionable error when the addon cannot be loaded", async () => {
        expect.assertions(2);

        vi.resetModules();
        mockRequireFailure();

        const { loadNativeBindings } = await import("../../src/native-binding");

        expect(() => loadNativeBindings()).toThrow(/native addon could not be loaded/);
        expect(() => loadNativeBindings()).toThrow(/task-runner-binding-\*/);
    });

    it("re-throws on subsequent calls (single load attempt)", async () => {
        expect.assertions(2);

        vi.resetModules();
        mockRequireFailure();

        const { loadNativeBindings } = await import("../../src/native-binding");

        // Both calls throw — the second re-throws the cached error rather than
        // re-attempting the require (guarded by the module-level loadAttempted).
        expect(() => loadNativeBindings()).toThrow(/native addon could not be loaded/);
        expect(() => loadNativeBindings()).toThrow(/native addon could not be loaded/);
    });

    it("isNativeAvailable() returns false instead of throwing when the addon is missing", async () => {
        expect.assertions(1);

        vi.resetModules();
        mockRequireFailure();

        const { isNativeAvailable } = await import("../../src/native-binding");

        expect(isNativeAvailable()).toBe(false);
    });
});
