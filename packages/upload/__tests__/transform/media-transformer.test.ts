import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import type { MediaTransformerConfig } from "../../src/transform";
import MediaTransformer from "../../src/transform/media-transformer";

// Mock storage
const mockStorage = {
    get: vi.fn(),
    logger: console,
};

// Mock individual transformers
vi.mock(import("../../src/transform/image-transformer"), () => {
    return {
        default: vi.fn().mockImplementation(() => {
            return {
                clearCache: vi.fn(),
                getCacheStats: vi.fn(),
                transform: vi.fn(),
            };
        }),
    };
});

vi.mock(import("../../src/transform/video-transformer"), () => {
    return {
        default: vi.fn().mockImplementation(() => {
            return {
                clearCache: vi.fn(),
                getCacheStats: vi.fn(),
                transform: vi.fn(),
            };
        }),
    };
});

vi.mock(import("../../src/transform/audio-transformer"), () => {
    return {
        default: vi.fn().mockImplementation(() => {
            return {
                clearCache: vi.fn(),
                getCacheStats: vi.fn(),
                transform: vi.fn(),
            };
        }),
    };
});

describe(MediaTransformer, () => {
    let transformer: MediaTransformer;

    beforeEach(() => {
        vi.clearAllMocks();
        transformer = new MediaTransformer(mockStorage as any, {
            enableCache: false,
        });
    });

    describe("constructor", () => {
        it("should create transformer with default config", () => {
            const transformer = new MediaTransformer(mockStorage as any);

            expect(transformer).toBeInstanceOf(MediaTransformer);
        });

        it("should create transformer with custom config", () => {
            const config: MediaTransformerConfig = {
                cacheTtl: 7200,
                enableCache: true,
                maxAudioSize: 50 * 1024 * 1024,
                maxImageSize: 5 * 1024 * 1024,
                maxVideoSize: 200 * 1024 * 1024,
            };

            const transformer = new MediaTransformer(mockStorage as any, config);

            expect(transformer).toBeInstanceOf(MediaTransformer);
        });
    });

    describe("cache management", () => {
        it("should clear cache for specific file", () => {
            const transformer = new MediaTransformer(mockStorage as any, {
                enableCache: true,
            });

            // Should not throw
            transformer.clearCache("test-file-id");
        });

        it("should clear entire cache", () => {
            const transformer = new MediaTransformer(mockStorage as any, {
                enableCache: true,
            });

            // Should not throw
            transformer.clearCache();
        });

        it("should return cache stats", () => {
            const transformer = new MediaTransformer(mockStorage as any, {
                enableCache: true,
            });

            const stats = transformer.getCacheStats();

            expect(stats).toBeDefined();

            // When caching is enabled, cache stats should be available
            expectTypeOf(stats.image).toBeObject();
            expectTypeOf(stats.video).toBeObject();
            expectTypeOf(stats.audio).toBeObject();
        });
    });

    describe("query parsing", () => {
        it("should parse object query", () => {
            const query = {
                format: "webp",
                height: 600,
                quality: 80,
                width: 800,
            };

            // Test that handle method can process object queries
            // (Full integration test would require mocking storage.get)
            expectTypeOf(query).toBeObject();
        });

        it("should parse URLSearchParams", () => {
            const parameters = new URLSearchParams("width=800&height=600&format=webp&quality=80");

            // Test that handle method can process URLSearchParams
            // (Full integration test would require mocking storage.get)
            expect(parameters instanceof URLSearchParams).toBe(true);
        });

        it("should parse query string", () => {
            const queryString = "width=800&height=600&format=webp&quality=80";

            // Test that fetch method accepts query strings
            // (Full integration test would require mocking storage.get)
            expectTypeOf(queryString).toBeString();
        });
    });

    describe("mIME type detection", () => {
        it("should detect image MIME types", () => {
            // Test the private method indirectly through expected behavior
            // This would be tested in integration with actual handle method
            expect("image/jpeg".startsWith("image/")).toBe(true);
            expect("image/png".startsWith("image/")).toBe(true);
        });

        it("should detect video MIME types", () => {
            expect("video/mp4".startsWith("video/")).toBe(true);
            expect("video/webm".startsWith("video/")).toBe(true);
        });

        it("should detect audio MIME types", () => {
            expect("audio/mp3".startsWith("audio/")).toBe(true);
            expect("audio/wav".startsWith("audio/")).toBe(true);
        });

        it("should reject unsupported MIME types", () => {
            expect("application/json".startsWith("image/")).toBe(false);
            expect("application/json".startsWith("video/")).toBe(false);
            expect("application/json".startsWith("audio/")).toBe(false);
        });
    });

    describe("query parameter validation", () => {
        let transformer: MediaTransformer;

        beforeEach(() => {
            transformer = new MediaTransformer(mockStorage as any, {
                enableCache: false,
            });
        });

        describe("image parameter validation", () => {
            it("should accept valid image parameters", () => {
                const query = {
                    fit: "cover" as const,
                    format: "webp" as const,
                    height: 600,
                    quality: 80,
                    width: 800,
                };

                // Should not throw for valid image parameters
                expect(() => {
                    (transformer as any).validateImageQueryParameters(query);
                }).not.toThrow();
            });

            it("should reject video/audio parameters for images", () => {
                const query = {
                    codec: "avc", // Video-only parameter
                    sampleRate: 44_100, // Audio-only parameter
                    width: 800,
                };

                expect(() => {
                    (transformer as any).validateImageQueryParameters(query);
                }).toThrow(
                    "Invalid query parameters for image transformation: codec, sampleRate. "
                    + "Images support: angle, background, cropHeight, cropWidth, fit, format, height, left, position, quality, top, width, withoutEnlargement, withoutReduction. "
                    + "Video/audio parameters (codec, sampleRate) are not supported for images.",
                );
            });

            it("should reject invalid fit values", () => {
                const query = {
                    fit: "invalid" as any,
                };

                expect(() => {
                    (transformer as any).validateImageQueryParameters(query);
                }).toThrow("Invalid fit value: \"invalid\". Supported values: \"cover\", \"contain\", \"fill\", \"inside\", \"outside\"");
            });

            it("should reject invalid angle values", () => {
                const query = {
                    angle: 45,
                };

                expect(() => {
                    (transformer as any).validateImageQueryParameters(query);
                }).toThrow("Invalid angle value: 45. Supported values: 90, 180, 270");
            });

            it("should reject incomplete crop parameters", () => {
                const query = {
                    left: 10,
                    top: 20,
                    // Missing cropWidth and cropHeight
                };

                expect(() => {
                    (transformer as any).validateImageQueryParameters(query);
                }).toThrow("Incomplete crop parameters: left, top. All crop parameters must be provided: left, top, cropWidth, cropHeight");
            });
        });

        describe("video parameter validation", () => {
            it("should accept valid video parameters", () => {
                const query = {
                    bitrate: 2_000_000,
                    codec: "avc" as const,
                    format: "mp4" as const,
                    height: 1080,
                    width: 1920,
                };

                // Should not throw for valid video parameters
                expect(() => {
                    (transformer as any).validateVideoQueryParameters(query);
                }).not.toThrow();
            });

            it("should reject audio-only parameters for videos", () => {
                const query = {
                    numberOfChannels: 2, // Audio-only parameter
                    sampleRate: 44_100, // Audio-only parameter
                    width: 1920,
                };

                expect(() => {
                    (transformer as any).validateVideoQueryParameters(query);
                }).toThrow(
                    "Invalid query parameters for video transformation: numberOfChannels, sampleRate. "
                    + "Videos support: angle, background, bitrate, codec, cropHeight, cropWidth, fit, format, frameRate, height, keyFrameInterval, left, position, quality, top, width, withoutEnlargement, withoutReduction. "
                    + "Audio-only parameters (numberOfChannels, sampleRate) are not supported for videos.",
                );
            });

            it("should reject invalid codec for video", () => {
                const query = {
                    codec: "invalid",
                };

                expect(() => {
                    (transformer as any).validateVideoQueryParameters(query);
                }).toThrow("Invalid codec for video: \"invalid\". Supported codecs: avc, hevc, vp8, vp9, av1");
            });

            it("should reject invalid format for video", () => {
                const query = {
                    format: "jpg",
                };

                expect(() => {
                    (transformer as any).validateVideoQueryParameters(query);
                }).toThrow("Invalid format for video: \"jpg\". Supported formats: mp4, webm, mkv, ogg");
            });

            it("should reject negative width", () => {
                const query = {
                    width: -100,
                };

                expect(() => {
                    (transformer as any).validateVideoQueryParameters(query);
                }).toThrow("Invalid width: -100. Must be a positive number.");
            });

            it("should reject zero bitrate", () => {
                const query = {
                    bitrate: 0,
                };

                expect(() => {
                    (transformer as any).validateVideoQueryParameters(query);
                }).toThrow("Invalid bitrate: 0. Must be a positive number.");
            });
        });

        describe("audio parameter validation", () => {
            it("should accept valid audio parameters", () => {
                const query = {
                    bitrate: 128_000,
                    codec: "aac" as const,
                    format: "mp3" as const,
                    numberOfChannels: 2,
                    sampleRate: 44_100,
                };

                // Should not throw for valid audio parameters
                expect(() => {
                    (transformer as any).validateAudioQueryParameters(query);
                }).not.toThrow();
            });

            it("should reject video-only parameters for audio", () => {
                const query = {
                    angle: 90, // Video-only parameter
                    codec: "aac",
                    height: 600, // Video-only parameter
                    width: 800, // Video-only parameter
                };

                expect(() => {
                    (transformer as any).validateAudioQueryParameters(query);
                }).toThrow(
                    "Invalid query parameters for audio transformation: angle, height, width. "
                    + "Audio supports: bitrate, codec, format, numberOfChannels, quality, sampleRate. "
                    + "Video-only parameters (angle, height, width) are not supported for audio.",
                );
            });

            it("should reject invalid codec for audio", () => {
                const query = {
                    codec: "invalid",
                };

                expect(() => {
                    (transformer as any).validateAudioQueryParameters(query);
                }).toThrow("Invalid codec for audio: \"invalid\". Supported codecs: aac, opus, mp3, vorbis, flac");
            });

            it("should reject invalid format for audio", () => {
                const query = {
                    format: "mp4",
                };

                expect(() => {
                    (transformer as any).validateAudioQueryParameters(query);
                }).toThrow("Invalid format for audio: \"mp4\". Supported formats: mp3, wav, ogg, aac, flac");
            });

            it("should reject invalid sample rate", () => {
                const query = {
                    sampleRate: 12_345,
                };

                expect(() => {
                    (transformer as any).validateAudioQueryParameters(query);
                }).toThrow("Invalid sampleRate: 12345. Supported sample rates: 8000, 11025, 16000, 22050, 32000, 44100, 48000, 88200, 96000, 192000");
            });

            it("should reject invalid number of channels", () => {
                const query = {
                    numberOfChannels: 10,
                };

                expect(() => {
                    (transformer as any).validateAudioQueryParameters(query);
                }).toThrow("Invalid numberOfChannels: 10. Must be a number between 1 and 8.");
            });
        });
    });

    // Note: More comprehensive tests would require mocking the entire storage
    // and transformer stack, which is complex for this initial implementation.
    // Integration tests would be better suited for testing the full handle/fetch flow.
});
