import { ALL_FORMATS, BufferSource, Input } from "mediabunny";
import { describe, expect, it, vi } from "vitest";

import MemoryStorage from "../../src/storage/memory/memory-storage";
import AudioTransformer from "../../src/transformer/audio-transformer";
import VideoTransformer from "../../src/transformer/video-transformer";
import { makeMp4, makeWav, seedFile } from "../__helpers__/media";

const AUDIO = "audio-file";
const VIDEO = "video-file";

const probe = async (buffer: Buffer): Promise<{ audio?: { channels: number; sampleRate: number }; mimeType: string; video?: { height: number; width: number } }> => {
    const input = new Input({ formats: ALL_FORMATS, source: new BufferSource(buffer) });
    const audio = await input.getPrimaryAudioTrack();
    const video = await input.getPrimaryVideoTrack();

    return {
        audio: audio ? { channels: audio.numberOfChannels, sampleRate: audio.sampleRate } : undefined,
        mimeType: await input.getMimeType(),
        video: video ? { height: video.displayHeight, width: video.displayWidth } : undefined,
    };
};

const audioSetup = async (
    content?: Buffer,
    config: ConstructorParameters<typeof AudioTransformer>[1] = {},
    contentType = "audio/wav",
): Promise<{ storage: MemoryStorage; transformer: AudioTransformer }> => {
    const storage = new MemoryStorage();

    await seedFile(storage, AUDIO, content ?? makeWav(44_100, 2, 4410), contentType);

    return { storage, transformer: new AudioTransformer(storage, config) };
};

const videoSetup = async (
    content?: Buffer,
    config: ConstructorParameters<typeof VideoTransformer>[1] = {},
    contentType = "video/mp4",
): Promise<{ storage: MemoryStorage; transformer: VideoTransformer }> => {
    const storage = new MemoryStorage();

    await seedFile(storage, VIDEO, content ?? (await makeMp4()), contentType);

    return { storage, transformer: new VideoTransformer(storage, config) };
};

// Node has no WebCodecs: mediabunny can decode/encode PCM (WAV) itself, and remux containers, but
// cannot encode MP3/AAC/Opus/FLAC audio or any video codec. Those paths are asserted to fail cleanly.
describe("audioTransformer with mediabunny", () => {
    it("converts WAV to WAV and reports the real format and track", async () => {
        expect.assertions(3);

        const { transformer } = await audioSetup();
        const result = await transformer.convertFormat(AUDIO, "wav");

        expect(result).toMatchObject({ duration: 0.1, format: "wav", numberOfChannels: 2, sampleRate: 44_100 });
        expect(result.size).toBe(result.buffer.length);
        await expect(probe(result.buffer)).resolves.toMatchObject({ audio: { channels: 2, sampleRate: 44_100 }, mimeType: "audio/wav" });
    });

    it("resamples", async () => {
        expect.assertions(2);

        const { transformer } = await audioSetup();
        const result = await transformer.transform(AUDIO, [
            { options: { format: "wav" }, type: "format" },
            { options: { sampleRate: 22_050 }, type: "resample" },
        ]);

        expect(result.sampleRate).toBe(22_050);
        await expect(probe(result.buffer)).resolves.toMatchObject({ audio: { sampleRate: 22_050 } });
    });

    it("downmixes to mono", async () => {
        expect.assertions(2);

        const { transformer } = await audioSetup();
        const result = await transformer.transform(AUDIO, [
            { options: { format: "wav" }, type: "format" },
            { options: { numberOfChannels: 1 }, type: "channels" },
        ]);

        expect(result.numberOfChannels).toBe(1);
        await expect(probe(result.buffer)).resolves.toMatchObject({ audio: { channels: 1 } });
    });

    it("exposes resample and mixChannels shortcuts", async () => {
        expect.assertions(2);

        const { transformer } = await audioSetup();
        const transform = vi.spyOn(transformer, "transform");

        await transformer.resample(AUDIO, { sampleRate: 8000 }).catch(() => undefined);
        await transformer.mixChannels(AUDIO, { numberOfChannels: 1 }).catch(() => undefined);

        expect(transform).toHaveBeenNthCalledWith(1, AUDIO, [{ options: { sampleRate: 8000 }, type: "resample" }]);
        expect(transform).toHaveBeenNthCalledWith(2, AUDIO, [{ options: { numberOfChannels: 1 }, type: "channels" }]);
    });

    it.each([
        ["no steps (mp3 default)", []],
        ["mp3", [{ options: { format: "mp3" }, type: "format" }]],
        ["flac", [{ options: { format: "flac" }, type: "format" }]],
        ["ogg", [{ options: { format: "ogg" }, type: "format" }]],
        ["aac", [{ options: { format: "aac" }, type: "format" }]],
        ["codec + bitrate", [{ options: { bitrate: 64_000, codec: "opus" }, type: "codec" }]],
        ["bitrate", [{ options: { bitrate: 64_000 }, type: "bitrate" }]],
    ] as const)("fails cleanly when no encoder is available: %s", async (_name, steps) => {
        expect.assertions(1);

        const { transformer } = await audioSetup();

        await expect(transformer.transform(AUDIO, [...steps] as never)).rejects.toThrow(/^Audio transformation failed: /);
    });

    it("rejects files that are not audio", async () => {
        expect.assertions(1);

        const { transformer } = await audioSetup(Buffer.from("text"), {}, "text/plain");

        await expect(transformer.convertFormat(AUDIO, "wav")).rejects.toThrow("File is not audio: text/plain");
    });

    it("rejects audio over maxAudioSize", async () => {
        expect.assertions(1);

        const { transformer } = await audioSetup(undefined, { maxAudioSize: 100 });

        await expect(transformer.convertFormat(AUDIO, "wav")).rejects.toThrow(/^Audio size \d+ exceeds maximum allowed size 100$/);
    });

    it("rejects formats outside supportedFormats", async () => {
        expect.assertions(1);

        const { transformer } = await audioSetup(undefined, { supportedFormats: ["mp3"] });

        await expect(transformer.convertFormat(AUDIO, "wav")).rejects.toThrow("Unsupported audio format: wav");
    });

    it("accepts audio/mpeg with the default supportedFormats", async () => {
        expect.assertions(1);

        // A WAV payload labelled audio/mpeg: the format check passes (mp3 is supported), decoding still works.
        const { transformer } = await audioSetup(undefined, {}, "audio/mpeg");

        await expect(transformer.convertFormat(AUDIO, "wav")).resolves.toMatchObject({ format: "wav" });
    });

    it("rejects bytes without an audio track", async () => {
        expect.assertions(1);

        const { transformer } = await audioSetup(Buffer.from("not audio at all"));

        await expect(transformer.convertFormat(AUDIO, "wav")).rejects.toThrow(/^Invalid audio file:/);
    });

    it("rejects a video-only file", async () => {
        expect.assertions(1);

        const { transformer } = await audioSetup(await makeMp4(), {}, "audio/mp4");

        await expect(transformer.convertFormat(AUDIO, "wav")).rejects.toThrow("Invalid audio file: Error: No audio track found");
    });

    it("caches results and invalidates them when the original changes", async () => {
        expect.assertions(3);

        const { storage, transformer } = await audioSetup(undefined, { cache: new Map() });
        const first = await transformer.convertFormat(AUDIO, "wav");

        await expect(transformer.convertFormat(AUDIO, "wav")).resolves.toBe(first);

        await seedFile(storage, AUDIO, makeWav(8000, 1, 800), "audio/wav");

        const replaced = await transformer.convertFormat(AUDIO, "wav");

        expect(replaced).not.toBe(first);
        expect(replaced).toMatchObject({ numberOfChannels: 1, sampleRate: 8000 });
    });

    it("streams the result with its content type", async () => {
        expect.assertions(1);

        const { transformer } = await audioSetup();
        const { headers } = await transformer.transformStream!(AUDIO, [{ options: { format: "wav" }, type: "format" }]);

        expect(headers?.["Content-Type"]).toMatch(/^audio\/(x-)?wav/);
    });
});

describe("videoTransformer with mediabunny", () => {
    it("remuxes MP4 to MP4 without steps", async () => {
        expect.assertions(2);

        const { transformer } = await videoSetup();
        const result = await transformer.transform(VIDEO, []);

        expect(result).toMatchObject({ bitrate: 2_000_000, format: "mp4", height: 16, width: 32 });
        await expect(probe(result.buffer)).resolves.toMatchObject({ mimeType: expect.stringMatching(/^video\/mp4/), video: { height: 16, width: 32 } });
    });

    it("remuxes into Matroska and reports mkv", async () => {
        expect.assertions(2);

        const { transformer } = await videoSetup();
        const result = await transformer.convertFormat(VIDEO, "mkv");

        expect(result.format).toBe("mkv");
        await expect(probe(result.buffer)).resolves.toMatchObject({ mimeType: expect.stringMatching(/^video\/x-matroska/) });
    });

    it("rotates by writing rotation metadata", async () => {
        expect.assertions(2);

        const { transformer } = await videoSetup();
        const result = await transformer.rotate(VIDEO, { angle: 90 });

        expect([result.width, result.height]).toStrictEqual([16, 32]);
        await expect(probe(result.buffer)).resolves.toMatchObject({ video: { height: 32, width: 16 } });
    });

    it("defaults the fit for a resize with width and height", async () => {
        expect.assertions(1);

        const { transformer } = await videoSetup();

        // Mediabunny itself throws "options.video.fit must also be provided" without a fit; with the
        // default the request reaches the conversion, which then needs a decoder Node does not have.
        await expect(transformer.resize(VIDEO, { height: 8, width: 16 })).rejects.toThrow(/^Video transformation failed: /);
    });

    it.each([
        ["crop", (t: VideoTransformer) => t.crop(VIDEO, { height: 8, left: 0, top: 0, width: 16 })],
        ["webm", (t: VideoTransformer) => t.convertFormat(VIDEO, "webm", { codec: "vp9" })],
        ["transcode", (t: VideoTransformer) => t.transcode(VIDEO, "vp9", { bitrate: 500_000 })],
    ] as const)("fails cleanly when re-encoding is required: %s", async (_name, run) => {
        expect.assertions(1);

        const { transformer } = await videoSetup();

        await expect(run(transformer)).rejects.toThrow(/^Video transformation failed: /);
    });

    it("maps every step type onto the conversion", async () => {
        expect.assertions(1);

        const { transformer } = await videoSetup();
        const toOptions = (transformer as unknown as { stepsToVideoOptions: (steps: unknown[]) => unknown }).stepsToVideoOptions.bind(transformer);

        expect(
            toOptions([
                { options: { fit: "contain", height: 8, position: "top", width: 16 }, type: "resize" },
                { options: { height: 4, left: 1, top: 2, width: 3 }, type: "crop" },
                { options: { angle: 180, background: "#000" }, type: "rotate" },
                { options: { bitrate: 1000, codec: "vp9" }, type: "codec" },
                { options: { bitrate: 2000 }, type: "bitrate" },
                { options: { frameRate: 24 }, type: "frameRate" },
                { options: { format: "webm" }, type: "format" },
            ]),
        ).toStrictEqual({
            background: "#000",
            bitrate: 2000,
            codec: "vp9",
            crop: { height: 4, left: 1, top: 2, width: 3 },
            fit: "contain",
            frameRate: 24,
            height: 8,
            position: "top",
            rotate: 180,
            width: 16,
        });
    });

    it("rejects files that are not videos", async () => {
        expect.assertions(1);

        const { transformer } = await videoSetup(Buffer.from("text"), {}, "text/plain");

        await expect(transformer.transform(VIDEO, [])).rejects.toThrow("File is not a video: text/plain");
    });

    it("rejects videos over maxVideoSize", async () => {
        expect.assertions(1);

        const { transformer } = await videoSetup(undefined, { maxVideoSize: 10 });

        await expect(transformer.transform(VIDEO, [])).rejects.toThrow(/^Video size \d+ exceeds maximum allowed size 10$/);
    });

    it("rejects formats outside supportedFormats", async () => {
        expect.assertions(1);

        const { transformer } = await videoSetup(undefined, { supportedFormats: ["webm"] });

        await expect(transformer.transform(VIDEO, [])).rejects.toThrow("Unsupported video format: mp4");
    });

    it("accepts video/quicktime with the default supportedFormats", async () => {
        expect.assertions(1);

        const { transformer } = await videoSetup(undefined, {}, "video/quicktime");

        await expect(transformer.transform(VIDEO, [])).resolves.toMatchObject({ width: 32 });
    });

    it("rejects an audio-only file", async () => {
        expect.assertions(1);

        const { transformer } = await videoSetup(makeWav(8000, 1, 80));

        await expect(transformer.transform(VIDEO, [])).rejects.toThrow("Invalid video file: Error: No video track found");
    });

    it("serves the cached result without reading the original again", async () => {
        expect.assertions(2);

        const { storage, transformer } = await videoSetup(undefined, { cache: new Map() });
        const get = vi.spyOn(storage, "get");
        const first = await transformer.transform(VIDEO, []);

        await expect(transformer.transform(VIDEO, [])).resolves.toBe(first);
        expect(get).toHaveBeenCalledTimes(1);
    });
});
