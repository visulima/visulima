import { createRequire } from "node:module";

import { describe, expect, expectTypeOf, it, vi } from "vitest";

// Detect whether the compiled .node binary is loadable for the current platform.
// In the build-native.yml workflow the binary is always downloaded before these
// tests run, so it should be present.  Locally (without a compiled binary) the
// tests still pass but assert the graceful-fallback path instead.
const esmRequire = createRequire(import.meta.url);

let nativeBinaryPresent: boolean;

try {
    esmRequire("../index.js");
    nativeBinaryPresent = true;
} catch {
    nativeBinaryPresent = false;
}

// We need to isolate module state between tests since native-binding.ts
// uses module-level caching (loadAttempted flag).
// Each test imports from a fresh module using dynamic import + vi.resetModules.

describe("native-binding", () => {
    describe("loadNativeBindings", () => {
        it("should load the native addon when the binary is compiled", async () => {
            if (!nativeBinaryPresent) {
                return;
            }

            vi.resetModules();

            const { loadNativeBindings } = await import("../src/native-binding");
            const result = loadNativeBindings();

            expect(result).toBeDefined();

            expectTypeOf(result).toBeObject();
            expectTypeOf(result!.hashCommand).toBeFunction();
            expectTypeOf(result!.hashFile).toBeFunction();
            expectTypeOf(result!.runConcurrent).toBeFunction();
        });

        it("should return undefined when native addon is not available", async () => {
            if (nativeBinaryPresent) {
                return;
            }

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
        it("should return true when native addon is compiled", async () => {
            if (!nativeBinaryPresent) {
                return;
            }

            vi.resetModules();

            const { isNativeAvailable } = await import("../src/native-binding");

            expect(isNativeAvailable()).toBe(true);
        });

        it("should return false when native addon is not available", async () => {
            if (nativeBinaryPresent) {
                return;
            }

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
