import { afterEach, describe, expect, it, vi } from "vitest";

import {
    asciiToUint8Array,
    base64ToUint8Array,
    bufferToUint8Array,
    concat,
    equals,
    hexToUint8Array,
    indexOfNeedle,
    isUint8Array,
    toUint8Array,
    Uint8ArrayIncompatibleError,
    uint8ArrayToAscii,
    uint8ArrayToBase64,
    uint8ArrayToHex,
    uint8ArrayToUtf8,
    utf8ToUint8Array,
} from "../../src/index";

describe("@visulima/bytes on workerd", () => {
    describe("runtime capabilities", () => {
        it("should expose a Buffer global via nodejs_compat", () => {
            expect.assertions(2);

            expect(Buffer).toBeTypeOf("function");
            expect(Buffer.isBuffer(Buffer.from("x"))).toBe(true);
        });

        it("should expose TextEncoder, TextDecoder, atob and btoa", () => {
            expect.assertions(4);

            expect(TextEncoder).toBeTypeOf("function");
            expect(TextDecoder).toBeTypeOf("function");
            expect(atob).toBeTypeOf("function");
            expect(btoa).toBeTypeOf("function");
        });
    });

    describe(bufferToUint8Array, () => {
        it("should convert a Buffer into a Uint8Array view with the right bytes", () => {
            expect.assertions(3);

            const buffer = Buffer.from("hello");
            const bytes = bufferToUint8Array(buffer);

            expect(bytes).toBeInstanceOf(Uint8Array);
            expect(bytes).toHaveLength(5);
            expect([...bytes]).toStrictEqual([104, 101, 108, 108, 111]);
        });

        it("should honour byteOffset for a sliced Buffer", () => {
            expect.assertions(1);

            const buffer = Buffer.from("abcdef").subarray(2, 5);

            expect([...bufferToUint8Array(buffer)]).toStrictEqual([99, 100, 101]);
        });

        it("should handle an empty Buffer", () => {
            expect.assertions(1);

            expect([...bufferToUint8Array(Buffer.alloc(0))]).toStrictEqual([]);
        });
    });

    describe(isUint8Array, () => {
        it("should recognise a Uint8Array and a Buffer", () => {
            expect.assertions(2);

            expect(isUint8Array(new Uint8Array([1]))).toBe(true);
            expect(isUint8Array(Buffer.from("x"))).toBe(true);
        });

        it("should reject other typed arrays, ArrayBuffers and primitives", () => {
            expect.assertions(5);

            expect(isUint8Array(new Int8Array([1]))).toBe(false);
            expect(isUint8Array(new Uint16Array([1]))).toBe(false);
            expect(isUint8Array(new ArrayBuffer(4))).toBe(false);
            expect(isUint8Array("abc")).toBe(false);
            // eslint-disable-next-line unicorn/no-null
            expect(isUint8Array(null)).toBe(false);
        });

        it("should not be fooled by a forged Symbol.toStringTag", () => {
            expect.assertions(1);

            const forged = { [Symbol.toStringTag]: "Uint8Array" };

            expect(isUint8Array(forged)).toBe(false);
        });
    });

    describe("ascii/latin1 round-trip", () => {
        it("should round-trip a latin1 string", () => {
            expect.assertions(2);

            const bytes = asciiToUint8Array("Grüße");

            expect([...bytes]).toStrictEqual([71, 114, 252, 223, 101]);
            expect(uint8ArrayToAscii(bytes)).toBe("Grüße");
        });

        it("should keep only the low byte for code units above 0xFF", () => {
            expect.assertions(1);

            // U+0141 (Ł) -> 0x41 ("A")
            expect([...asciiToUint8Array("Ł")]).toStrictEqual([0x41]);
        });

        it("should support tagged-template usage", () => {
            expect.assertions(1);

            const value = "b";

            expect([...asciiToUint8Array`a${value}c`]).toStrictEqual([97, 98, 99]);
        });

        it("should decode an ArrayBuffer as latin1", () => {
            expect.assertions(1);

            const source = new Uint8Array([104, 105]);

            expect(uint8ArrayToAscii(source.buffer)).toBe("hi");
        });
    });

    describe("utf8 round-trip", () => {
        it("should round-trip multi-byte text", () => {
            expect.assertions(2);

            const bytes = utf8ToUint8Array("héllo 世界 🚀");

            expect(uint8ArrayToUtf8(bytes)).toBe("héllo 世界 🚀");
            expect(bytes.byteLength).toBeGreaterThan("héllo 世界 🚀".length);
        });

        it("should encode an emoji as its four UTF-8 bytes", () => {
            expect.assertions(1);

            expect([...utf8ToUint8Array("🚀")]).toStrictEqual([240, 159, 154, 128]);
        });

        it("should replace invalid byte sequences with U+FFFD", () => {
            expect.assertions(1);

            expect(uint8ArrayToUtf8(new Uint8Array([0xff, 0xfe]))).toBe("��");
        });

        it("should support tagged-template usage", () => {
            expect.assertions(1);

            const value = "ö";

            expect(uint8ArrayToUtf8(utf8ToUint8Array`a${value}c`)).toBe("aöc");
        });

        it("should handle the empty string", () => {
            expect.assertions(2);

            expect([...utf8ToUint8Array("")]).toStrictEqual([]);
            expect(uint8ArrayToUtf8(new Uint8Array([]))).toBe("");
        });
    });

    describe("hex round-trip", () => {
        it("should round-trip every byte value through the Buffer fast path", () => {
            expect.assertions(2);

            const all = new Uint8Array(256);

            for (let index = 0; index < 256; index += 1) {
                all[index] = index;
            }

            const hex = uint8ArrayToHex(all);

            expect(hex).toHaveLength(512);
            expect([...hexToUint8Array(hex)]).toStrictEqual([...all]);
        });

        it("should emit lowercase hex", () => {
            expect.assertions(1);

            expect(uint8ArrayToHex(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))).toBe("deadbeef");
        });

        it("should accept uppercase hex on decode", () => {
            expect.assertions(1);

            expect([...hexToUint8Array("DEADBEEF")]).toStrictEqual([0xde, 0xad, 0xbe, 0xef]);
        });

        it("should honour byteOffset when encoding a subarray", () => {
            expect.assertions(1);

            const view = new Uint8Array([0, 1, 2, 3, 4, 5]).subarray(2, 5);

            expect(uint8ArrayToHex(view)).toBe("020304");
        });

        it("should encode and decode the empty value", () => {
            expect.assertions(2);

            expect(uint8ArrayToHex(new Uint8Array([]))).toBe("");
            expect([...hexToUint8Array("")]).toStrictEqual([]);
        });

        it("should throw on an odd-length hex string", () => {
            expect.assertions(1);

            expect(() => hexToUint8Array("abc")).toThrow(TypeError);
        });

        it("should throw on a non-hex character instead of truncating", () => {
            expect.assertions(2);

            expect(() => hexToUint8Array("zz")).toThrow("non-hex character at index 0");
            expect(() => hexToUint8Array("abzz")).toThrow("non-hex character at index 2");
        });
    });

    describe("base64 round-trip", () => {
        it("should round-trip binary data through the Buffer fast path", () => {
            expect.assertions(2);

            const data = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);
            const base64 = uint8ArrayToBase64(data);

            expect(base64).toBe("AAEC+vv8/f7/");
            expect([...base64ToUint8Array(base64)]).toStrictEqual([...data]);
        });

        it("should produce the canonical padding for each remainder", () => {
            expect.assertions(3);

            expect(uint8ArrayToBase64(utf8ToUint8Array("a"))).toBe("YQ==");
            expect(uint8ArrayToBase64(utf8ToUint8Array("ab"))).toBe("YWI=");
            expect(uint8ArrayToBase64(utf8ToUint8Array("abc"))).toBe("YWJj");
        });

        it("should honour byteOffset when encoding a subarray", () => {
            expect.assertions(1);

            const view = utf8ToUint8Array("xxabcxx").subarray(2, 5);

            expect(uint8ArrayToBase64(view)).toBe("YWJj");
        });

        it("should ignore ASCII whitespace when decoding", () => {
            expect.assertions(1);

            expect(uint8ArrayToUtf8(base64ToUint8Array("YWJj\n YWJj"))).toBe("abcabc");
        });

        it("should reject non-alphabet characters", () => {
            expect.assertions(1);

            expect(() => base64ToUint8Array("YW!j")).toThrow("Invalid base64 string");
        });

        it("should reject an invalid remainder and mispadded input", () => {
            expect.assertions(3);

            expect(() => base64ToUint8Array("YWJjY")).toThrow("Invalid base64 string");
            expect(() => base64ToUint8Array("aG=")).toThrow("Invalid base64 string");
            expect(() => base64ToUint8Array("==")).toThrow("Invalid base64 string");
        });

        it("should encode and decode the empty value", () => {
            expect.assertions(2);

            expect(uint8ArrayToBase64(new Uint8Array([]))).toBe("");
            expect([...base64ToUint8Array("")]).toStrictEqual([]);
        });
    });

    describe(toUint8Array, () => {
        it("should return the same instance for a Uint8Array without copy", () => {
            expect.assertions(1);

            const input = new Uint8Array([1, 2, 3]);

            expect(toUint8Array(input)).toBe(input);
        });

        it("should return an owned copy when copy is requested", () => {
            expect.assertions(2);

            const input = new Uint8Array([1, 2, 3]);
            const result = toUint8Array(input, { copy: true });

            expect(result).not.toBe(input);
            expect([...result]).toStrictEqual([1, 2, 3]);
        });

        it("should convert a Buffer through the Buffer branch", () => {
            expect.assertions(2);

            const result = toUint8Array(Buffer.from("hey"));

            expect(result).toBeInstanceOf(Uint8Array);
            expect([...result]).toStrictEqual([104, 101, 121]);
        });

        it("should not alias the Buffer pool when copying a Buffer", () => {
            expect.assertions(2);

            const buffer = Buffer.from("hey");
            const result = toUint8Array(buffer, { copy: true });

            expect([...result]).toStrictEqual([104, 101, 121]);
            expect(result.byteLength).toBe(result.buffer.byteLength);
        });

        it("should convert an ArrayBuffer", () => {
            expect.assertions(2);

            const source = new Uint8Array([9, 8, 7]);
            const result = toUint8Array(source.buffer);

            expect([...result]).toStrictEqual([9, 8, 7]);
            expect(toUint8Array(source.buffer, { copy: true }).buffer).not.toBe(source.buffer);
        });

        it("should convert an array of numbers", () => {
            expect.assertions(1);

            expect([...toUint8Array([1, 2, 300])]).toStrictEqual([1, 2, 44]);
        });

        it("should convert a string as UTF-8", () => {
            expect.assertions(1);

            expect([...toUint8Array("ü")]).toStrictEqual([195, 188]);
        });

        it("should throw a coded error for unsupported input", () => {
            expect.assertions(6);

            for (const [input, received] of [
                // eslint-disable-next-line unicorn/no-null
                [null, "null"],
                [undefined, "undefined"],
                [42, "number"],
                [{}, "object"],
                [Symbol("x"), "symbol"],
            ] as const) {
                let caught: unknown;

                try {
                    toUint8Array(input);
                } catch (error) {
                    caught = error;
                }

                expect((caught as Uint8ArrayIncompatibleError).message).toBe(
                    `UINT8ARRAY_INCOMPATIBLE: Cannot convert data to Uint8Array (received: ${received})`,
                );
            }

            expect(() => toUint8Array([1, "2"])).toThrow(Uint8ArrayIncompatibleError);
        });

        it("should carry a stable error code and instanceof relationship", () => {
            expect.assertions(3);

            let caught: unknown;

            try {
                toUint8Array(42);
            } catch (error) {
                caught = error;
            }

            expect(caught).toBeInstanceOf(Uint8ArrayIncompatibleError);
            expect(caught).toBeInstanceOf(Error);
            expect((caught as Uint8ArrayIncompatibleError).code).toBe("UINT8ARRAY_INCOMPATIBLE");
        });
    });

    describe("without a Buffer global", () => {
        // A Worker deployed without the `nodejs_compat` flag has no `Buffer` at all.
        // `hasBuffer()` is re-checked per call precisely so the pure-Web fallbacks
        // take over; these assert the fallbacks agree with the Buffer fast paths.
        afterEach(() => {
            vi.unstubAllGlobals();
        });

        it("should encode latin1 without Buffer", () => {
            expect.assertions(2);

            const expected = [...asciiToUint8Array("Grüße")];

            vi.stubGlobal("Buffer", undefined);

            expect([...asciiToUint8Array("Grüße")]).toStrictEqual(expected);
            expect([...asciiToUint8Array("Ł")]).toStrictEqual([0x41]);
        });

        it("should round-trip hex without Buffer", () => {
            expect.assertions(3);

            vi.stubGlobal("Buffer", undefined);

            const all = new Uint8Array(256);

            for (let index = 0; index < 256; index += 1) {
                all[index] = index;
            }

            expect(uint8ArrayToHex(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))).toBe("deadbeef");
            expect([...hexToUint8Array(uint8ArrayToHex(all))]).toStrictEqual([...all]);
            expect([...hexToUint8Array("DEAD")]).toStrictEqual([0xde, 0xad]);
        });

        it("should still reject invalid hex without Buffer", () => {
            expect.assertions(2);

            vi.stubGlobal("Buffer", undefined);

            expect(() => hexToUint8Array("zz")).toThrow("non-hex character at index 0");
            expect(() => hexToUint8Array("abc")).toThrow("expected an even length");
        });

        it("should round-trip base64 without Buffer", () => {
            expect.assertions(3);

            vi.stubGlobal("Buffer", undefined);

            const data = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);

            expect(uint8ArrayToBase64(data)).toBe("AAEC+vv8/f7/");
            expect([...base64ToUint8Array("AAEC+vv8/f7/")]).toStrictEqual([...data]);
            expect(uint8ArrayToBase64(utf8ToUint8Array("a"))).toBe("YQ==");
        });

        it("should still reject invalid base64 without Buffer", () => {
            expect.assertions(2);

            vi.stubGlobal("Buffer", undefined);

            expect(() => base64ToUint8Array("YW!j")).toThrow("Invalid base64 string");
            expect(() => base64ToUint8Array("YWJjY")).toThrow("Invalid base64 string");
        });

        it("should convert values via toUint8Array without Buffer", () => {
            expect.assertions(3);

            vi.stubGlobal("Buffer", undefined);

            expect([...toUint8Array("ü")]).toStrictEqual([195, 188]);
            expect([...toUint8Array([1, 2, 3])]).toStrictEqual([1, 2, 3]);
            expect(() => toUint8Array(42)).toThrow(Uint8ArrayIncompatibleError);
        });
    });

    describe("re-exported @std/bytes helpers", () => {
        it("should concat, compare and search byte arrays", () => {
            expect.assertions(4);

            const joined = concat([new Uint8Array([1, 2]), new Uint8Array([3])]);

            expect([...joined]).toStrictEqual([1, 2, 3]);
            expect(equals(joined, new Uint8Array([1, 2, 3]))).toBe(true);
            expect(equals(joined, new Uint8Array([1, 2, 4]))).toBe(false);
            expect(indexOfNeedle(joined, new Uint8Array([2, 3]))).toBe(1);
        });
    });
});
