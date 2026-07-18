import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

import type { DeepReadwrite } from "../src";
import { createDeepClone, deepClone } from "../src";

describe("prototype pollution safety", () => {
    it("does not re-parent the clone prototype when cloning JSON with an own __proto__ key", () => {
        expect.assertions(4);

        // JSON.parse produces an own enumerable `__proto__` data property.
        const malicious = JSON.parse("{\"__proto__\":{\"isAdmin\":true}}") as Record<string, unknown>;

        const cloned = deepClone(malicious) as Record<string, unknown>;

        // The clone must keep the default Object prototype, not the attacker payload.
        expect(Object.getPrototypeOf(cloned)).toBe(Object.prototype);
        // The global prototype must remain untouched.
        expect(({} as Record<string, unknown>).isAdmin).toBeUndefined();
        // The `__proto__` key is preserved as an own data property (faithful clone).
        expect(Object.hasOwn(cloned, "__proto__")).toBe(true);
        expect(Object.getOwnPropertyDescriptor(cloned, "__proto__")?.value).toStrictEqual({ isAdmin: true });
    });

    it("deep-clones the nested value carried by an own __proto__ key", () => {
        expect.assertions(2);

        const nested = { isAdmin: true };
        const malicious = JSON.parse("{\"a\":1}") as Record<string, unknown>;

        Object.defineProperty(malicious, "__proto__", { configurable: true, enumerable: true, value: nested, writable: true });

        const cloned = deepClone(malicious) as Record<string, unknown>;
        const clonedProto = Object.getOwnPropertyDescriptor(cloned, "__proto__")?.value as { isAdmin: boolean };

        expect(clonedProto).toStrictEqual(nested);
        expect(clonedProto).not.toBe(nested);
    });
});

describe("partial custom handlers", () => {
    it("accepts a single custom handler without requiring all keys", () => {
        expect.assertions(1);

        const cloned = deepClone(
            { when: new Date(0) },
            {
                handler: {
                    Date: (date) => new Date(date.getTime() + 1000),
                },
            },
        );

        expect((cloned.when as Date).getTime()).toBe(1000);
    });
});

describe("createDeepClone() factory", () => {
    it("produces independent deep clones with the configured options", () => {
        expect.assertions(3);

        const cloner = createDeepClone();
        const original = { a: { b: 1 } };
        const cloned = cloner(original);

        expect(cloned).toStrictEqual(original);
        expect(cloned).not.toBe(original);
        expect(cloned.a).not.toBe(original.a);
    });

    it("honors strict mode", () => {
        expect.assertions(1);

        const cloner = createDeepClone({ strict: true });
        const original: Record<string, unknown> = {};

        Object.defineProperty(original, "hidden", { enumerable: false, value: 5 });

        const cloned = cloner(original);

        expect(Object.getOwnPropertyDescriptor(cloned, "hidden")?.value).toBe(5);
    });
});

describe("map key cloning", () => {
    it("shares object keys in loose mode (default)", () => {
        expect.assertions(1);

        const key = { id: 1 };
        const original = new Map([[key, "v"]]);
        const cloned = deepClone(original) as Map<{ id: number }, string>;

        expect([...cloned.keys()][0]).toBe(key);
    });

    it("deep-clones object keys in strict mode", () => {
        expect.assertions(3);

        const key = { id: 1 };
        const original = new Map([[key, "v"]]);
        const cloned = deepClone(original, { strict: true }) as Map<{ id: number }, string>;
        const clonedKey = [...cloned.keys()][0] as { id: number };

        expect(clonedKey).not.toBe(key);
        expect(clonedKey).toStrictEqual(key);
        expect(cloned.get(clonedKey)).toBe("v");
    });
});

describe("exported DeepReadwrite type", () => {
    it("strips readonly modifiers and is part of the public API", () => {
        expect.assertions(1);

        const original = { a: 1, nested: { b: 2 } } as const;
        // `DeepReadwrite` is exported, so consumers can name the return type and it
        // is deeply writable.
        const writable: DeepReadwrite<typeof original> = deepClone(original);

        writable.a = 5;
        writable.nested.b = 6;

        expect(writable).toStrictEqual({ a: 5, nested: { b: 6 } });
    });
});

describe("leaf reference identity", () => {
    it("collapses duplicate Date references to a single clone", () => {
        expect.assertions(3);

        const date = new Date(123);
        const original = { a: date, b: date };
        const cloned = deepClone(original);

        expect(cloned.a).not.toBe(date);
        expect(cloned.a).toBe(cloned.b);
        expect(cloned.a.getTime()).toBe(123);
    });

    it("collapses duplicate ArrayBuffer references to a single clone", () => {
        expect.assertions(1);

        const buffer = new ArrayBuffer(4);
        const original = { a: buffer, b: buffer };
        const cloned = deepClone(original);

        expect(cloned.a).toBe(cloned.b);
    });
});

describe("null-prototype and non-function constructor objects", () => {
    it("clones a null-prototype object with nested values", () => {
        expect.assertions(5);

        const original: Record<string, unknown> = Object.create(null);

        original.a = 1;
        original.nested = { b: 2 };

        const cloned = deepClone(original) as Record<string, unknown>;

        expect(cloned).not.toBe(original);
        expect(Object.getPrototypeOf(cloned)).toBeNull();
        expect(cloned.a).toBe(1);
        expect(cloned.nested).toStrictEqual({ b: 2 });
        expect(cloned.nested).not.toBe(original.nested);
    });

    it("clones an object carrying an own non-function `constructor` property", () => {
        expect.assertions(3);

        const original = { constructor: "x", value: 1 };
        const cloned = deepClone(original);

        expect(cloned).not.toBe(original);
        expect(cloned.constructor).toBe("x");
        expect(cloned.value).toBe(1);
    });
});

describe("boxed primitives", () => {
    it("preserves the value of Number/String/Boolean wrappers", () => {
        expect.assertions(6);

        // eslint-disable-next-line no-new-wrappers, unicorn/new-for-builtins
        const number_ = deepClone(new Number(5)) as Number;
        // eslint-disable-next-line no-new-wrappers, unicorn/new-for-builtins
        const string_ = deepClone(new String("abc")) as String;
        // eslint-disable-next-line no-new-wrappers, unicorn/new-for-builtins
        const boolean_ = deepClone(new Boolean(true)) as Boolean;

        expect(number_).toBeInstanceOf(Number);
        expect(number_.valueOf()).toBe(5);
        expect(string_).toBeInstanceOf(String);
        expect(string_.valueOf()).toBe("abc");
        expect(boolean_).toBeInstanceOf(Boolean);
        expect(boolean_.valueOf()).toBe(true);
    });

    it("preserves the value of BigInt wrappers", () => {
        expect.assertions(2);

        const cloned = deepClone(Object(10n)) as BigInt;

        expect(cloned).toBeInstanceOf(BigInt);
        expect(cloned.valueOf()).toBe(10n);
    });
});

describe("shared underlying buffers", () => {
    it("shares a single cloned buffer across two typed-array views", () => {
        expect.assertions(2);

        const buffer = new ArrayBuffer(8);
        const a = new Uint8Array(buffer, 0, 4);
        const b = new Uint8Array(buffer, 4, 4);
        const cloned = deepClone({ a, b });

        expect(cloned.a.buffer).toBe(cloned.b.buffer);
        expect(cloned.a.buffer).not.toBe(buffer);
    });

    it("shares the cloned buffer between a typed-array view and the raw buffer", () => {
        expect.assertions(2);

        const buffer = new ArrayBuffer(8);
        const view = new Uint8Array(buffer);
        const cloned = deepClone({ raw: buffer, view });

        expect(cloned.view.buffer).toBe(cloned.raw);
        expect(cloned.raw).not.toBe(buffer);
    });

    it("shares a single cloned buffer across two DataViews", () => {
        expect.assertions(1);

        const buffer = new ArrayBuffer(8);
        const a = new DataView(buffer, 0, 4);
        const b = new DataView(buffer, 4, 4);
        const cloned = deepClone({ a, b });

        expect(cloned.a.buffer).toBe(cloned.b.buffer);
    });
});

describe("Node Buffer cloning", () => {
    it("clones a Buffer into a real Buffer without the deprecated constructor", () => {
        expect.assertions(3);

        const original = Buffer.from("hello");
        const cloned = deepClone(original);

        expect(Buffer.isBuffer(cloned)).toBe(true);
        expect(cloned).not.toBe(original);
        expect(cloned.toString()).toBe("hello");
    });
});

describe("DOM node reference identity", () => {
    it("collapses duplicate DOM-node references to a single clone", () => {
        expect.assertions(2);

        const node = new JSDOM(`<p>Hello world</p>`).window.document.querySelector("p");
        const original = { a: node, b: node };
        const cloned = deepClone(original);

        expect(cloned.a).toBe(cloned.b);
        expect(cloned.a).not.toBe(node);
    });
});

describe("cloned error fields", () => {
    it("preserves stack, code, errno and syscall (including falsy values)", () => {
        expect.assertions(4);

        const original = new Error("boom") as Error & { code?: unknown; errno?: unknown; syscall?: unknown };

        original.code = "EPIPE";
        original.errno = 0;
        original.syscall = "write";

        const cloned = deepClone(original) as typeof original;

        expect(cloned.stack).toBe(original.stack);
        expect(cloned.code).toBe("EPIPE");
        expect(cloned.errno).toBe(0);
        expect(cloned.syscall).toBe("write");
    });
});
