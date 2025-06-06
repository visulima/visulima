import { describe, expect, it } from "vitest";

import { inspect } from "../../src";

describe("date", () => {
    it("returns date in iso format", () => {
        expect.assertions(1);

        expect(inspect(new Date(1_475_318_637_123))).toBe("2016-10-01T10:43:57.123Z");
    });

    it("returns \"Invalid Date\" if given an invalid Date object", () => {
        expect.assertions(1);

        // See: https://github.com/chaijs/loupe/issues/58
        expect(inspect(new Date("not a date"))).toBe("Invalid Date");
    });

    it("should inspect a date object with a toJSON method that returns null", () => {
        expect.assertions(1);

        const date = new Date("invalid");

        expect(inspect(date)).toBe("Invalid Date");
    });

    describe("maxStringLength", () => {
        it("returns the full representation when maxStringLength is over string length", () => {
            expect.assertions(1);

            expect(inspect(new Date(1_475_318_637_123), { maxStringLength: 24 })).toBe("2016-10-01T10:43:57.123Z");
        });

        it("maxStringLengths strings longer than maxStringLength (23)", () => {
            expect.assertions(1);

            expect(inspect(new Date(1_475_318_637_123), { maxStringLength: 23 })).toBe("2016-10-01T10:43:57.12…");
        });

        it("maxStringLengths strings longer than maxStringLength (22)", () => {
            expect.assertions(1);

            expect(inspect(new Date(1_475_318_637_123), { maxStringLength: 22 })).toBe("2016-10-01T10:43:57.1…");
        });

        it("maxStringLengths strings longer than maxStringLength (21)", () => {
            expect.assertions(1);

            expect(inspect(new Date(1_475_318_637_123), { maxStringLength: 21 })).toBe("2016-10-01T10:43:57.…");
        });

        it("maxStringLengths strings longer than maxStringLength (20)", () => {
            expect.assertions(1);

            expect(inspect(new Date(1_475_318_637_123), { maxStringLength: 20 })).toBe("2016-10-01T10:43:57…");
        });

        it("maxStringLengths strings longer than maxStringLength (19)", () => {
            expect.assertions(1);

            expect(inspect(new Date(1_475_318_637_123), { maxStringLength: 19 })).toBe("2016-10-01T10:43:5…");
        });

        it("maxStringLengths strings longer than maxStringLength (18)", () => {
            expect.assertions(1);

            expect(inspect(new Date(1_475_318_637_123), { maxStringLength: 18 })).toBe("2016-10-01T10:43:…");
        });

        it("maxStringLengths strings longer than maxStringLength (17)", () => {
            expect.assertions(1);

            expect(inspect(new Date(1_475_318_637_123), { maxStringLength: 17 })).toBe("2016-10-01T10:43…");
        });

        it("maxStringLengths strings longer than maxStringLength (16)", () => {
            expect.assertions(1);

            expect(inspect(new Date(1_475_318_637_123), { maxStringLength: 16 })).toBe("2016-10-01T10:4…");
        });

        it("maxStringLengths strings longer than maxStringLength (15)", () => {
            expect.assertions(1);

            expect(inspect(new Date(1_475_318_637_123), { maxStringLength: 15 })).toBe("2016-10-01T10:…");
        });

        it("maxStringLengths strings longer than maxStringLength (14)", () => {
            expect.assertions(1);

            expect(inspect(new Date(1_475_318_637_123), { maxStringLength: 14 })).toBe("2016-10-01T10…");
        });

        it("maxStringLengths strings longer than maxStringLength (13)", () => {
            expect.assertions(1);

            expect(inspect(new Date(1_475_318_637_123), { maxStringLength: 13 })).toBe("2016-10-01T1…");
        });

        it("maxStringLengths strings longer than maxStringLength (12)", () => {
            expect.assertions(1);

            expect(inspect(new Date(1_475_318_637_123), { maxStringLength: 12 })).toBe("2016-10-01T…");
        });

        it("does not maxStringLength past the date value with low maxStringLength values (11)", () => {
            expect.assertions(1);

            expect(inspect(new Date(1_475_318_637_123), { maxStringLength: 11 })).toBe("2016-10-01T…");
        });

        it("does not maxStringLength past the date value with low maxStringLength values (10)", () => {
            expect.assertions(1);

            expect(inspect(new Date(1_475_318_637_123), { maxStringLength: 10 })).toBe("2016-10-01T…");
        });

        it("does not maxStringLength past the date value with low maxStringLength values (9)", () => {
            expect.assertions(1);

            expect(inspect(new Date(1_475_318_637_123), { maxStringLength: 9 })).toBe("2016-10-01T…");
        });

        it("does not maxStringLength past the date value with low maxStringLength values (8)", () => {
            expect.assertions(1);

            expect(inspect(new Date(1_475_318_637_123), { maxStringLength: 8 })).toBe("2016-10-01T…");
        });

        it("does not maxStringLength past the date value with low maxStringLength values (7)", () => {
            expect.assertions(1);

            expect(inspect(new Date(1_475_318_637_123), { maxStringLength: 7 })).toBe("2016-10-01T…");
        });

        it("does not maxStringLength past the date value with low maxStringLength values (6)", () => {
            expect.assertions(1);

            expect(inspect(new Date(1_475_318_637_123), { maxStringLength: 6 })).toBe("2016-10-01T…");
        });

        it("does not maxStringLength past the date value with low maxStringLength values (5)", () => {
            expect.assertions(1);

            expect(inspect(new Date(1_475_318_637_123), { maxStringLength: 5 })).toBe("2016-10-01T…");
        });

        it("does not maxStringLength past the date value with low maxStringLength values (4)", () => {
            expect.assertions(1);

            expect(inspect(new Date(1_475_318_637_123), { maxStringLength: 4 })).toBe("2016-10-01T…");
        });

        it("does not maxStringLength past the date value with low maxStringLength values (3)", () => {
            expect.assertions(1);

            expect(inspect(new Date(1_475_318_637_123), { maxStringLength: 3 })).toBe("2016-10-01T…");
        });

        it("does not maxStringLength past the date value with low maxStringLength values (2)", () => {
            expect.assertions(1);

            expect(inspect(new Date(1_475_318_637_123), { maxStringLength: 2 })).toBe("2016-10-01T…");
        });

        it("does not maxStringLength past the date value with low maxStringLength values (1)", () => {
            expect.assertions(1);

            expect(inspect(new Date(1_475_318_637_123), { maxStringLength: 1 })).toBe("2016-10-01T…");
        });

        it("does not maxStringLength past the date value with low maxStringLength values (0)", () => {
            expect.assertions(1);

            expect(inspect(new Date(1_475_318_637_123), { maxStringLength: 0 })).toBe("2016-10-01T…");
        });

        it("should truncate the time portion of the date string", () => {
            expect.assertions(1);

            const date = new Date("2024-01-01T12:34:56.789Z");

            expect(inspect(date, { maxStringLength: 20 })).toBe("2024-01-01T12:34:56…");
        });

        it("should not truncate the time portion if it fits within maxStringLength", () => {
            expect.assertions(1);

            const date = new Date("2024-01-01T12:34:56.789Z");

            expect(inspect(date, { maxStringLength: 80 })).toBe("2024-01-01T12:34:56.789Z");
        });

        it("should return just the date part if maxStringLength is too small for time", () => {
            expect.assertions(1);

            const date = new Date("2024-01-01T12:34:56.789Z");

            expect(inspect(date, { maxStringLength: 12 })).toBe("2024-01-01T…");
        });
    });
});
