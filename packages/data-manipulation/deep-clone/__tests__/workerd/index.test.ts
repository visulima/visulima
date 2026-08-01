// eslint-disable-next-line max-classes-per-file
import { afterEach, describe, expect, it, vi } from "vitest";

import { createDeepClone, deepClone } from "../../src/index";

describe("@visulima/deep-clone on workerd", () => {
    describe("primitives and plain structures", () => {
        it("should return primitives unchanged", () => {
            expect.assertions(6);

            expect(deepClone(1)).toBe(1);
            expect(deepClone("x")).toBe("x");
            expect(deepClone(true)).toBe(true);
            // eslint-disable-next-line unicorn/no-null
            expect(deepClone(null)).toBeNull();
            // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
            expect(deepClone(undefined)).toBeUndefined();
            expect(deepClone(10n)).toBe(10n);
        });

        it("should deep-clone nested objects and arrays without aliasing", () => {
            expect.assertions(4);

            const source = { list: [1, { deep: true }], nested: { value: 1 } };
            const cloned = deepClone(source);

            expect(cloned).toStrictEqual(source);
            expect(cloned).not.toBe(source);
            expect(cloned.nested).not.toBe(source.nested);
            expect(cloned.list[1]).not.toBe(source.list[1]);
        });
    });

    describe("built-in object types", () => {
        it("should clone a Date preserving the timestamp", () => {
            expect.assertions(3);

            const date = new Date("2024-05-06T07:08:09.010Z");
            const cloned = deepClone(date);

            expect(cloned).toBeInstanceOf(Date);
            expect(cloned).not.toBe(date);
            expect(cloned.getTime()).toBe(date.getTime());
        });

        it("should clone an invalid Date", () => {
            expect.assertions(1);

            expect(Number.isNaN(deepClone(new Date(Number.NaN)).getTime())).toBe(true);
        });

        it("should clone a RegExp preserving source, flags and lastIndex", () => {
            expect.assertions(4);

            const regexp = /ab+c/giu;

            regexp.lastIndex = 2;

            const cloned = deepClone(regexp);

            expect(cloned).not.toBe(regexp);
            expect(cloned.source).toBe("ab+c");
            expect(cloned.flags).toBe("giu");
            expect(cloned.lastIndex).toBe(2);
        });

        it("should clone a Map with deep values", () => {
            expect.assertions(4);

            const inner = { value: 1 };
            const map = new Map<string, unknown>([
                ["a", inner],
                ["b", 2],
            ]);
            const cloned = deepClone(map);

            expect(cloned).toBeInstanceOf(Map);
            expect(cloned).not.toBe(map);
            expect(cloned.get("b")).toBe(2);
            expect(cloned.get("a")).not.toBe(inner);
        });

        it("should keep object keys by reference in loose mode and clone them in strict mode", () => {
            expect.assertions(2);

            const key = { id: 1 };
            const map = new Map<object, string>([[key, "value"]]);

            const looseKeys = [...(deepClone(map) as Map<object, string>).keys()];
            const strictKeys = [...(deepClone(map, { strict: true }) as Map<object, string>).keys()];

            expect(looseKeys[0]).toBe(key);
            expect(strictKeys[0]).not.toBe(key);
        });

        it("should clone a Set with deep values", () => {
            expect.assertions(3);

            const inner = { value: 1 };
            const set = new Set<unknown>([2, inner]);
            const cloned = deepClone(set);

            expect(cloned).toBeInstanceOf(Set);
            expect(cloned.has(2)).toBe(true);
            expect([...cloned][0]).not.toBe(inner);
        });

        it("should clone an Error preserving name, message and stack", () => {
            expect.assertions(4);

            const error = new TypeError("boom");

            (error as TypeError & { code?: string }).code = "E_BOOM";

            const cloned = deepClone(error) as TypeError & { code?: string };

            expect(cloned).toBeInstanceOf(TypeError);
            expect(cloned.message).toBe("boom");
            expect(cloned.stack).toBe(error.stack);
            expect(cloned.code).toBe("E_BOOM");
        });

        it("should clone boxed primitives without losing their value", () => {
            expect.assertions(3);

            // eslint-disable-next-line no-new-wrappers, unicorn/new-for-builtins, sonarjs/no-primitive-wrappers
            expect(deepClone(new Number(5)).valueOf()).toBe(5);
            // eslint-disable-next-line no-new-wrappers, unicorn/new-for-builtins, sonarjs/no-primitive-wrappers
            expect(deepClone(new String("hi")).valueOf()).toBe("hi");
            // eslint-disable-next-line no-new-wrappers, unicorn/new-for-builtins, sonarjs/no-primitive-wrappers
            expect(deepClone(new Boolean(true)).valueOf()).toBe(true);
        });

        it("should throw for values that cannot be cloned", () => {
            expect.assertions(3);

            expect(() => deepClone(new WeakMap())).toThrow("WeakMap objects cannot be cloned");
            expect(() => deepClone(new WeakSet())).toThrow("WeakSet objects cannot be cloned");
            expect(() => deepClone(Promise.resolve(1))).toThrow("Promise objects cannot be cloned");
        });
    });

    describe("binary types", () => {
        it("should clone an ArrayBuffer into an independent buffer", () => {
            expect.assertions(3);

            const buffer = new ArrayBuffer(4);

            new Uint8Array(buffer).set([1, 2, 3, 4]);

            const cloned = deepClone(buffer);

            expect(cloned).toBeInstanceOf(ArrayBuffer);
            expect(cloned).not.toBe(buffer);
            expect([...new Uint8Array(cloned)]).toStrictEqual([1, 2, 3, 4]);
        });

        it("should clone every typed-array flavour with the right constructor and contents", () => {
            expect.assertions(10);

            const cases = [
                new Int8Array([-1, 2]),
                new Uint8Array([1, 2]),
                new Uint8ClampedArray([1, 300]),
                new Int16Array([-1, 2]),
                new Uint16Array([1, 2]),
                new Int32Array([-1, 2]),
                new Uint32Array([1, 2]),
                new Float32Array([1.5, 2.5]),
                new Float64Array([1.5, 2.5]),
            ];

            for (const source of cases) {
                const cloned = deepClone(source);

                expect({ constructor: cloned.constructor.name, values: [...cloned] }).toStrictEqual({
                    constructor: source.constructor.name,
                    values: [...source],
                });
            }

            expect([...deepClone(new BigInt64Array([1n, -2n]))]).toStrictEqual([1n, -2n]);
        });

        it("should not alias the source buffer when cloning a typed array", () => {
            expect.assertions(2);

            const source = new Uint8Array([1, 2, 3]);
            const cloned = deepClone(source);

            cloned[0] = 9;

            expect(source[0]).toBe(1);
            expect(cloned.buffer).not.toBe(source.buffer);
        });

        it("should preserve byteOffset and length for a typed-array view", () => {
            expect.assertions(2);

            const view = new Uint8Array([0, 1, 2, 3, 4, 5]).subarray(2, 5);
            const cloned = deepClone(view);

            expect([...cloned]).toStrictEqual([2, 3, 4]);
            expect(cloned).toHaveLength(3);
        });

        it("should share one cloned buffer across views of the same ArrayBuffer", () => {
            expect.assertions(2);

            const buffer = new ArrayBuffer(8);
            const source = { a: new Uint8Array(buffer), b: new Uint8Array(buffer) };
            const cloned = deepClone(source);

            expect(cloned.a.buffer).toBe(cloned.b.buffer);

            cloned.a[0] = 7;

            expect(cloned.b[0]).toBe(7);
        });

        it("should clone a DataView preserving offset, length and contents", () => {
            expect.assertions(4);

            const buffer = new ArrayBuffer(8);
            const view = new DataView(buffer, 2, 4);

            view.setUint32(0, 0xde_ad_be_ef);

            const cloned = deepClone(view);

            expect(cloned).toBeInstanceOf(DataView);
            expect(cloned.byteOffset).toBe(2);
            expect(cloned.byteLength).toBe(4);
            expect(cloned.getUint32(0)).toBe(0xde_ad_be_ef);
        });

        it("should clone a Buffer as a Buffer, not a bare Uint8Array", () => {
            expect.assertions(5);

            const buffer = Buffer.from("hello");
            const cloned = deepClone(buffer);

            expect(Buffer.isBuffer(cloned)).toBe(true);
            expect(cloned).toBeInstanceOf(Uint8Array);
            expect(cloned).not.toBe(buffer);
            expect(cloned.toString("utf8")).toBe("hello");
            expect([...cloned]).toStrictEqual([...buffer]);
        });

        it("should clone a Buffer independently of the source", () => {
            expect.assertions(2);

            const buffer = Buffer.from([1, 2, 3]);
            const cloned = deepClone(buffer);

            cloned[0] = 9;

            expect(buffer[0]).toBe(1);
            expect(cloned[0]).toBe(9);
        });

        it("should clone a Buffer nested in an object graph", () => {
            expect.assertions(3);

            const source = { name: "x", payload: Buffer.from("abc") };
            const cloned = deepClone(source);

            expect(Buffer.isBuffer(cloned.payload)).toBe(true);
            expect(cloned.payload.toString("utf8")).toBe("abc");
            expect(cloned.name).toBe("x");
        });

        it("should clone a subarray Buffer preserving only its own bytes", () => {
            expect.assertions(2);

            const buffer = Buffer.from("abcdef").subarray(2, 5);
            const cloned = deepClone(buffer);

            expect(cloned).toHaveLength(3);
            expect(cloned.toString("utf8")).toBe("cde");
        });

        it("should clone an empty Buffer", () => {
            expect.assertions(2);

            const cloned = deepClone(Buffer.alloc(0));

            expect(Buffer.isBuffer(cloned)).toBe(true);
            expect(cloned).toHaveLength(0);
        });
    });

    describe("runtimes missing optional globals", () => {
        afterEach(() => {
            vi.unstubAllGlobals();
        });

        it("should clone typed arrays when SharedArrayBuffer is not exposed", () => {
            expect.assertions(3);

            // Browsers only define SharedArrayBuffer on cross-origin-isolated pages
            // and edge runtimes may drop it, so an unguarded `instanceof` would throw
            // "Right-hand side of 'instanceof' is not an object" for every typed array.
            vi.stubGlobal("SharedArrayBuffer", undefined);

            expect([...deepClone(new Uint8Array([1, 2, 3]))]).toStrictEqual([1, 2, 3]);
            expect([...deepClone(new Float64Array([1.5]))]).toStrictEqual([1.5]);
            expect([...new Uint8Array(deepClone(new Uint8Array([4, 5]).buffer))]).toStrictEqual([4, 5]);
        });

        it("should clone a DataView when SharedArrayBuffer is not exposed", () => {
            expect.assertions(2);

            vi.stubGlobal("SharedArrayBuffer", undefined);

            const view = new DataView(new ArrayBuffer(8), 2, 4);

            view.setUint32(0, 0x01_02_03_04);

            const cloned = deepClone(view);

            expect(cloned.byteLength).toBe(4);
            expect(cloned.getUint32(0)).toBe(0x01_02_03_04);
        });

        it("should clone a typed array when Buffer is not exposed", () => {
            expect.assertions(2);

            vi.stubGlobal("Buffer", undefined);

            const cloned = deepClone(new Uint8Array([1, 2]));

            expect(cloned).toBeInstanceOf(Uint8Array);
            expect([...cloned]).toStrictEqual([1, 2]);
        });

        it("should still reject a real SharedArrayBuffer where the runtime has one", () => {
            expect.assertions(1);

            expect(() => deepClone(new SharedArrayBuffer(8))).toThrow("SharedArrayBuffer objects cannot be cloned");
        });
    });

    describe("web types available in workerd", () => {
        it("should clone a Blob preserving type and contents", async () => {
            expect.assertions(3);

            const blob = new Blob(["hello"], { type: "text/plain" });
            const cloned = deepClone(blob);

            expect(cloned).toBeInstanceOf(Blob);
            expect(cloned.type).toBe("text/plain");
            await expect(cloned.text()).resolves.toBe("hello");
        });

        it("should clone a File preserving its name and lastModified", async () => {
            expect.assertions(3);

            const file = new File(["data"], "a.txt", { lastModified: 1_700_000_000_000, type: "text/plain" });
            const cloned = deepClone(file);

            expect(cloned.name).toBe("a.txt");
            expect(cloned.lastModified).toBe(1_700_000_000_000);
            await expect(cloned.text()).resolves.toBe("data");
        });
    });

    describe("circular references", () => {
        it("should preserve a self-reference", () => {
            expect.assertions(2);

            const source: Record<string, unknown> = { name: "root" };

            source.self = source;

            const cloned = deepClone(source);

            expect(cloned.self).toBe(cloned);
            expect(cloned.self).not.toBe(source);
        });

        it("should preserve mutual references between two nodes", () => {
            expect.assertions(2);

            const a: Record<string, unknown> = {};
            const b: Record<string, unknown> = { a };

            a.b = b;

            const cloned = deepClone(a);

            expect((cloned.b as Record<string, unknown>).a).toBe(cloned);
            expect(cloned.b).not.toBe(b);
        });

        it("should preserve a cycle through a Map, a Set and an array", () => {
            expect.assertions(3);

            const root: Record<string, unknown> = {};

            root.map = new Map([["self", root]]);
            root.set = new Set([root]);
            root.list = [root];

            const cloned = deepClone(root);

            expect((cloned.map as Map<string, unknown>).get("self")).toBe(cloned);
            expect([...(cloned.set as Set<unknown>)][0]).toBe(cloned);
            expect((cloned.list as unknown[])[0]).toBe(cloned);
        });

        it("should collapse duplicate references to a single clone", () => {
            expect.assertions(1);

            const shared = { value: 1 };
            const cloned = deepClone({ a: shared, b: shared });

            expect(cloned.a).toBe(cloned.b);
        });
    });

    describe("class instances", () => {
        it("should preserve the prototype chain and instance fields", () => {
            expect.assertions(4);

            class Person {
                public constructor(
                    public name: string,
                    public tags: string[],
                ) {}

                public greet(): string {
                    return `hi ${this.name}`;
                }
            }

            const person = new Person("ada", ["a"]);
            const cloned = deepClone(person);

            expect(cloned).toBeInstanceOf(Person);
            expect(cloned.name).toBe("ada");
            expect(cloned.greet()).toBe("hi ada");
            expect(cloned.tags).not.toBe(person.tags);
        });

        it("should clone a subclass of Error", () => {
            expect.assertions(3);

            class DomainError extends Error {
                public constructor(
                    message: string,
                    public detail: string,
                ) {
                    super(message);

                    this.name = "DomainError";
                }
            }

            const cloned = deepClone(new DomainError("nope", "d"));

            expect(cloned).toBeInstanceOf(Error);
            expect(cloned.message).toBe("nope");
            expect(cloned.detail).toBe("d");
        });

        it("should clone a null-prototype object without re-parenting it", () => {
            expect.assertions(2);

            const source = Object.assign(Object.create(null) as Record<string, unknown>, { a: 1 });
            const cloned = deepClone(source);

            expect(Object.getPrototypeOf(cloned)).toBeNull();
            expect(cloned.a).toBe(1);
        });

        it("should not re-parent the clone for an own __proto__ data property", () => {
            expect.assertions(2);

            const source = JSON.parse(String.raw`{"__proto__": {"polluted": true}, "safe": 1}`) as Record<string, unknown>;
            const cloned = deepClone(source);

            expect(Object.getPrototypeOf(cloned)).toBe(Object.prototype);
            expect(({} as Record<string, unknown>).polluted).toBeUndefined();
        });
    });

    describe("symbol keys and property descriptors", () => {
        it("should copy enumerable symbol-keyed properties", () => {
            expect.assertions(2);

            const key = Symbol("key");
            const source = { [key]: { deep: 1 }, plain: 2 };
            const cloned = deepClone(source);

            expect(cloned[key]).toStrictEqual({ deep: 1 });
            expect(cloned[key]).not.toBe(source[key]);
        });

        it("should skip non-enumerable properties in loose mode and keep them in strict mode", () => {
            expect.assertions(2);

            const source = { visible: 1 };

            Object.defineProperty(source, "hidden", { configurable: true, enumerable: false, value: 2, writable: true });

            expect(Object.hasOwn(deepClone(source), "hidden")).toBe(false);
            expect(Object.hasOwn(deepClone(source, { strict: true }), "hidden")).toBe(true);
        });

        it("should invoke a getter in loose mode and carry it over in strict mode", () => {
            expect.assertions(4);

            let calls = 0;
            const source = {
                get computed(): number {
                    calls += 1;

                    return 42;
                },
            };

            const loose = deepClone(source);

            expect(loose.computed).toBe(42);
            // eslint-disable-next-line @typescript-eslint/unbound-method, vitest/unbound-method
            expect(Object.getOwnPropertyDescriptor(loose, "computed")?.get).toBeUndefined();

            const strict = deepClone(source, { strict: true });

            // eslint-disable-next-line @typescript-eslint/unbound-method, vitest/unbound-method
            expect(Object.getOwnPropertyDescriptor(strict, "computed")?.get).toBeTypeOf("function");

            expect(calls).toBeGreaterThan(0);
        });

        it("should preserve frozen and sealed state", () => {
            expect.assertions(2);

            expect(Object.isFrozen(deepClone(Object.freeze({ a: 1 })))).toBe(true);
            expect(Object.isSealed(deepClone(Object.seal({ a: 1 })))).toBe(true);
        });

        it("should copy custom properties on arrays only in strict mode", () => {
            expect.assertions(2);

            const source = [1, 2] as number[] & { extra?: string };

            source.extra = "x";

            expect((deepClone(source) as typeof source).extra).toBeUndefined();
            expect((deepClone(source, { strict: true }) as typeof source).extra).toBe("x");
        });
    });

    describe(createDeepClone, () => {
        it("should reuse a resolved configuration across calls", () => {
            expect.assertions(2);

            const clone = createDeepClone({ strict: true });
            const source = { a: 1 };

            Object.defineProperty(source, "hidden", { configurable: true, enumerable: false, value: 2, writable: true });

            expect(Object.hasOwn(clone(source), "hidden")).toBe(true);
            expect(clone({ b: 2 })).toStrictEqual({ b: 2 });
        });

        it("should honour a custom handler", () => {
            expect.assertions(1);

            const clone = createDeepClone({ handler: { Date: () => new Date(0) } });

            expect(clone(new Date("2024-01-01")).getTime()).toBe(0);
        });
    });
});
