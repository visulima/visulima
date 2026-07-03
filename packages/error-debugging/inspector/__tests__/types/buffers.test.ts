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

    describe("truncate", () => {
        it.skipIf(isNotBuffer)("returns the full representation when truncate is over string length", () => {
            expect.assertions(1);

            expect(inspect(Buffer.from([1, 2, 3]), { truncate: 21 })).toBe("Buffer[ 1, 2, 3 ]");
        });

        it.skipIf(isNotBuffer)("truncates array values longer than truncate (20)", () => {
            expect.assertions(1);

            expect(inspect(Buffer.from([1, 2, 3]), { truncate: 20 })).toBe("Buffer[ 1, 2, 3 ]");
        });

        it.skipIf(isNotBuffer)("truncates array values longer than truncate (19)", () => {
            expect.assertions(1);

            expect(inspect(Buffer.from([1, 2, 3]), { truncate: 19 })).toBe("Buffer[ 1, …(2) ]");
        });

        it.skipIf(isNotBuffer)("truncates array values longer than truncate (18)", () => {
            expect.assertions(1);

            expect(inspect(Buffer.from([1, 2, 3]), { truncate: 18 })).toBe("Buffer[ 1, …(2) ]");
        });

        it.skipIf(isNotBuffer)("truncates array values longer than truncate (17)", () => {
            expect.assertions(1);

            expect(inspect(Buffer.from([1, 2, 3]), { truncate: 17 })).toBe("Buffer[ 1, …(2) ]");
        });

        it.skipIf(isNotBuffer)("truncates array values longer than truncate (16)", () => {
            expect.assertions(1);

            expect(inspect(Buffer.from([1, 2, 3]), { truncate: 16 })).toBe("Buffer[ …(3) ]");
        });

        it.skipIf(isNotBuffer)("truncates array values longer than truncate (15)", () => {
            expect.assertions(1);

            expect(inspect(Buffer.from([1, 2, 3]), { truncate: 15 })).toBe("Buffer[ …(3) ]");
        });

        it.skipIf(isNotBuffer)("truncates array values longer than truncate (14)", () => {
            expect.assertions(1);

            expect(inspect(Buffer.from([1, 2, 3]), { truncate: 14 })).toBe("Buffer[ …(3) ]");
        });

        it.skipIf(isNotBuffer)("truncates array values longer than truncate (13)", () => {
            expect.assertions(1);

            expect(inspect(Buffer.from([1, 2, 3]), { truncate: 13 })).toBe("Buffer[ …(3) ]");
        });

        it.skipIf(isNotBuffer)("truncates array values longer than truncate (12)", () => {
            expect.assertions(1);

            expect(inspect(Buffer.from([1, 2, 3]), { truncate: 12 })).toBe("Buffer[ …(3) ]");
        });

        it.skipIf(isNotBuffer)("truncates array values longer than truncate (11)", () => {
            expect.assertions(1);

            expect(inspect(Buffer.from([1, 2, 3]), { truncate: 11 })).toBe("Buffer[ …(3) ]");
        });

        it.skipIf(isNotBuffer)("truncates array values longer than truncate (10)", () => {
            expect.assertions(1);

            expect(inspect(Buffer.from([1, 2, 3]), { truncate: 10 })).toBe("Buffer[ …(3) ]");
        });

        it.skipIf(isNotBuffer)("truncates array values longer than truncate (9)", () => {
            expect.assertions(1);

            expect(inspect(Buffer.from([1, 2, 3]), { truncate: 9 })).toBe("Buffer[ …(3) ]");
        });

        it.skipIf(isNotBuffer)("truncates array values longer than truncate (8)", () => {
            expect.assertions(1);

            expect(inspect(Buffer.from([1, 2, 3]), { truncate: 8 })).toBe("Buffer[ …(3) ]");
        });

        it.skipIf(isNotBuffer)("truncates array values longer than truncate (7)", () => {
            expect.assertions(1);

            expect(inspect(Buffer.from([1, 2, 3]), { truncate: 7 })).toBe("Buffer[ …(3) ]");
        });

        it.skipIf(isNotBuffer)("truncates array values longer than truncate (6)", () => {
            expect.assertions(1);

            expect(inspect(Buffer.from([1, 2, 3]), { truncate: 6 })).toBe("Buffer[ …(3) ]");
        });

        it.skipIf(isNotBuffer)("truncates array values longer than truncate (5)", () => {
            expect.assertions(1);

            expect(inspect(Buffer.from([1, 2, 3]), { truncate: 5 })).toBe("Buffer[ …(3) ]");
        });

        it.skipIf(isNotBuffer)("truncates array values longer than truncate (4)", () => {
            expect.assertions(1);

            expect(inspect(Buffer.from([1, 2, 3]), { truncate: 4 })).toBe("Buffer[ …(3) ]");
        });

        it.skipIf(isNotBuffer)("truncates array values longer than truncate (3)", () => {
            expect.assertions(1);

            expect(inspect(Buffer.from([1, 2, 3]), { truncate: 3 })).toBe("Buffer[ …(3) ]");
        });

        it.skipIf(isNotBuffer)("truncates array values longer than truncate (2)", () => {
            expect.assertions(1);

            expect(inspect(Buffer.from([1, 2, 3]), { truncate: 2 })).toBe("Buffer[ …(3) ]");
        });

        it.skipIf(isNotBuffer)("truncates array values longer than truncate (1)", () => {
            expect.assertions(1);

            expect(inspect(Buffer.from([1, 2, 3]), { truncate: 1 })).toBe("Buffer[ …(3) ]");
        });
    });
});
