import { afterEach, describe, expect, it, vi } from "vitest";

import { isStderrColorSupported, isStdoutColorSupported } from "../src/is-color-supported.edge-light";

describe("is-color-supported.edge-light", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
    });

    it("should expose stdout and stderr detectors as the same implementation", () => {
        expect.assertions(1);

        expect(isStdoutColorSupported).toBe(isStderrColorSupported);
    });

    it("should return 1 when NEXT_RUNTIME is edge", () => {
        expect.assertions(1);

        vi.stubEnv("NEXT_RUNTIME", "edge");

        expect(isStdoutColorSupported()).toBe(1);
    });

    it("should return 1 when NEXT_RUNTIME is experimental-edge", () => {
        expect.assertions(1);

        vi.stubEnv("NEXT_RUNTIME", "experimental-edge");

        expect(isStderrColorSupported()).toBe(1);
    });

    it("should fall back to the browser detector when NEXT_RUNTIME is not an edge runtime", () => {
        expect.assertions(1);

        vi.stubEnv("NEXT_RUNTIME", "nodejs");
        // No navigator is defined in the node environment, so the browser detector returns mono.
        vi.stubGlobal("navigator", undefined);

        expect(isStdoutColorSupported()).toBe(0);
    });

    it("should fall back to the browser detector when NEXT_RUNTIME is unset", () => {
        expect.assertions(1);

        vi.stubGlobal("navigator", undefined);

        expect(isStdoutColorSupported()).toBe(0);
    });

    it("should not throw when no process global exists", () => {
        expect.assertions(1);

        vi.stubGlobal("process", undefined);
        vi.stubGlobal("navigator", undefined);

        expect(isStdoutColorSupported()).toBe(0);
    });
});
