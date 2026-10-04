import { describe, expect, it, vi } from "vitest";

import MemoryStorage from "../../src/storage/memory/memory-storage";
import type { FileReturn } from "../../src/storage/utils/file";
import BaseTransformer from "../../src/transformer/base-transformer";
import type { BaseTransformerConfig } from "../../src/transformer/transformer-config";
import { getFormatFromContentType, isKnownContentType, isSupportedFormat, isValidMediaType, sourceVersion, validateMediaFile } from "../../src/transformer/utils";
import ValidationError from "../../src/transformer/validation-error";

const file = (contentType: string | undefined, size: number | string = 10): FileReturn => ({ content: Buffer.alloc(0), contentType, id: "x", size }) as FileReturn;

describe("transformer utils", () => {
    it("matches media types by prefix", () => {
        expect.assertions(4);

        expect(isValidMediaType("image/png", "image")).toBe(true);
        expect(isValidMediaType("video/mp4", "image")).toBe(false);
        expect(isValidMediaType("audio/wav", "audio")).toBe(true);
        expect(isValidMediaType(undefined, "video")).toBe(false);
    });

    it("maps content types to their preferred extension", () => {
        expect.assertions(3);

        expect(getFormatFromContentType("image/png")).toBe("png");
        expect(getFormatFromContentType("image/x-nope")).toBeUndefined();
        expect(getFormatFromContentType(undefined)).toBeUndefined();
    });

    it("knows registered content types", () => {
        expect.assertions(3);

        expect(isKnownContentType("video/webm")).toBe(true);
        expect(isKnownContentType("video/x-nope")).toBe(false);
        expect(isKnownContentType(undefined)).toBe(false);
    });

    it.each([
        ["image/jpeg", ["jpeg"], true],
        ["image/tiff", ["tiff"], true],
        ["audio/mpeg", ["mp3"], true],
        ["audio/aac", ["aac"], true],
        ["audio/ogg", ["ogg"], true],
        ["video/quicktime", ["mov"], true],
        ["image/png", ["jpeg"], false],
        ["image/x-nope", ["jpeg"], true],
        [undefined, ["jpeg"], true],
    ] as const)("isSupportedFormat(%s, %j) is %s", (contentType, formats, expected) => {
        expect.assertions(1);

        expect(isSupportedFormat(contentType, [...formats])).toBe(expected);
    });

    describe(validateMediaFile, () => {
        it("accepts a valid file", () => {
            expect.assertions(1);

            expect(() => validateMediaFile(file("image/jpeg"), "image", { maxSize: 100, supportedFormats: ["jpeg"] })).not.toThrow();
        });

        it("rejects oversized files, also with a string size", () => {
            expect.assertions(2);

            expect(() => validateMediaFile(file("image/png", 200), "image", { maxSize: 100 })).toThrow("image size 200 exceeds maximum allowed size 100");
            expect(() => validateMediaFile(file("image/png", "200"), "image", { maxSize: 100 })).toThrow("image size 200 exceeds maximum allowed size 100");
        });

        it("rejects the wrong media type with the right article", () => {
            expect.assertions(2);

            expect(() => validateMediaFile(file("text/plain"), "image")).toThrow("File is not an image: text/plain");
            expect(() => validateMediaFile(file("text/plain"), "video")).toThrow("File is not a video: text/plain");
        });

        it("rejects unsupported formats", () => {
            expect.assertions(1);

            expect(() => validateMediaFile(file("audio/wav"), "audio", { supportedFormats: ["mp3"] })).toThrow("Unsupported audio format: wav");
        });
    });

    it("fingerprints the original's version", () => {
        expect.assertions(3);

        expect(sourceVersion({ ETag: "abc", modifiedAt: new Date("2024-01-02T03:04:05.000Z"), size: 5 })).toBe("abc|2024-01-02T03:04:05.000Z|5");
        expect(sourceVersion({ modifiedAt: 7, size: "9" })).toBe("|7|9");
        expect(sourceVersion({})).toBe("||");
    });

    it("builds a ValidationError with details", () => {
        expect.assertions(4);

        const error = new ValidationError("bad", "CODE", "image", ["fit"], ["cover"], ["try cover"]);

        expect(error).toBeInstanceOf(Error);
        expect(error.name).toBe("ValidationError");
        expect(error.code).toBe("CODE");
        expect(error.details).toStrictEqual({ invalidParams: ["fit"], mediaType: "image", suggestions: ["try cover"], validParams: ["cover"] });
    });
});

class EchoTransformer extends BaseTransformer<BaseTransformerConfig, { buffer?: Buffer; format?: string }> {
    public result: { buffer?: Buffer; format?: string } = {};

    public constructor(storage: MemoryStorage, config: BaseTransformerConfig, logger?: Console) {
        super(storage, config, logger);
    }

    public async transform(): Promise<{ buffer?: Buffer; format?: string }> {
        return this.result;
    }

    public key(fileId: string): Promise<string | undefined> {
        return this.versionedCacheKey(fileId, `${fileId}:steps`);
    }

    public put(key: string, value: { format?: string }): Promise<void> {
        return this.setCached(key, value);
    }
}

describe("base transformer", () => {
    it("streams a buffer result with its content type", async () => {
        expect.assertions(2);

        const transformer = new EchoTransformer(new MemoryStorage(), {});

        transformer.result = { buffer: Buffer.from("abc"), format: "png" };

        const { headers, size } = await transformer.transformStream!("x", []);

        expect(headers).toStrictEqual({ "Content-Length": "3", "Content-Type": "image/png" });
        expect(size).toBe(3);
    });

    it("falls back to application/octet-stream for unknown formats", async () => {
        expect.assertions(2);

        const transformer = new EchoTransformer(new MemoryStorage(), {});

        transformer.result = { buffer: Buffer.from("abc"), format: "nope" };

        await expect(transformer.transformStream!("x", [])).resolves.toMatchObject({ headers: { "Content-Type": "application/octet-stream" } });

        transformer.result = { buffer: Buffer.from("abc") };

        await expect(transformer.transformStream!("x", [])).resolves.toMatchObject({ headers: { "Content-Type": "application/octet-stream" } });
    });

    it("refuses to stream results without a buffer", async () => {
        expect.assertions(1);

        const transformer = new EchoTransformer(new MemoryStorage(), {});

        await expect(transformer.transformStream!("x", [])).rejects.toThrow("Streaming transformation not supported for this transformer");
    });

    it("skips caching without a cache or when the original is missing", async () => {
        expect.assertions(2);

        const storage = new MemoryStorage({ initial: { "a.txt": "a" } });

        await expect(new EchoTransformer(storage, {}).key("a.txt")).resolves.toBeUndefined();
        await expect(new EchoTransformer(storage, { cache: new Map() }).key("missing.txt")).resolves.toBeUndefined();
    });

    it("versions cache keys with the original's fingerprint", async () => {
        expect.assertions(1);

        const storage = new MemoryStorage({ initial: { "a.txt": "a" } });

        await expect(new EchoTransformer(storage, { cache: new Map() }).key("a.txt")).resolves.toMatch(/^a\.txt:steps@[^|]+\|[^|]+\|1$/);
    });

    it("clears every entry of one file and leaves the others", async () => {
        expect.assertions(1);

        const cache = new Map<string>();
        const transformer = new EchoTransformer(new MemoryStorage(), { cache });

        await transformer.put("a:1@v", {});
        await transformer.put("a:2@v", {});
        await transformer.put("ab:1@v", {});
        transformer.clearCache("a");

        expect([...cache.keys()]).toStrictEqual(["ab:1@v"]);
    });

    it("falls back to a full clear for caches without keys()", async () => {
        expect.assertions(2);

        const logger = { warn: vi.fn() } as unknown as Console;
        const clear = vi.fn();
        const cache = { clear, delete: vi.fn(), get: vi.fn(), has: vi.fn(), set: vi.fn() };
        const transformer = new EchoTransformer(new MemoryStorage(), { cache }, logger);

        transformer.clearCache("a");

        expect(clear).toHaveBeenCalledTimes(1);
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("falling back to full clear()"));
    });

    it("reports cache stats", async () => {
        expect.assertions(2);

        const cache = new Map<string>();
        const transformer = new EchoTransformer(new MemoryStorage(), { cache, maxCacheSize: 5 });

        await transformer.put("a:1@v", {});

        expect(transformer.getCacheStats()).toStrictEqual({ maxSize: 5, size: 1 });
        expect(new EchoTransformer(new MemoryStorage(), {}).getCacheStats()).toStrictEqual({ maxSize: -1, size: 0 });
    });

    it("passes cacheTtl to the cache in milliseconds", async () => {
        expect.assertions(1);

        const set = vi.fn();
        const cache = { clear: vi.fn(), delete: vi.fn(), get: vi.fn(), has: vi.fn(), set };

        await new EchoTransformer(new MemoryStorage(), { cache, cacheTtl: 30 }).put("a:1@v", {});

        expect(set).toHaveBeenCalledWith("a:1@v", {}, { ttl: 30_000 });
    });
});
