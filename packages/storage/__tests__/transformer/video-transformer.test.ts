import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import type { VideoTransformerConfig } from "../../src/transformer";
import VideoTransformer from "../../src/transformer/video-transformer";

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
        transformer = new VideoTransformer(mockStorage as import("../../src/storage/storage").BaseStorage, {});
    });

    describe("constructor", () => {
        it("should create transformer with default configuration", () => {
            expect.assertions(1);

            const transformer = new VideoTransformer(mockStorage as import("../../src/storage/storage").BaseStorage);

            expect(transformer).toBeInstanceOf(VideoTransformer);
        });

        it("should create transformer with custom configuration", () => {
            expect.assertions(1);

            const config: VideoTransformerConfig = {
                cache: new Map(),
                cacheTtl: 7200,
                maxVideoSize: 100 * 1024 * 1024,
            };

            const transformer = new VideoTransformer(mockStorage as import("../../src/storage/storage").BaseStorage, config);

            expect(transformer).toBeInstanceOf(VideoTransformer);
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
