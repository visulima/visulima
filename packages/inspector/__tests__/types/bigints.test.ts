import { describe, expect, it } from "vitest";

import { inspect } from "../../src";

describe("inspect with BigInts", () => {
    it("should return the BigInt as a string with 'n' suffix", () => {
        expect.assertions(2);

        expect(inspect(1n)).toBe("1n");
        expect(inspect(0n)).toBe("0n");
    });

    it("should use scientific notation for large numbers when possible", () => {
        expect.assertions(1);

        expect(inspect(1e300)).toBe("1e+300");
    });

    describe("with maxStringLength option", () => {
        it("should return the full representation when maxStringLength is greater than the actual length", () => {
            expect.assertions(2);

            expect(inspect(3_141_592_654n, { maxStringLength: 11, numericSeparator: false })).toBe("3141592654n");
            expect(inspect(3_141_592_654n, { maxStringLength: 11 })).toBe("3_141_592_654n");
        });

        it("should truncate the string representation when maxStringLength is 10", () => {
            expect.assertions(2);

            expect(inspect(3_141_592_654n, { maxStringLength: 10, numericSeparator: false })).toBe("31415926…n");
            expect(inspect(3_141_592_654n, { maxStringLength: 10 })).toBe("31_415_926…n");
        });

        it("should truncate the string representation when maxStringLength is 9", () => {
            expect.assertions(2);

            expect(inspect(3_141_592_654n, { maxStringLength: 9, numericSeparator: false })).toBe("3141592…n");
            expect(inspect(3_141_592_654n, { maxStringLength: 9 })).toBe("3_141_592…n");
        });

        it("should truncate the string representation when maxStringLength is 8", () => {
            expect.assertions(2);

            expect(inspect(3_141_592_654n, { maxStringLength: 8, numericSeparator: false })).toBe("314159…n");
            expect(inspect(3_141_592_654n, { maxStringLength: 8 })).toBe("314_159…n");
        });

        it("should truncate the string representation when maxStringLength is 7", () => {
            expect.assertions(2);

            expect(inspect(3_141_592_654n, { maxStringLength: 7, numericSeparator: false })).toBe("31415…n");
            expect(inspect(3_141_592_654n, { maxStringLength: 7 })).toBe("31_415…n");
        });

        it("should truncate the string representation when maxStringLength is 6", () => {
            expect.assertions(2);

            expect(inspect(3_141_592_654n, { maxStringLength: 6, numericSeparator: false })).toBe("3141…n");
            expect(inspect(3_141_592_654n, { maxStringLength: 6 })).toBe("3_141…n");
        });

        it("should truncate the string representation when maxStringLength is 5", () => {
            expect.assertions(1);

            expect(inspect(3_141_592_654n, { maxStringLength: 5 })).toBe("314…n");
        });

        it("should truncate the string representation when maxStringLength is 4", () => {
            expect.assertions(1);

            expect(inspect(3_141_592_654n, { maxStringLength: 4 })).toBe("31…n");
        });

        it("should truncate the string representation when maxStringLength is 3", () => {
            expect.assertions(1);

            expect(inspect(3_141_592_654n, { maxStringLength: 3 })).toBe("3…n");
        });

        it("should truncate the string representation when maxStringLength is 2", () => {
            expect.assertions(1);

            expect(inspect(3_141_592_654n, { maxStringLength: 2 })).toBe("…");
        });

        it("should truncate the string representation when maxStringLength is 1", () => {
            expect.assertions(1);

            expect(inspect(3_141_592_654n, { maxStringLength: 1 })).toBe("…");
        });

        it("should show '…' when maxStringLength is 0 and the number is large", () => {
            expect.assertions(1);

            expect(inspect(3_141_592_654n, { maxStringLength: 0 })).toBe("…");
        });

        it("should not truncate if the truncation tail is the same length as the value", () => {
            expect.assertions(1);

            expect(inspect(3n, { maxStringLength: 0 })).toBe("3n");
        });
    });
});
