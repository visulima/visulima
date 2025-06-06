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

    describe("maxStringLengthd", () => {
        it("returns the full string representation regardless of maxStringLength", () => {
            expect.assertions(10);

            expect(inspect(true, { maxStringLength: 5 })).toBe("true");
            expect(inspect(true, { maxStringLength: 4 })).toBe("true");
            expect(inspect(true, { maxStringLength: 3 })).toBe("true");
            expect(inspect(true, { maxStringLength: 2 })).toBe("true");
            expect(inspect(true, { maxStringLength: 1 })).toBe("true");
            expect(inspect(false, { maxStringLength: 5 })).toBe("false");
            expect(inspect(false, { maxStringLength: 4 })).toBe("false");
            expect(inspect(false, { maxStringLength: 3 })).toBe("false");
            expect(inspect(false, { maxStringLength: 2 })).toBe("false");
            expect(inspect(false, { maxStringLength: 1 })).toBe("false");
        });
    });
});
