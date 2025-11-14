import { Readable } from "node:stream";

import { temporaryDirectory } from "tempy";
import { describe, expect, it, vi } from "vitest";

import DiskStorage from "../../src/storage/local/disk-storage";
import ImageTransformer from "../../src/transformer/image-transformer";

describe("imageTransformer streaming", () => {
    const storage = new DiskStorage({ directory: temporaryDirectory() });
    const transformer = new ImageTransformer(storage);

    // Mock the storage methods
    vi.spyOn(storage, "get").mockResolvedValue({
        content: Buffer.from("fake image data"),
        contentType: "image/jpeg",
        ETag: "etag123",
        id: "test-image",
        metadata: {},
        modifiedAt: new Date(),
        name: "test.jpg",
        originalName: "test.jpg",
        size: 1024,
    });

    describe("transformStream()", () => {
        it("should return streaming result for image transformations", async () => {
            expect.assertions(4);

            // Mock the regular transform method
            const mockTransform = vi.spyOn(transformer, "transform").mockResolvedValue({
                buffer: Buffer.from("x".repeat(2048)), // Create buffer of correct size
                format: "png",
                height: 600,
                originalFile: {
                    content: Buffer.from("original"),
                    contentType: "image/jpeg",
                    id: "test-image",
                    metadata: {},
                    name: "test.jpg",
                    originalName: "test.jpg",
                    size: 1024,
                },
                size: 2048,
                width: 800,
            });

            if (!transformer.transformStream) {
                throw new Error("transformStream is not available");
            }

            const result = await transformer.transformStream("test-image", [{ options: { height: 600, width: 800 }, type: "resize" }]);

            expect(result).toBeDefined();
            expect(result.stream).toBeInstanceOf(Readable);
            expect(result.size).toBe(2048);
            expect(result.headers).toEqual({
                "Content-Length": "2048",
                "Content-Type": "image/png",
                "X-Image-Height": "600",
                "X-Image-Width": "800",
            });

            mockTransform.mockRestore();
        });

        it("should handle different image formats", async () => {
            expect.assertions(1);

            const mockTransform = vi.spyOn(transformer, "transform").mockResolvedValue({
                buffer: Buffer.from("webp image"),
                format: "webp",
                height: 300,
                originalFile: {
                    content: Buffer.from("original"),
                    contentType: "image/jpeg",
                    id: "test-image",
                    metadata: {},
                    name: "test.jpg",
                    originalName: "test.jpg",
                    size: 1024,
                },
                size: 1024,
                width: 400,
            });

            if (!transformer.transformStream) {
                throw new Error("transformStream is not available");
            }

            const result = await transformer.transformStream("test-image", [{ options: { format: "webp" }, type: "format" }]);

            expect(result.headers?.["Content-Type"]).toBe("image/webp");

            mockTransform.mockRestore();
        });

        it("should handle unknown formats gracefully", async () => {
            expect.assertions(1);

            const mockTransform = vi.spyOn(transformer, "transform").mockResolvedValue({
                buffer: Buffer.from("unknown format"),
                format: "unknown",
                originalFile: {
                    content: Buffer.from("original"),
                    contentType: "image/jpeg",
                    id: "test-image",
                    metadata: {},
                    name: "test.jpg",
                    originalName: "test.jpg",
                    size: 1024,
                },
                size: 512,
            });

            if (!transformer.transformStream) {
                throw new Error("transformStream is not available");
            }

            const result = await transformer.transformStream("test-image", []);

            expect(result.headers?.["Content-Type"]).toBe("application/octet-stream");

            mockTransform.mockRestore();
        });

        it("should have transformStream available", async () => {
            expect.assertions(2);

            // ImageTransformer always has transformStream available (it's overridden from base class)
            expect(transformer.transformStream).toBeDefined();
            expect(typeof transformer.transformStream).toBe("function");
        });

        it("should handle transform errors gracefully", async () => {
            expect.assertions(1);

            const mockTransform = vi.spyOn(transformer, "transform").mockRejectedValue(new Error("Transform failed"));

            if (!transformer.transformStream) {
                throw new Error("transformStream is not available");
            }

            await expect(transformer.transformStream("test-image", [])).rejects.toThrow("Transform failed");

            mockTransform.mockRestore();
        });
    });

    describe("getContentTypeFromResult()", () => {
        it("should return correct content type for supported formats", () => {
            expect.assertions(5);

            expect(transformer.getContentTypeFromResult({ format: "jpeg" })).toBe("image/jpeg");
            expect(transformer.getContentTypeFromResult({ format: "png" })).toBe("image/png");
            expect(transformer.getContentTypeFromResult({ format: "webp" })).toBe("image/webp");
            expect(transformer.getContentTypeFromResult({ format: "gif" })).toBe("image/gif");
            expect(transformer.getContentTypeFromResult({ format: "svg" })).toBe("image/svg+xml");
        });

        it("should handle jpg format correctly", () => {
            expect.assertions(1);

            expect(transformer.getContentTypeFromResult({ format: "jpg" })).toBe("image/jpeg");
        });

        it("should return default content type for unknown formats", () => {
            expect.assertions(2);

            expect(transformer.getContentTypeFromResult({ format: "unknown" })).toBe("application/octet-stream");
            expect(transformer.getContentTypeFromResult({})).toBe("application/octet-stream");
        });
    });
});
