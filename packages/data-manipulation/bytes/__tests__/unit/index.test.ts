import { Buffer } from "node:buffer";

import { describe, expect, it } from "vitest";

import { asciiToUint8Array, bufferToUint8Array, isUint8Array, toUint8Array, utf8ToUint8Array } from "../../src/index";

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

        it.skipIf(Buffer === undefined)("should convert Buffer (Node.js like env)", () => {
            expect.assertions(3);

            const buf = Buffer.from("node");
            const u8 = toUint8Array(buf);

            expect(u8).toStrictEqual(new Uint8Array([110, 111, 100, 101]));
            expect(u8.buffer).toBe(buf.buffer);
            expect(u8.byteOffset).toBe(buf.byteOffset);
        });

        it.skipIf(Buffer === undefined)("should convert string (via Buffer.from in Node.js like env)", () => {
            expect.assertions(1);

            expect(toUint8Array("string")).toStrictEqual(new Uint8Array([115, 116, 114, 105, 110, 103]));
        });

        it("should throw error for incompatible types if Buffer is not available", () => {
            expect.assertions(2);

            const originalBuffer = globalThis.Buffer;
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
});
