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
