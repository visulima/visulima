import { describe, expect, it } from "vitest";

import { inspect } from "../../src";

describe("primitives in workerd", () => {
    it("should render scalars", () => {
        expect.assertions(8);

        expect(inspect(undefined)).toBe("undefined");
        expect(inspect(null)).toBe("null");
        expect(inspect(true)).toBe("true");
        expect(inspect(false)).toBe("false");
        expect(inspect(42)).toBe("42");
        expect(inspect(Number.NaN)).toBe("NaN");
        expect(inspect(Number.POSITIVE_INFINITY)).toBe("Infinity");
        expect(inspect(-0)).toBe("-0");
    });

    it("should render strings, symbols and bigints", () => {
        expect.assertions(4);

        expect(inspect("hello")).toBe("'hello'");
        expect(inspect("hello", { quoteStyle: "double" })).toBe("\"hello\"");
        expect(inspect(Symbol("foo"))).toBe("Symbol(foo)");
        expect(inspect(10n)).toBe("10n");
    });

    it("should apply numeric separators", () => {
        expect.assertions(2);

        expect(inspect(1_000_000)).toBe("1_000_000");
        expect(inspect(1_000_000, { numericSeparator: false })).toBe("1000000");
    });
});

describe("collections in workerd", () => {
    it("should render Map and Set", () => {
        expect.assertions(4);

        expect(inspect(new Map())).toBe("Map (0) {}");
        expect(inspect(new Map([["a", 1]]))).toBe("Map (1) { 'a' => 1 }");
        expect(inspect(new Set())).toBe("Set (0) {}");
        expect(inspect(new Set([1, 2]))).toBe("Set (2) { 1, 2 }");
    });

    it("should render WeakMap and WeakSet opaquely", () => {
        expect.assertions(2);

        expect(inspect(new WeakMap())).toBe("WeakMap{…}");
        expect(inspect(new WeakSet())).toBe("WeakSet{…}");
    });

    it("should render arrays", () => {
        expect.assertions(3);

        expect(inspect([])).toBe("[]");
        expect(inspect([1, 2, 3])).toBe("[ 1, 2, 3 ]");
        expect(inspect(["foo", "bar", "baz", "bing"], { truncate: 22 })).toBe("[ 'foo', 'bar', …(2) ]");
    });
});

describe("binary types in workerd", () => {
    it("should render typed arrays", () => {
        expect.assertions(3);

        expect(inspect(new Uint8Array())).toBe("Uint8Array[]");
        expect(inspect(new Uint8Array([1, 2, 3]))).toBe("Uint8Array[ 1, 2, 3 ]");
        expect(inspect(new Float64Array([1.5]))).toBe("Float64Array[ 1.5 ]");
    });

    it("should render ArrayBuffer contents", () => {
        expect.assertions(3);

        const buffer = new ArrayBuffer(4);

        new Uint8Array(buffer).set([1, 2, 255, 16]);

        expect(inspect(buffer)).toBe("ArrayBuffer { [Uint8Contents]: <01 02 ff 10>, byteLength: 4 }");
        expect(inspect(new ArrayBuffer(0))).toBe("ArrayBuffer { byteLength: 0 }");
        expect(inspect(new ArrayBuffer(100))).toContain("... 50 more bytes");
    });

    it("should render a DataView", () => {
        expect.assertions(1);

        expect(inspect(new DataView(new ArrayBuffer(8)))).toBe("DataView { byteLength: 8, byteOffset: 0, buffer: ArrayBuffer { byteLength: 8 } }");
    });
});

describe("buffer under nodejs_compat", () => {
    it("should expose a Buffer global that reports as a Uint8Array subclass", () => {
        expect.assertions(3);

        expect(Buffer).toBeTypeOf("function");
        expect(Buffer.from([1, 2, 3])).toBeInstanceOf(Uint8Array);
        expect(Buffer.from([1, 2, 3])).toBeInstanceOf(Buffer);
    });

    it("should label buffers as `Buffer`, not `Uint8Array`", () => {
        expect.assertions(3);

        expect(inspect(Buffer.from(""))).toBe("Buffer[]");
        expect(inspect(Buffer.from([2, 3, 4]))).toBe("Buffer[ 2, 3, 4 ]");
        expect(inspect(Buffer.from([1, 2, 3]), { truncate: 19 })).toBe("Buffer[ 1, …(2) ]");
    });

    it("should render buffers nested inside other values", () => {
        expect.assertions(2);

        expect(inspect({ payload: Buffer.from([1, 2]) })).toBe("{ payload: Buffer[ 1, 2 ] }");
        expect(inspect(new Map([["body", Buffer.from([255])]]))).toBe("Map (1) { 'body' => Buffer[ 255 ] }");
    });

    it("should not throw on a zero-length or detached-style buffer", () => {
        expect.assertions(2);

        expect(() => inspect(Buffer.alloc(0))).not.toThrow();
        expect(() => inspect(Buffer.allocUnsafe(8))).not.toThrow();
    });
});

describe("objects and classes in workerd", () => {
    it("should render plain objects and nested objects", () => {
        expect.assertions(3);

        expect(inspect({})).toBe("{}");
        expect(inspect({ a: 1, b: "two" })).toBe("{ a: 1, b: 'two' }");
        expect(inspect({ a: { b: { c: 1 } } })).toBe("{ a: { b: { c: 1 } } }");
    });

    it("should render class instances with their constructor name", () => {
        expect.assertions(2);

        class Money {
            public amount = 42;
        }

        expect(inspect(new Money())).toBe("Money { amount: 42 }");
        expect(inspect(Object.create(null))).toBe("[Object: null prototype] {}");
    });

    it("should render symbol keys", () => {
        expect.assertions(2);

        expect(inspect({ [Symbol("foo")]: 1 })).toBe("{ [Symbol(foo)]: 1 }");
        expect(inspect({ foo: 1, [Symbol("foo")]: 1 })).toBe("{ foo: 1, [Symbol(foo)]: 1 }");
    });

    it("should detect circular references", () => {
        expect.assertions(2);

        const circular: Record<string, unknown> = { name: "root" };

        circular.self = circular;

        expect(inspect(circular)).toBe("{ name: 'root', self: [Circular] }");

        const a: Record<string, unknown> = {};
        const b: Record<string, unknown> = { a };

        a.b = b;

        expect(inspect(a)).toBe("{ b: { a: [Circular] } }");
    });

    it("should honour the depth option", () => {
        expect.assertions(3);

        expect(inspect({ a: [1, [2, [3]]] }, { depth: 1 })).toBe("{ a: [Array] }");
        expect(inspect([[[[1]]]], { depth: 2 })).toBe("[ [ [Array] ] ]");
        expect(inspect({ a: { b: { c: { d: 1 } } } }, { depth: 2 })).toBe("{ a: { b: [Object] } }");
    });

    it("should honour the truncate and indent options", () => {
        expect.assertions(3);

        expect(inspect({ a: 1 }, { indent: "\t" })).toBe("{\n\ta: 1\n}");
        expect(inspect({ a: 1, b: 2 }, { indent: 2 })).toBe("{\n  a: 1,\n  b: 2\n}");
        expect(() => inspect({ a: 1 }, { indent: -5 })).toThrow(TypeError);
    });
});

describe("getters and proxies in workerd", () => {
    it("should invoke a getter and render its value", () => {
        expect.assertions(1);

        const object = {
            get answer() {
                return 42;
            },
        };

        expect(inspect(object)).toBe("{ answer: 42 }");
    });

    it("should not crash on a throwing getter", () => {
        expect.assertions(2);

        const object = {
            get boom(): never {
                throw new Error("nope");
            },
        };

        expect(() => inspect(object)).not.toThrow();
        expect(inspect(object)).toContain("[Inspection threw]");
    });

    it("should render a setter-only accessor", () => {
        expect.assertions(1);

        const object = {
            set writeOnly(_value: number) {
                // intentionally empty
            },
        };

        expect(inspect(object)).toContain("[Setter]");
    });

    it("should render a Proxy transparently through its traps", () => {
        expect.assertions(3);

        const rewriting: ProxyHandler<{ a: number }> = {
            get(target, key) {
                return key === "a" ? 99 : Reflect.get(target, key);
            },
        };

        expect(inspect(new Proxy({ a: 1 }, {}))).toBe("{ a: 1 }");
        expect(inspect(new Proxy([1, 2], {}))).toBe("[ 1, 2 ]");
        expect(inspect(new Proxy({ a: 1 }, rewriting))).toBe("{ a: 99 }");
    });

    it("should not propagate a throwing Proxy get trap (same in node and workerd)", () => {
        expect.assertions(2);

        // `internalInspect` reads `Symbol.toStringTag` via
        // `Object.prototype.toString.call(value)` before any guarded read, so this
        // used to escape the `safeReadProperty` guard and crash. The dispatch slug
        // is now computed defensively: the keys stay observable, only the values
        // degrade. Runtime-independent — it behaves identically under node.
        const hostile = new Proxy(
            { a: 1 },
            {
                get: () => {
                    throw new Error("trap");
                },
            },
        );

        expect(() => inspect(hostile)).not.toThrow();
        expect(inspect(hostile)).toBe("{ a: [Inspection threw] }");
    });

    it("should not propagate a revoked Proxy", () => {
        expect.assertions(2);

        const { proxy, revoke } = Proxy.revocable({ a: 1 }, {});

        revoke();

        expect(() => inspect(proxy)).not.toThrow();
        expect(inspect(proxy)).toBe("[Inspection threw]");
    });
});

describe("errors in workerd", () => {
    it("should render an error with its name and message", () => {
        expect.assertions(2);

        expect(inspect(new Error("boom"))).toBe("Error: boom");
        expect(inspect(new TypeError("bad type"))).toBe("TypeError: bad type");
    });

    it("should render extra own properties on an error", () => {
        expect.assertions(1);

        const error = new Error("boom") as Error & { code: string };

        error.code = "E_BOOM";

        expect(inspect(error)).toBe("Error: boom { code: 'E_BOOM' }");
    });

    it("should render an error nested in an object", () => {
        expect.assertions(1);

        expect(inspect({ cause: new RangeError("out of range") })).toBe("{ cause: RangeError: out of range }");
    });
});

describe("other built-ins in workerd", () => {
    it("should render dates, regexps, functions and promises", () => {
        expect.assertions(4);

        expect(inspect(new Date("2020-01-01T00:00:00.000Z"))).toBe("2020-01-01T00:00:00.000Z");
        expect(inspect(/ab+c/gi)).toBe("/ab+c/gi");
        // With the default (infinite) `truncate` the whole source is rendered.
        expect(inspect(function named() {})).toBe("[Function: function named() {}]");
        expect(inspect(Promise.resolve(1))).toBe("Promise{…}");
    });

    it("should render deeply nested mixed structures", () => {
        expect.assertions(1);

        const value = {
            list: [1, { deep: new Set(["x"]) }],
            meta: new Map<string, unknown>([["buf", Buffer.from([7])]]),
        };

        expect(inspect(value)).toBe("{ list: [ 1, { deep: Set (1) { 'x' } } ], meta: Map (1) { 'buf' => Buffer[ 7 ] } }");
    });
});
