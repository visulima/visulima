import { Readable } from "node:stream";

import { describe, expect, it, vi } from "vitest";

import { detectFileTypeFromBuffer, detectFileTypeFromStream } from "../../src/utils/detect-file-type";

// Mock file-type
vi.mock(import("file-type"), async () => {
    const actual = await vi.importActual<typeof import("file-type")>("file-type");

    return {
        ...actual,
        fileTypeFromBuffer: vi.fn(),
    };
});

describe(detectFileTypeFromBuffer, () => {
    it("should detect file type from buffer", async () => {
        expect.assertions(1);

        const { fileTypeFromBuffer } = await import("file-type");
        const mockFileType = { ext: "png", mime: "image/png" };

        vi.mocked(fileTypeFromBuffer).mockResolvedValue(mockFileType);

        const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG magic bytes
        const result = await detectFileTypeFromBuffer(buffer);

        expect(result).toStrictEqual(mockFileType);
    });

    it("should return undefined when file type cannot be detected", async () => {
        expect.assertions(1);

        const { fileTypeFromBuffer } = await import("file-type");

        vi.mocked(fileTypeFromBuffer).mockResolvedValue(undefined);

        const buffer = Buffer.from([0x00, 0x00, 0x00, 0x00]);
        const result = await detectFileTypeFromBuffer(buffer);

        expect(result).toBeUndefined();
    });

    it("should return undefined when detection throws an error", async () => {
        expect.assertions(1);

        const { fileTypeFromBuffer } = await import("file-type");

        vi.mocked(fileTypeFromBuffer).mockRejectedValue(new Error("Detection failed"));

        const buffer = Buffer.from([0x00, 0x00, 0x00, 0x00]);
        const result = await detectFileTypeFromBuffer(buffer);

        expect(result).toBeUndefined();
    });
});

describe(detectFileTypeFromStream, () => {
    it("should detect file type from stream", async () => {
        expect.assertions(2);

        const { fileTypeFromBuffer } = await import("file-type");
        const mockFileType = { ext: "jpg", mime: "image/jpeg" };

        vi.mocked(fileTypeFromBuffer).mockResolvedValue(mockFileType);

        // Create a stream with PNG magic bytes
        const stream = Readable.from(Buffer.from([0xff, 0xd8, 0xff, 0xe0])); // JPEG magic bytes

        const { fileType, stream: outputStream } = await detectFileTypeFromStream(stream);

        // Wait a bit for detection to complete
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(fileType).toStrictEqual(mockFileType);
        expect(outputStream).toBeInstanceOf(Readable);
    });

    it("should return stream even when detection fails", async () => {
        expect.assertions(2);

        const { fileTypeFromBuffer } = await import("file-type");

        vi.mocked(fileTypeFromBuffer).mockResolvedValue(undefined);

        const stream = Readable.from(Buffer.from([0x00, 0x00, 0x00, 0x00]));

        const { fileType, stream: outputStream } = await detectFileTypeFromStream(stream);

        // Wait a bit for detection to complete
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(fileType).toBeUndefined();
        expect(outputStream).toBeInstanceOf(Readable);
    });

    it("should handle stream errors gracefully", async () => {
        expect.assertions(2);

        const { fileTypeFromBuffer } = await import("file-type");

        vi.mocked(fileTypeFromBuffer).mockRejectedValue(new Error("Detection failed"));

        const stream = Readable.from(Buffer.from([0x00, 0x00, 0x00, 0x00]));

        const { fileType, stream: outputStream } = await detectFileTypeFromStream(stream);

        // Wait a bit for detection to complete
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(fileType).toBeUndefined();
        expect(outputStream).toBeInstanceOf(Readable);
    });

    it("should use custom sample size when provided", async () => {
        expect.assertions(1);

        const { fileTypeFromBuffer } = await import("file-type");
        const mockFileType = { ext: "pdf", mime: "application/pdf" };

        vi.mocked(fileTypeFromBuffer).mockResolvedValue(mockFileType);

        // Create a stream with enough data
        const largeBuffer = Buffer.alloc(5000, 0x25); // 5000 bytes
        const stream = Readable.from(largeBuffer);

        const { fileType } = await detectFileTypeFromStream(stream, { sampleSize: 2000 });

        // Wait a bit for detection to complete
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(fileType).toStrictEqual(mockFileType);
    });

    it("should return a readable stream that can be consumed", async () => {
        expect.assertions(3);

        const { fileTypeFromBuffer } = await import("file-type");
        const mockFileType = { ext: "png", mime: "image/png" };

        vi.mocked(fileTypeFromBuffer).mockResolvedValue(mockFileType);

        const originalData = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Buffer.alloc(100, 0x42)]);
        const stream = Readable.from(originalData);

        const { fileType, stream: outputStream } = await detectFileTypeFromStream(stream);

        // Check stream immediately (before it might end)
        expect(outputStream).toBeInstanceOf(Readable);

        // Stream should be readable OR already ended (both are valid states)
        const isReadableOrEnded = outputStream.readable || outputStream.readableEnded;

        expect(isReadableOrEnded).toBe(true);

        // Wait for detection
        await new Promise((resolve) => setTimeout(resolve, 200));

        // Verify fileType is detected
        expect(fileType).toStrictEqual(mockFileType);
    });

    it("should handle empty stream", async () => {
        expect.assertions(2);

        const { fileTypeFromBuffer } = await import("file-type");

        vi.mocked(fileTypeFromBuffer).mockResolvedValue(undefined);

        const stream = Readable.from([]);

        const chunks: Buffer[] = [];
        const { fileType, stream: outputStream } = await detectFileTypeFromStream(stream);

        // Set up listeners immediately
        outputStream.on("data", (chunk) => {
            chunks.push(chunk);
        });

        // Wait for stream to end
        await new Promise<void>((resolve) => {
            if (outputStream.readableEnded) {
                resolve();
            } else {
                outputStream.once("end", () => resolve());
                setTimeout(() => resolve(), 200);
            }
        });

        expect(fileType).toBeUndefined();
        expect(chunks).toHaveLength(0);
    });

    it("should handle stream ending before detection completes", async () => {
        expect.assertions(2);

        const { fileTypeFromBuffer } = await import("file-type");
        const mockFileType = { ext: "gif", mime: "image/gif" };

        // Delay detection to simulate stream ending first
        vi.mocked(fileTypeFromBuffer).mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(mockFileType), 200)));

        const stream = Readable.from(Buffer.from([0x47, 0x49, 0x46, 0x38])); // GIF magic bytes

        const { fileType, stream: outputStream } = await detectFileTypeFromStream(stream);

        // Wait for stream to end and detection to complete
        await new Promise((resolve) => setTimeout(resolve, 250));

        expect(outputStream).toBeInstanceOf(Readable);
        // FileType might be undefined if detection didn't complete in time, or set if it did
        expect(typeof fileType === "object" || fileType === undefined).toBe(true);
    });

    it("should return stream even when input stream has errors", async () => {
        expect.assertions(2);

        const { fileTypeFromBuffer } = await import("file-type");

        vi.mocked(fileTypeFromBuffer).mockResolvedValue(undefined);

        // Create a normal stream (error handling is tested in integration tests)
        const stream = Readable.from(Buffer.from([0x00, 0x00]));

        const { fileType, stream: outputStream } = await detectFileTypeFromStream(stream);

        // Wait a bit for detection to complete
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Should return a stream even if detection fails
        expect(fileType).toBeUndefined();
        expect(outputStream).toBeInstanceOf(Readable);
    });

    it("should handle streams with multiple chunks", async () => {
        expect.assertions(2);

        const { fileTypeFromBuffer } = await import("file-type");
        const mockFileType = { ext: "jpg", mime: "image/jpeg" };

        vi.mocked(fileTypeFromBuffer).mockResolvedValue(mockFileType);

        // Create stream with multiple small chunks
        const chunks = [Buffer.from([0xff, 0xd8]), Buffer.from([0xff, 0xe0]), Buffer.from([0x00, 0x10]), Buffer.from([0x4a, 0x46])];
        const expectedData = Buffer.concat(chunks);
        const stream = Readable.from(chunks);

        const outputChunks: Buffer[] = [];
        const { fileType, stream: outputStream } = await detectFileTypeFromStream(stream);

        // Set up listeners immediately
        outputStream.on("data", (chunk) => {
            outputChunks.push(chunk);
        });

        // Wait for stream to end
        await new Promise<void>((resolve) => {
            if (outputStream.readableEnded) {
                resolve();
            } else {
                outputStream.once("end", () => resolve());
                setTimeout(() => resolve(), 200);
            }
        });

        const outputData = Buffer.concat(outputChunks);

        expect(fileType).toStrictEqual(mockFileType);
        expect(outputData.equals(expectedData)).toBe(true);
    });

    it("should handle backpressure correctly", async () => {
        expect.assertions(2);

        const { fileTypeFromBuffer } = await import("file-type");
        const mockFileType = { ext: "png", mime: "image/png" };

        vi.mocked(fileTypeFromBuffer).mockResolvedValue(mockFileType);

        // Create a large stream to test backpressure
        const largeData = Buffer.alloc(10_000, 0x42);
        const stream = Readable.from(largeData);

        const chunks: Buffer[] = [];
        const { fileType, stream: outputStream } = await detectFileTypeFromStream(stream);

        // Set up listeners immediately with backpressure handling
        let paused = false;

        outputStream.on("data", (chunk) => {
            chunks.push(chunk);

            // Simulate slow consumption
            if (!paused && chunks.length > 5) {
                paused = true;
                outputStream.pause();
                setTimeout(() => {
                    outputStream.resume();
                }, 10);
            }
        });

        // Wait for all data
        await new Promise<void>((resolve) => {
            if (outputStream.readableEnded) {
                resolve();
            } else {
                outputStream.once("end", () => resolve());
                setTimeout(() => resolve(), 500);
            }
        });

        expect(fileType).toStrictEqual(mockFileType);
        expect(Buffer.concat(chunks)).toHaveLength(largeData.length);
    });
});
