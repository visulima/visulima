import { promises as fsp } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";

import { temporaryDirectory } from "tempy";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Files } from "../../src/files";
import DiskStorage from "../../src/storage/local/disk-storage";
import type { File } from "../../src/storage/utils/file";

const makeFiles = (directory: string): { adapter: DiskStorage; facade: Files<DiskStorage> } => {
    const adapter = new DiskStorage<File>({
        directory,
        maxUploadSize: "100MB",
    });

    return { adapter, facade: new Files({ adapter }) };
};

describe("files facade", () => {
    let directory: string;

    beforeEach(async () => {
        directory = temporaryDirectory();
    });

    afterEach(async () => {
        try {
            await rm(directory, { force: true, recursive: true });
        } catch {
            // ignore
        }
    });

    describe("upload + download + head", () => {
        it("round-trips a string body and lands the object at the given key", async () => {
            const { facade } = makeFiles(directory);

            const uploaded = await facade.upload("avatars/abc.png", "hello world", { contentType: "image/png" });

            expect(uploaded.key).toBe("avatars/abc.png");
            expect(uploaded.contentType).toBe("image/png");

            const onDisk = await fsp.readFile(join(directory, "avatars/abc.png"), "utf8");

            expect(onDisk).toBe("hello world");

            const downloaded = await facade.download("avatars/abc.png");

            expect(downloaded.body.toString("utf8")).toBe("hello world");
            expect(downloaded.key).toBe("avatars/abc.png");
        });

        it("uploads a Buffer body", async () => {
            const { facade } = makeFiles(directory);
            const payload = Buffer.from([1, 2, 3, 4, 5]);

            await facade.upload("data.bin", payload, { contentType: "application/octet-stream" });

            const downloaded = await facade.download("data.bin");

            expect(downloaded.body).toEqual(payload);
            expect(downloaded.size).toBe(5);
        });

        it("uploads a Uint8Array body", async () => {
            const { facade } = makeFiles(directory);
            const payload = new Uint8Array([10, 20, 30]);

            await facade.upload("uint.bin", payload);

            const downloaded = await facade.download("uint.bin");

            expect(downloaded.body.equals(Buffer.from(payload))).toBe(true);
        });

        it("uploads an ArrayBuffer body", async () => {
            const { facade } = makeFiles(directory);
            const { buffer } = new Uint8Array([1, 2, 3, 4]);

            const uploaded = await facade.upload("ab.bin", buffer);

            expect(uploaded.size).toBe(4);

            const downloaded = await facade.download("ab.bin");

            expect(downloaded.body.equals(Buffer.from([1, 2, 3, 4]))).toBe(true);
        });

        it("uploads an ArrayBufferView (DataView) body", async () => {
            const { facade } = makeFiles(directory);
            const underlying = new Uint8Array([9, 8, 7, 6, 5]);
            const view = new DataView(underlying.buffer, 1, 3); // bytes [8, 7, 6]

            await facade.upload("view.bin", view);

            const downloaded = await facade.download("view.bin");

            expect(downloaded.body.equals(Buffer.from([8, 7, 6]))).toBe(true);
            expect(downloaded.size).toBe(3);
        });

        it("passes user metadata through to the stored file", async () => {
            const { facade } = makeFiles(directory);

            await facade.upload("meta.txt", "hi", {
                contentType: "text/plain",
                metadata: { author: "alice", tag: "v1" },
            });

            const head = await facade.head("meta.txt");

            expect(head.metadata?.author).toBe("alice");
            expect(head.metadata?.tag).toBe("v1");
        });

        it("uploads a Node Readable when size is provided", async () => {
            const { facade } = makeFiles(directory);
            const body = Readable.from(Buffer.from("streamed"));

            const result = await facade.upload("streamed.txt", body, { contentType: "text/plain", size: 8 });

            expect(result.size).toBe(8);

            const downloaded = await facade.download("streamed.txt");

            expect(downloaded.body.toString("utf8")).toBe("streamed");
        });

        it("uploads a Blob body", async () => {
            const { facade } = makeFiles(directory);
            const blob = new Blob(["blob-payload"], { type: "text/plain" });

            await facade.upload("blob.txt", blob, { contentType: "text/plain" });

            const downloaded = await facade.download("blob.txt");

            expect(downloaded.body.toString("utf8")).toBe("blob-payload");
        });

        it("head() returns metadata without the body", async () => {
            const { facade } = makeFiles(directory);

            await facade.upload("note.txt", "x", { contentType: "text/plain" });

            const head = await facade.head("note.txt");

            expect(head.key).toBe("note.txt");
            expect(head.contentType).toBe("text/plain");
            expect(head.size).toBe(1);
            expect(head).not.toHaveProperty("body");
        });
    });

    describe("delete + copy + list", () => {
        it("delete() removes the object", async () => {
            const { facade } = makeFiles(directory);

            await facade.upload("tmp.txt", "bye");
            await facade.delete("tmp.txt");

            await expect(facade.head("tmp.txt")).rejects.toThrow();
        });

        it("copy() duplicates the object at a new key", async () => {
            const { facade } = makeFiles(directory);

            await facade.upload("src.txt", "duplicate me", { contentType: "text/plain" });

            const copied = await facade.copy("src.txt", "dst.txt");

            expect(copied.key).toBe("dst.txt");

            const a = await fsp.readFile(join(directory, "src.txt"), "utf8");
            const b = await fsp.readFile(join(directory, "dst.txt"), "utf8");

            expect(a).toBe("duplicate me");
            expect(b).toBe("duplicate me");
        });

        it("list() returns uploaded objects and supports prefix filtering", async () => {
            const { facade } = makeFiles(directory);

            await facade.upload("a/1.txt", "1");
            await facade.upload("a/2.txt", "2");
            await facade.upload("b/3.txt", "3");

            const all = await facade.list();

            expect(all.length).toBeGreaterThanOrEqual(3);

            const filtered = await facade.list({ prefix: "a/" });

            expect(filtered.map((entry) => entry.key).toSorted()).toEqual(["a/1.txt", "a/2.txt"]);
        });

        it("list() returns an empty array when no objects match the prefix", async () => {
            const { facade } = makeFiles(directory);

            await facade.upload("a/1.txt", "1");

            const filtered = await facade.list({ prefix: "no-such-prefix/" });

            expect(filtered).toEqual([]);
        });
    });

    describe("raw escape hatch", () => {
        it("exposes the adapter's native raw client", () => {
            const { adapter, facade } = makeFiles(directory);

            expect(facade.raw).toEqual(adapter.raw);
            expect(facade.raw).toEqual({ directory });
        });
    });

    describe("url + signedUploadUrl", () => {
        it("throws METHOD_NOT_ALLOWED for adapters that do not implement presign", async () => {
            const { facade } = makeFiles(directory);

            await expect(facade.url("nope.txt")).rejects.toThrow(/MethodNotAllowed|does not implement/);
            await expect(facade.signedUploadUrl("nope.txt")).rejects.toThrow(/MethodNotAllowed|does not implement/);
        });
    });

    describe("path traversal hardening", () => {
        const traversalKeys: string[] = [
            "../etc/passwd",
            "foo/../../bar",
            String.raw`..\windows\system32`,
            "/etc/passwd",
            String.raw`C:\Windows\system32`,
            "with\0null",
        ];

        for (const key of traversalKeys) {
            it(`rejects upload for unsafe key ${JSON.stringify(key)}`, async () => {
                const { facade } = makeFiles(directory);

                await expect(facade.upload(key, "x")).rejects.toThrow(/Invalid file id|InvalidFileName/);
            });

            it(`rejects head/delete/download for unsafe key ${JSON.stringify(key)}`, async () => {
                const { facade } = makeFiles(directory);

                await expect(facade.head(key)).rejects.toThrow(/Invalid file id|InvalidFileName/);
                await expect(facade.delete(key)).rejects.toThrow(/Invalid file id|InvalidFileName/);
                await expect(facade.download(key)).rejects.toThrow(/Invalid file id|InvalidFileName/);
            });

            it(`rejects copy when either side is ${JSON.stringify(key)}`, async () => {
                const { facade } = makeFiles(directory);

                await facade.upload("safe.txt", "x");

                await expect(facade.copy(key, "ok.txt")).rejects.toThrow(/Invalid file id|InvalidFileName/);
                await expect(facade.copy("safe.txt", key)).rejects.toThrow(/Invalid file id|InvalidFileName/);
            });
        }
    });
});
