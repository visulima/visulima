import { describe, expect, it } from "vitest";

import { inspect } from "../../src";

describe("numbers", () => {
    it("returns number as passed in", () => {
        expect.assertions(1);

        expect(inspect(3.141)).toBe("3.141");
    });

    it("returns 0 as +0", () => {
        expect.assertions(1);

        expect(inspect(0)).toBe("+0");
    });

    it("returns -0 as -0", () => {
        expect.assertions(1);

        expect(inspect(-0)).toBe("-0");
    });

    it("uses scientific notation where possible", () => {
        expect.assertions(1);

        expect(inspect(1e300)).toBe("1e+300");
    });

    describe("maxStringLength", () => {
        it("returns the full representation when maxStringLength is over string length", () => {
            expect.assertions(2);

            expect(inspect(3.141_592_654, { maxStringLength: 11, numericSeparator: false })).toBe("3.141592654");
            expect(inspect(3.141_592_654, { maxStringLength: 11 })).toBe("3.141_592_…");
        });

        it("maxStringLengths numbers longer than maxStringLength (10)", () => {
            expect.assertions(2);

            expect(inspect(3.141_592_654, { maxStringLength: 10, numericSeparator: false })).toBe("3.1415926…");
            expect(inspect(3.141_592_654, { maxStringLength: 10 })).toBe("3.141_592…");
        });

        it("maxStringLengths numbers longer than maxStringLength (9)", () => {
            expect.assertions(2);

            expect(inspect(3.141_592_654, { maxStringLength: 9, numericSeparator: false })).toBe("3.141592…");
            expect(inspect(3.141_592_654, { maxStringLength: 9 })).toBe("3.141_59…");
        });

        it("maxStringLengths numbers longer than maxStringLength (8)", () => {
            expect.assertions(2);

            expect(inspect(3.141_592_654, { maxStringLength: 8, numericSeparator: false })).toBe("3.14159…");
            expect(inspect(3.141_592_654, { maxStringLength: 8 })).toBe("3.141_5…");
        });

        it("maxStringLengths numbers longer than maxStringLength (7)", () => {
            expect.assertions(2);

            expect(inspect(3.141_592_654, { maxStringLength: 7, numericSeparator: false })).toBe("3.1415…");
            expect(inspect(3.141_592_654, { maxStringLength: 7 })).toBe("3.141_…");
        });

        it("maxStringLengths numbers longer than maxStringLength (6)", () => {
            expect.assertions(1);

            expect(inspect(3.141_592_654, { maxStringLength: 6 })).toBe("3.141…");
        });

        it("maxStringLengths numbers longer than maxStringLength (5)", () => {
            expect.assertions(1);

            expect(inspect(3.141_592_654, { maxStringLength: 5 })).toBe("3.14…");
        });

        it("maxStringLengths numbers longer than maxStringLength (4)", () => {
            expect.assertions(1);

            expect(inspect(3.141_592_654, { maxStringLength: 4 })).toBe("3.1…");
        });

        it("maxStringLengths numbers longer than maxStringLength (3)", () => {
            expect.assertions(1);

            expect(inspect(3.141_592_654, { maxStringLength: 3 })).toBe("3.…");
        });

        it("maxStringLengths numbers longer than maxStringLength (2)", () => {
            expect.assertions(1);

            expect(inspect(3.141_592_654, { maxStringLength: 2 })).toBe("3…");
        });

        it("maxStringLengths numbers longer than maxStringLength (1)", () => {
            expect.assertions(1);

            expect(inspect(3.141_592_654, { maxStringLength: 1 })).toBe("…");
        });

        it("disregards maxStringLength when it cannot maxStringLength further (0)", () => {
            expect.assertions(1);

            expect(inspect(3.141_592_654, { maxStringLength: 0 })).toBe("…");
        });

        it("does not maxStringLength if tail is same length as value", () => {
            expect.assertions(1);

            expect(inspect(3, { maxStringLength: 0 })).toBe("3");
        });
    });

    describe("naN", () => {
        it("returns `NaN`", () => {
            expect.assertions(1);

            expect(inspect(Number.NaN)).toBe("NaN");
        });

        describe("maxStringLength", () => {
            it("returns the full string representation regardless of maxStringLength", () => {
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

    describe("infinity", () => {
        it("returns `Infinity`", () => {
            expect.assertions(1);

            expect(inspect(Number.POSITIVE_INFINITY)).toBe("Infinity");
        });

        describe("maxStringLength", () => {
            it("returns the full string representation regardless of maxStringLength", () => {
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

    describe("-Infinity", () => {
        it("returns `-Infinity`", () => {
            expect.assertions(1);

            expect(inspect(Number.NEGATIVE_INFINITY)).toBe("-Infinity");
        });

        describe("maxStringLength", () => {
            it("returns the full string representation regardless of maxStringLength", () => {
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
