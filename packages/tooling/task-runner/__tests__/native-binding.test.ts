import { describe, expect, it, vi } from "vitest";

// We need to isolate module state between tests since native-binding.ts
// uses module-level caching (loadAttempted flag).
// Each test imports from a fresh module using dynamic import + vi.resetModules.

describe("native-binding", () => {
    describe("loadNativeBindings", () => {
        it("should return undefined when native addon is not available", async () => {
            vi.resetModules();

            const { loadNativeBindings } = await import("../src/native-binding");

            // In the test environment, the native .node binary is not compiled,
            // so loadNativeBindings should gracefully return undefined.
            const result = loadNativeBindings();

            expect(result).toBeUndefined();
        });

        it("should cache the result after the first attempt", async () => {
            vi.resetModules();

            const { loadNativeBindings } = await import("../src/native-binding");

            const first = loadNativeBindings();
            const second = loadNativeBindings();

            // Both calls should return the same value (cached)
            expect(first).toBe(second);
        });
    });

    describe("isNativeAvailable", () => {
        it("should return false when native addon is not available", async () => {
            vi.resetModules();

            const { isNativeAvailable } = await import("../src/native-binding");

            expect(isNativeAvailable()).toBe(false);
        });

        it("should be consistent with loadNativeBindings", async () => {
            vi.resetModules();

            const { isNativeAvailable, loadNativeBindings } = await import("../src/native-binding");

            const bindings = loadNativeBindings();
            const available = isNativeAvailable();

            expect(available).toBe(bindings !== undefined);
        });
    });
});
