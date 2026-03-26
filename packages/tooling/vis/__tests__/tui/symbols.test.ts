import { describe, expect, it } from "vitest";

import { CROSS, DASH, ELLIPSIS, SPINNER_FRAMES, TICK } from "../../src/tui/symbols";

describe("tui/symbols", () => {
    it("should export TICK as a non-empty string", () => {
        expect(typeof TICK).toBe("string");
        expect(TICK.length).toBeGreaterThan(0);
    });

    it("should export CROSS as a non-empty string", () => {
        expect(typeof CROSS).toBe("string");
        expect(CROSS.length).toBeGreaterThan(0);
    });

    it("should export DASH as a non-empty string", () => {
        expect(typeof DASH).toBe("string");
        expect(DASH.length).toBeGreaterThan(0);
    });

    it("should export ELLIPSIS as a non-empty string", () => {
        expect(typeof ELLIPSIS).toBe("string");
        expect(ELLIPSIS.length).toBeGreaterThan(0);
    });

    it("should export SPINNER_FRAMES as a non-empty array of strings", () => {
        expect(Array.isArray(SPINNER_FRAMES)).toBe(true);
        expect(SPINNER_FRAMES.length).toBeGreaterThan(0);

        for (const frame of SPINNER_FRAMES) {
            expect(typeof frame).toBe("string");
        }
    });
});
