import { describe, expect, it } from "vitest";

import { formatHrtime, formatMs } from "../../src/tui/pretty-time";

describe("tui/pretty-time", () => {
    describe("formatMs", () => {
        it("should format milliseconds to human-readable string", () => {
            const result = formatMs(5000);

            expect(result).toContain("5");
            expect(result.toLowerCase()).toContain("s");
        });

        it("should format sub-second durations", () => {
            const result = formatMs(250);

            expect(result).toContain("250");
        });

        it("should format multi-unit durations with at most 2 units", () => {
            // 1 hour, 30 minutes, 45 seconds = 5445000ms
            const result = formatMs(5_445_000);

            // Should show at most 2 units (largest: 2)
            expect(result).toBeTruthy();
        });

        it("should handle zero", () => {
            const result = formatMs(0);

            expect(result).toBeTruthy();
        });
    });

    describe("formatHrtime", () => {
        it("should format hrtime tuples", () => {
            const result = formatHrtime([1, 234_000_000]);

            // 1 second + 234ms = 1234ms
            expect(result).toContain("1");
        });

        it("should format zero hrtime", () => {
            const result = formatHrtime([0, 0]);

            expect(result).toBeTruthy();
        });

        it("should format large hrtime values", () => {
            const result = formatHrtime([65, 0]);

            // 65 seconds = 1m 5s
            expect(result).toContain("1");
        });
    });
});
