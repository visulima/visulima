import { Readable } from "node:stream";

import { BufferTarget, EncodedPacket, EncodedVideoPacketSource, Mp4OutputFormat, Output } from "mediabunny";
import sharp from "sharp";

import type MemoryStorage from "../../src/storage/memory/memory-storage";

/** Stores `content` under `id` with the given content type, the way an upload would. */
export const seedFile = async (storage: MemoryStorage, id: string, content: Buffer, contentType: string): Promise<void> => {
    await storage.create({ contentType, id, metadata: {}, originalName: id, size: content.length });
    await storage.write({ body: Readable.from(content), contentLength: content.length, id, start: 0 });
};

/** A real, solid-red RGBA image encoded with sharp. */
export const makeImage = async (width: number, height: number, format: "gif" | "jpeg" | "png" | "webp" = "png"): Promise<Buffer> =>
    sharp({ create: { background: { alpha: 1, b: 0, g: 0, r: 255 }, channels: 4, height, width } })
        .toFormat(format)
        .toBuffer();

/** A real 16-bit PCM WAV file holding a sine wave. */
export const makeWav = (sampleRate: number, channels: number, frames: number): Buffer => {
    const data = Buffer.alloc(frames * channels * 2);

    for (let index = 0; index < frames * channels; index += 1) {
        data.writeInt16LE(Math.round(Math.sin(index / 10) * 8000), index * 2);
    }

    const header = Buffer.alloc(44);

    header.write("RIFF", 0);
    header.writeUInt32LE(36 + data.length, 4);
    header.write("WAVE", 8);
    header.write("fmt ", 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * channels * 2, 28);
    header.writeUInt16LE(channels * 2, 32);
    header.writeUInt16LE(16, 34);
    header.write("data", 36);
    header.writeUInt32LE(data.length, 40);

    return Buffer.concat([header, data]);
};

/**
 * A structurally valid MP4 with one 32x16 AVC track of three packets. The packet payloads are not
 * decodable H.264 — Node has no WebCodecs — so it supports remuxing (container change, rotation
 * metadata) but not re-encoding.
 */
export const makeMp4 = async (): Promise<Buffer> => {
    const target = new BufferTarget();
    const output = new Output({ format: new Mp4OutputFormat(), target });
    const source = new EncodedVideoPacketSource("avc");

    output.addVideoTrack(source);
    await output.start();

    const sps = [0x67, 0x42, 0x00, 0x1e, 0x95, 0xa8, 0x28, 0x0f, 0x64];
    const pps = [0x68, 0xce, 0x3c, 0x80];
    const avcC = new Uint8Array([1, 0x42, 0, 0x1e, 0xff, 0xe1, 0, sps.length, ...sps, 1, 0, pps.length, ...pps]);

    for (let index = 0; index < 3; index += 1) {
        await source.add(
            new EncodedPacket(new Uint8Array([0, 0, 0, 2, 0x65, 0x88]), index === 0 ? "key" : "delta", index / 10, 0.1),
            index === 0 ? { decoderConfig: { codec: "avc1.42001e", codedHeight: 16, codedWidth: 32, description: avcC } } : undefined,
        );
    }

    await output.finalize();

    return Buffer.from(target.buffer as ArrayBuffer);
};
