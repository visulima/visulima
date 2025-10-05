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
        it("should create transformer with default configuration", () => {
            expect.assertions(1);

            const transformer = new VideoTransformer(mockStorage as any);

            expect(transformer).toBeInstanceOf(VideoTransformer);
        });

        it("should create transformer with custom configuration", () => {
            expect.assertions(1);

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
            expect.assertions(0);

            const transformer = new VideoTransformer(mockStorage as any, {
                enableCache: true,
            });

            // Should not throw
            transformer.clearCache("test-file-id");
        });

        it("should clear entire cache", () => {
            expect.assertions(0);

            const transformer = new VideoTransformer(mockStorage as any, {
                enableCache: true,
            });

            // Should not throw
            transformer.clearCache();
        });

        it("should return cache stats when cache is enabled", () => {
            expect.assertions(1);

            const transformer = new VideoTransformer(mockStorage as any, {
                enableCache: true,
            });

            const stats = transformer.getCacheStats();

            expect(stats).toBeDefined();

            expectTypeOf(stats?.maxSize).toBeNumber();
            expectTypeOf(stats?.size).toBeNumber();
        });

        it("should return undefined cache stats when cache is disabled", () => {
            expect.assertions(1);

            const transformer = new VideoTransformer(mockStorage as any, {
                enableCache: false,
            });

            const stats = transformer.getCacheStats();

            expect(stats).toBeUndefined();
        });
    });

    describe("transformation methods", () => {
        it("should have resize method available", () => {
            expect.assertions(0);

            expectTypeOf(transformer.resize).toBeFunction();
        });

        it("should have crop method available", () => {
            expect.assertions(0);

            expectTypeOf(transformer.crop).toBeFunction();
        });

        it("should have rotate method available", () => {
            expect.assertions(0);

            expectTypeOf(transformer.rotate).toBeFunction();
        });

        it("should have convertFormat method available", () => {
            expect.assertions(0);

            expectTypeOf(transformer.convertFormat).toBeFunction();
        });

        it("should have transcode method available", () => {
            expect.assertions(0);

            expectTypeOf(transformer.transcode).toBeFunction();
        });

        it("should have transform method available", () => {
            expect.assertions(0);

            expectTypeOf(transformer.transform).toBeFunction();
        });
    });
});
