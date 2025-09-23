import { describe, expect, it } from "vitest";

import { inspect } from "../../src";

describe("inspect with undefined", () => {
    it("should inspect undefined", () => {
        expect.assertions(1);

        expect(inspect(undefined)).toBe("undefined");
    });

    describe("maxStringLength option", () => {
        it("should return the full string representation regardless of maxStringLength", () => {
            expect.assertions(9);

            expect(inspect(undefined, { maxStringLength: 9 })).toBe("undefined");
            expect(inspect(undefined, { maxStringLength: 8 })).toBe("undefined");
            expect(inspect(undefined, { maxStringLength: 7 })).toBe("undefined");
            expect(inspect(undefined, { maxStringLength: 6 })).toBe("undefined");
            expect(inspect(undefined, { maxStringLength: 5 })).toBe("undefined");
            expect(inspect(undefined, { maxStringLength: 4 })).toBe("undefined");
            expect(inspect(undefined, { maxStringLength: 3 })).toBe("undefined");
            expect(inspect(undefined, { maxStringLength: 2 })).toBe("undefined");
            expect(inspect(undefined, { maxStringLength: 1 })).toBe("undefined");
        });
    });
});
