import { describe, expect, expectTypeOf, it, vi } from "vitest";

// We need to isolate module state between tests since native-binding.ts
// uses module-level caching (loadAttempted flag).
// Each test imports from a fresh module using dynamic import + vi.resetModules.
// (Bun loads napi-rs addons since 1.x, so these run on the bun runtime too.)

describe("native-binding", () => {
    describe("loadNativeBindings", () => {
        it("should load the native addon when the binary is compiled", async () => {
            expect.assertions(1);

            vi.resetModules();

            const { loadNativeBindings } = await import("../../src/native-binding");
            const result = loadNativeBindings();

            expect(result).toBeDefined();

            expectTypeOf(result).toBeObject();
            expectTypeOf(result!.hashCommand).toBeFunction();
            expectTypeOf(result!.hashFile).toBeFunction();
            expectTypeOf(result!.runConcurrent).toBeFunction();
        });

        it("should cache the result after the first attempt", async () => {
            expect.assertions(1);

            vi.resetModules();

            const { loadNativeBindings } = await import("../../src/native-binding");

            const first = loadNativeBindings();
            const second = loadNativeBindings();

            expect(first).toBe(second);
        });
    });

    describe("isNativeAvailable", () => {
        it("should return true when native addon is compiled", async () => {
            expect.assertions(1);

            vi.resetModules();

            const { isNativeAvailable } = await import("../../src/native-binding");

            expect(isNativeAvailable()).toBe(true);
        });

        it("should be consistent with loadNativeBindings", async () => {
            expect.assertions(1);

            vi.resetModules();

            const { isNativeAvailable, loadNativeBindings } = await import("../../src/native-binding");

            const bindings = loadNativeBindings();
            const available = isNativeAvailable();

            expect(available).toBe(bindings !== undefined);
        });
    });
});
