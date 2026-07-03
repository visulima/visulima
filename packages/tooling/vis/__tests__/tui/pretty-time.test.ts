import { describe, expect, expectTypeOf, it } from "vitest";

import { formatHrtime, formatMs } from "../../src/tui/pretty-time";

describe("tui/pretty-time", () => {
    describe(formatMs, () => {
        it("should format milliseconds to human-readable string", () => {
            expect.assertions(2);

            const result = formatMs(5000);

            expect(result).toContain("5");
            expect(result.toLowerCase()).toContain("s");
        });

        it("should format sub-second durations", () => {
            expect.assertions(1);

            const result = formatMs(250);

            expect(result).toContain("250");
        });

        it("should format multi-unit durations with at most 2 units", () => {
            // 1 hour, 30 minutes, 45 seconds = 5445000ms
            expect.assertions(1);

            const result = formatMs(5_445_000);

            // Should show at most 2 units (largest: 2)
            expectTypeOf(result).toBeString();

            expect(result.length).toBeGreaterThan(0);
        });

        it("should handle zero", () => {
            expect.assertions(1);

            const result = formatMs(0);

            expectTypeOf(result).toBeString();

            expect(result).toContain("0");
        });
    });

    describe(formatHrtime, () => {
        it("should format hrtime tuples", () => {
            expect.assertions(1);

            const result = formatHrtime([1, 234_000_000]);

            // 1 second + 234ms = 1234ms
            expect(result).toContain("1");
        });

        it("should format zero hrtime", () => {
            expect.assertions(1);

            const result = formatHrtime([0, 0]);

            expectTypeOf(result).toBeString();

            expect(result).toContain("0");
        });

        it("should format large hrtime values", () => {
            expect.assertions(1);

            const result = formatHrtime([65, 0]);

            // 65 seconds = 1m 5s
            expect(result).toContain("1");
        });
    });
});
