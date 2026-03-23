import { describe, expect, it } from "vitest";

import { createXxh3Hasher, xxh3Hash } from "../src/xxh3";

describe("xxh3Hash", () => {
    it("should return a 32-character hex string", () => {
        const result = xxh3Hash(Buffer.from("hello world"));

        expect(result).toMatch(/^[\da-f]{32}$/);
    });

    it("should be deterministic", () => {
        const data = Buffer.from("deterministic input");

        expect(xxh3Hash(data)).toBe(xxh3Hash(data));
    });

    it("should produce different hashes for different inputs", () => {
        const a = xxh3Hash(Buffer.from("input a"));
        const b = xxh3Hash(Buffer.from("input b"));

        expect(a).not.toBe(b);
    });

    it("should handle empty buffers", () => {
        const result = xxh3Hash(Buffer.from(""));

        expect(result).toMatch(/^[\da-f]{32}$/);
    });

    it("should handle single-byte input", () => {
        const result = xxh3Hash(Buffer.from("x"));

        expect(result).toMatch(/^[\da-f]{32}$/);
    });

    it("should handle input lengths at algorithm boundaries", () => {
        // Test all length categories in the xxh3-128 implementation:
        // 0 bytes (empty)
        expect(xxh3Hash(Buffer.alloc(0))).toMatch(/^[\da-f]{32}$/);
        // 1-3 bytes
        expect(xxh3Hash(Buffer.alloc(1, 0x42))).toMatch(/^[\da-f]{32}$/);
        expect(xxh3Hash(Buffer.alloc(3, 0x42))).toMatch(/^[\da-f]{32}$/);
        // 4-8 bytes
        expect(xxh3Hash(Buffer.alloc(4, 0x42))).toMatch(/^[\da-f]{32}$/);
        expect(xxh3Hash(Buffer.alloc(8, 0x42))).toMatch(/^[\da-f]{32}$/);
        // 9-16 bytes
        expect(xxh3Hash(Buffer.alloc(9, 0x42))).toMatch(/^[\da-f]{32}$/);
        expect(xxh3Hash(Buffer.alloc(16, 0x42))).toMatch(/^[\da-f]{32}$/);
        // 17-128 bytes
        expect(xxh3Hash(Buffer.alloc(17, 0x42))).toMatch(/^[\da-f]{32}$/);
        expect(xxh3Hash(Buffer.alloc(64, 0x42))).toMatch(/^[\da-f]{32}$/);
        expect(xxh3Hash(Buffer.alloc(128, 0x42))).toMatch(/^[\da-f]{32}$/);
        // 129-240 bytes
        expect(xxh3Hash(Buffer.alloc(129, 0x42))).toMatch(/^[\da-f]{32}$/);
        expect(xxh3Hash(Buffer.alloc(240, 0x42))).toMatch(/^[\da-f]{32}$/);
        // >240 bytes (long hash path)
        expect(xxh3Hash(Buffer.alloc(241, 0x42))).toMatch(/^[\da-f]{32}$/);
        expect(xxh3Hash(Buffer.alloc(1024, 0x42))).toMatch(/^[\da-f]{32}$/);
        expect(xxh3Hash(Buffer.alloc(10000, 0x42))).toMatch(/^[\da-f]{32}$/);
    });

    it("should produce unique hashes for each boundary length", () => {
        const lengths = [0, 1, 3, 4, 8, 9, 16, 17, 128, 129, 240, 241, 1024];
        const hashes = new Set(lengths.map((len) => xxh3Hash(Buffer.alloc(len, 0x42))));

        expect(hashes.size).toBe(lengths.length);
    });

    it("should handle binary content", () => {
        const binary = Buffer.from([0x00, 0xff, 0x80, 0x7f, 0x01, 0xfe]);
        const result = xxh3Hash(binary);

        expect(result).toMatch(/^[\da-f]{32}$/);
    });
});

describe("createXxh3Hasher", () => {
    it("should produce the same hash as xxh3Hash for single update", () => {
        const data = Buffer.from("hello world");
        const direct = xxh3Hash(data);

        const hasher = createXxh3Hasher();

        hasher.update(data);

        expect(hasher.digest()).toBe(direct);
    });

    it("should produce the same hash as xxh3Hash for concatenated string updates", () => {
        const combined = Buffer.from("helloworld");
        const direct = xxh3Hash(combined);

        const hasher = createXxh3Hasher();

        hasher.update("hello");
        hasher.update("world");

        expect(hasher.digest()).toBe(direct);
    });

    it("should accept both string and Buffer inputs", () => {
        const hasher1 = createXxh3Hasher();

        hasher1.update("test");

        const hasher2 = createXxh3Hasher();

        hasher2.update(Buffer.from("test"));

        expect(hasher1.digest()).toBe(hasher2.digest());
    });

    it("should return a 32-character hex string", () => {
        const hasher = createXxh3Hasher();

        hasher.update("data");

        expect(hasher.digest()).toMatch(/^[\da-f]{32}$/);
    });

    it("should support chaining", () => {
        const result = createXxh3Hasher().update("a").update("b").update("c").digest();

        expect(result).toMatch(/^[\da-f]{32}$/);
        expect(result).toBe(xxh3Hash(Buffer.from("abc")));
    });

    it("should handle empty input", () => {
        const result = createXxh3Hasher().digest();

        expect(result).toBe(xxh3Hash(Buffer.alloc(0)));
    });

    it("should handle multiple small updates", () => {
        const hasher = createXxh3Hasher();

        for (let i = 0; i < 100; i++) {
            hasher.update(String(i));
        }

        const result = hasher.digest();

        expect(result).toMatch(/^[\da-f]{32}$/);

        // Should be deterministic
        const hasher2 = createXxh3Hasher();

        for (let i = 0; i < 100; i++) {
            hasher2.update(String(i));
        }

        expect(hasher2.digest()).toBe(result);
    });
});
