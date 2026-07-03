import { describe, expect, it } from "vitest";

import safeAssign from "../../src/utils/safe-assign";

describe("safe-assign", () => {
    it("assigns a regular key as an own enumerable property", () => {
        expect.assertions(2);

        const target: Record<string, unknown> = {};

        safeAssign(target, "foo", "bar");

        expect(target.foo).toBe("bar");
        expect(Object.keys(target)).toStrictEqual(["foo"]);
    });

    it("stores a __proto__ key as an own property without mutating the prototype", () => {
        expect.assertions(4);

        const target: Record<string, unknown> = {};

        safeAssign(target, "__proto__", { polluted: true });

        // The value is stored as an own enumerable property...
        expect(Object.hasOwn(target, "__proto__")).toBe(true);
        expect(Object.getOwnPropertyDescriptor(target, "__proto__")?.value).toStrictEqual({ polluted: true });
        // ...and the prototype chain is untouched (no pollution).
        expect(Object.getPrototypeOf(target)).toBe(Object.prototype);
        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });
});
