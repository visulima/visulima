import { describe, expect, it } from "vitest";

import { formatMinutesAsTimeString, parseDurationToMinutes } from "../../src/security/security";

describe(formatMinutesAsTimeString, () => {
    it("renders whole days as `Nd`", () => {
        expect.assertions(2);

        expect(formatMinutesAsTimeString(2880)).toBe("2d");
        expect(formatMinutesAsTimeString(1440)).toBe("1d");
    });

    it("renders whole hours as `Nh` when the value is not a multiple of a day", () => {
        expect.assertions(2);

        expect(formatMinutesAsTimeString(60)).toBe("1h");
        expect(formatMinutesAsTimeString(120)).toBe("2h");
    });

    it("renders bare minutes as `Nm` when neither days nor hours divide evenly", () => {
        expect.assertions(2);

        expect(formatMinutesAsTimeString(15)).toBe("15m");
        expect(formatMinutesAsTimeString(90)).toBe("90m");
    });

    it("clamps zero and negative values to `0m` instead of throwing", () => {
        expect.assertions(3);

        expect(formatMinutesAsTimeString(0)).toBe("0m");
        expect(formatMinutesAsTimeString(-10)).toBe("0m");
        expect(formatMinutesAsTimeString(Number.NaN)).toBe("0m");
    });

    it("rounds fractional minutes up to the nearest minute (canonical-minute write)", () => {
        expect.assertions(2);

        // Sub-minute fractions would otherwise round-trip differently on each PM.
        expect(formatMinutesAsTimeString(0.4)).toBe("1m");
        expect(formatMinutesAsTimeString(1.5)).toBe("2m");
    });
});

describe(parseDurationToMinutes, () => {
    it("parses bare numbers as minutes", () => {
        expect.assertions(2);

        expect(parseDurationToMinutes("60")).toBe(60);
        expect(parseDurationToMinutes("2880")).toBe(2880);
    });

    it("parses the four unit suffixes", () => {
        expect.assertions(4);

        expect(parseDurationToMinutes("15m")).toBe(15);
        expect(parseDurationToMinutes("2h")).toBe(120);
        expect(parseDurationToMinutes("2d")).toBe(2880);
        expect(parseDurationToMinutes("1w")).toBe(10_080);
    });

    it("accepts fractional input and rounds to the nearest minute", () => {
        expect.assertions(2);

        expect(parseDurationToMinutes("1.5d")).toBe(2160);
        expect(parseDurationToMinutes("0.5h")).toBe(30);
    });

    it("returns undefined for malformed input", () => {
        expect.assertions(4);

        expect(parseDurationToMinutes("")).toBeUndefined();
        expect(parseDurationToMinutes("foo")).toBeUndefined();
        expect(parseDurationToMinutes("-1d")).toBeUndefined();
        expect(parseDurationToMinutes("2x")).toBeUndefined();
    });

    it("is case-insensitive for the unit suffix", () => {
        expect.assertions(2);

        expect(parseDurationToMinutes("2D")).toBe(2880);
        expect(parseDurationToMinutes("3H")).toBe(180);
    });
});

describe("formatMinutesAsTimeString / parseDurationToMinutes round-trip", () => {
    it("round-trips through `d`/`h`/`m` for clean values", () => {
        expect.assertions(3);

        for (const minutes of [2880, 120, 15]) {
            const formatted = formatMinutesAsTimeString(minutes);

            expect(parseDurationToMinutes(formatted)).toBe(minutes);
        }
    });

    it("normalises `1w` to `7d` on round-trip (formatter is narrower than parser)", () => {
        expect.assertions(2);

        const minutes = parseDurationToMinutes("1w");

        expect(minutes).toBe(10_080);
        // The formatter does not emit `w`, so 10080 → "7d", not "1w".
        expect(formatMinutesAsTimeString(minutes!)).toBe("7d");
    });
});
