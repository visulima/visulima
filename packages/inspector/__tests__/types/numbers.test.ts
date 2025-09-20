import { describe, expect, it } from "vitest";

import { inspect } from "../../src";

describe("inspect with Numbers", () => {
    it("should return a standard number as a string", () => {
        expect.assertions(1);

        expect(inspect(3.141)).toBe("3.141");
    });

    it("should represent 0 as '+0'", () => {
        expect.assertions(1);

        expect(inspect(0)).toBe("+0");
    });

    it("should represent -0 as '-0'", () => {
        expect.assertions(1);

        expect(inspect(-0)).toBe("-0");
    });

    it("should use scientific notation for very large numbers", () => {
        expect.assertions(1);

        expect(inspect(1e300)).toBe("1e+300");
    });

    describe("with maxStringLength option", () => {
        it("should return the full representation when maxStringLength is greater than the actual length", () => {
            expect.assertions(2);

            expect(inspect(3.141_592_654, { maxStringLength: 11, numericSeparator: false })).toBe("3.141592654");
            expect(inspect(3.141_592_654, { maxStringLength: 11 })).toBe("3.141_592_…");
        });

        it("should truncate the number string when maxStringLength is 10", () => {
            expect.assertions(2);

            expect(inspect(3.141_592_654, { maxStringLength: 10, numericSeparator: false })).toBe("3.1415926…");
            expect(inspect(3.141_592_654, { maxStringLength: 10 })).toBe("3.141_592…");
        });

        it("should truncate the number string when maxStringLength is 9", () => {
            expect.assertions(2);

            expect(inspect(3.141_592_654, { maxStringLength: 9, numericSeparator: false })).toBe("3.141592…");
            expect(inspect(3.141_592_654, { maxStringLength: 9 })).toBe("3.141_59…");
        });

        it("should truncate the number string when maxStringLength is 8", () => {
            expect.assertions(2);

            expect(inspect(3.141_592_654, { maxStringLength: 8, numericSeparator: false })).toBe("3.14159…");
            expect(inspect(3.141_592_654, { maxStringLength: 8 })).toBe("3.141_5…");
        });

        it("should truncate the number string when maxStringLength is 7", () => {
            expect.assertions(2);

            expect(inspect(3.141_592_654, { maxStringLength: 7, numericSeparator: false })).toBe("3.1415…");
            expect(inspect(3.141_592_654, { maxStringLength: 7 })).toBe("3.141_…");
        });

        it("should truncate the number string when maxStringLength is 6", () => {
            expect.assertions(1);

            expect(inspect(3.141_592_654, { maxStringLength: 6 })).toBe("3.141…");
        });

        it("should truncate the number string when maxStringLength is 5", () => {
            expect.assertions(1);

            expect(inspect(3.141_592_654, { maxStringLength: 5 })).toBe("3.14…");
        });

        it("should truncate the number string when maxStringLength is 4", () => {
            expect.assertions(1);

            expect(inspect(3.141_592_654, { maxStringLength: 4 })).toBe("3.1…");
        });

        it("should truncate the number string when maxStringLength is 3", () => {
            expect.assertions(1);

            expect(inspect(3.141_592_654, { maxStringLength: 3 })).toBe("3.…");
        });

        it("should truncate the number string when maxStringLength is 2", () => {
            expect.assertions(1);

            expect(inspect(3.141_592_654, { maxStringLength: 2 })).toBe("3…");
        });

        it("should show only '…' when maxStringLength is 1", () => {
            expect.assertions(1);

            expect(inspect(3.141_592_654, { maxStringLength: 1 })).toBe("…");
        });

        it("should not truncate if the truncation tail is the same length as the value", () => {
            expect.assertions(1);

            expect(inspect(3, { maxStringLength: 0 })).toBe("");
        });
    });

    describe("inspect with NaN", () => {
        it("should return the string 'NaN'", () => {
            expect.assertions(1);

            expect(inspect(Number.NaN)).toBe("NaN");
        });

        describe("with maxStringLength option", () => {
            it("should not truncate 'NaN' regardless of maxStringLength", () => {
                expect.assertions(9);

                expect(inspect(Number.NaN, { maxStringLength: 9 })).toBe("NaN");
                expect(inspect(Number.NaN, { maxStringLength: 8 })).toBe("NaN");
                expect(inspect(Number.NaN, { maxStringLength: 7 })).toBe("NaN");
                expect(inspect(Number.NaN, { maxStringLength: 6 })).toBe("NaN");
                expect(inspect(Number.NaN, { maxStringLength: 5 })).toBe("NaN");
                expect(inspect(Number.NaN, { maxStringLength: 4 })).toBe("NaN");
                expect(inspect(Number.NaN, { maxStringLength: 3 })).toBe("NaN");
                expect(inspect(Number.NaN, { maxStringLength: 2 })).toBe("NaN");
                expect(inspect(Number.NaN, { maxStringLength: 1 })).toBe("NaN");
            });
        });
    });

    describe("inspect with Infinity", () => {
        it("should return the string 'Infinity'", () => {
            expect.assertions(1);

            expect(inspect(Number.POSITIVE_INFINITY)).toBe("Infinity");
        });

        describe("with maxStringLength option", () => {
            it("should not truncate 'Infinity' regardless of maxStringLength", () => {
                expect.assertions(9);

                expect(inspect(Number.POSITIVE_INFINITY, { maxStringLength: 9 })).toBe("Infinity");
                expect(inspect(Number.POSITIVE_INFINITY, { maxStringLength: 8 })).toBe("Infinity");
                expect(inspect(Number.POSITIVE_INFINITY, { maxStringLength: 7 })).toBe("Infinity");
                expect(inspect(Number.POSITIVE_INFINITY, { maxStringLength: 6 })).toBe("Infinity");
                expect(inspect(Number.POSITIVE_INFINITY, { maxStringLength: 5 })).toBe("Infinity");
                expect(inspect(Number.POSITIVE_INFINITY, { maxStringLength: 4 })).toBe("Infinity");
                expect(inspect(Number.POSITIVE_INFINITY, { maxStringLength: 3 })).toBe("Infinity");
                expect(inspect(Number.POSITIVE_INFINITY, { maxStringLength: 2 })).toBe("Infinity");
                expect(inspect(Number.POSITIVE_INFINITY, { maxStringLength: 1 })).toBe("Infinity");
            });
        });
    });

    describe("inspect with -Infinity", () => {
        it("should return the string '-Infinity'", () => {
            expect.assertions(1);

            expect(inspect(Number.NEGATIVE_INFINITY)).toBe("-Infinity");
        });

        describe("with maxStringLength option", () => {
            it("should not truncate '-Infinity' regardless of maxStringLength", () => {
                expect.assertions(9);

                expect(inspect(Number.NEGATIVE_INFINITY, { maxStringLength: 9 })).toBe("-Infinity");
                expect(inspect(Number.NEGATIVE_INFINITY, { maxStringLength: 8 })).toBe("-Infinity");
                expect(inspect(Number.NEGATIVE_INFINITY, { maxStringLength: 7 })).toBe("-Infinity");
                expect(inspect(Number.NEGATIVE_INFINITY, { maxStringLength: 6 })).toBe("-Infinity");
                expect(inspect(Number.NEGATIVE_INFINITY, { maxStringLength: 5 })).toBe("-Infinity");
                expect(inspect(Number.NEGATIVE_INFINITY, { maxStringLength: 4 })).toBe("-Infinity");
                expect(inspect(Number.NEGATIVE_INFINITY, { maxStringLength: 3 })).toBe("-Infinity");
                expect(inspect(Number.NEGATIVE_INFINITY, { maxStringLength: 2 })).toBe("-Infinity");
                expect(inspect(Number.NEGATIVE_INFINITY, { maxStringLength: 1 })).toBe("-Infinity");
            });
        });
    });
});
