import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

import MemoryStorage from "../../src/storage/memory/memory-storage";
import ImageTransformer from "../../src/transformer/image-transformer";
import { makeImage, seedFile } from "../__helpers__/media";

const ID = "image-file";

const setup = async (
    image?: Buffer,
    config: ConstructorParameters<typeof ImageTransformer>[1] = {},
    contentType = "image/png",
): Promise<{ storage: MemoryStorage; transformer: ImageTransformer }> => {
    const storage = new MemoryStorage();

    await seedFile(storage, ID, image ?? (await makeImage(40, 20)), contentType);

    return { storage, transformer: new ImageTransformer(storage, config) };
};

/** A 2x1 raw image: a red pixel then a blue one. */
const twoPixels = async (width: number, height: number): Promise<Buffer> =>
    sharp(Buffer.from([255, 0, 0, 0, 0, 255]), { raw: { channels: 3, height, width } })
        .png()
        .toBuffer();

const pixels = async (buffer: Buffer): Promise<number[]> => [...(await sharp(buffer).removeAlpha().raw().toBuffer())];

describe("imageTransformer with sharp", () => {
    describe("geometry", () => {
        it.each([
            ["cover", 10, 10, 10, 10],
            ["contain", 10, 10, 10, 10],
            ["fill", 10, 10, 10, 10],
            ["inside", 10, 10, 10, 5],
            ["outside", 10, 10, 20, 10],
        ] as const)("resizes with fit=%s", async (fit, width, height, expectedWidth, expectedHeight) => {
            expect.assertions(2);

            const { transformer } = await setup();
            const result = await transformer.resize(ID, { fit, height, width });

            expect([result.width, result.height]).toStrictEqual([expectedWidth, expectedHeight]);
            await expect(sharp(result.buffer).metadata()).resolves.toMatchObject({ height: expectedHeight, width: expectedWidth });
        });

        it("keeps the aspect ratio when only the width is given", async () => {
            expect.assertions(1);

            const { transformer } = await setup();

            await expect(transformer.resize(ID, { width: 20 })).resolves.toMatchObject({ height: 10, width: 20 });
        });

        it("honours withoutEnlargement", async () => {
            expect.assertions(1);

            const { transformer } = await setup();

            await expect(transformer.resize(ID, { width: 400, withoutEnlargement: true })).resolves.toMatchObject({ height: 20, width: 40 });
        });

        it("applies encoder options given with a resize", async () => {
            expect.assertions(1);

            const { transformer } = await setup();
            const result = await transformer.resize(ID, { format: "webp", quality: 50, width: 10 });

            expect(result).toMatchObject({ format: "webp", width: 10 });
        });

        it("crops a region", async () => {
            expect.assertions(1);

            const { transformer } = await setup();

            await expect(transformer.crop(ID, { height: 5, left: 2, top: 3, width: 7 })).resolves.toMatchObject({ height: 5, width: 7 });
        });

        it("crops and converts in one step", async () => {
            expect.assertions(1);

            const { transformer } = await setup();

            await expect(transformer.crop(ID, { format: "jpeg", height: 5, left: 0, quality: 70, top: 0, width: 5 })).resolves.toMatchObject({ format: "jpeg" });
        });

        it("rejects a crop outside the image", async () => {
            expect.assertions(1);

            const { transformer } = await setup();

            await expect(transformer.crop(ID, { height: 50, left: 0, top: 0, width: 50 })).rejects.toThrow(/extract_area|bad extract area/i);
        });

        it.each([
            [90, 20, 40],
            [180, 40, 20],
            [270, 20, 40],
        ])("rotates by %i degrees", async (angle, width, height) => {
            expect.assertions(1);

            const { transformer } = await setup();

            await expect(transformer.rotate(ID, { angle, background: "#ffffff" })).resolves.toMatchObject({ height, width });
        });

        it("grows the canvas for arbitrary angles", async () => {
            expect.assertions(1);

            const { transformer } = await setup();
            const result = await transformer.rotate(ID, { angle: 45, format: "png" });

            expect(result.width).toBeGreaterThan(40);
        });

        it("flips vertically and flops horizontally", async () => {
            expect.assertions(2);

            const { transformer: flopper } = await setup(await twoPixels(2, 1));
            const { transformer: flipper } = await setup(await twoPixels(1, 2));

            const { buffer: flopped } = await flopper.flop(ID);
            const { buffer: flipped } = await flipper.flip(ID);

            await expect(pixels(flopped)).resolves.toStrictEqual([0, 0, 255, 255, 0, 0]);
            await expect(pixels(flipped)).resolves.toStrictEqual([0, 0, 255, 255, 0, 0]);
        });

        it("auto-orients", async () => {
            expect.assertions(1);

            const oriented = await sharp(await makeImage(40, 20, "jpeg"))
                .withMetadata({ orientation: 6 })
                .toBuffer();
            const { transformer } = await setup(oriented, {}, "image/jpeg");

            await expect(transformer.autoOrient(ID)).resolves.toMatchObject({ height: 40, width: 20 });
        });

        it("applies an affine matrix", async () => {
            expect.assertions(1);

            const { transformer } = await setup();
            const result = await transformer.affine(ID, { matrix: [2, 0, 0, 2] });

            expect([result.width, result.height]).toStrictEqual([80, 40]);
        });
    });

    describe("formats", () => {
        it.each([
            ["jpeg", "jpeg"],
            ["png", "png"],
            ["webp", "webp"],
            ["tiff", "tiff"],
            ["gif", "gif"],
        ] as const)("converts to %s", async (format, expected) => {
            expect.assertions(2);

            const { transformer } = await setup();
            const result = await transformer.convertFormat(ID, format, { quality: 80 });

            expect(result.format).toBe(expected);
            await expect(sharp(result.buffer).metadata()).resolves.toMatchObject({ format: expected });
        });

        it("reports AVIF output as avif, not as libvips' heif container", async () => {
            expect.assertions(2);

            const { transformer } = await setup();
            const result = await transformer.convertFormat(ID, "avif", { effort: 0, quality: 50 });

            expect(result.format).toBe("avif");
            await expect(sharp(result.buffer).metadata()).resolves.toMatchObject({ compression: "av1", format: "heif" });
        });

        it("encodes lossless webp", async () => {
            expect.assertions(1);

            const { transformer } = await setup();
            const lossless = await transformer.convertFormat(ID, "webp", { lossless: true });

            await expect(pixels(lossless.buffer)).resolves.toStrictEqual(await pixels(await makeImage(40, 20)));
        });

        it("keeps the input format when only encoder options are given", async () => {
            expect.assertions(2);

            const { transformer } = await setup();
            const result = await transformer.transform(ID, [{ options: { quality: 40 }, type: "quality" }]);

            expect(result.format).toBe("png");
            await expect(sharp(result.buffer).metadata()).resolves.toMatchObject({ format: "png" });
        });

        it("keeps a jpeg a jpeg when the quality changes", async () => {
            expect.assertions(1);

            const { transformer } = await setup(await makeImage(40, 20, "jpeg"), {}, "image/jpeg");

            await expect(transformer.sharpen(ID, { quality: 30, sigma: 1 })).resolves.toMatchObject({ format: "jpeg" });
        });

        it("writes png when encoder options are applied to an svg", async () => {
            expect.assertions(1);

            const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="4"><rect width="8" height="4" fill="red"/></svg>');
            const { transformer } = await setup(svg, {}, "image/svg+xml");

            await expect(transformer.transform(ID, [{ options: { quality: 50 }, type: "quality" }])).resolves.toMatchObject({ format: "png", width: 8 });
        });

        it("returns the original format when there are no steps", async () => {
            expect.assertions(1);

            const { transformer } = await setup();

            await expect(transformer.transform(ID, [])).resolves.toMatchObject({ format: "png", height: 20, width: 40 });
        });
    });

    describe("filters and colour", () => {
        it.each([
            ["blur", (t: ImageTransformer) => t.blur(ID)],
            ["blur with sigma", (t: ImageTransformer) => t.blur(ID, { format: "png", sigma: 2 })],
            ["sharpen", (t: ImageTransformer) => t.sharpen(ID)],
            ["median", (t: ImageTransformer) => t.median(ID, { format: "png", size: 3 })],
            ["clahe", (t: ImageTransformer) => t.clahe(ID, { format: "png", height: 3, maxSlope: 3, width: 3 })],
            ["convolve", (t: ImageTransformer) => t.convolve(ID, { format: "png", height: 3, kernel: [0, 0, 0, 0, 1, 0, 0, 0, 0], width: 3 })],
            ["threshold", (t: ImageTransformer) => t.threshold(ID, { format: "png", greyscale: true, threshold: 100 })],
            ["linear", (t: ImageTransformer) => t.linear(ID, { a: 1.1, b: 0, format: "png" })],
            [
                "recombine",
                (t: ImageTransformer) =>
                    t.recombine(ID, {
                        format: "png",
                        matrix: [
                            [0.3, 0.6, 0.1],
                            [0.3, 0.6, 0.1],
                            [0.3, 0.6, 0.1],
                        ],
                    }),
            ],
            ["modulate", (t: ImageTransformer) => t.modulate(ID, { brightness: 1.2, format: "png", hue: 90, lightness: 2, saturation: 0.5 })],
            ["modulate with brightness only", (t: ImageTransformer) => t.modulate(ID, { brightness: 1.2 })],
            ["tint (array)", (t: ImageTransformer) => t.tint(ID, { format: "png", rgb: [0, 0, 255] })],
            ["tint (string)", (t: ImageTransformer) => t.tint(ID, { rgb: "#00ff00" })],
            ["gamma", (t: ImageTransformer) => t.gamma(ID)],
            ["normalise", (t: ImageTransformer) => t.normalise(ID)],
            ["normalize alias", (t: ImageTransformer) => t.transform(ID, [{ options: {}, type: "normalize" }])],
            ["dilate", (t: ImageTransformer) => t.dilate(ID, { format: "png" })],
            ["dilate with kernel size", (t: ImageTransformer) => t.dilate(ID, { kernelSize: 2 })],
            ["erode", (t: ImageTransformer) => t.erode(ID, { format: "png" })],
            ["erode with kernel size", (t: ImageTransformer) => t.erode(ID, { kernelSize: 2 })],
            ["pipelineColourspace", (t: ImageTransformer) => t.pipelineColourspace(ID, { colourspace: "rgb16", format: "png" })],
            ["toColourspace", (t: ImageTransformer) => t.toColourspace(ID, { colourspace: "srgb", format: "png" })],
            ["unflatten", (t: ImageTransformer) => t.unflatten(ID)],
            ["boolean", async (t: ImageTransformer) => t.boolean(ID, { format: "png", operand: await makeImage(40, 20), operator: "and" })],
        ] as const)("applies %s", async (_name, run) => {
            expect.assertions(2);

            const { transformer } = await setup();
            const result = await run(transformer);

            expect([result.width, result.height]).toStrictEqual([40, 20]);
            await expect(sharp(result.buffer).metadata()).resolves.toMatchObject({ height: 20, width: 40 });
        });

        it("negates the colours", async () => {
            expect.assertions(1);

            const { transformer } = await setup(await twoPixels(2, 1));

            const { buffer } = await transformer.negate(ID);

            await expect(pixels(buffer)).resolves.toStrictEqual([0, 255, 255, 255, 255, 0]);
        });

        it("converts to greyscale", async () => {
            expect.assertions(1);

            const { transformer } = await setup();
            const result = await transformer.greyscale(ID, { format: "png" });
            const [red, green, blue] = await pixels(result.buffer);

            expect(red === green && green === blue).toBe(true);
        });

        it.each([
            ["colourspace b-w", (t: ImageTransformer) => t.colourspace(ID, { colourspace: "b-w", format: "png" }), 2],
            ["extractChannel", (t: ImageTransformer) => t.extractChannel(ID, { channel: 0, format: "png" } as never), 1],
            ["removeAlpha", (t: ImageTransformer) => t.removeAlpha(ID, { format: "png" }), 3],
            ["flatten", (t: ImageTransformer) => t.flatten(ID), 3],
        ] as const)("changes the channel count with %s", async (_name, run, channels) => {
            expect.assertions(1);

            const { transformer } = await setup();

            const { buffer } = await run(transformer);

            await expect(sharp(buffer).metadata()).resolves.toMatchObject({ channels });
        });

        it("combines the bands with bandbool", async () => {
            expect.assertions(1);

            // Red is (255, 0, 0): AND across the bands is 0 everywhere.
            const { transformer } = await setup(await twoPixels(2, 1));
            const result = await transformer.bandbool(ID, { format: "png", operator: "and" });

            await expect(pixels(result.buffer)).resolves.toStrictEqual([0, 0, 0, 0, 0, 0]);
        });

        it("adds an alpha channel", async () => {
            expect.assertions(1);

            const { transformer } = await setup(await makeImage(4, 4, "jpeg"), {}, "image/jpeg");
            const result = await transformer.ensureAlpha(ID, { format: "png" });

            await expect(sharp(result.buffer).metadata()).resolves.toMatchObject({ channels: 4 });
        });

        it("joins extra channels", async () => {
            expect.assertions(1);

            const { transformer } = await setup(await makeImage(4, 4, "jpeg"), {}, "image/jpeg");
            const band = await sharp(Buffer.alloc(16, 128), { raw: { channels: 1, height: 4, width: 4 } })
                .png()
                .toBuffer();
            const result = await transformer.joinChannel(ID, { format: "png", images: [band] });

            await expect(sharp(result.buffer).metadata()).resolves.toMatchObject({ channels: 4 });
        });

        it("chains several steps in order", async () => {
            expect.assertions(1);

            const { transformer } = await setup();
            const result = await transformer.transform(ID, [
                { options: { fit: "inside", width: 20 }, type: "resize" },
                { options: { sigma: 1.5 }, type: "blur" },
                { options: {}, type: "sharpen" },
                { options: {}, type: "greyscale" },
                { options: { format: "webp", quality: 80 }, type: "format" },
            ]);

            expect(result).toMatchObject({ format: "webp", height: 10, width: 20 });
        });

        it("requires width and height for clahe", async () => {
            expect.assertions(1);

            const { transformer } = await setup();

            await expect(transformer.clahe(ID, { width: 3 })).rejects.toThrow("CLAHE transformation requires both `width` and `height`.");
        });

        it("requires width, height and kernel for convolve", async () => {
            expect.assertions(1);

            const { transformer } = await setup();

            await expect(transformer.convolve(ID, { width: 3 })).rejects.toThrow("Convolve transformation requires `width`, `height`, and `kernel`.");
        });

        it("rejects unknown step types", async () => {
            expect.assertions(1);

            const { transformer } = await setup();

            await expect(transformer.transform(ID, [{ options: {}, type: "nope" as never }])).rejects.toThrow("Unknown transformation type: nope");
        });
    });

    describe("validation", () => {
        it("rejects files that are not images", async () => {
            expect.assertions(1);

            const { transformer } = await setup(Buffer.from("hello"), {}, "text/plain");

            await expect(transformer.resize(ID, { width: 10 })).rejects.toThrow("File is not an image: text/plain");
        });

        it("rejects images over maxImageSize", async () => {
            expect.assertions(1);

            const { transformer } = await setup(undefined, { maxImageSize: 10 });

            await expect(transformer.resize(ID, { width: 10 })).rejects.toThrow(/^Image size \d+ exceeds maximum allowed size 10$/);
        });

        it("rejects formats outside supportedFormats", async () => {
            expect.assertions(1);

            const { transformer } = await setup(await makeImage(4, 4, "jpeg"), { supportedFormats: ["png"] }, "image/jpeg");

            await expect(transformer.resize(ID, { width: 2 })).rejects.toThrow("Unsupported image format: jpg");
        });

        it.each([
            ["image/jpeg", "jpeg"],
            ["image/tiff", "tiff"],
        ] as const)("accepts %s with the default supportedFormats", async (contentType, format) => {
            expect.assertions(1);

            const { transformer } = await setup(await sharp(await makeImage(8, 4)).toFormat(format).toBuffer(), {}, contentType);

            await expect(transformer.resize(ID, { width: 4 })).resolves.toMatchObject({ format, width: 4 });
        });

        it("rejects images wider than maxImageWidth", async () => {
            expect.assertions(1);

            const { transformer } = await setup(undefined, { maxImageWidth: 10 });

            await expect(transformer.resize(ID, { width: 5 })).rejects.toThrow("Image width 40px exceeds maximum 10px");
        });

        it("rejects images taller than maxImageHeight", async () => {
            expect.assertions(1);

            const { transformer } = await setup(undefined, { maxImageHeight: 10 });

            await expect(transformer.resize(ID, { width: 5 })).rejects.toThrow("Image height 20px exceeds maximum 10px");
        });

        it("rejects bytes that are not a decodable image", async () => {
            expect.assertions(1);

            const { transformer } = await setup(Buffer.from("definitely not a png"), {}, "image/png");

            await expect(transformer.resize(ID, { width: 5 })).rejects.toThrow(/^Invalid image file:/);
        });

        it("enforces limitInputPixels against decompression bombs", async () => {
            expect.assertions(1);

            const { transformer } = await setup(undefined, { limitInputPixels: 100 });

            await expect(transformer.resize(ID, { width: 5 })).rejects.toThrow(/pixel limit/i);
        });

        it("accepts large images when limitInputPixels is disabled", async () => {
            expect.assertions(1);

            const { transformer } = await setup(undefined, { limitInputPixels: false });

            await expect(transformer.resize(ID, { width: 5 })).resolves.toMatchObject({ width: 5 });
        });
    });

    describe("caching", () => {
        it("serves repeated transforms from the cache without reading the original", async () => {
            expect.assertions(3);

            const { storage, transformer } = await setup(undefined, { cache: new Map() });
            const get = vi.spyOn(storage, "get");

            const first = await transformer.resize(ID, { width: 10 });
            const second = await transformer.resize(ID, { width: 10 });

            expect(second).toBe(first);
            expect(get).toHaveBeenCalledTimes(1);
            expect(transformer.getCacheStats()).toStrictEqual({ maxSize: 100, size: 1 });
        });

        it("keys the cache by the steps", async () => {
            expect.assertions(2);

            const { transformer } = await setup(undefined, { cache: new Map() });

            await expect(transformer.resize(ID, { width: 10 })).resolves.toMatchObject({ width: 10 });
            await expect(transformer.resize(ID, { width: 20 })).resolves.toMatchObject({ width: 20 });
        });

        it("re-transforms after the original is replaced", async () => {
            expect.assertions(2);

            const { storage, transformer } = await setup(undefined, { cache: new Map() });

            await expect(transformer.resize(ID, { height: 10 })).resolves.toMatchObject({ width: 20 });

            await seedFile(storage, ID, await makeImage(80, 20), "image/png");

            await expect(transformer.resize(ID, { height: 10 })).resolves.toMatchObject({ width: 40 });
        });

        it("transforms again after clearCache(fileId)", async () => {
            expect.assertions(2);

            const cache = new Map();
            const { storage, transformer } = await setup(undefined, { cache });
            const get = vi.spyOn(storage, "get");

            await transformer.resize(ID, { width: 10 });
            transformer.clearCache(ID);

            expect(cache.size).toBe(0);

            await transformer.resize(ID, { width: 10 });

            expect(get).toHaveBeenCalledTimes(2);
        });

        it("does not cache without a cache instance", async () => {
            expect.assertions(1);

            const { storage, transformer } = await setup();
            const get = vi.spyOn(storage, "get");

            await transformer.resize(ID, { width: 10 });
            await transformer.resize(ID, { width: 10 });

            expect(get).toHaveBeenCalledTimes(2);
        });
    });

    it("streams the transformed image with headers", async () => {
        expect.assertions(3);

        const { transformer } = await setup();
        const { headers, size, stream } = await transformer.transformStream(ID, [{ options: { format: "webp", width: 10 }, type: "resize" }]);
        const chunks: Buffer[] = [];

        for await (const chunk of stream) {
            chunks.push(chunk as Buffer);
        }

        expect(headers).toStrictEqual({ "Content-Length": String(size), "Content-Type": "image/webp", "X-Image-Height": "5", "X-Image-Width": "10" });
        expect(Buffer.concat(chunks)).toHaveLength(size as number);
        await expect(sharp(Buffer.concat(chunks)).metadata()).resolves.toMatchObject({ format: "webp", width: 10 });
    });
});
