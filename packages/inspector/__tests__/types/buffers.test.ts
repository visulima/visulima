import { describe, expect, it } from "vitest";

import { inspect } from "../../src";

const isNotBuffer = typeof Buffer !== "function";

describe("buffers", () => {
    it.skipIf(isNotBuffer)("returns `Buffer[]` for empty arrays", () => {
        expect.assertions(1);

        expect(inspect(Buffer.from(""))).toBe("Buffer[]");
    });

    it.skipIf(isNotBuffer)("returns a populated buffer", () => {
        expect.assertions(1);

        expect(inspect(Buffer.from([2, 3, 4]))).toBe("Buffer[ 2, 3, 4 ]");
    });

    describe("maxStringLength", () => {
        it.skipIf(isNotBuffer)("returns the full representation when maxStringLength is over string length", () => {
            expect.assertions(1);

            expect(inspect(Buffer.from([1, 2, 3]), { maxStringLength: 21 })).toBe("Buffer[ 1, 2, 3 ]");
        });

        it.skipIf(isNotBuffer)("maxStringLengths array values longer than maxStringLength (20)", () => {
            expect.assertions(1);

            expect(inspect(Buffer.from([1, 2, 3]), { maxStringLength: 20 })).toBe("Buffer[ 1, 2, 3 ]");
        });

        it.skipIf(isNotBuffer)("maxStringLengths array values longer than maxStringLength (19)", () => {
            expect.assertions(1);

            expect(inspect(Buffer.from([1, 2, 3]), { maxStringLength: 19 })).toBe("Buffer[ 1, …(2) ]");
        });

        it.skipIf(isNotBuffer)("maxStringLengths array values longer than maxStringLength (18)", () => {
            expect.assertions(1);

            expect(inspect(Buffer.from([1, 2, 3]), { maxStringLength: 18 })).toBe("Buffer[ 1, …(2) ]");
        });

        it.skipIf(isNotBuffer)("maxStringLengths array values longer than maxStringLength (17)", () => {
            expect.assertions(1);

            expect(inspect(Buffer.from([1, 2, 3]), { maxStringLength: 17 })).toBe("Buffer[ 1, …(2) ]");
        });

        it.skipIf(isNotBuffer)("maxStringLengths array values longer than maxStringLength (16)", () => {
            expect.assertions(1);

            expect(inspect(Buffer.from([1, 2, 3]), { maxStringLength: 16 })).toBe("Buffer[ …(3) ]");
        });

        it.skipIf(isNotBuffer)("maxStringLengths array values longer than maxStringLength (15)", () => {
            expect.assertions(1);

            expect(inspect(Buffer.from([1, 2, 3]), { maxStringLength: 15 })).toBe("Buffer[ …(3) ]");
        });

        it.skipIf(isNotBuffer)("maxStringLengths array values longer than maxStringLength (14)", () => {
            expect.assertions(1);

            expect(inspect(Buffer.from([1, 2, 3]), { maxStringLength: 14 })).toBe("Buffer[ …(3) ]");
        });

        it.skipIf(isNotBuffer)("maxStringLengths array values longer than maxStringLength (13)", () => {
            expect.assertions(1);

            expect(inspect(Buffer.from([1, 2, 3]), { maxStringLength: 13 })).toBe("Buffer[ …(3) ]");
        });

        it.skipIf(isNotBuffer)("maxStringLengths array values longer than maxStringLength (12)", () => {
            expect.assertions(1);

            expect(inspect(Buffer.from([1, 2, 3]), { maxStringLength: 12 })).toBe("Buffer[ …(3) ]");
        });

        it.skipIf(isNotBuffer)("maxStringLengths array values longer than maxStringLength (11)", () => {
            expect.assertions(1);

            expect(inspect(Buffer.from([1, 2, 3]), { maxStringLength: 11 })).toBe("Buffer[ …(3) ]");
        });

        it.skipIf(isNotBuffer)("maxStringLengths array values longer than maxStringLength (10)", () => {
            expect.assertions(1);

            expect(inspect(Buffer.from([1, 2, 3]), { maxStringLength: 10 })).toBe("Buffer[ …(3) ]");
        });

        it.skipIf(isNotBuffer)("maxStringLengths array values longer than maxStringLength (9)", () => {
            expect.assertions(1);

            expect(inspect(Buffer.from([1, 2, 3]), { maxStringLength: 9 })).toBe("Buffer[ …(3) ]");
        });

        it.skipIf(isNotBuffer)("maxStringLengths array values longer than maxStringLength (8)", () => {
            expect.assertions(1);

            expect(inspect(Buffer.from([1, 2, 3]), { maxStringLength: 8 })).toBe("Buffer[ …(3) ]");
        });

        it.skipIf(isNotBuffer)("maxStringLengths array values longer than maxStringLength (7)", () => {
            expect.assertions(1);

            expect(inspect(Buffer.from([1, 2, 3]), { maxStringLength: 7 })).toBe("Buffer[ …(3) ]");
        });

        it.skipIf(isNotBuffer)("maxStringLengths array values longer than maxStringLength (6)", () => {
            expect.assertions(1);

            expect(inspect(Buffer.from([1, 2, 3]), { maxStringLength: 6 })).toBe("Buffer[ …(3) ]");
        });

        it.skipIf(isNotBuffer)("maxStringLengths array values longer than maxStringLength (5)", () => {
            expect.assertions(1);

            expect(inspect(Buffer.from([1, 2, 3]), { maxStringLength: 5 })).toBe("Buffer[ …(3) ]");
        });

        it.skipIf(isNotBuffer)("maxStringLengths array values longer than maxStringLength (4)", () => {
            expect.assertions(1);

            expect(inspect(Buffer.from([1, 2, 3]), { maxStringLength: 4 })).toBe("Buffer[ …(3) ]");
        });

        it.skipIf(isNotBuffer)("maxStringLengths array values longer than maxStringLength (3)", () => {
            expect.assertions(1);

            expect(inspect(Buffer.from([1, 2, 3]), { maxStringLength: 3 })).toBe("Buffer[ …(3) ]");
        });

        it.skipIf(isNotBuffer)("maxStringLengths array values longer than maxStringLength (2)", () => {
            expect.assertions(1);

            expect(inspect(Buffer.from([1, 2, 3]), { maxStringLength: 2 })).toBe("Buffer[ …(3) ]");
        });

        it.skipIf(isNotBuffer)("maxStringLengths array values longer than maxStringLength (1)", () => {
            expect.assertions(1);

            expect(inspect(Buffer.from([1, 2, 3]), { maxStringLength: 1 })).toBe("Buffer[ …(3) ]");
        });
    });
});
