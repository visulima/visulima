import { createRequire } from "node:module";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createXxh3Hasher, xxh3Hash } from "../xxh3";

/**
 * Known-answer vectors confirmed against the native Rust addon
 * (`task-runner-native.linux-x64-gnu.node`, `hashFile` for raw bytes and
 * `hashString` for UTF-8 strings). These lock in bit-exact parity per length
 * class. Raw-byte vectors are listed as byte arrays so cases with bytes >= 0x80
 * (which triggered the historical len1to3 overflow bug) are covered explicitly.
 */
const BYTE_VECTORS: [string, number[], string][] = [
    ["empty", [], "99aa06d3014798d86001c324468d497f"],
    // 1-3 byte path — regression vectors for the `byte << 24` int32 overflow.
    ["single high byte 0x80", [0x80], "39f23593542c7e2b6b148c0872500941"],
    ["two bytes, high middle 0xbf", [0x01, 0xbf], "de670d087dbb66b3ea227e78d585e0bc"],
    ["three bytes, low middle", [0x01, 0x7f, 0x02], "7d201b6f657a9327de0998042ff373b1"],
    ["three high bytes", [0xff, 0xfe, 0xfd], "0dd9c687b25db90a87cd1ec6b82714f2"],
    ["abc", [97, 98, 99], "06b05ab6733a618578af5f94892f3950"],
    // 4-8 bytes
    ["4 bytes", [0x00, 0xff, 0x80, 0x7f], "752d4c65481386646dda2ad6ef5e33e0"],
    ["8 bytes", [1, 2, 3, 4, 5, 6, 7, 8], "2ab463fddb09a0b83e8675c57268fb02"],
    // 9-16 bytes
    ["9 bytes", [1, 2, 3, 4, 5, 6, 7, 8, 9], "e338e616502be3613c4087b7dea54fc0"],
    ["16 bytes", Array.from({ length: 16 }, (_, index) => index + 1), "6d84a882f6411b41eada823104bd7174"],
    // 17-128 bytes
    ["17 bytes", Array.from({ length: 17 }, (_, index) => index + 1), "9ac14e2c3fe59a83acda8373034d6aaf"],
    ["64 bytes", Array.from({ length: 64 }, (_, index) => (index * 7) & 0xff), "a7fa95f7f23b64a7edae5e0312655703"],
    ["128 bytes", Array.from({ length: 128 }, (_, index) => (index * 13) & 0xff), "a0c8e27dac0acad94462929a486a0994"],
    // 129-240 bytes
    ["129 bytes", Array.from({ length: 129 }, (_, index) => (index * 17) & 0xff), "2ca72b65a43edeb26b3cb2c943455c3e"],
    ["240 bytes", Array.from({ length: 240 }, (_, index) => (index * 3) & 0xff), "b0abaf8dec0aaf3e0ea9bd86dd4ee54a"],
    // >240 bytes (long hash path)
    ["241 bytes", Array.from({ length: 241 }, (_, index) => (index * 5) & 0xff), "c20b0548e839971f8f88d473c1c98f34"],
    ["1024 bytes", Array.from({ length: 1024 }, (_, index) => (index * 11) & 0xff), "7613aea71fbb2edb25a649c379a563c0"],
];

/** UTF-8 string vectors confirmed against the native `hashString`. */
const STRING_VECTORS: [string, string][] = [
    ["hello world", "df8d09e93f874900a99b8775cc15b6c7"],
    // "é" is two bytes (0xc3 0xa9) — the high middle byte triggers the old bug.
    ["é", "90326970ab18793af7940a006cf10cb3"],
];

/**
 * Seeded known-answer vectors (seed = 42) confirmed against xxhash-rust 0.8.15
 * (`xxh3_128_with_seed`), which the native Rust addon does not expose. These
 * lock in the seed handling per length class — in particular the 4-8 byte seed
 * mangling and the 9-16 byte bitflip signs, which are silently unexercised by
 * the default (seed 0) vectors above.
 */
const SEEDED_BYTE_VECTORS: [string, number[], string][] = [
    ["empty", [], "16c20acd33f7af2f3c1d09e9fe249164"],
    ["single high byte 0x80", [0x80], "be05ff5783833c51b8ada083b13528e8"],
    ["two bytes, high middle 0xbf", [0x01, 0xbf], "982c3e20a5488d659a2ab51e50129a53"],
    ["three bytes, low middle", [0x01, 0x7f, 0x02], "b0cc3366ae8b895b4e2edebf0cfcc595"],
    ["three high bytes", [0xff, 0xfe, 0xfd], "d8d3ab93221c006700c50ab6343e769a"],
    ["abc", [97, 98, 99], "4bc24859f045e0b4d8438def21bbdcc3"],
    ["4 bytes", [0x00, 0xff, 0x80, 0x7f], "e229e719672c1aebbef6018e7aea6654"],
    ["8 bytes", [1, 2, 3, 4, 5, 6, 7, 8], "f0c05692ff0e4cd310597bd55eed270a"],
    ["9 bytes", [1, 2, 3, 4, 5, 6, 7, 8, 9], "f9f512894b4b395f7faed9eb94f44c43"],
    ["16 bytes", Array.from({ length: 16 }, (_, index) => index + 1), "99bc556aa25bb5026b86c87cd7e5bdf5"],
    ["17 bytes", Array.from({ length: 17 }, (_, index) => index + 1), "3d0e87dee24546a9e40e9f1903350afd"],
    ["64 bytes", Array.from({ length: 64 }, (_, index) => (index * 7) & 0xff), "4855906be817b2f97b07d9cc644b0fdf"],
    ["128 bytes", Array.from({ length: 128 }, (_, index) => (index * 13) & 0xff), "441f1dc22148140fa80d2d6c61779aee"],
    ["129 bytes", Array.from({ length: 129 }, (_, index) => (index * 17) & 0xff), "3c5f1328787e9629c93a51cb5af6345f"],
    ["240 bytes", Array.from({ length: 240 }, (_, index) => (index * 3) & 0xff), "ab5b2a82c85b79156e5240b01035743c"],
    ["241 bytes", Array.from({ length: 241 }, (_, index) => (index * 5) & 0xff), "0fa95fb19ef8e461df530238daf8f6d5"],
    ["1024 bytes", Array.from({ length: 1024 }, (_, index) => (index * 11) & 0xff), "bbc41f0c927794b196350143768fed7b"],
];

describe("xxh3Hash known-answer vectors", () => {
    it.each(BYTE_VECTORS)("matches the native addon for %s", (_name, bytes, expected) => {
        expect(xxh3Hash(Buffer.from(bytes))).toBe(expected);
    });

    it.each(STRING_VECTORS)("matches the native addon for the string %j", (input, expected) => {
        expect(xxh3Hash(input)).toBe(expected);
    });

    it("regression: 1-3 byte inputs with a high middle byte do not overflow int32", () => {
        // `0xbf << 24` is negative in JS number space; the fix widens to BigInt
        // before shifting. These would have diverged from native before the fix.
        expect(xxh3Hash(Buffer.from([0x80]))).toBe("39f23593542c7e2b6b148c0872500941");
        expect(xxh3Hash(Buffer.from([0x01, 0xbf]))).toBe("de670d087dbb66b3ea227e78d585e0bc");
        expect(xxh3Hash("é")).toBe("90326970ab18793af7940a006cf10cb3");
    });
});

describe("xxh3Hash seeded known-answer vectors (seed 42, xxhash-rust)", () => {
    it.each(SEEDED_BYTE_VECTORS)("matches xxhash-rust for %s", (_name, bytes, expected) => {
        expect(xxh3Hash(Buffer.from(bytes), 42n)).toBe(expected);
    });

    it("matches xxhash-rust for the string 'hello world'", () => {
        expect(xxh3Hash("hello world", 42n)).toBe("5a5ecb4a698378a282c1ce3b43a636ba");
    });

    it("regression: 4-8 byte seed mangling matches the reference", () => {
        // The reference mangles the seed (`seed ^= swap32(seed) << 32`) before
        // computing the bitflip; omitting it diverged for non-zero seeds.
        expect(xxh3Hash(Buffer.from([0x00, 0xff, 0x80, 0x7f]), 42n)).toBe("e229e719672c1aebbef6018e7aea6654");
        expect(xxh3Hash(Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]), 42n)).toBe("f0c05692ff0e4cd310597bd55eed270a");
    });

    it("regression: 9-16 byte bitflip signs match the reference", () => {
        // secret[32..40] lane uses `- seed`, secret[48..56] lane uses `+ seed`;
        // the signs were swapped, diverging for non-zero seeds.
        expect(xxh3Hash(Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9]), 42n)).toBe("f9f512894b4b395f7faed9eb94f44c43");
        expect(xxh3Hash(Buffer.from(Array.from({ length: 16 }, (_, index) => index + 1)), 42n)).toBe(
            "99bc556aa25bb5026b86c87cd7e5bdf5",
        );
    });
});

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

    it("should accept a string directly (UTF-8 encoded, like a Buffer)", () => {
        expect(xxh3Hash("hello world")).toBe(xxh3Hash(Buffer.from("hello world")));
        expect(xxh3Hash("é")).toBe(xxh3Hash(Buffer.from("é")));
    });

    it("should produce unique hashes for each boundary length", () => {
        const lengths = [0, 1, 3, 4, 8, 9, 16, 17, 128, 129, 240, 241, 1024];
        const hashes = new Set(lengths.map((length) => xxh3Hash(Buffer.alloc(length, 0x42))));

        expect(hashes.size).toBe(lengths.length);
    });

    describe("seed", () => {
        it("defaults to seed 0", () => {
            const data = Buffer.alloc(1024, 0x42);

            expect(xxh3Hash(data)).toBe(xxh3Hash(data, 0n));
        });

        it("changes the hash for every length class, including the long path", () => {
            for (const length of [0, 2, 8, 16, 64, 200, 1024]) {
                const data = Buffer.alloc(length, 0x42);

                expect(xxh3Hash(data, 42n)).not.toBe(xxh3Hash(data, 0n));
            }
        });

        it("is deterministic for a given seed", () => {
            const data = Buffer.alloc(1024, 0x42);

            expect(xxh3Hash(data, 42n)).toBe(xxh3Hash(data, 42n));
        });

        it("normalizes out-of-range seeds to 64 bits, consistently across length classes", () => {
            // A seed >= 2^64 or negative is reduced mod 2^64 (BigInt.asUintN(64))
            // at the entry point, so every length class agrees on its meaning.
            for (const length of [0, 2, 8, 16, 64, 200, 1024]) {
                const data = Buffer.alloc(length, 0x42);

                expect(xxh3Hash(data, (1n << 64n) + 1n)).toBe(xxh3Hash(data, 1n));
                expect(xxh3Hash(data, -1n)).toBe(xxh3Hash(data, (1n << 64n) - 1n));
            }

            // seed 2^64 collapses to seed 0 (including the long-path fast path).
            const long = Buffer.alloc(1024, 0x42);

            expect(xxh3Hash(long, 1n << 64n)).toBe(xxh3Hash(long, 0n));
        });

        it("wide/negative seeds still match the canonical reference (xxhash-rust)", () => {
            const eight = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]);
            const long = Buffer.from(Array.from({ length: 1024 }, (_, index) => (index * 11) & 0xff));

            // seed -1 ≡ 2^64 - 1 (u64::MAX in the reference generator).
            expect(xxh3Hash(eight, -1n)).toBe("9f12bb63e2bf4a6a4220efd931e0d2dd");
            expect(xxh3Hash(long, -1n)).toBe("9920b68abf3499e14ca89ac9089a5608");
            // seed 2^64 + 1 ≡ 1.
            expect(xxh3Hash(eight, (1n << 64n) + 1n)).toBe("09b25035a669378be7a1b91bd9e8134c");
            expect(xxh3Hash(long, (1n << 64n) + 1n)).toBe("b8f0eedd8fc475ec709c5003872ffe13");
        });
    });
});

describe("createXxh3Hasher", () => {
    it("should produce the same hash as xxh3Hash for single update", () => {
        const data = Buffer.from("hello world");
        const direct = xxh3Hash(data);

        expect(createXxh3Hasher().update(data).digest()).toBe(direct);
    });

    it("should produce the same hash as xxh3Hash for concatenated string updates", () => {
        const direct = xxh3Hash(Buffer.from("helloworld"));

        expect(createXxh3Hasher().update("hello").update("world").digest()).toBe(direct);
    });

    it("should accept both string and Buffer inputs", () => {
        const fromString = createXxh3Hasher().update("test").digest();
        const fromBuffer = createXxh3Hasher().update(Buffer.from("test")).digest();

        expect(fromString).toBe(fromBuffer);
    });

    it("should support chaining", () => {
        const result = createXxh3Hasher().update("a").update("b").update("c").digest();

        expect(result).toBe(xxh3Hash(Buffer.from("abc")));
    });

    it("should handle empty input", () => {
        expect(createXxh3Hasher().digest()).toBe(xxh3Hash(Buffer.alloc(0)));
    });

    it("digest() is non-terminal — updates after a digest extend the input", () => {
        const hasher = createXxh3Hasher();

        hasher.update("hello");

        const first = hasher.digest();

        hasher.update("world");

        const second = hasher.digest();

        expect(first).toBe(xxh3Hash("hello"));
        expect(second).toBe(xxh3Hash("helloworld"));
    });

    it("copies Buffer inputs so mutating them after update() does not change the digest", () => {
        const scratch = Buffer.from("hello");
        const hasher = createXxh3Hasher().update(scratch);

        scratch.fill(0);

        expect(hasher.digest()).toBe(xxh3Hash("hello"));
    });

    it("reset() clears accumulated chunks", () => {
        const hasher = createXxh3Hasher();

        hasher.update("a").update("b");
        hasher.reset();
        hasher.update("xyz");

        expect(hasher.digest()).toBe(xxh3Hash("xyz"));
    });

    it("forwards the seed to the digest", () => {
        expect(createXxh3Hasher(7n).update("x").digest()).toBe(xxh3Hash("x", 7n));
    });

    it("reset(seed) changes the seed for subsequent digests", () => {
        const hasher = createXxh3Hasher();

        hasher.update("x");

        const unseeded = hasher.digest();

        hasher.reset(7n).update("x");

        expect(hasher.digest()).not.toBe(unseeded);
        expect(hasher.digest()).toBe(xxh3Hash("x", 7n));
    });
});

/**
 * Direct parity check against a locally-built native binding when one is
 * present. Skipped (not failed) on platforms / checkouts where the addon has
 * not been built, so the suite stays green everywhere while still catching
 * divergence on developer machines and CI runners that have it.
 */
const loadNativeBinding = (): { hashFile: (path: string) => string; hashString: (input: string) => string } | undefined => {
    const require = createRequire(import.meta.url);
    const candidates = [
        "darwin-arm64",
        "darwin-x64",
        "linux-x64-gnu",
        "linux-arm64-gnu",
        "win32-x64-msvc",
        "win32-arm64-msvc",
    ];

    for (const target of candidates) {
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports, import/no-dynamic-require, global-require
            return require(`../../../packages/tooling/task-runner/task-runner-native.${target}.node`);
        } catch {
            // try the next target
        }
    }

    return undefined;
};

const native = loadNativeBinding();

describe.skipIf(!native)("native parity", () => {
    it("matches the native addon for raw-byte inputs across every length class", () => {
        const directory = mkdtempSync(join(tmpdir(), "xxh3-parity-"));

        for (const [name, bytes] of BYTE_VECTORS) {
            const file = join(directory, name.replace(/[^\da-z]/giu, "_"));

            writeFileSync(file, Buffer.from(bytes));

            expect(xxh3Hash(Buffer.from(bytes)), name).toBe(native!.hashFile(file));
        }
    });

    it("matches the native addon for UTF-8 string inputs", () => {
        for (const [input] of STRING_VECTORS) {
            expect(xxh3Hash(input), input).toBe(native!.hashString(input));
        }
    });
});
