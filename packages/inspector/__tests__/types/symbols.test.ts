import { describe, expect, it } from "vitest";

import { inspect } from "../../src";

describe("inspect with Symbols", () => {
    it("should inspect an empty Symbol", () => {
        expect.assertions(1);

        // eslint-disable-next-line symbol-description
        expect(inspect(Symbol())).toBe("Symbol()");
    });

    it("should inspect a Symbol with a description", () => {
        expect.assertions(1);

        expect(inspect(Symbol("foo"))).toBe("Symbol(foo)");
    });

    it("should inspect a Symbol with a description and single quotes", () => {
        expect.assertions(1);

        expect(inspect(Symbol("ab'c"))).toBe("Symbol(ab'c)");
    });

    it("should inspect a Symbol with a description and double quotes", () => {
        expect.assertions(1);

        expect(inspect(Symbol('ab"c'))).toBe('Symbol(ab"c)');
    });

    it("should inspect a Symbol with a description and unicode characters", () => {
        expect.assertions(1);

        expect(inspect(Symbol("\u001B"))).toBe("Symbol(\\u001b)");
    });

    it("should inspect an object with Symbol.toStringTag", () => {
        expect.assertions(4);

        const object = { a: 1 };

        expect(inspect(object), "object, no Symbol.toStringTag").toBe("{ a: 1 }");

        object[Symbol.toStringTag] = "foo";

        expect(inspect(object), "object with Symbol.toStringTag").toBe("foo { a: 1 }");

        const dict = { __proto__: null, a: 1 };

        expect(inspect(dict), "null object with Symbol.toStringTag").toBe("[Object: null prototype] { a: 1 }");

        dict[Symbol.toStringTag] = "Dict";

        expect(inspect(dict), "null object with Symbol.toStringTag").toBe("[Dict: null prototype] { a: 1 }");
    });
});
