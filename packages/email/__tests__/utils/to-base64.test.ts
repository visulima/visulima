import { describe, expect, it } from "vitest";

import toBase64 from "../../src/utils/to-base64";

describe(toBase64, () => {
    describe("string input", () => {
        it("should encode simple string", () => {
            expect.assertions(1);

            const result = toBase64("hello");

            expect(result).toBe("aGVsbG8=");
        });

        it("should encode string with special characters", () => {
            expect.assertions(1);

            const result = toBase64("hello world!");

            expect(result).toBe("aGVsbG8gd29ybGQh");
        });

        it("should encode empty string", () => {
            expect.assertions(1);

            const result = toBase64("");

            expect(result).toBe("");
        });

        it("should encode unicode string", () => {
            expect.assertions(2);

            const result = toBase64("Hello 世界");

            expect(result).toBeDefined();
            expect(result.length).toBeGreaterThan(0);
        });
    });

    describe("buffer input", () => {
        it("should encode Buffer", () => {
            expect.assertions(1);

            const buffer = Buffer.from("test content", "utf8");
            const result = toBase64(buffer);

            expect(result).toBe("dGVzdCBjb250ZW50");
        });

        it("should encode Buffer with binary data", () => {
            expect.assertions(1);

            const buffer = Buffer.from([1, 2, 3, 4, 255]);
            const result = toBase64(buffer);

            expect(result).toBe("AQIDBP8=");
        });
    });

    describe("uint8Array input", () => {
        it("should encode Uint8Array", () => {
            expect.assertions(1);

            const uint8Array = new Uint8Array([116, 101, 115, 116]); // "test"
            const result = toBase64(uint8Array);

            expect(result).toBe("dGVzdA==");
        });

        it("should encode large Uint8Array", () => {
            expect.assertions(2);

            const uint8Array = new Uint8Array(1000).fill(65); // 1000 'A' characters
            const result = toBase64(uint8Array);

            expect(result).toBeDefined();
            expect(result.length).toBeGreaterThan(0);
        });
    });

    describe("edge cases", () => {
        it("should handle ArrayLike input", () => {
            expect.assertions(1);

            const arrayLike = { 0: 116, 1: 101, 2: 115, 3: 116, length: 4 };
            const result = toBase64(arrayLike as unknown as Uint8Array);

            expect(result).toBeDefined();
        });

        it("should produce consistent results for same input", () => {
            expect.assertions(1);

            const input = "test string";
            const result1 = toBase64(input);
            const result2 = toBase64(input);

            expect(result1).toBe(result2);
        });
    });
});
