import { describe, expect, it } from "vitest";

import { inspect } from "../../src";

describe("null", () => {
    it("returns `null`", () => {
        expect.assertions(1);

        expect(inspect(null)).toBe("null");
    });

    describe("colors", () => {
        it("returns string with bold color, if colour is set to true", () => {
        expect.assertions(1);

            expect(inspect(null, { colors: true })).toBe("\u001B[1mnull\u001B[22m");
        });
    });

    describe("truncate", () => {
        it("returns the full string representation regardless of truncate", () => {
        expect.assertions(9);

            expect(inspect(null, { truncate: 9 })).toBe("null");
            expect(inspect(null, { truncate: 8 })).toBe("null");
            expect(inspect(null, { truncate: 7 })).toBe("null");
            expect(inspect(null, { truncate: 6 })).toBe("null");
            expect(inspect(null, { truncate: 5 })).toBe("null");
            expect(inspect(null, { truncate: 4 })).toBe("null");
            expect(inspect(null, { truncate: 3 })).toBe("null");
            expect(inspect(null, { truncate: 2 })).toBe("null");
            expect(inspect(null, { truncate: 1 })).toBe("null");
        });
    });
});
