import { describe, expect, it } from "vitest";

import { inspect } from "../../src";

describe("symbols", () => {
    it("returns Symbol() for empty Symbol", () => {
        expect.assertions(1);

        // eslint-disable-next-line symbol-description
        expect(inspect(Symbol())).toBe("Symbol()");
    });

    it("returns string wrapped in quotes", () => {
        expect.assertions(1);

        expect(inspect("abc")).toBe("'abc'");
    });

    it("escapes single quotes", () => {
        expect.assertions(1);

        expect(inspect("ab'c")).toBe("'ab\\'c'");
    });

    it("does not escape double quotes", () => {
        expect.assertions(1);

        expect(inspect('ab"c')).toBe("'ab\"c'");
    });

    it("escapes unicode characters", () => {
        expect.assertions(1);

        expect(inspect("\u001B")).toBe("'\\u001b'");
    });
});
