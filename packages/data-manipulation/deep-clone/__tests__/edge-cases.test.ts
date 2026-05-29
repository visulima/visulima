import { describe, expect, it } from "vitest";

import { deepClone } from "../src";

describe("deepClone edge cases", () => {
    it("clones a frozen object and reapplies the frozen/sealed/non-extensible state", () => {
        expect.assertions(4);

        const original = Object.freeze({});
        const cloned = deepClone(original);

        expect(cloned).not.toBe(original);
        expect(Object.isFrozen(cloned)).toBe(true);
        expect(Object.isSealed(cloned)).toBe(true);
        expect(Object.isExtensible(cloned)).toBe(false);
    });

    it("clones enumerable symbol-keyed properties", () => {
        expect.assertions(2);

        const symbol = Symbol("s");
        const original: Record<symbol, number> = { [symbol]: 42 };
        const cloned = deepClone(original);

        expect(cloned).not.toBe(original);
        expect(cloned[symbol]).toBe(42);
    });

    it("clones an error whose stack is absent without failing", () => {
        expect.assertions(3);

        const original = new Error("boom");

        original.stack = undefined;

        const cloned = deepClone(original);

        expect(cloned).toBeInstanceOf(Error);
        expect(cloned.message).toBe("boom");
        expect(cloned).not.toBe(original);
    });

    it("clones a top-level ArrayBuffer", () => {
        expect.assertions(3);

        const original = new ArrayBuffer(8);
        const view = new Uint8Array(original);

        view.set([1, 2, 3, 4, 5, 6, 7, 8]);

        const cloned = deepClone(original);

        expect(cloned).toBeInstanceOf(ArrayBuffer);
        expect(cloned).not.toBe(original);
        expect([...new Uint8Array(cloned as ArrayBuffer)]).toStrictEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    });

    it("throws when cloning a typed array backed by a SharedArrayBuffer", () => {
        expect.assertions(1);

        const view = new Uint8Array(new SharedArrayBuffer(8));

        expect(() => deepClone(view)).toThrow(TypeError);
    });

    it("throws when cloning a DataView backed by a SharedArrayBuffer", () => {
        expect.assertions(1);

        const view = new DataView(new SharedArrayBuffer(8));

        expect(() => deepClone(view)).toThrow(TypeError);
    });
});
