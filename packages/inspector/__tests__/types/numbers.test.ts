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

    describe("colors", () => {
        it("returns string with yellow color, if colour is set to true", () => {
            expect.assertions(1);

            expect(inspect(3.141, { colors: true })).toBe("\u001B[33m3.141\u001B[39m");
        });
    });

    describe("truncate", () => {
        it("returns the full representation when truncate is over string length", () => {
            expect.assertions(1);

            expect(inspect(3.141_592_654, { truncate: 11 })).toBe("3.141592654");
        });

        it("truncates numbers longer than truncate (10)", () => {
            expect.assertions(1);

            expect(inspect(3.141_592_654, { truncate: 10 })).toBe("3.1415926…");
        });

        it("truncates numbers longer than truncate (9)", () => {
            expect.assertions(1);

            expect(inspect(3.141_592_654, { truncate: 9 })).toBe("3.141592…");
        });
        it("truncates numbers longer than truncate (8)", () => {
            expect.assertions(1);

            expect(inspect(3.141_592_654, { truncate: 8 })).toBe("3.14159…");
        });

        it("truncates numbers longer than truncate (7)", () => {
            expect.assertions(1);

            expect(inspect(3.141_592_654, { truncate: 7 })).toBe("3.1415…");
        });

        it("truncates numbers longer than truncate (6)", () => {
            expect.assertions(1);

            expect(inspect(3.141_592_654, { truncate: 6 })).toBe("3.141…");
        });

        it("truncates numbers longer than truncate (5)", () => {
            expect.assertions(1);

            expect(inspect(3.141_592_654, { truncate: 5 })).toBe("3.14…");
        });

        it("truncates numbers longer than truncate (4)", () => {
            expect.assertions(1);

            expect(inspect(3.141_592_654, { truncate: 4 })).toBe("3.1…");
        });

        it("truncates numbers longer than truncate (3)", () => {
            expect.assertions(1);

            expect(inspect(3.141_592_654, { truncate: 3 })).toBe("3.…");
        });

        it("truncates numbers longer than truncate (2)", () => {
            expect.assertions(1);

            expect(inspect(3.141_592_654, { truncate: 2 })).toBe("3…");
        });

        it("truncates numbers longer than truncate (1)", () => {
            expect.assertions(1);

            expect(inspect(3.141_592_654, { truncate: 1 })).toBe("…");
        });

        it("disregards truncate when it cannot truncate further (0)", () => {
            expect.assertions(1);

            expect(inspect(3.141_592_654, { truncate: 0 })).toBe("…");
        });

        it("does not truncate if tail is same length as value", () => {
            expect.assertions(1);

            expect(inspect(3, { truncate: 0 })).toBe("3");
        });
    });

    describe("naN", () => {
        it("returns `NaN`", () => {
            expect.assertions(1);

            expect(inspect(Number.NaN)).toBe("NaN");
        });

        describe("colors", () => {
            it("returns string with yellow color, if colour is set to true", () => {
                expect.assertions(1);

                expect(inspect(Number.NaN, { colors: true })).toBe("\u001B[33mNaN\u001B[39m");
            });
        });

        describe("truncate", () => {
            it("returns the full string representation regardless of truncate", () => {
                expect.assertions(9);

                expect(inspect(Number.NaN, { truncate: 9 })).toBe("NaN");
                expect(inspect(Number.NaN, { truncate: 8 })).toBe("NaN");
                expect(inspect(Number.NaN, { truncate: 7 })).toBe("NaN");
                expect(inspect(Number.NaN, { truncate: 6 })).toBe("NaN");
                expect(inspect(Number.NaN, { truncate: 5 })).toBe("NaN");
                expect(inspect(Number.NaN, { truncate: 4 })).toBe("NaN");
                expect(inspect(Number.NaN, { truncate: 3 })).toBe("NaN");
                expect(inspect(Number.NaN, { truncate: 2 })).toBe("NaN");
                expect(inspect(Number.NaN, { truncate: 1 })).toBe("NaN");
            });
        });
    });

    describe("infinity", () => {
        it("returns `Infinity`", () => {
            expect.assertions(1);

            expect(inspect(Number.POSITIVE_INFINITY)).toBe("Infinity");
        });

        describe("colors", () => {
            it("returns string with yellow color, if colour is set to true", () => {
                expect.assertions(1);

                expect(inspect(Number.POSITIVE_INFINITY, { colors: true })).toBe("\u001B[33mInfinity\u001B[39m");
            });
        });

        describe("truncate", () => {
            it("returns the full string representation regardless of truncate", () => {
                expect.assertions(9);

                expect(inspect(Number.POSITIVE_INFINITY, { truncate: 9 })).toBe("Infinity");
                expect(inspect(Number.POSITIVE_INFINITY, { truncate: 8 })).toBe("Infinity");
                expect(inspect(Number.POSITIVE_INFINITY, { truncate: 7 })).toBe("Infinity");
                expect(inspect(Number.POSITIVE_INFINITY, { truncate: 6 })).toBe("Infinity");
                expect(inspect(Number.POSITIVE_INFINITY, { truncate: 5 })).toBe("Infinity");
                expect(inspect(Number.POSITIVE_INFINITY, { truncate: 4 })).toBe("Infinity");
                expect(inspect(Number.POSITIVE_INFINITY, { truncate: 3 })).toBe("Infinity");
                expect(inspect(Number.POSITIVE_INFINITY, { truncate: 2 })).toBe("Infinity");
                expect(inspect(Number.POSITIVE_INFINITY, { truncate: 1 })).toBe("Infinity");
            });
        });
    });

    describe("-Infinity", () => {
        it("returns `-Infinity`", () => {
            expect.assertions(1);

            expect(inspect(Number.NEGATIVE_INFINITY)).toBe("-Infinity");
        });

        describe("colors", () => {
            it("returns string with yellow color, if colour is set to true", () => {
                expect.assertions(1);

                expect(inspect(Number.NEGATIVE_INFINITY, { colors: true })).toBe("\u001B[33m-Infinity\u001B[39m");
            });
        });

        describe("truncate", () => {
            it("returns the full string representation regardless of truncate", () => {
                expect.assertions(9);

                expect(inspect(Number.NEGATIVE_INFINITY, { truncate: 9 })).toBe("-Infinity");
                expect(inspect(Number.NEGATIVE_INFINITY, { truncate: 8 })).toBe("-Infinity");
                expect(inspect(Number.NEGATIVE_INFINITY, { truncate: 7 })).toBe("-Infinity");
                expect(inspect(Number.NEGATIVE_INFINITY, { truncate: 6 })).toBe("-Infinity");
                expect(inspect(Number.NEGATIVE_INFINITY, { truncate: 5 })).toBe("-Infinity");
                expect(inspect(Number.NEGATIVE_INFINITY, { truncate: 4 })).toBe("-Infinity");
                expect(inspect(Number.NEGATIVE_INFINITY, { truncate: 3 })).toBe("-Infinity");
                expect(inspect(Number.NEGATIVE_INFINITY, { truncate: 2 })).toBe("-Infinity");
                expect(inspect(Number.NEGATIVE_INFINITY, { truncate: 1 })).toBe("-Infinity");
            });
        });
    });
});
