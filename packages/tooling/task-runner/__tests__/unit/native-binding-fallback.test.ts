import { afterEach, describe, expect, it, vi } from "vitest";

// These tests force the native addon to fail to load (by mocking
// `node:module`'s `createRequire` so the generated `../index.js` require
// throws), then assert the loader no longer degrades *silently*:
//   - default: emits exactly one process warning and returns undefined
//   - TASK_RUNNER_REQUIRE_NATIVE / VIS_REQUIRE_NATIVE: throws instead
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

describe("native-binding fallback visibility", () => {
    afterEach(() => {
        vi.doUnmock("node:module");
        vi.resetModules();
        delete process.env["TASK_RUNNER_REQUIRE_NATIVE"];
        delete process.env["VIS_REQUIRE_NATIVE"];
    });

    it("warns once and returns undefined when the addon cannot be loaded", async () => {
        expect.assertions(3);

        vi.resetModules();
        mockRequireFailure();

        const warn = vi.spyOn(process, "emitWarning").mockImplementation(() => undefined);

        const { loadNativeBindings } = await import("../../src/native-binding");

        // Call twice — the module-level `loadAttempted` guard must keep the
        // warning to a single emission, not one per call.
        const first = loadNativeBindings();
        const second = loadNativeBindings();

        expect(first).toBeUndefined();
        expect(second).toBeUndefined();
        expect(warn).toHaveBeenCalledTimes(1);

        warn.mockRestore();
    });

    it("tags the warning with the TASK_RUNNER_NATIVE_FALLBACK code", async () => {
        expect.assertions(1);

        vi.resetModules();
        mockRequireFailure();

        const warn = vi.spyOn(process, "emitWarning").mockImplementation(() => undefined);

        const { loadNativeBindings } = await import("../../src/native-binding");

        loadNativeBindings();

        expect(warn.mock.calls[0]?.[1]).toMatchObject({ code: "TASK_RUNNER_NATIVE_FALLBACK" });

        warn.mockRestore();
    });

    it("throws instead of degrading when TASK_RUNNER_REQUIRE_NATIVE=1", async () => {
        expect.assertions(1);

        vi.resetModules();
        mockRequireFailure();
        process.env["TASK_RUNNER_REQUIRE_NATIVE"] = "1";

        const { loadNativeBindings } = await import("../../src/native-binding");

        expect(() => loadNativeBindings()).toThrow(/native addon is required/);
    });

    it("also honours the VIS_REQUIRE_NATIVE alias", async () => {
        expect.assertions(1);

        vi.resetModules();
        mockRequireFailure();
        process.env["VIS_REQUIRE_NATIVE"] = "true";

        const { loadNativeBindings } = await import("../../src/native-binding");

        expect(() => loadNativeBindings()).toThrow(/native addon is required/);
    });
});
