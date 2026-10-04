import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

import MemoryStorage from "../../src/storage/memory/memory-storage";
import AudioTransformer from "../../src/transformer/audio-transformer";
import ImageTransformer from "../../src/transformer/image-transformer";
import MediaTransformer from "../../src/transformer/media-transformer";
import ValidationError from "../../src/transformer/validation-error";
import VideoTransformer from "../../src/transformer/video-transformer";
import { makeImage, makeMp4, makeWav, seedFile } from "../__helpers__/media";

const ALL = { AudioTransformer, ImageTransformer, VideoTransformer };

const setup = async (config: ConstructorParameters<typeof MediaTransformer>[1] = ALL): Promise<{ media: MediaTransformer; storage: MemoryStorage }> => {
    const storage = new MemoryStorage();

    await seedFile(storage, "image-file", await makeImage(40, 20), "image/png");
    await seedFile(storage, "audio-file", makeWav(44_100, 2, 4410), "audio/wav");
    await seedFile(storage, "video-file", await makeMp4(), "video/mp4");
    await seedFile(storage, "text-file", Buffer.from("hello"), "text/plain");

    return { media: new MediaTransformer(storage, config), storage };
};

const rejectsWithCode = async (promise: Promise<unknown>, code: string): Promise<void> => {
    await expect(promise).rejects.toBeInstanceOf(ValidationError);
    await expect(promise).rejects.toMatchObject({ code, name: "ValidationError" });
};

describe("mediaTransformer with real transformers", () => {
    it("requires at least one transformer", () => {
        expect.assertions(1);

        expect(() => new MediaTransformer(new MemoryStorage(), {})).toThrow(/No transformers are configured/);
    });

    it("lists the formats of the configured transformers", async () => {
        expect.assertions(2);

        const { media } = await setup({ ImageTransformer });

        expect(media.supportedFormats()).toStrictEqual(["jpeg", "png", "webp", "avif", "tiff", "gif", "svg"]);
        expect(media.getCacheStats()).toStrictEqual({ image: { maxSize: 100, size: 0 } });
    });

    describe("routing by media type", () => {
        it("routes images to the image transformer", async () => {
            expect.assertions(2);

            const { media } = await setup();
            const result = await media.handle("image-file", { format: "webp", width: "10" });

            expect(result).toMatchObject({ format: "webp", height: 5, mediaType: "image", width: 10 });
            await expect(sharp(result.buffer).metadata()).resolves.toMatchObject({ format: "webp", width: 10 });
        });

        it("routes audio to the audio transformer", async () => {
            expect.assertions(1);

            const { media } = await setup();

            await expect(media.handle("audio-file", { format: "wav", numberOfChannels: "1", sampleRate: "22050" })).resolves.toMatchObject({
                format: "wav",
                mediaType: "audio",
                numberOfChannels: 1,
                sampleRate: 22_050,
            });
        });

        it("routes video to the video transformer", async () => {
            expect.assertions(1);

            const { media } = await setup();

            await expect(media.handle("video-file", { format: "mkv" })).resolves.toMatchObject({ format: "mkv", height: 16, mediaType: "video", width: 32 });
        });

        it("rotates a video through the query", async () => {
            expect.assertions(1);

            const { media } = await setup();

            await expect(media.fetch("video-file", "angle=90")).resolves.toMatchObject({ height: 32, width: 16 });
        });

        it.each([
            ["image", { ImageTransformer: undefined, VideoTransformer }, "image-file", "Image transformer not available", "width=10"],
            ["video", { ImageTransformer }, "video-file", "Video transformer not available", "width=10"],
            ["audio", { ImageTransformer }, "audio-file", "Audio transformer not available", "format=wav"],
        ] as const)("fails for %s without that transformer", async (_type, config, id, message, query) => {
            expect.assertions(1);

            const { media } = await setup(config);

            await expect(media.fetch(id, query).catch((error: Error) => error.message)).resolves.toContain(message);
        });

        it("rejects content types that are not media", async () => {
            expect.assertions(1);

            const { media } = await setup();

            await expect(media.handle("text-file", { width: "10" })).rejects.toThrow("Unsupported media type for content type: text/plain");
        });

        it("rejects unknown content types", async () => {
            expect.assertions(1);

            const { media, storage } = await setup();

            await seedFile(storage, "odd-file", Buffer.from("x"), "image/x-nope");

            await expect(media.handle("odd-file", { width: "10" })).rejects.toThrow("Unknown or invalid content type: image/x-nope");
        });
    });

    describe("image query parameters", () => {
        it.each([
            ["string", "width=20&height=20&fit=contain"],
            ["URLSearchParams", new URLSearchParams("width=20&height=20&fit=contain")],
            ["record", { fit: "contain", height: "20", width: "20" }],
        ] as const)("parses a %s query", async (_kind, query) => {
            expect.assertions(1);

            const { media } = await setup();

            await expect(media.handle("image-file", query as never)).resolves.toMatchObject({ height: 20, width: 20 });
        });

        it("parses boolean strings in a record query", async () => {
            expect.assertions(2);

            const { media } = await setup();

            // sharp throws on the string "true"; the handlers pass the query as a string record.
            await expect(media.handle("image-file", { width: "400", withoutEnlargement: "true" })).resolves.toMatchObject({ width: 40 });
            await expect(media.handle("image-file", { width: "400", withoutEnlargement: "false" })).resolves.toMatchObject({ width: 400 });
        });

        it("crops with left/top/cropWidth/cropHeight", async () => {
            expect.assertions(1);

            const { media } = await setup();

            await expect(media.fetch("image-file", "left=1&top=2&cropWidth=6&cropHeight=4")).resolves.toMatchObject({ height: 4, width: 6 });
        });

        it("rotates with angle and background", async () => {
            expect.assertions(1);

            const { media } = await setup();

            await expect(media.fetch("image-file", "angle=90&background=%23ffffff")).resolves.toMatchObject({ height: 40, width: 20 });
        });

        it("keeps the format when only quality is given", async () => {
            expect.assertions(1);

            const { media } = await setup();

            await expect(media.fetch("image-file", "quality=40")).resolves.toMatchObject({ format: "png" });
        });

        it("applies lossless and effort", async () => {
            expect.assertions(2);

            const { media } = await setup();
            const transform = vi.spyOn(ImageTransformer.prototype, "transform");

            await expect(media.fetch("image-file", "format=webp&lossless=true&effort=1")).resolves.toMatchObject({ format: "webp" });
            expect(transform).toHaveBeenLastCalledWith("image-file", [{ options: { effort: 1, format: "webp", lossless: true, quality: undefined }, type: "format" }]);

            transform.mockRestore();
        });

        it("turns the documented filter flags into steps", async () => {
            expect.assertions(2);

            const { media } = await setup();
            const transform = vi.spyOn(ImageTransformer.prototype, "transform");

            await expect(
                media.fetch(
                    "image-file",
                    "blur=true&sharpen=1&greyscale=true&flip=true&flop=true&negate=true&normalize=true&gamma=true&flatten=true&median=3&threshold=100&brightness=1.5&hue=90",
                ),
            ).resolves.toMatchObject({ height: 20, width: 40 });
            expect(transform.mock.lastCall?.[1].map((step) => step.type)).toStrictEqual([
                "blur",
                "flatten",
                "flip",
                "flop",
                "gamma",
                "greyscale",
                "negate",
                "normalise",
                "sharpen",
                "median",
                "threshold",
                "modulate",
            ]);

            transform.mockRestore();
        });

        it("ignores flags set to false", async () => {
            expect.assertions(1);

            const { media } = await setup();
            const transform = vi.spyOn(ImageTransformer.prototype, "transform");

            await media.handle("image-file", { blur: "false", width: "10" });

            expect(transform.mock.lastCall?.[1].map((step) => step.type)).toStrictEqual(["resize"]);

            transform.mockRestore();
        });

        it("negates the image for real", async () => {
            expect.assertions(1);

            const { media } = await setup();
            const result = await media.fetch("image-file", "negate=true&format=png");
            const [red, green, blue] = await sharp(result.buffer).removeAlpha().raw().toBuffer();

            expect([red, green, blue]).toStrictEqual([0, 255, 255]);
        });
    });

    describe("validation errors", () => {
        it.each([
            ["image-file", "codec=avc", "INVALID_PARAMS_FOR_IMAGE"],
            ["image-file", "sampleRate=44100", "INVALID_PARAMS_FOR_IMAGE"],
            ["image-file", "fit=bogus", "INVALID_FIT_VALUE"],
            ["image-file", "format=bmp", "INVALID_FORMAT"],
            ["image-file", "left=1&top=1", "INCOMPLETE_CROP_PARAMS"],
            ["video-file", "sampleRate=44100", "INVALID_PARAMS_FOR_VIDEO"],
            ["video-file", "fit=bogus", "INVALID_FIT_VALUE"],
            ["video-file", "codec=mp3", "INVALID_VIDEO_CODEC"],
            ["video-file", "codec=bogus", "INVALID_VIDEO_CODEC"],
            ["video-file", "format=avi", "INVALID_VIDEO_FORMAT"],
            ["video-file", "cropWidth=4", "INCOMPLETE_CROP_PARAMS"],
            ["video-file", "width=-5", "INVALID_WIDTH"],
            ["video-file", "height=0x", "INVALID_HEIGHT"],
            ["video-file", "bitrate=-1", "INVALID_BITRATE"],
            ["video-file", "frameRate=-30", "INVALID_FRAME_RATE"],
            ["video-file", "keyFrameInterval=-2", "INVALID_KEY_FRAME_INTERVAL"],
            ["audio-file", "width=10", "INVALID_PARAMS_FOR_AUDIO"],
            ["audio-file", "codec=avc", "INVALID_AUDIO_CODEC"],
            ["audio-file", "format=mp4", "INVALID_AUDIO_FORMAT"],
            ["audio-file", "bitrate=-1", "INVALID_BITRATE"],
            ["audio-file", "numberOfChannels=9", "INVALID_CHANNEL_COUNT"],
            ["audio-file", "sampleRate=12345", "INVALID_SAMPLE_RATE"],
        ])("rejects %s?%s with %s", async (id, query, code) => {
            expect.assertions(2);

            const { media } = await setup();

            await rejectsWithCode(media.fetch(id, query), code);
        });

        it("carries the invalid and valid parameters", async () => {
            expect.assertions(1);

            const { media } = await setup();

            await expect(media.fetch("image-file", "fit=bogus")).rejects.toMatchObject({
                details: { invalidParams: ["fit"], mediaType: "image", validParams: ["cover", "contain", "fill", "inside", "outside"] },
            });
        });
    });

    describe("caching", () => {
        it("shares one cache across the transformers", async () => {
            expect.assertions(2);

            const cache = new Map();
            const { media } = await setup({ AudioTransformer, cache, ImageTransformer });

            await media.fetch("image-file", "width=10");
            await media.fetch("audio-file", "format=wav");

            expect(cache.size).toBe(2);

            media.clearCache("image-file");

            expect([...cache.keys()].every((key: string) => key.startsWith("audio-file:"))).toBe(true);
        });

        it("clears every transformer cache", async () => {
            expect.assertions(1);

            const cache = new Map();
            const { media } = await setup({ AudioTransformer, cache, ImageTransformer });

            await media.fetch("image-file", "width=10");
            await media.fetch("audio-file", "format=wav");
            media.clearCache();

            expect(cache.size).toBe(0);
        });
    });

    describe("saveTransformedFiles", () => {
        it("persists the transform and serves it from storage next time", async () => {
            expect.assertions(4);

            const { media, storage } = await setup({ ImageTransformer, saveTransformedFiles: true });
            const transform = vi.spyOn(ImageTransformer.prototype, "transform");

            const first = await media.fetch("image-file", "width=10&format=webp");
            const items = await storage.list();
            const saved = items.find((item) => item.id.startsWith("image-file_transformed_"));

            expect(saved).toMatchObject({ contentType: "image/webp", metadata: expect.objectContaining({ height: 5, originalFileId: "image-file", width: 10 }) });

            const second = await media.fetch("image-file", "format=webp&width=10");

            expect(transform).toHaveBeenCalledTimes(1);
            expect(second.buffer.equals(first.buffer)).toBe(true);
            expect(second).toMatchObject({ format: "webp", mediaType: "image" });

            transform.mockRestore();
        });

        it("transforms again once the original is replaced", async () => {
            expect.assertions(2);

            const { media, storage } = await setup({ ImageTransformer, saveTransformedFiles: true });

            await expect(media.fetch("image-file", "height=10")).resolves.toMatchObject({ width: 20 });

            await seedFile(storage, "image-file", await makeImage(80, 20), "image/png");

            await expect(media.fetch("image-file", "height=10")).resolves.toMatchObject({ width: 40 });
        });

        it("does not persist requests without transformations", async () => {
            expect.assertions(1);

            const { media, storage } = await setup({ ImageTransformer, saveTransformedFiles: true });

            await media.handle("image-file", {});

            const items = await storage.list();

            expect(items.some((item) => item.id.includes("_transformed_"))).toBe(false);
        });

        it("still returns the transform when saving it fails", async () => {
            expect.assertions(2);

            const logger = { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() };
            const { media, storage } = await setup({ ImageTransformer, logger: logger as unknown as Console, saveTransformedFiles: true });

            vi.spyOn(storage, "create").mockRejectedValueOnce(new Error("disk full"));

            await expect(media.fetch("image-file", "width=10")).resolves.toMatchObject({ width: 10 });
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("disk full"));
        });

        it("only warns for the unimplemented bulk clean-up", async () => {
            expect.assertions(2);

            const logger = { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() };
            const { media } = await setup({ ImageTransformer, logger: logger as unknown as Console, saveTransformedFiles: true });

            await media.clearSavedTransformedFiles();
            await media.clearSavedTransformedFilesForFile("image-file");

            expect(logger.warn).toHaveBeenCalledTimes(2);
            expect(logger.error).not.toHaveBeenCalled();
        });
    });
});
