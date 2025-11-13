import { Readable } from "node:stream";

import { temporaryDirectory } from "tempy";
import { describe, expect, it, vi } from "vitest";

import DiskStorage from "../../src/storage/local/disk-storage";
import ImageTransformer from "../../src/transformer/image-transformer";

describe("imageTransformer streaming", () => {
    const storage = new DiskStorage({ directory: temporaryDirectory() });
    const transformer = new ImageTransformer(storage);

    // Mock the storage methods
    const mockGet = vi.spyOn(storage, "get").mockResolvedValue({
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

            const result = await transformer.transformStream!("test-image", [{ options: { height: 600, width: 800 }, type: "resize" }]);

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

            const result = await transformer.transformStream!("test-image", [{ options: { format: "webp" }, type: "format" }]);

            expect(result.headers!["Content-Type"]).toBe("image/webp");

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

            const result = await transformer.transformStream!("test-image", []);

            expect(result.headers!["Content-Type"]).toBe("application/octet-stream");

            mockTransform.mockRestore();
        });

        it("should throw error when transformStream is not available", async () => {
            expect.assertions(1);

            // Temporarily remove the transformStream method
            const originalTransformStream = transformer.transformStream;

            delete (transformer as unknown as { transformStream?: typeof originalTransformStream }).transformStream;

            await expect(transformer.transformStream!("test-image", [])).rejects.toThrow();

            // Restore the method
            transformer.transformStream = originalTransformStream;
        });

        it("should handle transform errors gracefully", async () => {
            expect.assertions(1);

            const mockTransform = vi.spyOn(transformer, "transform").mockRejectedValue(new Error("Transform failed"));

            await expect(transformer.transformStream!("test-image", [])).rejects.toThrow();

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
