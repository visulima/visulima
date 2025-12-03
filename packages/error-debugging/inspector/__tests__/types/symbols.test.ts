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

        expect(inspect("ab'c")).toBe(String.raw`'ab\'c'`);
    });

    it("does not escape double quotes", () => {
        expect.assertions(1);

        expect(inspect("ab\"c")).toBe("'ab\"c'");
    });

    it("escapes unicode characters", () => {
        expect.assertions(1);

        expect(inspect("\u001B")).toBe(String.raw`'\u001b'`);
    });

    it("should return the correct Symbol.toStringTag", () => {
        expect.assertions(4);

        const object = { a: 1 };

        expect(inspect(object), "object, no Symbol.toStringTag").toBe("{ a: 1 }");

        object[Symbol.toStringTag] = "foo";

        expect(inspect(object), "object with Symbol.toStringTag").toBe("{ a: 1, [Symbol(Symbol.toStringTag)]: 'foo' }");

        const dict = { __proto__: null, a: 1 };

        expect(inspect(dict), "null object with Symbol.toStringTag").toBe("[Object: null prototype] { a: 1 }");

        dict[Symbol.toStringTag] = "Dict";

        expect(inspect(dict), "null object with Symbol.toStringTag").toBe("[Dict: null prototype] { a: 1, [Symbol(Symbol.toStringTag)]: 'Dict' }");
    });
});
