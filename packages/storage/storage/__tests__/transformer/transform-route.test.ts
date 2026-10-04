import express from "express";
import sharp from "sharp";
import supertest from "supertest";
import { describe, expect, it, vi } from "vitest";

import MultipartFetch from "../../src/handler/multipart/multipart-fetch";
import Rest from "../../src/handler/rest/rest";
import RestFetch from "../../src/handler/rest/rest-fetch";
import MemoryStorage from "../../src/storage/memory/memory-storage";
import AudioTransformer from "../../src/transformer/audio-transformer";
import ImageTransformer from "../../src/transformer/image-transformer";
import MediaTransformer from "../../src/transformer/media-transformer";
import { makeImage, makeWav, seedFile } from "../__helpers__/media";

const BASE = "http://localhost/files/";

const setup = async (
    Handler: typeof MultipartFetch | typeof RestFetch,
    withTransformer = true,
): Promise<{ handler: MultipartFetch | RestFetch; logger: Console; original: Buffer }> => {
    const logger = { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() } as unknown as Console;
    const storage = new MemoryStorage({ logger });
    const original = await makeImage(40, 20);

    await seedFile(storage, "image-file", original, "image/png");
    await seedFile(storage, "audio-file", makeWav(44_100, 2, 4410), "audio/wav");
    await seedFile(storage, "text-file", Buffer.from("hello"), "text/plain");

    const mediaTransformer = withTransformer ? new MediaTransformer(storage, { AudioTransformer, ImageTransformer }) : undefined;

    return { handler: new Handler({ logger, mediaTransformer, storage }), logger, original };
};

const body = async (response: Response): Promise<Buffer> => Buffer.from(await response.arrayBuffer());

describe.each([
    ["RestFetch", RestFetch],
    ["MultipartFetch", MultipartFetch],
] as const)("transform route through %s", (_name, Handler) => {
    it("serves a resized, converted image with transform headers", async () => {
        expect.assertions(8);

        const { handler } = await setup(Handler);
        const response = await handler.fetch(new Request(`${BASE}image-file?width=10&format=webp&quality=70`));
        const content = await body(response);

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toBe("image/webp");
        expect(response.headers.get("content-length")).toBe(String(content.length));
        expect(response.headers.get("x-media-type")).toBe("image");
        expect(response.headers.get("x-original-format")).toBe("png");
        expect(response.headers.get("x-transformed-format")).toBe("webp");
        expect(response.headers.get("etag")).toMatch(/^"[^"]+"$/);
        await expect(sharp(content).metadata()).resolves.toMatchObject({ format: "webp", height: 5, width: 10 });
    });

    it("labels AVIF output image/avif", async () => {
        expect.assertions(2);

        const { handler } = await setup(Handler);
        const response = await handler.fetch(new Request(`${BASE}image-file?format=avif&effort=0`));

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toBe("image/avif");
    });

    it("honours boolean query flags", async () => {
        expect.assertions(2);

        const { handler } = await setup(Handler);
        const response = await handler.fetch(new Request(`${BASE}image-file?width=400&withoutEnlargement=true`));

        expect(response.headers.get("x-transformed-format")).toBe("png");
        await expect(sharp(await body(response)).metadata()).resolves.toMatchObject({ width: 40 });
    });

    it.each(["fit=bogus", "codec=avc", "format=bmp", "left=1"])("answers 400 for ?%s", async (query) => {
        expect.assertions(2);

        const { handler } = await setup(Handler);
        const response = await handler.fetch(new Request(`${BASE}image-file?${query}`));

        expect(response.status).toBe(400);
        expect(response.headers.get("content-type")).toContain("application/json");
    });

    it("falls back to the original when the transform fails", async () => {
        expect.assertions(4);

        const { handler, logger, original } = await setup(Handler);
        const response = await handler.fetch(new Request(`${BASE}image-file?width=-5`));

        expect(response.status).toBe(200);
        expect(response.headers.get("x-media-type")).toBeNull();
        expect(Buffer.compare(await body(response), original)).toBe(0);
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("Media transformation failed"));
    });

    it("serves non-media files untouched even with transform parameters", async () => {
        expect.assertions(2);

        const { handler } = await setup(Handler);
        const response = await handler.fetch(new Request(`${BASE}text-file?width=10`));

        expect(response.status).toBe(200);
        await expect(response.text()).resolves.toBe("hello");
    });

    it("serves the original without a media transformer", async () => {
        expect.assertions(2);

        const { handler, original } = await setup(Handler, false);
        const response = await handler.fetch(new Request(`${BASE}image-file?width=10`));

        expect(response.headers.get("x-media-type")).toBeNull();
        expect(Buffer.compare(await body(response), original)).toBe(0);
    });

    it("transforms audio", async () => {
        expect.assertions(3);

        const { handler } = await setup(Handler);
        const response = await handler.fetch(new Request(`${BASE}audio-file?format=wav&sampleRate=22050&numberOfChannels=1`));

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toBe("audio/wav");
        expect(response.headers.get("x-transformed-format")).toBe("wav");
    });
});

describe("transform route through the Node Rest handler", () => {
    const binary = (response: supertest.Response, callback: (error: Error | null, body: Buffer) => void): void => {
        const chunks: Buffer[] = [];

        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => callback(null, Buffer.concat(chunks)));
    };

    const app = async (): Promise<express.Express> => {
        const storage = new MemoryStorage();

        await seedFile(storage, "image-file", await makeImage(40, 20), "image/png");

        const server = express();

        server.use("/files", new Rest({ mediaTransformer: new MediaTransformer(storage, { ImageTransformer }), storage }).handle);

        return server;
    };

    it("serves the transformed image", async () => {
        expect.assertions(4);

        const response = await supertest(await app())
            .get("/files/image-file?width=10&format=jpeg")
            .buffer(true)
            .parse(binary);

        expect(response.status).toBe(200);
        expect(response.headers["content-type"]).toBe("image/jpeg");
        expect(response.headers["x-media-type"]).toBe("image");
        await expect(sharp(response.body as Buffer).metadata()).resolves.toMatchObject({ format: "jpeg", width: 10 });
    });

    it("answers 400 for invalid parameters", async () => {
        expect.assertions(1);

        const response = await supertest(await app()).get("/files/image-file?fit=bogus");

        expect(response.status).toBe(400);
    });
});
