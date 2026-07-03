import { describe, expect, it } from "vitest";

import { inspect } from "../../src";

describe("undefined", () => {
    it("returns `undefined`", () => {
        expect.assertions(1);

        expect(inspect(undefined)).toBe("undefined");
    });

    describe("truncate", () => {
        it("returns the full string representation regardless of truncate", () => {
            expect.assertions(9);

            expect(inspect(undefined, { truncate: 9 })).toBe("undefined");
            expect(inspect(undefined, { truncate: 8 })).toBe("undefined");
            expect(inspect(undefined, { truncate: 7 })).toBe("undefined");
            expect(inspect(undefined, { truncate: 6 })).toBe("undefined");
            expect(inspect(undefined, { truncate: 5 })).toBe("undefined");
            expect(inspect(undefined, { truncate: 4 })).toBe("undefined");
            expect(inspect(undefined, { truncate: 3 })).toBe("undefined");
            expect(inspect(undefined, { truncate: 2 })).toBe("undefined");
            expect(inspect(undefined, { truncate: 1 })).toBe("undefined");
        });
    });
});
