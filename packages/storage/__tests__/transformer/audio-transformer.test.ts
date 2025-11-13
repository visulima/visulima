import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import type { AudioTransformerConfig } from "../../src/transformer";
import AudioTransformer from "../../src/transformer/audio-transformer";

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
        Mp3OutputFormat: vi.fn(),
        Output: vi.fn(),
    };
});

describe(AudioTransformer, () => {
    let transformer: AudioTransformer;

    beforeEach(() => {
        vi.clearAllMocks();
        transformer = new AudioTransformer(mockStorage as import("../../src/storage/storage").BaseStorage, {});
    });

    describe("constructor", () => {
        it("should create transformer with default configuration", () => {
            expect.assertions(1);

            const newTransformer = new AudioTransformer(mockStorage as import("../../src/storage/storage").BaseStorage);

            expect(newTransformer).toBeInstanceOf(AudioTransformer);
        });

        it("should create transformer with custom configuration", () => {
            expect.assertions(1);

            const config: AudioTransformerConfig = {
                cache: new Map(),
                cacheTtl: 7200,
                maxAudioSize: 50 * 1024 * 1024,
            };

            const newTransformer = new AudioTransformer(mockStorage as import("../../src/storage/storage").BaseStorage, config);

            expect(newTransformer).toBeInstanceOf(AudioTransformer);
        });
    });

    describe("transformation methods", () => {
        it("should have resample method available", () => {
            expect.assertions(0);

            expectTypeOf(transformer.resample).toBeFunction();
        });

        it("should have mixChannels method available", () => {
            expect.assertions(0);

            expectTypeOf(transformer.mixChannels).toBeFunction();
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
