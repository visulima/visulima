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

        (instance as { constructor: unknown }).constructor = null;

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

describe("hostile proxies (security)", () => {
    it("does not throw when the `get` trap throws for every key", () => {
        expect.assertions(2);

        // The dispatch slug (`Object.prototype.toString.call`) reads
        // `Symbol.toStringTag` off the value, so this used to crash before any
        // guarded read was reached. The own keys stay observable through the
        // default `ownKeys` trap; only the values degrade.
        const value = new Proxy(
            { a: 1 },
            {
                get: () => {
                    throw new Error("trap");
                },
            },
        );

        expect(() => inspect(value)).not.toThrow();
        expect(inspect(value)).toBe("{ a: [Inspection threw] }");
    });

    it("renders every property when the `get` trap throws only for `Symbol.toStringTag`", () => {
        expect.assertions(1);

        const value = new Proxy(
            { a: 1 },
            {
                get: (target, key, receiver) => {
                    if (key === Symbol.toStringTag) {
                        throw new Error("trap");
                    }

                    return Reflect.get(target, key, receiver) as unknown;
                },
            },
        );

        expect(inspect(value)).toBe("{ a: 1 }");
    });

    it("renders every property when the `get` trap throws only for `constructor`", () => {
        expect.assertions(1);

        const value = new Proxy(
            { a: 1 },
            {
                get: (target, key, receiver) => {
                    if (key === "constructor") {
                        throw new Error("trap");
                    }

                    return Reflect.get(target, key, receiver) as unknown;
                },
            },
        );

        expect(inspect(value)).toBe("{ a: 1 }");
    });

    it("renders every property when the `get` trap throws only for the custom-inspect symbols", () => {
        expect.assertions(3);

        const hostileFor = (symbol: symbol | string) =>
            new Proxy(
                { a: 1 },
                {
                    get: (target, key, receiver) => {
                        if (key === symbol) {
                            throw new Error("trap");
                        }

                        return Reflect.get(target, key, receiver) as unknown;
                    },
                },
            );

        expect(inspect(hostileFor(Symbol.for("chai/inspect")))).toBe("{ a: 1 }");
        expect(inspect(hostileFor(Symbol.for("nodejs.util.inspect.custom")))).toBe("{ a: 1 }");
        expect(inspect(hostileFor("inspect"))).toBe("{ a: 1 }");
    });

    it("does not throw when the `has` trap throws", () => {
        expect.assertions(2);

        const value = new Proxy(
            { a: 1 },
            {
                has: () => {
                    throw new Error("trap");
                },
            },
        );

        expect(() => inspect(value)).not.toThrow();
        expect(inspect(value)).toBe("{ a: 1 }");
    });

    it("does not throw when the `getPrototypeOf` trap throws", () => {
        expect.assertions(2);

        const value = new Proxy(
            { a: 1 },
            {
                getPrototypeOf: () => {
                    throw new Error("trap");
                },
            },
        );

        expect(() => inspect(value)).not.toThrow();
        // An unreadable prototype must not be reported as a null prototype.
        expect(inspect(value)).toBe("{ a: 1 }");
    });

    it("does not throw when the `getOwnPropertyDescriptor` trap throws", () => {
        expect.assertions(2);

        const value = new Proxy(
            { a: 1 },
            {
                getOwnPropertyDescriptor: () => {
                    throw new Error("trap");
                },
            },
        );

        expect(() => inspect(value)).not.toThrow();
        // Enumerability is unknowable, so the key is kept rather than dropped.
        expect(inspect(value)).toBe("{ a: 1 }");
    });

    it("does not throw when the `ownKeys` trap throws", () => {
        expect.assertions(2);

        const value = new Proxy(
            { a: 1 },
            {
                ownKeys: () => {
                    throw new Error("trap");
                },
            },
        );

        expect(() => inspect(value)).not.toThrow();
        // Not a single key is observable, so there is nothing honest left to print.
        expect(inspect(value)).toBe("[Inspection threw]");
    });

    it("does not throw for a hostile proxy over an array", () => {
        expect.assertions(2);

        const value = new Proxy([1, 2], {
            get: () => {
                throw new Error("trap");
            },
        });

        expect(() => inspect(value)).not.toThrow();
        // `length` is unreadable, so the value drops to the object renderer, which
        // reads own keys only.
        expect(inspect(value)).toBe("{ '0': [Inspection threw], '1': [Inspection threw] }");
    });

    it("does not throw for a hostile proxy over a class instance", () => {
        expect.assertions(2);

        class Widget {
            public size = 1;
        }

        const value = new Proxy(new Widget(), {
            get: () => {
                throw new Error("trap");
            },
        });

        expect(() => inspect(value)).not.toThrow();
        expect(inspect(value)).toBe("{ size: [Inspection threw] }");
    });

    it("keeps a hostile proxy from taking down its siblings", () => {
        expect.assertions(1);

        const value = {
            after: 2,
            bad: new Proxy(
                { inner: 1 },
                {
                    get: () => {
                        throw new Error("trap");
                    },
                },
            ),
            before: 1,
        };

        expect(inspect(value)).toBe("{ after: 2, bad: { inner: [Inspection threw] }, before: 1 }");
    });
});

describe("revoked proxies (security)", () => {
    it("does not throw for a revoked proxy over an object", () => {
        expect.assertions(2);

        const { proxy, revoke } = Proxy.revocable({ a: 1 }, {});

        revoke();

        // Every operation on a revoked proxy throws, including ones that look
        // total — `Object.prototype.toString`, `Array.isArray`, `ownKeys`.
        expect(() => inspect(proxy)).not.toThrow();
        expect(inspect(proxy)).toBe("[Inspection threw]");
    });

    it("does not throw for a revoked proxy over an array", () => {
        expect.assertions(2);

        const { proxy, revoke } = Proxy.revocable([1, 2], {});

        revoke();

        expect(() => inspect(proxy)).not.toThrow();
        expect(inspect(proxy)).toBe("[Inspection threw]");
    });

    it("does not throw for a revoked proxy over a function", () => {
        expect.assertions(2);

        const { proxy, revoke } = Proxy.revocable(() => 1, {});

        revoke();

        // `typeof` still reports "function", so this reaches the function
        // inspector with nothing readable on it — not even `toString`.
        expect(() => inspect(proxy)).not.toThrow();
        expect(inspect(proxy)).toBe("[Inspection threw]");
    });

    it("does not throw for a revoked proxy sitting at the depth limit", () => {
        expect.assertions(2);

        const { proxy, revoke } = Proxy.revocable([1], {});

        revoke();

        // The depth cut-off calls `Array.isArray` to pick between `[Array]` and
        // `[Object]`, which throws on a revoked proxy.
        expect(() => inspect({ a: { b: { c: { d: { e: proxy } } } } })).not.toThrow();
        expect(inspect({ a: { b: { c: { d: { e: proxy } } } } })).toBe("{ a: { b: { c: { d: { e: [Object] } } } } }");
    });
});

describe("throwing Symbol.toStringTag getter", () => {
    it("does not throw for a getter that throws on a plain object", () => {
        expect.assertions(2);

        const value = {
            a: 1,
            get [Symbol.toStringTag](): string {
                throw new Error("boom");
            },
        };

        expect(() => inspect(value)).not.toThrow();
        expect(inspect(value)).toBe("{ a: 1, [Symbol(Symbol.toStringTag)]: [Inspection threw] }");
    });
});

// Every built-in tag that carries a brand check. `Int32Array` is left out on purpose —
// it is exercised by the `registerStringTag` case at the end of the block.
const brandCheckedTags = [
    "Arguments",
    "Array",
    "ArrayBuffer",
    "BigInt",
    "Boolean",
    "DataView",
    "Date",
    "Error",
    "Float32Array",
    "Float64Array",
    "Function",
    "Int8Array",
    "Int16Array",
    "Map",
    "Number",
    "RegExp",
    "Set",
    "SharedArrayBuffer",
    "String",
    "Symbol",
    "Uint8Array",
    "Uint8ClampedArray",
    "Uint16Array",
    "Uint32Array",
    "WeakMap",
    "WeakSet",
];

describe("forged string tags (security)", () => {
    it("does not dispatch a plain object into the Map inspector", () => {
        expect.assertions(2);

        // `Object.prototype.toString` returns whatever `Symbol.toStringTag` says, so
        // this used to be routed straight into `inspectMap` and die on `map.entries()`.
        const value = { a: 1, [Symbol.toStringTag]: "Map" };

        expect(() => inspect(value)).not.toThrow();
        expect(inspect(value)).toBe("{ a: 1, [Symbol(Symbol.toStringTag)]: 'Map' }");
    });

    it("does not dispatch a plain object into the Set, Date, RegExp, DataView or Error inspectors", () => {
        expect.assertions(10);

        // The other five tags whose renderers reached for a method or accessor that
        // only exists on the genuine built-in.
        for (const tag of ["Set", "Date", "RegExp", "DataView", "Error"]) {
            const value = { a: 1, [Symbol.toStringTag]: tag };

            expect(() => inspect(value)).not.toThrow();
            expect(inspect(value)).toBe(`{ a: 1, [Symbol(Symbol.toStringTag)]: '${tag}' }`);
        }
    });

    it("renders every brand-checked built-in tag as the plain object it is", () => {
        expect.assertions(26);

        // A forged tag buys nothing: the value is printed for what it is, with the tag
        // itself visible as the own symbol property it is.
        for (const tag of brandCheckedTags) {
            expect(inspect({ a: 1, [Symbol.toStringTag]: tag })).toBe(`{ a: 1, [Symbol(Symbol.toStringTag)]: '${tag}' }`);
        }
    });

    it("does not dispatch a value that inherits a built-in prototype without its internal slot", () => {
        expect.assertions(5);

        // Inheriting `Map.prototype` is enough to be tagged `Map`, but not enough to
        // have a `[[MapData]]` slot — including for the prototype objects themselves.
        expect(inspect(Object.create(Map.prototype) as object)).toBe("Map [Map] {}");
        expect(inspect(Map.prototype)).toBe("{}");
        expect(inspect(Set.prototype)).toBe("{}");
        expect(inspect(ArrayBuffer.prototype)).toBe("{}");
        expect(inspect(DataView.prototype)).toBe("{}");
    });

    it("does not dispatch a proxy wrapping a genuine built-in", () => {
        expect.assertions(4);

        // A proxy forwards the tag read to its target but has no internal slot of its
        // own, so the built-in accessors reject it as an incompatible receiver.
        expect(() => inspect(new Proxy(new Map([[1, 2]]), {}))).not.toThrow();
        expect(inspect(new Proxy(new Map([[1, 2]]), {}))).toBe("Map [Map] {}");
        expect(() => inspect(new Proxy(new Set([1]), {}))).not.toThrow();
        expect(inspect(new Proxy(new Set([1]), {}))).toBe("Set [Set] {}");
    });

    it("leaves genuine built-ins on their own inspectors", () => {
        expect.assertions(9);

        class MyMap extends Map<string, number> {}

        expect(inspect(new Map([["a", 1]]))).toBe("Map (1) { 'a' => 1 }");
        expect(inspect(new MyMap([["a", 1]]))).toBe("Map (1) { 'a' => 1 }");
        expect(inspect(new Set([1, 2]))).toBe("Set (2) { 1, 2 }");
        expect(inspect(new WeakMap())).toBe("WeakMap{…}");
        expect(inspect(new WeakSet())).toBe("WeakSet{…}");
        expect(inspect(/ab+c/gi)).toBe("/ab+c/gi");
        expect(inspect(new Date("2020-01-01T00:00:00.000Z"))).toBe("2020-01-01T00:00:00.000Z");
        expect(inspect(new Int32Array([1, 2]))).toBe("Int32Array[ 1, 2 ]");
        expect(inspect(new Error("boom"))).toBe("Error: boom");
    });

    it("keeps rendering a tag that was already safe to forge", () => {
        expect.assertions(6);

        // `Promise`, `Generator` and `AsyncGenerator` are deliberately left unchecked:
        // every operation that would prove their slots (`then`, `next`, `return`) is
        // observable — it schedules a job, marks a rejection handled, or advances the
        // iterator — and their inspectors read nothing off the value beyond a guarded
        // tag read, so a forgery was never able to make them throw.
        //
        // This pins the documented limitation (README, "Forged tags"): the label is a
        // lie, and that is the accepted cost. If a sound side-effect-free brand check
        // ever lands, this expectation changes and the docs must change with it.
        for (const tag of ["Promise", "Generator", "AsyncGenerator"]) {
            expect(() => inspect({ [Symbol.toStringTag]: tag })).not.toThrow();
        }

        expect(inspect({ [Symbol.toStringTag]: "Promise" })).toBe("Promise{…}");
        expect(inspect({ [Symbol.toStringTag]: "Generator" })).toBe("Object [Generator] {}");
        expect(inspect({ [Symbol.toStringTag]: "AsyncGenerator" })).toBe("Object [AsyncGenerator] {}");
    });

    it("still renders genuine promises and generators that a prototype heuristic would reject", () => {
        expect.assertions(3);

        // A `getPrototypeOf(value) === Promise.prototype` style check would fail all
        // three of these — the first two are cross-realm-shaped (a subclass and an
        // object whose own tag was redefined), and it is exactly why no such heuristic
        // is used in `matchesBuiltInTag`. They must keep rendering as the real thing.
        class MyPromise extends Promise<number> {}

        expect(inspect(MyPromise.resolve(1))).toBe("Promise{…}");

        const tagged = Promise.resolve(1);

        // `Reflect` rather than `Object`, because `Object.defineProperty` hands the
        // promise straight back and the bare expression statement then reads as a
        // floating promise.
        Reflect.defineProperty(tagged, Symbol.toStringTag, { configurable: true, value: "Promise" });

        expect(inspect(tagged)).toBe("Promise{…}");

        // eslint-disable-next-line func-names
        expect(inspect((function* () {})())).toBe("Object [Generator] {}");
    });

    it("does not throw for a forged DOM collection whose members are hostile", () => {
        expect.assertions(4);

        // `NodeList` / `HTMLCollection` are host tags with no ES-level brand, so they
        // stay dispatchable by tag alone; the per-node render is what is bounded.
        for (const tag of ["NodeList", "HTMLCollection"]) {
            const value = {
                0: {
                    get nodeType(): number {
                        throw new Error("boom");
                    },
                },
                length: 1,
                [Symbol.toStringTag]: tag,
            };

            expect(() => inspect(value)).not.toThrow();
            expect(inspect(value)).toBe("[Inspection threw]");
        }
    });

    it("does not throw for a forged generator whose tag stops answering", () => {
        expect.assertions(2);

        // `Generator` is unchecked for the same reason as `Promise` (`next` would
        // advance the iterator), so its inspector must survive a tag that answers the
        // dispatch read and then throws on the read the inspector itself makes.
        const makeValue = () => {
            let reads = 0;

            return new Proxy(
                {},
                {
                    get: (target, key, receiver) => {
                        if (key === Symbol.toStringTag) {
                            reads += 1;

                            if (reads > 1) {
                                throw new Error("boom");
                            }

                            return "Generator";
                        }

                        return Reflect.get(target, key, receiver) as unknown;
                    },
                },
            );
        };

        expect(() => inspect(makeValue())).not.toThrow();
        expect(inspect(makeValue())).toBe("Object [Generator] {}");
    });

    it("does not brand-check consumer-registered string tags", () => {
        expect.assertions(4);

        // The extension point is untouched: `registerStringTag` writes to its own map,
        // which the brand table is never consulted for — for a tag of the consumer's own
        // invention, and for one that collides with a built-in name. Genuine built-ins
        // keep winning, because `baseTypesMap` is still consulted first.
        expect(registerStringTag("Duration", () => "registered-duration")).toBe(true);
        expect(inspect({ [Symbol.toStringTag]: "Duration" })).toBe("registered-duration");

        expect(registerStringTag("Int32Array", () => "registered-int32")).toBe(true);
        expect(inspect({ [Symbol.toStringTag]: "Int32Array" })).toBe("registered-int32");
    });
});
