import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
            expect.assertions(1);

            const result = toBase64("Hello 世界");

            expect(result).toBe("SGVsbG8g5LiW55WM");
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

            // ArrayLike representing bytes [116, 101, 115, 116] which is "test" in ASCII
            const arrayLike: ArrayLike<number> = { 0: 116, 1: 101, 2: 115, 3: 116, length: 4 };
            const result = toBase64(arrayLike);

            expect(result).toBe("dGVzdA==");
        });

        it("should produce consistent results for same input", () => {
            expect.assertions(1);

            const input = "test string";
            const result1 = toBase64(input);
            const result2 = toBase64(input);

            expect(result1).toBe(result2);
        });
    });

    describe("without a global Buffer (TextEncoder/btoa fallback)", () => {
        let originalBuffer: typeof globalThis.Buffer;

        beforeEach(() => {
            originalBuffer = globalThis.Buffer;
            // Simulate a runtime without Node's Buffer (Deno/Workers) so the module
            // re-evaluates hasBuffer === false and uses the TextEncoder/btoa path.
            (globalThis as { Buffer?: typeof globalThis.Buffer }).Buffer = undefined;
            vi.resetModules();
        });

        afterEach(() => {
            globalThis.Buffer = originalBuffer;
            vi.resetModules();
        });

        it("encodes strings via TextEncoder and btoa", async () => {
            expect.assertions(3);

            const { default: toBase64NoBuffer } = await import("../../src/utils/to-base64");

            expect(toBase64NoBuffer("hello")).toBe("aGVsbG8=");
            expect(toBase64NoBuffer("")).toBe("");
            expect(toBase64NoBuffer("Hello 世界")).toBe("SGVsbG8g5LiW55WM");
        });

        it("encodes Uint8Array and ArrayLike via btoa", async () => {
            expect.assertions(2);

            const { default: toBase64NoBuffer } = await import("../../src/utils/to-base64");

            const arrayLike: ArrayLike<number> = { 0: 116, 1: 101, 2: 115, 3: 116, length: 4 };

            expect(toBase64NoBuffer(new Uint8Array([116, 101, 115, 116]))).toBe("dGVzdA==");
            expect(toBase64NoBuffer(arrayLike)).toBe("dGVzdA==");
        });

        it("chunks large inputs to avoid stack overflow", async () => {
            expect.assertions(2);

            const { default: toBase64NoBuffer } = await import("../../src/utils/to-base64");

            // Larger than the 8192-byte chunk size to exercise the chunking loops.
            expect(toBase64NoBuffer("a".repeat(10_000))).toBe(globalThis.btoa("a".repeat(10_000)));
            expect(toBase64NoBuffer(new Uint8Array(10_000).fill(65)).length).toBeGreaterThan(0);
        });
    });
});
