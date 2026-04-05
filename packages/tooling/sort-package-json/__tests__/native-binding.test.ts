import { describe, expect, it, vi } from "vitest";

describe("native-binding", () => {
    describe("loadNativeBindings", () => {
        it("should return undefined when native addon is not available", async () => {
            vi.resetModules();

            const { loadNativeBindings } = await import("../src/native-binding");
            const result = loadNativeBindings();

            expect(result).toBeUndefined();
        });

        it("should cache the result after the first attempt", async () => {
            vi.resetModules();

            const { loadNativeBindings } = await import("../src/native-binding");
            const first = loadNativeBindings();
            const second = loadNativeBindings();

            expect(first).toBe(second);
        });
    });

    describe("isNativeAvailable", () => {
        it("should return false when native addon is not available", async () => {
            vi.resetModules();

            const { isNativeAvailable } = await import("../src/native-binding");

            expect(isNativeAvailable()).toBe(false);
        });
    });
});
