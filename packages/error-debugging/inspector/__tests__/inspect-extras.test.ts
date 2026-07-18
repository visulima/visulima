/* eslint-disable max-classes-per-file */
import { describe, expect, it } from "vitest";

import { inspect, registerConstructor, registerStringTag } from "../src";
import type { Options } from "../src/types";

describe("binary base types", () => {
    it("renders an ArrayBuffer with its byte contents and byteLength", () => {
        expect.assertions(2);

        const buffer = new ArrayBuffer(4);

        new Uint8Array(buffer).set([1, 2, 255, 16]);

        expect(inspect(buffer)).toBe("ArrayBuffer { [Uint8Contents]: <01 02 ff 10>, byteLength: 4 }");
        expect(inspect(new ArrayBuffer(0))).toBe("ArrayBuffer { byteLength: 0 }");
    });

    it("truncates large ArrayBuffer contents with a more-bytes marker", () => {
        expect.assertions(1);

        const result = inspect(new ArrayBuffer(100));

        expect(result).toContain("... 50 more bytes");
    });

    it("renders a DataView with byteLength, byteOffset and buffer", () => {
        expect.assertions(1);

        expect(inspect(new DataView(new ArrayBuffer(8)))).toBe(
            "DataView { byteLength: 8, byteOffset: 0, buffer: ArrayBuffer { byteLength: 8 } }",
        );
    });

    it("renders a generic ArrayBuffer field inside an object instead of a blank", () => {
        expect.assertions(1);

        expect(inspect({ buf: new ArrayBuffer(2) })).toBe("{ buf: ArrayBuffer { byteLength: 2 } }");
    });

    it("tags a Generator instance without draining it", () => {
        expect.assertions(2);

        const generator = function* (): Generator<number> {
            yield 1;
        };

        const instance = generator();

        expect(inspect(instance)).toBe("Object [Generator] {}");
        // The generator must not have been consumed by inspecting it.
        expect(instance.next().value).toBe(1);
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

describe("throwing getters", () => {
    it("does not throw and renders a placeholder for a getter that throws", () => {
        expect.assertions(2);

        const value = {
            get x() {
                throw new Error("boom");
            },
        };

        expect(() => inspect(value)).not.toThrow();
        expect(inspect(value)).toBe("{ x: [Inspection threw] }");
    });

    it("still renders sibling properties when one getter throws", () => {
        expect.assertions(1);

        const value = {
            a: 1,
            get b() {
                throw new Error("boom");
            },
            c: 3,
        };

        expect(inspect(value)).toBe("{ a: 1, b: [Inspection threw], c: 3 }");
    });

    it("does not throw for an Error own property whose getter throws", () => {
        expect.assertions(2);

        const error = new Error("outer");

        Object.defineProperty(error, "ctx", {
            configurable: true,
            enumerable: true,
            get() {
                throw new Error("boom");
            },
        });

        expect(() => inspect(error)).not.toThrow();
        expect(inspect(error)).toBe("Error: outer { ctx: [Inspection threw] }");
    });

    it("does not throw for an array non-index property whose getter throws", () => {
        expect.assertions(2);

        const array: unknown[] = [1, 2];

        Object.defineProperty(array, "extra", {
            configurable: true,
            enumerable: true,
            get() {
                throw new Error("boom");
            },
        });

        expect(() => inspect(array)).not.toThrow();
        expect(inspect(array)).toBe("[ 1, 2, extra: [Inspection threw] ]");
    });
});

describe("depth limit with null", () => {
    it("renders a nested null as `null`, not `[Object]`", () => {
        expect.assertions(1);

        expect(inspect({ a: null }, { depth: 1 })).toBe("{ a: null }");
    });
});

describe("class instance with a broken constructor", () => {
    it("does not throw when the own `constructor` property is null", () => {
        expect.assertions(2);

        class Foo {
            public value = 1;
        }

        const instance = new Foo() as unknown as Record<string, unknown>;

        instance.constructor = null;

        expect(() => inspect(instance)).not.toThrow();
        expect(inspect(instance)).toContain("<Anonymous Class>");
    });
});

describe("hostile Symbol.toStringTag values (security)", () => {
    it("does not throw for a `valueOf` toStringTag", () => {
        expect.assertions(2);

        const value = { [Symbol.toStringTag]: "valueOf" };

        expect(() => inspect(value)).not.toThrow();
        // The hostile tag must never be invoked or smuggled in as a callable: it is
        // rendered as the literal, labelled `Symbol(Symbol.toStringTag)` property
        // value (the library convention, see types/symbols.test.ts), not executed.
        expect(inspect(value)).toBe("{ [Symbol(Symbol.toStringTag)]: 'valueOf' }");
    });

    it("does not produce `[object Undefined]` for a `toString` toStringTag", () => {
        expect.assertions(1);

        const value = { [Symbol.toStringTag]: "toString" };

        // A `toString` tag must not coerce the object into `[object Undefined]`; it
        // is shown verbatim as the labelled toStringTag symbol property instead.
        expect(inspect(value)).toBe("{ [Symbol(Symbol.toStringTag)]: 'toString' }");
    });

    it("allows registering an inspector for the `toString` tag", () => {
        expect.assertions(2);

        const registered = registerStringTag("toString", () => "tag-toString");

        expect(registered).toBe(true);
        expect(inspect({ [Symbol.toStringTag]: "toString" })).toBe("tag-toString");
    });
});

describe("maxArrayLength option", () => {
    it("limits the number of rendered array elements", () => {
        expect.assertions(1);

        expect(inspect([1, 2, 3, 4, 5, 6], { maxArrayLength: 2 })).toBe("[ 1, 2, … 4 more ]");
    });

    it("renders every element when maxArrayLength is Infinity", () => {
        expect.assertions(1);

        expect(inspect([1, 2, 3, 4, 5, 6])).toBe("[ 1, 2, 3, 4, 5, 6 ]");
    });

    it("limits typed-array elements", () => {
        expect.assertions(1);

        expect(inspect(new Uint8Array([1, 2, 3, 4]), { maxArrayLength: 2 })).toBe("Uint8Array[ 1, 2, … 2 more ]");
    });

    it("limits the number of rendered Set elements", () => {
        expect.assertions(1);

        expect(inspect(new Set([1, 2, 3, 4, 5, 6]), { maxArrayLength: 2 })).toBe("Set (6) { 1, 2, … 4 more }");
    });

    it("limits the number of rendered Map entries", () => {
        expect.assertions(1);

        const map = new Map([
            ["a", 1],
            ["b", 2],
            ["c", 3],
        ]);

        expect(inspect(map, { maxArrayLength: 2 })).toBe("Map (3) { 'a' => 1, 'b' => 2, … 1 more }");
    });
});

describe("showHidden option", () => {
    it("hides non-enumerable own properties by default", () => {
        expect.assertions(1);

        const value: Record<string, unknown> = { visible: 1 };

        Object.defineProperty(value, "hidden", { enumerable: false, value: 2 });

        expect(inspect(value)).toBe("{ visible: 1 }");
    });

    it("renders non-enumerable own properties when showHidden is true", () => {
        expect.assertions(1);

        const value: Record<string, unknown> = { visible: 1 };

        Object.defineProperty(value, "hidden", { enumerable: false, value: 2 });

        expect(inspect(value, { showHidden: true })).toBe("{ visible: 1, hidden: 2 }");
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
