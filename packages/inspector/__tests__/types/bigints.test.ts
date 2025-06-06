import { describe, expect, it } from "vitest";

import { inspect } from "../../src";

describe("bigints", () => {
    it("returns number as passed in", () => {
        expect.assertions(2);

        expect(inspect(1n)).toBe("1n");
        expect(inspect(0n)).toBe("0n");
    });

    it("uses scientific notation where possible", () => {
        expect.assertions(1);

        expect(inspect(1e300)).toBe("1e+300");
    });

    describe("maxStringLength", () => {
        it("returns the full representation when maxStringLength is over string length", () => {
            expect.assertions(2);

            expect(inspect(3_141_592_654n, { maxStringLength: 11, numericSeparator: false })).toBe("3141592654n");
            expect(inspect(3_141_592_654n, { maxStringLength: 11 })).toBe("3_141_592_654n");
        });

        it("maxStringLengths numbers longer than maxStringLength (10)", () => {
            expect.assertions(2);

            expect(inspect(3_141_592_654n, { maxStringLength: 10, numericSeparator: false })).toBe("31415926…n");
            expect(inspect(3_141_592_654n, { maxStringLength: 10 })).toBe("31_415_926…n");
        });

        it("maxStringLengths numbers longer than maxStringLength (9)", () => {
            expect.assertions(2);

            expect(inspect(3_141_592_654n, { maxStringLength: 9, numericSeparator: false })).toBe("3141592…n");
            expect(inspect(3_141_592_654n, { maxStringLength: 9 })).toBe("3_141_592…n");
        });

        it("maxStringLengths numbers longer than maxStringLength (8)", () => {
            expect.assertions(2);

            expect(inspect(3_141_592_654n, { maxStringLength: 8, numericSeparator: false })).toBe("314159…n");
            expect(inspect(3_141_592_654n, { maxStringLength: 8 })).toBe("314_159…n");
        });

        it("maxStringLengths numbers longer than maxStringLength (7)", () => {
            expect.assertions(2);

            expect(inspect(3_141_592_654n, { maxStringLength: 7, numericSeparator: false })).toBe("31415…n");
            expect(inspect(3_141_592_654n, { maxStringLength: 7 })).toBe("31_415…n");
        });

        it("maxStringLengths numbers longer than maxStringLength (6)", () => {
            expect.assertions(2);

            expect(inspect(3_141_592_654n, { maxStringLength: 6, numericSeparator: false })).toBe("3141…n");
            expect(inspect(3_141_592_654n, { maxStringLength: 6 })).toBe("3_141…n");
        });

        it("maxStringLengths numbers longer than maxStringLength (5)", () => {
            expect.assertions(1);

            expect(inspect(3_141_592_654n, { maxStringLength: 5 })).toBe("314…n");
        });

        it("maxStringLengths numbers longer than maxStringLength (4)", () => {
            expect.assertions(1);

            expect(inspect(3_141_592_654n, { maxStringLength: 4 })).toBe("31…n");
        });

        it("maxStringLengths numbers longer than maxStringLength (3)", () => {
            expect.assertions(1);

            expect(inspect(3_141_592_654n, { maxStringLength: 3 })).toBe("3…n");
        });

        it("maxStringLengths numbers longer than maxStringLength (2)", () => {
            expect.assertions(1);

            expect(inspect(3_141_592_654n, { maxStringLength: 2 })).toBe("…");
        });

        it("maxStringLengths numbers longer than maxStringLength (1)", () => {
            expect.assertions(1);

            expect(inspect(3_141_592_654n, { maxStringLength: 1 })).toBe("…");
        });

        it("disregards maxStringLength when it cannot maxStringLength further (0)", () => {
            expect.assertions(1);

            expect(inspect(3_141_592_654n, { maxStringLength: 0 })).toBe("…");
        });

        it("does not maxStringLength if tail is same length as value", () => {
            expect.assertions(1);

            expect(inspect(3n, { maxStringLength: 0 })).toBe("3n");
        });
    });
});
