import { describe, expect, it } from "vitest";

import { inspect } from "../../src";

describe("booleans", () => {
    it("returns `false` for false", () => {
        expect.assertions(4);

        expect(inspect(false)).toBe("false");
        expect(inspect(true)).toBe("true");
        // eslint-disable-next-line no-new-wrappers,unicorn/new-for-builtins,sonarjs/no-primitive-wrappers
        expect(inspect(new Boolean(1))).toBe("true");
        // eslint-disable-next-line no-new-wrappers,unicorn/new-for-builtins,sonarjs/no-primitive-wrappers
        expect(inspect(new Boolean(false))).toBe("false");
    });

    it("returns `true` for true", () => {
        expect.assertions(2);

        expect(inspect(false)).toBe("false");
        expect(inspect(true)).toBe("true");
    });

    describe("truncated", () => {
        it("returns the full string representation regardless of truncate", () => {
            expect.assertions(10);

            expect(inspect(true, { truncate: 5 })).toBe("true");
            expect(inspect(true, { truncate: 4 })).toBe("true");
            expect(inspect(true, { truncate: 3 })).toBe("true");
            expect(inspect(true, { truncate: 2 })).toBe("true");
            expect(inspect(true, { truncate: 1 })).toBe("true");
            expect(inspect(false, { truncate: 5 })).toBe("false");
            expect(inspect(false, { truncate: 4 })).toBe("false");
            expect(inspect(false, { truncate: 3 })).toBe("false");
            expect(inspect(false, { truncate: 2 })).toBe("false");
            expect(inspect(false, { truncate: 1 })).toBe("false");
        });
    });
});
