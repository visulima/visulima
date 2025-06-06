import { describe, expect, it } from "vitest";

import { inspect } from "../../src";

describe("inspect with Dates", () => {
    it("should format a valid Date object as an ISO string", () => {
        expect.assertions(1);

        expect(inspect(new Date(1_475_318_637_123))).toBe("2016-10-01T10:43:57.123Z");
    });

    it("should return 'Invalid Date' for an invalid Date object", () => {
        expect.assertions(1);

        // See: https://github.com/chaijs/loupe/issues/58
        expect(inspect(new Date("not a date"))).toBe("Invalid Date");
    });

    it("should return 'Invalid Date' for a date object whose toJSON() returns null", () => {
        expect.assertions(1);

        const date = new Date("invalid");

        expect(inspect(date)).toBe("Invalid Date");
    });

    describe("with maxStringLength option", () => {
        it("should return the full representation when maxStringLength is greater than the actual length", () => {
            expect.assertions(1);

            expect(inspect(new Date(1_475_318_637_123), { maxStringLength: 24 })).toBe("2016-10-01T10:43:57.123Z");
        });

        it("should truncate the date string when maxStringLength is 23", () => {
            expect.assertions(1);

            expect(inspect(new Date(1_475_318_637_123), { maxStringLength: 23 })).toBe("2016-10-01T10:43:57.12…");
        });

        it("should truncate the date string when maxStringLength is 22", () => {
            expect.assertions(1);

            expect(inspect(new Date(1_475_318_637_123), { maxStringLength: 22 })).toBe("2016-10-01T10:43:57.1…");
        });

        it("should truncate the date string when maxStringLength is 21", () => {
            expect.assertions(1);

            expect(inspect(new Date(1_475_318_637_123), { maxStringLength: 21 })).toBe("2016-10-01T10:43:57.…");
        });

        it("should truncate the date string when maxStringLength is 20", () => {
            expect.assertions(1);

            expect(inspect(new Date(1_475_318_637_123), { maxStringLength: 20 })).toBe("2016-10-01T10:43:57…");
        });

        it("should truncate the date string when maxStringLength is 19", () => {
            expect.assertions(1);

            expect(inspect(new Date(1_475_318_637_123), { maxStringLength: 19 })).toBe("2016-10-01T10:43:5…");
        });

        it("should truncate the date string when maxStringLength is 18", () => {
            expect.assertions(1);

            expect(inspect(new Date(1_475_318_637_123), { maxStringLength: 18 })).toBe("2016-10-01T10:43:…");
        });

        it("should truncate the date string when maxStringLength is 17", () => {
            expect.assertions(1);

            expect(inspect(new Date(1_475_318_637_123), { maxStringLength: 17 })).toBe("2016-10-01T10:43…");
        });

        it("should truncate the date string when maxStringLength is 16", () => {
            expect.assertions(1);

            expect(inspect(new Date(1_475_318_637_123), { maxStringLength: 16 })).toBe("2016-10-01T10:4…");
        });

        it("should truncate the date string when maxStringLength is 15", () => {
            expect.assertions(1);

            expect(inspect(new Date(1_475_318_637_123), { maxStringLength: 15 })).toBe("2016-10-01T10:…");
        });

        it("should truncate the date string when maxStringLength is 14", () => {
            expect.assertions(1);

            expect(inspect(new Date(1_475_318_637_123), { maxStringLength: 14 })).toBe("2016-10-01T10…");
        });

        it("should truncate the date string when maxStringLength is 13", () => {
            expect.assertions(1);

            expect(inspect(new Date(1_475_318_637_123), { maxStringLength: 13 })).toBe("2016-10-01T1…");
        });

        it("should truncate the date string when maxStringLength is 12", () => {
            expect.assertions(1);

            expect(inspect(new Date(1_475_318_637_123), { maxStringLength: 12 })).toBe("2016-10-01T…");
        });

        it("should not truncate the date part of the string, even with a small maxStringLength", () => {
            expect.assertions(12);

            expect(inspect(new Date(1_475_318_637_123), { maxStringLength: 11 })).toBe("2016-10-01T…");
            expect(inspect(new Date(1_475_318_637_123), { maxStringLength: 10 })).toBe("2016-10-01T…");
            expect(inspect(new Date(1_475_318_637_123), { maxStringLength: 9 })).toBe("2016-10-01T…");
            expect(inspect(new Date(1_475_318_637_123), { maxStringLength: 8 })).toBe("2016-10-01T…");
            expect(inspect(new Date(1_475_318_637_123), { maxStringLength: 7 })).toBe("2016-10-01T…");
            expect(inspect(new Date(1_475_318_637_123), { maxStringLength: 6 })).toBe("2016-10-01T…");
            expect(inspect(new Date(1_475_318_637_123), { maxStringLength: 5 })).toBe("2016-10-01T…");
            expect(inspect(new Date(1_475_318_637_123), { maxStringLength: 4 })).toBe("2016-10-01T…");
            expect(inspect(new Date(1_475_318_637_123), { maxStringLength: 3 })).toBe("2016-10-01T…");
            expect(inspect(new Date(1_475_318_637_123), { maxStringLength: 2 })).toBe("2016-10-01T…");
            expect(inspect(new Date(1_475_318_637_123), { maxStringLength: 1 })).toBe("2016-10-01T…");
            expect(inspect(new Date(1_475_318_637_123), { maxStringLength: 0 })).toBe("2016-10-01T…");
        });

        it("should truncate only the time portion when maxStringLength allows for the full date", () => {
            expect.assertions(1);

            const date = new Date("2024-01-01T12:34:56.789Z");

            expect(inspect(date, { maxStringLength: 20 })).toBe("2024-01-01T12:34:56…");
        });

        it("should not truncate the date string if it fits within maxStringLength", () => {
            expect.assertions(1);

            const date = new Date("2024-01-01T12:34:56.789Z");

            expect(inspect(date, { maxStringLength: 80 })).toBe("2024-01-01T12:34:56.789Z");
        });

        it("should return only the date part with a truncation symbol if maxStringLength is too short for the time", () => {
            expect.assertions(1);

            const date = new Date("2024-01-01T12:34:56.789Z");

            expect(inspect(date, { maxStringLength: 12 })).toBe("2024-01-01T…");
        });
    });
});
