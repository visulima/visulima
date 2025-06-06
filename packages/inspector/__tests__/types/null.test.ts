import { describe, expect, it } from "vitest";

import { inspect } from "../../src";

describe("null", () => {
    it("returns `null`", () => {
        expect.assertions(1);

        expect(inspect(null)).toBe("null");
    });

    describe("maxStringLength", () => {
        it("returns the full string representation regardless of maxStringLength", () => {
            expect.assertions(9);

            expect(inspect(null, { maxStringLength: 9 })).toBe("null");
            expect(inspect(null, { maxStringLength: 8 })).toBe("null");
            expect(inspect(null, { maxStringLength: 7 })).toBe("null");
            expect(inspect(null, { maxStringLength: 6 })).toBe("null");
            expect(inspect(null, { maxStringLength: 5 })).toBe("null");
            expect(inspect(null, { maxStringLength: 4 })).toBe("null");
            expect(inspect(null, { maxStringLength: 3 })).toBe("null");
            expect(inspect(null, { maxStringLength: 2 })).toBe("null");
            expect(inspect(null, { maxStringLength: 1 })).toBe("null");
        });
    });
});
