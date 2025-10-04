import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import type { VideoTransformerConfig } from "../../src/transform";
import VideoTransformer from "../../src/transform/video-transformer";

// Mock storage
const mockStorage = {
    get: vi.fn(),
    logger: console,
};

// Mock Mediabunny (we'll use a simple mock since Mediabunny might not be available in test environment)
vi.mock(import("mediabunny"), () => {
    return {
        ALL_FORMATS: [],
        BufferSource: vi.fn(),
        BufferTarget: vi.fn(),
        Conversion: {
            init: vi.fn(),
        },
        Input: vi.fn(),
        Mp4OutputFormat: vi.fn(),
        Output: vi.fn(),
    };
});

describe(VideoTransformer, () => {
    let transformer: VideoTransformer;

    beforeEach(() => {
        vi.clearAllMocks();
        transformer = new VideoTransformer(mockStorage as any, {
            enableCache: false,
        });
    });

    describe("constructor", () => {
        it("should create transformer with default config", () => {
            const transformer = new VideoTransformer(mockStorage as any);

            expect(transformer).toBeInstanceOf(VideoTransformer);
        });

        it("should create transformer with custom config", () => {
            const config: VideoTransformerConfig = {
                cacheTtl: 7200,
                enableCache: true,
                maxVideoSize: 100 * 1024 * 1024,
            };

            const transformer = new VideoTransformer(mockStorage as any, config);

            expect(transformer).toBeInstanceOf(VideoTransformer);
        });
    });

    describe("cache management", () => {
        it("should clear cache for specific file", () => {
            const transformer = new VideoTransformer(mockStorage as any, {
                enableCache: true,
            });

            // Should not throw
            transformer.clearCache("test-file-id");
        });

        it("should clear entire cache", () => {
            const transformer = new VideoTransformer(mockStorage as any, {
                enableCache: true,
            });

            // Should not throw
            transformer.clearCache();
        });

        it("should return cache stats when cache is enabled", () => {
            const transformer = new VideoTransformer(mockStorage as any, {
                enableCache: true,
            });

            const stats = transformer.getCacheStats();

            expect(stats).toBeDefined();

            expectTypeOf(stats?.maxSize).toBeNumber();
            expectTypeOf(stats?.size).toBeNumber();
        });

        it("should return undefined cache stats when cache is disabled", () => {
            const transformer = new VideoTransformer(mockStorage as any, {
                enableCache: false,
            });

            const stats = transformer.getCacheStats();

            expect(stats).toBeUndefined();
        });
    });

    describe("transformation methods", () => {
        it("should have resize method", () => {
            expectTypeOf(transformer.resize).toBeFunction();
        });

        it("should have crop method", () => {
            expectTypeOf(transformer.crop).toBeFunction();
        });

        it("should have rotate method", () => {
            expectTypeOf(transformer.rotate).toBeFunction();
        });

        it("should have convertFormat method", () => {
            expectTypeOf(transformer.convertFormat).toBeFunction();
        });

        it("should have transcode method", () => {
            expectTypeOf(transformer.transcode).toBeFunction();
        });

        it("should have transform method", () => {
            expectTypeOf(transformer.transform).toBeFunction();
        });
    });

    // Note: More comprehensive tests would require mocking the entire Mediabunny library
    // and creating test video files, which is complex for this initial implementation
});
