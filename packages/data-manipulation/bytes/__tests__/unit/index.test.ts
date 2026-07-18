import { Buffer } from "node:buffer";
import { runInNewContext } from "node:vm";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
    asciiToUint8Array,
    base64ToUint8Array,
    bufferToUint8Array,
    hexToUint8Array,
    isUint8Array,
    toUint8Array,
    Uint8ArrayIncompatibleError,
    uint8ArrayToAscii,
    uint8ArrayToBase64,
    uint8ArrayToHex,
    uint8ArrayToUtf8,
    utf8ToUint8Array,
} from "../../src/index";

/**
 * Build an array-like object that satisfies `TemplateStringsArray` but is NOT a
 * real `Array`. This forces the `String.raw(txt)` branch in the helpers, which
 * is otherwise skipped because native tagged-template arrays pass `Array.isArray`.
 * @param cooked The cooked string segments.
 * @param raw The raw string segments (defaults to the cooked segments).
 * @returns A `TemplateStringsArray`-shaped object that is not an `Array`.
 */
const buildNonArrayTemplate = (cooked: string[], raw: string[] = cooked): TemplateStringsArray => {
    const strings: Record<number | string, unknown> = { length: cooked.length, raw };

    cooked.forEach((value, index) => {
        strings[index] = value;
    });

    return strings as unknown as TemplateStringsArray;
};

describe("@visulima/bytes", () => {
    describe(bufferToUint8Array, () => {
        it("should convert a Buffer to a Uint8Array", () => {
            expect.assertions(3);

            const buf = Buffer.from("hello");
            const u8 = bufferToUint8Array(buf);

            expect(u8).toBeInstanceOf(Uint8Array);
            expect(u8).toHaveLength(buf.length);
            expect(u8).toStrictEqual(new Uint8Array([104, 101, 108, 108, 111]));
        });

        it("should handle an empty Buffer", () => {
            expect.assertions(3);

            const buf = Buffer.from("");
            const u8 = bufferToUint8Array(buf);

            expect(u8).toBeInstanceOf(Uint8Array);
            expect(u8).toHaveLength(0);
            expect(u8).toStrictEqual(new Uint8Array([]));
        });

        it("should respect Buffer byteOffset and length", () => {
            expect.assertions(5);

            const originalBuffer = Buffer.from([1, 2, 3, 4, 5]);
            const subBuffer = originalBuffer.subarray(1, 4);
            const u8 = bufferToUint8Array(subBuffer);

            expect(u8).toBeInstanceOf(Uint8Array);
            expect(u8).toHaveLength(3);
            expect(u8).toStrictEqual(new Uint8Array([2, 3, 4]));
            expect(u8.buffer).toBe(subBuffer.buffer);
            expect(u8.byteOffset).toBe(subBuffer.byteOffset);
        });
    });

    describe(isUint8Array, () => {
        it("should return true for Uint8Array", () => {
            expect.assertions(1);

            expect(isUint8Array(new Uint8Array())).toBe(true);
        });

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition,sonarjs/different-types-comparison
        it.skipIf(Buffer === undefined)("should return true for Buffer (in Node.js like env)", () => {
            expect.assertions(1);

            expect(isUint8Array(Buffer.from("test"))).toBe(true);
        });

        it("should return false for ArrayBuffer", () => {
            expect.assertions(1);

            expect(isUint8Array(new ArrayBuffer(0))).toBe(false);
        });

        it("should return false for plain arrays", () => {
            expect.assertions(1);

            expect(isUint8Array([1, 2])).toBe(false);
        });

        it("should return false for strings", () => {
            expect.assertions(1);

            expect(isUint8Array("test")).toBe(false);
        });

        it("should return false for numbers", () => {
            expect.assertions(1);

            expect(isUint8Array(123)).toBe(false);
        });

        it("should return false for undefined values", () => {
            expect.assertions(1);

            expect(isUint8Array(undefined)).toBe(false);
        });
    });

    describe(asciiToUint8Array, () => {
        it("should convert an ASCII string to Uint8Array", () => {
            expect.assertions(1);

            expect(asciiToUint8Array("Hello!")).toStrictEqual(new Uint8Array([72, 101, 108, 108, 111, 33]));
        });

        it("should handle empty string", () => {
            expect.assertions(1);

            expect(asciiToUint8Array("")).toStrictEqual(new Uint8Array([]));
        });

        it("should truncate non-ASCII characters (keep lower byte)", () => {
            expect.assertions(1);

            const charNi = "你".codePointAt(0) as number;
            const charHao = "好".codePointAt(0) as number;
            const charEuro = "€".codePointAt(0) as number;
            // eslint-disable-next-line no-bitwise
            const expectedRobust = new Uint8Array([charNi & 0xff, charHao & 0xff, charEuro & 0xff]);

            expect(asciiToUint8Array("你好€")).toStrictEqual(expectedRobust);
        });

        it("should handle template literals", () => {
            expect.assertions(1);

            const world = "World";

            expect(asciiToUint8Array(`Hello ${world}!`)).toStrictEqual(new Uint8Array([72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33]));
        });

        it("should support native tagged-template usage", () => {
            expect.assertions(1);

            expect(asciiToUint8Array`Hi!`).toStrictEqual(new Uint8Array([72, 105, 33]));
        });

        it("should resolve a non-Array TemplateStringsArray via String.raw", () => {
            expect.assertions(1);

            expect(asciiToUint8Array(buildNonArrayTemplate(["Hi!"]))).toStrictEqual(new Uint8Array([72, 105, 33]));
        });
    });

    describe(utf8ToUint8Array, () => {
        it("should convert a UTF-8 string to Uint8Array", () => {
            expect.assertions(2);

            expect(utf8ToUint8Array("Hello!")).toStrictEqual(new Uint8Array([72, 101, 108, 108, 111, 33]));
            expect(utf8ToUint8Array("你好€")).toStrictEqual(new Uint8Array([228, 189, 160, 229, 165, 189, 226, 130, 172]));
        });

        it("should handle empty string", () => {
            expect.assertions(1);

            expect(utf8ToUint8Array("")).toStrictEqual(new Uint8Array([]));
        });

        it("should handle template literals", () => {
            expect.assertions(1);

            const item = "你好";

            expect(utf8ToUint8Array(`Item: ${item}`)).toStrictEqual(new Uint8Array([73, 116, 101, 109, 58, 32, 228, 189, 160, 229, 165, 189]));
        });

        it("should support native tagged-template usage", () => {
            expect.assertions(1);

            expect(utf8ToUint8Array`Hi!`).toStrictEqual(new Uint8Array([72, 105, 33]));
        });

        it("should resolve a non-Array TemplateStringsArray via String.raw", () => {
            expect.assertions(1);

            expect(utf8ToUint8Array(buildNonArrayTemplate(["你好"]))).toStrictEqual(new Uint8Array([228, 189, 160, 229, 165, 189]));
        });
    });

    describe(toUint8Array, () => {
        it("should return Uint8Array as is", () => {
            expect.assertions(1);

            const u8 = new Uint8Array([1, 2]);

            expect(toUint8Array(u8)).toBe(u8);
        });

        it("should convert ArrayBuffer", () => {
            expect.assertions(1);

            const ab = new Uint8Array([1, 2, 3]).buffer;

            expect(toUint8Array(ab)).toStrictEqual(new Uint8Array([1, 2, 3]));
        });

        it("should convert array of numbers", () => {
            expect.assertions(1);

            expect(toUint8Array([1, 2, 3])).toStrictEqual(new Uint8Array([1, 2, 3]));
        });

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition,sonarjs/different-types-comparison
        it.skipIf(Buffer === undefined)("should convert Buffer (Node.js like env)", () => {
            expect.assertions(3);

            const buf = Buffer.from("node");
            const u8 = toUint8Array(buf);

            expect(u8).toStrictEqual(new Uint8Array([110, 111, 100, 101]));
            expect(u8.buffer).toBe(buf.buffer);
            expect(u8.byteOffset).toBe(buf.byteOffset);
        });

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition,sonarjs/different-types-comparison
        it.skipIf(Buffer === undefined)("should convert string (via Buffer.from in Node.js like env)", () => {
            expect.assertions(1);

            expect(toUint8Array("string")).toStrictEqual(new Uint8Array([115, 116, 114, 105, 110, 103]));
        });

        it("should throw error for incompatible types if Buffer is not available", () => {
            expect.assertions(2);

            const originalBuffer = globalThis.Buffer;
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition,sonarjs/different-types-comparison
            const bufferExisted = globalThis.Buffer !== undefined;

            // eslint-disable-next-line vitest/no-conditional-in-test
            if (bufferExisted) {
                // @ts-expect-error Simulate Buffer not being available only if it exists
                globalThis.Buffer = undefined as unknown;
            }

            try {
                expect(() => toUint8Array({ das: "dsa" })).toThrow("UINT8ARRAY_INCOMPATIBLE: Cannot convert data to Uint8Array");
                expect(() => toUint8Array(123)).toThrow("UINT8ARRAY_INCOMPATIBLE: Cannot convert data to Uint8Array");
            } finally {
                if (bufferExisted) {
                    globalThis.Buffer = originalBuffer; // Restore Buffer only if it existed and was modified
                }
            }
        });

        it("should throw error for plain numbers", () => {
            expect.assertions(1);

            expect(() => toUint8Array(123)).toThrow("UINT8ARRAY_INCOMPATIBLE: Cannot convert data to Uint8Array");
        });

        it("should throw error for booleans", () => {
            expect.assertions(1);

            expect(() => toUint8Array(true)).toThrow("UINT8ARRAY_INCOMPATIBLE: Cannot convert data to Uint8Array");
        });

        it("should throw for array of non-numbers", () => {
            expect.assertions(1);

            expect(() => toUint8Array([1, "b", 3])).toThrow("UINT8ARRAY_INCOMPATIBLE: Cannot convert data to Uint8Array");
        });

        it("should throw for undefined values", () => {
            expect.assertions(1);

            expect(() => toUint8Array(undefined)).toThrow("UINT8ARRAY_INCOMPATIBLE: Cannot convert data to Uint8Array");
        });
    });

    describe("isUint8Array cross-realm", () => {
        it("should recognise a genuine Uint8Array from another realm", () => {
            expect.assertions(2);

            // A real typed array built in a separate vm realm fails `instanceof`
            // Uint8Array but is still a genuine `ArrayBuffer` view.
            const crossRealm = runInNewContext("new Uint8Array([1, 2, 3])") as Uint8Array;

            expect(crossRealm instanceof Uint8Array).toBe(false);
            expect(isUint8Array(crossRealm)).toBe(true);
        });

        it("should not match a plain object with a spoofed toStringTag", () => {
            expect.assertions(2);

            // A forged `Symbol.toStringTag` must not pass the guard: it is not a
            // genuine `ArrayBuffer` view, so `ArrayBuffer.isView` rejects it.
            const spoof = Object.create(null) as Record<PropertyKey, unknown>;

            Object.defineProperty(spoof, Symbol.toStringTag, { value: "Uint8Array" });

            expect(spoof instanceof Uint8Array).toBe(false);
            expect(isUint8Array(spoof)).toBe(false);
        });

        it("should not match plain objects", () => {
            expect.assertions(1);

            expect(isUint8Array({})).toBe(false);
        });

        it("should not match a DataView", () => {
            expect.assertions(1);

            expect(isUint8Array(new DataView(new ArrayBuffer(4)))).toBe(false);
        });
    });

    describe("toUint8Array error contract", () => {
        it("should throw Uint8ArrayIncompatibleError with a code property", () => {
            expect.assertions(4);

            let caught: unknown;

            try {
                toUint8Array(123);
            } catch (error) {
                caught = error;
            }

            expect(caught).toBeInstanceOf(Uint8ArrayIncompatibleError);
            expect((caught as Uint8ArrayIncompatibleError).code).toBe("UINT8ARRAY_INCOMPATIBLE");
            expect((caught as Error).message).toContain("UINT8ARRAY_INCOMPATIBLE: Cannot convert data to Uint8Array");
            expect((caught as Error).message).toContain("number");
        });

        it("should report the rejected value type for null", () => {
            expect.assertions(1);

            // eslint-disable-next-line unicorn/no-null
            const nullValue = null;

            expect(() => toUint8Array(nullValue)).toThrow("received: null");
        });
    });

    describe("toUint8Array copy option", () => {
        it("should return the same reference without copy", () => {
            expect.assertions(1);

            const u8 = new Uint8Array([1, 2, 3]);

            expect(toUint8Array(u8)).toBe(u8);
        });

        it("should return a distinct copy with { copy: true }", () => {
            expect.assertions(2);

            const u8 = new Uint8Array([1, 2, 3]);
            const result = toUint8Array(u8, { copy: true });

            expect(result).not.toBe(u8);
            expect(result).toStrictEqual(u8);
        });

        it("should copy ArrayBuffer-backed data with { copy: true }", () => {
            expect.assertions(1);

            const ab = new Uint8Array([1, 2, 3]).buffer;
            const result = toUint8Array(ab, { copy: true });

            expect(result.buffer).not.toBe(ab);
        });
    });

    describe("toUint8Array cross-realm", () => {
        it("should convert a Uint8Array from another realm", () => {
            expect.assertions(3);

            const crossRealm = runInNewContext("new Uint8Array([1, 2, 3])") as Uint8Array;
            const result = toUint8Array(crossRealm);

            expect(result).toBeInstanceOf(Uint8Array);
            expect(result instanceof Uint8Array).toBe(true);
            expect(result).toStrictEqual(new Uint8Array([1, 2, 3]));
        });

        it("should agree with isUint8Array for a cross-realm Uint8Array", () => {
            expect.assertions(2);

            const crossRealm = runInNewContext("new Uint8Array([9, 8, 7])") as Uint8Array;

            expect(isUint8Array(crossRealm)).toBe(true);
            expect(() => toUint8Array(crossRealm)).not.toThrow();
        });

        it("should copy a cross-realm Uint8Array with { copy: true }", () => {
            expect.assertions(2);

            const crossRealm = runInNewContext("new Uint8Array([4, 5, 6])") as Uint8Array;
            const result = toUint8Array(crossRealm, { copy: true });

            expect(result).toStrictEqual(new Uint8Array([4, 5, 6]));
            expect(result.buffer).not.toBe(crossRealm.buffer);
        });

        it("should convert an ArrayBuffer from another realm", () => {
            expect.assertions(2);

            const crossRealm = runInNewContext("new Uint8Array([1, 2, 3]).buffer") as ArrayBuffer;
            const result = toUint8Array(crossRealm);

            expect(result).toBeInstanceOf(Uint8Array);
            expect(result).toStrictEqual(new Uint8Array([1, 2, 3]));
        });
    });

    describe(uint8ArrayToUtf8, () => {
        it("should decode UTF-8 bytes", () => {
            expect.assertions(1);

            expect(uint8ArrayToUtf8(new Uint8Array([228, 189, 160, 229, 165, 189]))).toBe("你好");
        });

        it("should round-trip with utf8ToUint8Array", () => {
            expect.assertions(1);

            const text = "Hello 🌍 你好 €";

            expect(uint8ArrayToUtf8(utf8ToUint8Array(text))).toBe(text);
        });

        it("should accept an ArrayBuffer", () => {
            expect.assertions(1);

            expect(uint8ArrayToUtf8(new Uint8Array([72, 105]).buffer)).toBe("Hi");
        });
    });

    describe(uint8ArrayToAscii, () => {
        it("should decode latin1 bytes", () => {
            expect.assertions(1);

            expect(uint8ArrayToAscii(new Uint8Array([72, 105, 33]))).toBe("Hi!");
        });

        it("should round-trip with asciiToUint8Array for latin1 input", () => {
            expect.assertions(1);

            expect(uint8ArrayToAscii(asciiToUint8Array("Hello!"))).toBe("Hello!");
        });
    });

    describe("hex codecs", () => {
        it("should encode bytes to lowercase hex", () => {
            expect.assertions(1);

            expect(uint8ArrayToHex(new Uint8Array([0, 15, 255, 171]))).toBe("000fffab");
        });

        it("should decode hex (both cases) to bytes", () => {
            expect.assertions(2);

            expect(hexToUint8Array("0fff")).toStrictEqual(new Uint8Array([15, 255]));
            expect(hexToUint8Array("0FFF")).toStrictEqual(new Uint8Array([15, 255]));
        });

        it("should round-trip", () => {
            expect.assertions(1);

            const bytes = new Uint8Array([0, 1, 2, 200, 255]);

            expect(hexToUint8Array(uint8ArrayToHex(bytes))).toStrictEqual(bytes);
        });

        it("should throw on odd-length input", () => {
            expect.assertions(1);

            expect(() => hexToUint8Array("abc")).toThrow("even length");
        });

        it("should throw on non-hex characters", () => {
            expect.assertions(1);

            expect(() => hexToUint8Array("zz")).toThrow("non-hex character");
        });

        it("should throw on non-hex characters mixed with valid pairs", () => {
            expect.assertions(1);

            expect(() => hexToUint8Array("00zz")).toThrow("non-hex character");
        });

        it("should encode a subarray view correctly", () => {
            expect.assertions(1);

            const view = new Uint8Array([255, 0, 15, 255]).subarray(1, 3);

            expect(uint8ArrayToHex(view)).toBe("000f");
        });

        it("should encode an empty array to an empty string", () => {
            expect.assertions(1);

            expect(uint8ArrayToHex(new Uint8Array([]))).toBe("");
        });
    });

    describe("base64 codecs", () => {
        it("should encode bytes to base64", () => {
            expect.assertions(1);

            expect(uint8ArrayToBase64(new Uint8Array([104, 105]))).toBe("aGk=");
        });

        it("should decode base64 to bytes", () => {
            expect.assertions(1);

            expect(base64ToUint8Array("aGk=")).toStrictEqual(new Uint8Array([104, 105]));
        });

        it("should round-trip arbitrary bytes", () => {
            expect.assertions(1);

            const bytes = new Uint8Array([0, 1, 250, 255, 128, 64]);

            expect(base64ToUint8Array(uint8ArrayToBase64(bytes))).toStrictEqual(bytes);
        });

        it("should encode a subarray view correctly", () => {
            expect.assertions(1);

            const view = new Uint8Array([0, 104, 105, 0]).subarray(1, 3);

            expect(uint8ArrayToBase64(view)).toBe("aGk=");
        });

        it("should throw on non-alphabet characters", () => {
            expect.assertions(2);

            expect(() => base64ToUint8Array("a!b=")).toThrow(TypeError);
            expect(() => base64ToUint8Array("a!b=")).toThrow("Invalid base64 string");
        });

        it("should throw on invalid padding", () => {
            expect.assertions(1);

            // A single leftover base64 digit encodes no bytes and is invalid.
            expect(() => base64ToUint8Array("aGk=A")).toThrow("Invalid base64 string");
        });

        it("should ignore ASCII whitespace", () => {
            expect.assertions(1);

            expect(base64ToUint8Array("aG\n k=")).toStrictEqual(new Uint8Array([104, 105]));
        });

        it("should accept unpadded input", () => {
            expect.assertions(1);

            expect(base64ToUint8Array("aGk")).toStrictEqual(new Uint8Array([104, 105]));
        });
    });

    describe("@std/bytes re-export smoke", () => {
        it("should re-export concat, equals and indexOfNeedle", async () => {
            expect.assertions(3);

            const module = await import("../../src/index");

            // `concat` here is the @std/bytes slice-concat (takes an array of
            // Uint8Arrays), not Array.prototype.concat.
            // eslint-disable-next-line unicorn/prefer-spread
            expect(module.concat([new Uint8Array([1]), new Uint8Array([2, 3])])).toStrictEqual(new Uint8Array([1, 2, 3]));
            expect(module.equals(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).toBe(true);
            expect(module.indexOfNeedle(new Uint8Array([0, 1, 2, 3]), new Uint8Array([2, 3]))).toBe(2);
        });
    });

    describe("browser environment (no Buffer)", () => {
        // The module branches on `typeof Buffer === "function"` at evaluation
        // time, so to exercise the browser/edge code paths we delete the global
        // `Buffer` and re-import a fresh module copy.
        const importWithoutBuffer = async () => {
            const originalBuffer = globalThis.Buffer;

            // @ts-expect-error simulate a runtime without Buffer
            delete globalThis.Buffer;

            vi.resetModules();

            try {
                return await import("../../src/index");
            } finally {
                globalThis.Buffer = originalBuffer;
            }
        };

        afterEach(() => {
            vi.resetModules();
        });

        it("isUint8Array uses the non-Buffer code path", async () => {
            expect.assertions(3);

            const bytesModule = await importWithoutBuffer();

            expect(bytesModule.isUint8Array(new Uint8Array([1]))).toBe(true);
            expect(bytesModule.isUint8Array([1, 2])).toBe(false);
            expect(bytesModule.isUint8Array("text")).toBe(false);
        });

        it("toUint8Array still converts Uint8Array, ArrayBuffer and number arrays", async () => {
            expect.assertions(3);

            const bytesModule = await importWithoutBuffer();
            const u8 = new Uint8Array([9]);

            expect(bytesModule.toUint8Array(u8)).toBe(u8);
            expect(bytesModule.toUint8Array(new Uint8Array([1, 2, 3]).buffer)).toStrictEqual(new Uint8Array([1, 2, 3]));
            expect(bytesModule.toUint8Array([4, 5])).toStrictEqual(new Uint8Array([4, 5]));
        });

        it("utf8ToUint8Array works via TextEncoder without Buffer", async () => {
            expect.assertions(2);

            const bytesModule = await importWithoutBuffer();

            expect(bytesModule.utf8ToUint8Array("Hi!")).toStrictEqual(new Uint8Array([72, 105, 33]));
            expect(bytesModule.utf8ToUint8Array("你好")).toStrictEqual(new Uint8Array([228, 189, 160, 229, 165, 189]));
        });

        it("asciiToUint8Array works via the manual loop without Buffer", async () => {
            expect.assertions(1);

            const bytesModule = await importWithoutBuffer();

            expect(bytesModule.asciiToUint8Array("Hi!")).toStrictEqual(new Uint8Array([72, 105, 33]));
        });

        it("toUint8Array converts strings via TextEncoder when Buffer is unavailable", async () => {
            expect.assertions(2);

            const bytesModule = await importWithoutBuffer();

            expect(bytesModule.toUint8Array("string")).toStrictEqual(new Uint8Array([115, 116, 114, 105, 110, 103]));
            expect(() => bytesModule.toUint8Array(123)).toThrow("UINT8ARRAY_INCOMPATIBLE");
        });

        it("hex and base64 codecs work without Buffer", async () => {
            expect.assertions(4);

            const bytesModule = await importWithoutBuffer();
            const bytes = new Uint8Array([104, 105]);

            expect(bytesModule.uint8ArrayToHex(bytes)).toBe("6869");
            expect(bytesModule.hexToUint8Array("6869")).toStrictEqual(bytes);
            expect(bytesModule.uint8ArrayToBase64(bytes)).toBe("aGk=");
            expect(bytesModule.base64ToUint8Array("aGk=")).toStrictEqual(bytes);
        });

        it("rejects invalid base64 without Buffer", async () => {
            expect.assertions(2);

            const bytesModule = await importWithoutBuffer();

            expect(() => bytesModule.base64ToUint8Array("a!b=")).toThrow("Invalid base64 string");
            expect(bytesModule.base64ToUint8Array("aG\n k=")).toStrictEqual(new Uint8Array([104, 105]));
        });

        it("rejects invalid hex without Buffer", async () => {
            expect.assertions(2);

            const bytesModule = await importWithoutBuffer();

            expect(() => bytesModule.hexToUint8Array("zz")).toThrow("non-hex character");
            expect(() => bytesModule.hexToUint8Array("abc")).toThrow("even length");
        });
    });
});
