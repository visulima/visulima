/* eslint-disable max-classes-per-file */
import { describe, expect, it } from "vitest";

import { inspect, registerConstructor, registerStringTag } from "../src";
import type { Options } from "../src/types";

describe("opaque base types", () => {
    it("returns an empty string for ArrayBuffer", () => {
        expect.assertions(1);

        expect(inspect(new ArrayBuffer(8))).toBe("");
    });

    it("returns an empty string for DataView", () => {
        expect.assertions(1);

        expect(inspect(new DataView(new ArrayBuffer(8)))).toBe("");
    });

    it("returns an empty string for a Generator instance", () => {
        expect.assertions(1);

        const generator = function* (): Generator<number> {
            yield 1;
        };

        expect(inspect(generator())).toBe("");
    });
});

describe("globalThis", () => {
    it("renders globalThis as `{ [object globalThis] }`", () => {
        expect.assertions(1);

        expect(inspect(globalThis)).toBe("{ [object globalThis] }");
    });
});

describe("depth limit on arrays", () => {
    it("renders `[Array]` once the depth limit is reached", () => {
        expect.assertions(2);

        expect(inspect({ a: [1, [2, [3]]] }, { depth: 1 })).toBe("{ a: [Array] }");
        expect(inspect([[[[1]]]], { depth: 2 })).toBe("[ [ [Array] ] ]");
    });
});

describe("indent option validation", () => {
    it("throws a TypeError for a negative integer indent", () => {
        expect.assertions(1);

        expect(() => inspect({ a: 1 }, { indent: -5 })).toThrow(TypeError);
    });

    it("throws a TypeError for a non-numeric string indent", () => {
        expect.assertions(1);

        // @ts-expect-error - exercising the runtime validation guard
        expect(() => inspect({ a: 1 }, { indent: "x" })).toThrow("option \"indent\" must be \"\\t\", an integer > 0, or `undefined`");
    });

    it("accepts a tab indent", () => {
        expect.assertions(1);

        expect(inspect({ a: 1 }, { indent: "\t" })).toBe("{\n\ta: 1\n}");
    });
});

describe("registerConstructor", () => {
    it("uses the registered inspector for matching instances and rejects duplicate registration", () => {
        expect.assertions(3);

        class Money {
            public amount: number;

            public constructor(amount: number) {
                this.amount = amount;
            }
        }

        const first = registerConstructor(Money, (value) => `$${String((value as Money).amount)}`);
        const second = registerConstructor(Money, () => "ignored");

        expect(first).toBe(true);
        expect(second).toBe(false);
        expect(inspect(new Money(42))).toBe("$42");
    });

    it("falls back to `unknown` when the registered inspector returns a falsy value", () => {
        expect.assertions(1);

        class Empty {
            public marker = true;
        }

        registerConstructor(Empty, () => undefined as unknown as string);

        expect(inspect(new Empty())).toBe("unknown");
    });
});

describe("registerStringTag", () => {
    it("uses the registered inspector for a matching Symbol.toStringTag and rejects duplicate registration", () => {
        expect.assertions(3);

        const first = registerStringTag("Temperature", () => "registered-tag");
        const second = registerStringTag("Temperature", () => "ignored");

        const value = { [Symbol.toStringTag]: "Temperature" };

        expect(first).toBe(true);
        expect(second).toBe(false);
        expect(inspect(value)).toBe("registered-tag");
    });
});

describe("null prototype objects", () => {
    it("renders own properties of a null-prototype object", () => {
        expect.assertions(1);

        const object = Object.create(null) as Record<string, unknown>;

        object.x = 1;

        expect(inspect(object)).toBe("[Object: null prototype] { x: 1 }");
    });
});

describe("complex keys with double quote style", () => {
    it("escapes embedded double quotes when quoteStyle is `double`", () => {
        expect.assertions(2);

        const options: Partial<Options> = { quoteStyle: "double" };

        expect(inspect({ "a-b": 1 }, options)).toBe(String.raw`{ \"a-b\": 1 }`);
        expect(inspect({ "a\"b": 1 }, options)).toBe(String.raw`{ \"a\\"b\": 1 }`);
    });
});
