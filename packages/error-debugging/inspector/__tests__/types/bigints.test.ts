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

    describe("truncate", () => {
        it("returns the full representation when truncate is over string length", () => {
            expect.assertions(2);

            expect(inspect(3_141_592_654n, { numericSeparator: false, truncate: 11 })).toBe("3141592654n");
            expect(inspect(3_141_592_654n, { truncate: 11 })).toBe("3_141_592_654n");
        });

        it("truncates numbers longer than truncate (10)", () => {
            expect.assertions(2);

            expect(inspect(3_141_592_654n, { numericSeparator: false, truncate: 10 })).toBe("31415926…n");
            expect(inspect(3_141_592_654n, { truncate: 10 })).toBe("31_415_926…n");
        });

        it("truncates numbers longer than truncate (9)", () => {
            expect.assertions(2);

            expect(inspect(3_141_592_654n, { numericSeparator: false, truncate: 9 })).toBe("3141592…n");
            expect(inspect(3_141_592_654n, { truncate: 9 })).toBe("3_141_592…n");
        });

        it("truncates numbers longer than truncate (8)", () => {
            expect.assertions(2);

            expect(inspect(3_141_592_654n, { numericSeparator: false, truncate: 8 })).toBe("314159…n");
            expect(inspect(3_141_592_654n, { truncate: 8 })).toBe("314_159…n");
        });

        it("truncates numbers longer than truncate (7)", () => {
            expect.assertions(2);

            expect(inspect(3_141_592_654n, { numericSeparator: false, truncate: 7 })).toBe("31415…n");
            expect(inspect(3_141_592_654n, { truncate: 7 })).toBe("31_415…n");
        });

        it("truncates numbers longer than truncate (6)", () => {
            expect.assertions(2);

            expect(inspect(3_141_592_654n, { numericSeparator: false, truncate: 6 })).toBe("3141…n");
            expect(inspect(3_141_592_654n, { truncate: 6 })).toBe("3_141…n");
        });

        it("truncates numbers longer than truncate (5)", () => {
            expect.assertions(1);

            expect(inspect(3_141_592_654n, { truncate: 5 })).toBe("314…n");
        });

        it("truncates numbers longer than truncate (4)", () => {
            expect.assertions(1);

            expect(inspect(3_141_592_654n, { truncate: 4 })).toBe("31…n");
        });

        it("truncates numbers longer than truncate (3)", () => {
            expect.assertions(1);

            expect(inspect(3_141_592_654n, { truncate: 3 })).toBe("3…n");
        });

        it("truncates numbers longer than truncate (2)", () => {
            expect.assertions(1);

            expect(inspect(3_141_592_654n, { truncate: 2 })).toBe("…");
        });

        it("truncates numbers longer than truncate (1)", () => {
            expect.assertions(1);

            expect(inspect(3_141_592_654n, { truncate: 1 })).toBe("…");
        });

        it("disregards truncate when it cannot truncate further (0)", () => {
            expect.assertions(1);

            expect(inspect(3_141_592_654n, { truncate: 0 })).toBe("…");
        });

        it("does not truncate if tail is same length as value", () => {
            expect.assertions(1);

            expect(inspect(3n, { truncate: 0 })).toBe("3n");
        });
    });
});
