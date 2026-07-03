import { Buffer } from "node:buffer";

import { describe, expect, it } from "vitest";

import toUint8Array from "../../../../src/write/utils/to-uint-8-array";

describe(toUint8Array, () => {
    it("should return the same Uint8Array instance untouched", () => {
        expect.assertions(2);

        const input = new Uint8Array([1, 2, 3]);
        const result = toUint8Array(input);

        expect(result).toBe(input);
        expect([...result]).toStrictEqual([1, 2, 3]);
    });

    it("should encode a string using UTF-8", () => {
        expect.assertions(2);

        const result = toUint8Array("hello");

        expect(result).toBeInstanceOf(Uint8Array);
        expect(new TextDecoder().decode(result)).toBe("hello");
    });

    it("should encode an empty string into an empty Uint8Array", () => {
        expect.assertions(2);

        const result = toUint8Array("");

        expect(result).toBeInstanceOf(Uint8Array);
        expect(result.byteLength).toBe(0);
    });

    it("should encode multi-byte UTF-8 characters correctly", () => {
        expect.assertions(2);

        const result = toUint8Array("✓ é 漢");

        expect(result.byteLength).toBeGreaterThan(5);
        expect(new TextDecoder().decode(result)).toBe("✓ é 漢");
    });

    it("should wrap an ArrayBuffer in a Uint8Array", () => {
        expect.assertions(2);

        const buffer = new ArrayBuffer(4);
        const view = new Uint8Array(buffer);

        view.set([10, 20, 30, 40]);

        const result = toUint8Array(buffer);

        expect(result).toBeInstanceOf(Uint8Array);
        expect([...result]).toStrictEqual([10, 20, 30, 40]);
    });

    it("should copy data from an ArrayBufferView with non-zero byteOffset", () => {
        expect.assertions(2);

        const buffer = new ArrayBuffer(8);
        const view = new Uint8Array(buffer);

        view.set([0, 0, 1, 2, 3, 4, 0, 0]);

        // Slice in the middle: offset 2, length 4
        const slice = new Uint8Array(buffer, 2, 4);
        const result = toUint8Array(slice);

        expect(result).toBeInstanceOf(Uint8Array);
        expect([...result]).toStrictEqual([1, 2, 3, 4]);
    });

    it("should convert a Node Buffer (Uint8Array subclass)", () => {
        expect.assertions(2);

        const buffer = Buffer.from("abc", "utf8");
        const result = toUint8Array(buffer);

        // Buffer is a Uint8Array so it returns the same instance
        expect(result).toBe(buffer);
        expect(new TextDecoder().decode(result)).toBe("abc");
    });

    it("should convert an Int16Array (TypedArray view)", () => {
        expect.assertions(2);

        const source = new Int16Array([0x01_02, 0x03_04]);
        const result = toUint8Array(source);

        expect(result).toBeInstanceOf(Uint8Array);
        expect(result.byteLength).toBe(4);
    });

    it("should convert a DataView", () => {
        expect.assertions(2);

        const buffer = new ArrayBuffer(4);
        const view = new DataView(buffer);

        view.setUint8(0, 1);
        view.setUint8(1, 2);
        view.setUint8(2, 3);
        view.setUint8(3, 4);

        const result = toUint8Array(view);

        expect(result).toBeInstanceOf(Uint8Array);
        expect([...result]).toStrictEqual([1, 2, 3, 4]);
    });

    it("should throw a TypeError for unsupported input types", () => {
        expect.assertions(4);

        expect(() => toUint8Array(123)).toThrow(TypeError);
        expect(() => toUint8Array(null)).toThrow("Invalid contents type. Expected string or ArrayBuffer.");
        expect(() => toUint8Array(undefined)).toThrow(TypeError);
        expect(() => toUint8Array({ foo: "bar" })).toThrow(TypeError);
    });
});
