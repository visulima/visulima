import { describe, expect, it } from "vitest";

import { formatMinutesAsTimeString, parseTimeStringToMinutes } from "../../../src/commands/update/handler";

describe(parseTimeStringToMinutes, () => {
    it("parses minutes, hours, days, weeks", () => {
        expect.assertions(4);

        expect(parseTimeStringToMinutes("15m")).toBe(15);
        expect(parseTimeStringToMinutes("2h")).toBe(120);
        expect(parseTimeStringToMinutes("3d")).toBe(4320);
        expect(parseTimeStringToMinutes("1w")).toBe(10_080);
    });

    it("treats a bare number as minutes (forgiving pnpm-style config)", () => {
        expect.assertions(1);

        expect(parseTimeStringToMinutes("2880")).toBe(2880);
    });

    it("returns undefined for malformed input", () => {
        expect.assertions(3);

        expect(parseTimeStringToMinutes("")).toBeUndefined();
        expect(parseTimeStringToMinutes("garbage")).toBeUndefined();
        // Negative durations are nonsense for a release-age gate.
        expect(parseTimeStringToMinutes("-1d")).toBeUndefined();
    });

    it("ignores surrounding whitespace and is case-insensitive on units", () => {
        expect.assertions(2);

        expect(parseTimeStringToMinutes("  48H ")).toBe(2880);
        expect(parseTimeStringToMinutes("2D")).toBe(2880);
    });
});

describe(formatMinutesAsTimeString, () => {
    it("renders whole days as Nd", () => {
        expect.assertions(2);

        expect(formatMinutesAsTimeString(2880)).toBe("2d");
        expect(formatMinutesAsTimeString(10_080)).toBe("7d");
    });

    it("renders whole hours as Nh when not a whole day", () => {
        expect.assertions(2);

        expect(formatMinutesAsTimeString(120)).toBe("2h");
        // 25 hours: whole hours but not a whole day.
        expect(formatMinutesAsTimeString(1500)).toBe("25h");
    });

    it("falls back to Nm when neither hours nor days divide evenly", () => {
        expect.assertions(2);

        expect(formatMinutesAsTimeString(15)).toBe("15m");
        // 90 min = 1.5h, doesn't divide evenly, so render as minutes.
        expect(formatMinutesAsTimeString(90)).toBe("90m");
    });

    it("renders zero / negative input as 0m", () => {
        expect.assertions(2);

        expect(formatMinutesAsTimeString(0)).toBe("0m");
        expect(formatMinutesAsTimeString(-5)).toBe("0m");
    });
});
