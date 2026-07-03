/* eslint-disable max-classes-per-file */
/* eslint-disable n/no-unsupported-features/node-builtins */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import compressData from "../../../../../src/reporter/http/utils/compression";

// Mock zlib for Node.js fallback
vi.mock(import("node:zlib"), () => {
    return {
        gzipSync: vi.fn((data: string) => {
            // Return a simple mock compressed data
            const encoder = new TextEncoder();

            return encoder.encode(`compressed:${data}`);
        }),
    };
});

describe(compressData, () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("should compress data using CompressionStream when available", async () => {
        expect.assertions(5);

        // Mock CompressionStream API
        const mockChunks = [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5])];

        const mockWriter = {
            close: vi.fn().mockResolvedValue(undefined),
            write: vi.fn().mockResolvedValue(undefined),
        };

        const mockReader = {
            read: vi
                .fn()
                .mockResolvedValueOnce({ done: false, value: mockChunks[0] })
                .mockResolvedValueOnce({ done: false, value: mockChunks[1] })
                .mockResolvedValueOnce({ done: true }),
        };

        const mockWritable = {
            getWriter: vi.fn().mockReturnValue(mockWriter),
        };

        const mockReadable = {
            getReader: vi.fn().mockReturnValue(mockReader),
        };

        class MockCompressionStream {
            public readonly readable: typeof mockReadable;

            public readonly writable: typeof mockWritable;

            public constructor(_format: string) {
                this.readable = mockReadable;
                this.writable = mockWritable;
            }
        }

        // @ts-expect-error - Adding CompressionStream to globalThis
        globalThis.CompressionStream = MockCompressionStream;

        const result = await compressData("test data");

        expect(mockWriter.write).toHaveBeenCalledWith(expect.any(Uint8Array));
        expect(mockWriter.close).toHaveBeenCalledWith();
        expect(mockReader.read).toHaveBeenCalledTimes(3);
        expect(result).toBeInstanceOf(Uint8Array);
        expect(result).toHaveLength(5); // Combined length of both chunks

        // Cleanup
        // @ts-expect-error - Removing CompressionStream from globalThis
        delete globalThis.CompressionStream;
    });

    it("should use zlib fallback when CompressionStream is not available", async () => {
        expect.assertions(3);

        const { gzipSync } = await import("node:zlib");

        // Ensure CompressionStream is not available
        // @ts-expect-error - Removing CompressionStream from globalThis
        delete globalThis.CompressionStream;

        const result = await compressData("test data");

        expect(gzipSync).toHaveBeenCalledWith("test data");
        expect(result).toBeInstanceOf(Uint8Array);
        expect(result.length).toBeGreaterThan(0);
    });

    it("should handle empty string", async () => {
        expect.assertions(2);

        const { gzipSync } = await import("node:zlib");

        // @ts-expect-error - Removing CompressionStream from globalThis
        delete globalThis.CompressionStream;

        const result = await compressData("");

        expect(gzipSync).toHaveBeenCalledWith("");
        expect(result).toBeInstanceOf(Uint8Array);
    });

    it("should handle large strings", async () => {
        expect.assertions(3);

        const { gzipSync } = await import("node:zlib");

        // @ts-expect-error - Removing CompressionStream from globalThis
        delete globalThis.CompressionStream;

        const largeData = "x".repeat(10_000);
        const result = await compressData(largeData);

        expect(gzipSync).toHaveBeenCalledWith(largeData);
        expect(result).toBeInstanceOf(Uint8Array);
        expect(result.length).toBeGreaterThan(0);
    });

    it("should combine multiple chunks correctly", async () => {
        expect.assertions(2);

        // Mock CompressionStream with multiple chunks
        const mockChunks = [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6]), new Uint8Array([7, 8])];

        const mockWriter = {
            close: vi.fn().mockResolvedValue(undefined),
            write: vi.fn().mockResolvedValue(undefined),
        };

        let readCallCount = 0;
        const mockReader = {
            read: vi.fn().mockImplementation(() => {
                readCallCount += 1;

                if (readCallCount <= mockChunks.length) {
                    return Promise.resolve({ done: false, value: mockChunks[readCallCount - 1] });
                }

                return Promise.resolve({ done: true });
            }),
        };

        const mockWritable = {
            getWriter: vi.fn().mockReturnValue(mockWriter),
        };

        const mockReadable = {
            getReader: vi.fn().mockReturnValue(mockReader),
        };

        class MockCompressionStream {
            public readonly readable: typeof mockReadable;

            public readonly writable: typeof mockWritable;

            public constructor(_format: string) {
                this.readable = mockReadable;
                this.writable = mockWritable;
            }
        }

        // @ts-expect-error - Adding CompressionStream to globalThis
        globalThis.CompressionStream = MockCompressionStream;

        const result = await compressData("test data");

        expect(result).toHaveLength(8); // Sum of all chunk lengths: 3 + 3 + 2 = 8

        // Verify chunks are combined correctly
        expect([...result]).toStrictEqual([1, 2, 3, 4, 5, 6, 7, 8]);

        // Cleanup
        // @ts-expect-error - Removing CompressionStream from globalThis
        delete globalThis.CompressionStream;
    });

    it("should handle chunks with done: true and no value", async () => {
        expect.assertions(2);

        const mockWriter = {
            close: vi.fn().mockResolvedValue(undefined),
            write: vi.fn().mockResolvedValue(undefined),
        };

        const mockReader = {
            read: vi
                .fn()
                .mockResolvedValueOnce({ done: false, value: new Uint8Array([1, 2]) })
                .mockResolvedValueOnce({ done: true, value: undefined }),
        };

        const mockWritable = {
            getWriter: vi.fn().mockReturnValue(mockWriter),
        };

        const mockReadable = {
            getReader: vi.fn().mockReturnValue(mockReader),
        };

        class MockCompressionStream {
            public readonly readable: typeof mockReadable;

            public readonly writable: typeof mockWritable;

            public constructor(_format: string) {
                this.readable = mockReadable;
                this.writable = mockWritable;
            }
        }

        // @ts-expect-error - Adding CompressionStream to globalThis
        globalThis.CompressionStream = MockCompressionStream;

        const result = await compressData("test");

        expect(result).toBeInstanceOf(Uint8Array);
        expect(result).toHaveLength(2);

        // Cleanup
        // @ts-expect-error - Removing CompressionStream from globalThis
        delete globalThis.CompressionStream;
    });
});
