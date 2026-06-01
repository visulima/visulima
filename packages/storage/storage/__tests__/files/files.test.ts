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

    describe("exists", () => {
        it("returns true for an existing object and false for a missing one", async () => {
            const { facade } = makeFiles(directory);

            await facade.upload("present.txt", "hi");

            await expect(facade.exists("present.txt")).resolves.toBe(true);
            await expect(facade.exists("absent.txt")).resolves.toBe(false);
        });

        it("returns false after the object is deleted", async () => {
            const { facade } = makeFiles(directory);

            await facade.upload("gone.txt", "bye");
            await facade.delete("gone.txt");

            await expect(facade.exists("gone.txt")).resolves.toBe(false);
        });

        it("rejects an unsafe key", async () => {
            const { facade } = makeFiles(directory);

            await expect(facade.exists("../escape.txt")).rejects.toThrow(/Invalid file id|InvalidFileName/);
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

        describe.each(traversalKeys)("unsafe key %j", (key) => {
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
        });
    });

    describe("constructor prefix", () => {
        const makePrefixed = (directoryPath: string, prefix: string): { adapter: DiskStorage; facade: Files<DiskStorage> } => {
            const adapter = new DiskStorage<File>({ directory: directoryPath, maxUploadSize: "100MB" });

            return { adapter, facade: new Files({ adapter, prefix }) };
        };

        it("namespaces every operation under the prefix and strips it back off returned keys", async () => {
            const { facade } = makePrefixed(directory, "users");

            const uploaded = await facade.upload("123/avatar.png", "x", { contentType: "image/png" });

            expect(uploaded.key).toBe("123/avatar.png");

            // File lands under the prefixed path on disk
            const onDisk = await fsp.readFile(join(directory, "users/123/avatar.png"), "utf8");

            expect(onDisk).toBe("x");

            const head = await facade.head("123/avatar.png");

            expect(head.key).toBe("123/avatar.png");

            const downloaded = await facade.download("123/avatar.png");

            expect(downloaded.body.toString("utf8")).toBe("x");
        });

        it("normalizes leading/trailing slashes equivalently", async () => {
            const { facade: f1 } = makePrefixed(directory, "users");
            const { facade: f2 } = makePrefixed(directory, "/users/");

            await f1.upload("a.txt", "x");
            const head = await f2.head("a.txt");

            expect(head.key).toBe("a.txt");
        });

        it("list() scopes results on a path boundary so `users` does not match `users-archive/`", async () => {
            const adapter = new DiskStorage<File>({ directory, maxUploadSize: "100MB" });
            // Seed via the raw adapter so we control the layout
            const seed = new Files({ adapter });

            await seed.upload("users/a.txt", "1");
            await seed.upload("users/b.txt", "2");
            await seed.upload("users-archive/c.txt", "3");

            const users = new Files({ adapter, prefix: "users" });
            const result = await users.list();
            const listed = result.map((file) => file.key).toSorted();

            expect(listed).toEqual(["a.txt", "b.txt"]);
        });
    });

    describe("per-call OperationOptions", () => {
        // A DiskStorage subclass that records the `options` argument passed to getMeta. Lets us
        // assert the signal/timeout actually reach the adapter, not just that the call type-checks.
        class CapturingDiskStorage extends DiskStorage {
            public readonly captured: { retries?: number; signal?: AbortSignal; timeout?: number }[] = [];

            public override async getMeta(id: string, options?: { retries?: number; signal?: AbortSignal; timeout?: number }): Promise<File> {
                this.captured.push({ retries: options?.retries, signal: options?.signal, timeout: options?.timeout });

                return super.getMeta(id, options);
            }
        }

        it("threads the per-call signal through to the adapter", async () => {
            const adapter = new CapturingDiskStorage({ directory, maxUploadSize: "100MB" });
            const facade = new Files({ adapter });

            await facade.upload("sig.txt", "x");
            adapter.captured.length = 0;

            const controller = new AbortController();

            await facade.head("sig.txt", { signal: controller.signal });

            expect(adapter.captured).toHaveLength(1);
            expect(adapter.captured[0]?.signal).toBe(controller.signal);
        });

        it("combines constructor-defaults signal with per-call signal via AbortSignal.any", async () => {
            const adapter = new CapturingDiskStorage({ directory, maxUploadSize: "100MB" });
            const defaultsController = new AbortController();
            const facade = new Files({ adapter, defaults: { signal: defaultsController.signal } });

            await facade.upload("sig2.txt", "x");
            adapter.captured.length = 0;

            const perCallController = new AbortController();

            await facade.head("sig2.txt", { signal: perCallController.signal });

            const combined = adapter.captured[0]?.signal;

            expect(combined).toBeDefined();
            expect(combined).not.toBe(defaultsController.signal);
            expect(combined).not.toBe(perCallController.signal);
            expect(combined?.aborted).toBe(false);

            perCallController.abort();

            expect(combined?.aborted).toBe(true);
        });

        it("ignores per-call keys explicitly set to undefined and keeps the constructor defaults", async () => {
            const adapter = new CapturingDiskStorage({ directory, maxUploadSize: "100MB" });
            const defaultsController = new AbortController();
            const facade = new Files({
                adapter,
                defaults: { retries: 3, signal: defaultsController.signal, timeout: 5000 },
            });

            await facade.upload("sig3.txt", "x");
            adapter.captured.length = 0;

            await facade.head("sig3.txt", { retries: undefined, signal: undefined, timeout: undefined });

            expect(adapter.captured[0]?.signal).toBe(defaultsController.signal);
            expect(adapter.captured[0]?.timeout).toBe(5000);
            expect(adapter.captured[0]?.retries).toBe(3);
        });

        it("merges constructor defaults with per-call options (per-call wins for scalars)", async () => {
            const adapter = new CapturingDiskStorage({ directory, maxUploadSize: "100MB" });
            const facade = new Files({ adapter, defaults: { timeout: 5000 } });

            await facade.upload("merge.txt", "hi");
            adapter.captured.length = 0;

            await facade.head("merge.txt", { timeout: 1000 });

            expect(adapter.captured[0]?.timeout).toBe(1000);
        });
    });

    describe("bulk operations", () => {
        it("upload() accepts an array of items and returns successes in order", async () => {
            const { facade } = makeFiles(directory);

            const result = await facade.upload([
                { body: "a", contentType: "text/plain", key: "bulk/a.txt" },
                { body: "b", contentType: "text/plain", key: "bulk/b.txt" },
                { body: "c", key: "bulk/c.txt" },
            ]);

            expect(result.uploaded.map((file) => file.key)).toEqual(["bulk/a.txt", "bulk/b.txt", "bulk/c.txt"]);
            expect(result.errors).toBeUndefined();
        });

        it("upload() collects per-key failures in errors instead of throwing", async () => {
            const { facade } = makeFiles(directory);

            const result = await facade.upload([
                { body: "ok", key: "bulk/ok.txt" },
                { body: "bad", key: "../escape.txt" },
            ]);

            expect(result.uploaded.map((file) => file.key)).toEqual(["bulk/ok.txt"]);
            expect(result.errors?.length).toBe(1);
            expect(result.errors?.[0]?.key).toBe("../escape.txt");
            expect(result.errors?.[0]?.error.message).toMatch(/Invalid file id|InvalidFileName/);
        });

        it("download() returns { downloaded, errors? } for an array of keys", async () => {
            const { facade } = makeFiles(directory);

            await facade.upload([
                { body: "a", key: "d/a.txt" },
                { body: "b", key: "d/b.txt" },
            ]);

            const result = await facade.download(["d/a.txt", "d/b.txt", "d/missing.txt"]);

            expect(result.downloaded.map((file) => file.body.toString("utf8")).toSorted()).toEqual(["a", "b"]);
            expect(result.errors?.length).toBe(1);
            expect(result.errors?.[0]?.key).toBe("d/missing.txt");
        });

        it("head() returns { files, errors? } for an array of keys", async () => {
            const { facade } = makeFiles(directory);

            await facade.upload([
                { body: "a", key: "h/a.txt" },
                { body: "b", key: "h/b.txt" },
            ]);

            const result = await facade.head(["h/a.txt", "h/b.txt", "h/missing.txt"]);

            expect(result.files.map((file) => file.key).toSorted()).toEqual(["h/a.txt", "h/b.txt"]);
            expect(result.errors?.length).toBe(1);
        });

        it("exists() splits results into existing/missing arrays", async () => {
            const { facade } = makeFiles(directory);

            await facade.upload([
                { body: "1", key: "e/here.txt" },
                { body: "2", key: "e/also.txt" },
            ]);

            const result = await facade.exists(["e/here.txt", "e/gone.txt", "e/also.txt"]);

            expect(result.existing.toSorted()).toEqual(["e/also.txt", "e/here.txt"]);
            expect(result.missing).toEqual(["e/gone.txt"]);
            expect(result.errors).toBeUndefined();
        });

        it("delete() returns { deleted, errors? } and removes the objects", async () => {
            const { facade } = makeFiles(directory);

            await facade.upload([
                { body: "1", key: "del/a.txt" },
                { body: "2", key: "del/b.txt" },
            ]);

            const result = await facade.delete(["del/a.txt", "del/b.txt"]);

            expect(result.deleted.toSorted()).toEqual(["del/a.txt", "del/b.txt"]);
            expect(result.errors).toBeUndefined();

            await expect(facade.exists("del/a.txt")).resolves.toBe(false);
            await expect(facade.exists("del/b.txt")).resolves.toBe(false);
        });

        it("delete() collects per-key validation failures in errors instead of throwing the whole batch", async () => {
            const { facade } = makeFiles(directory);

            await facade.upload([{ body: "ok", key: "del2/ok.txt" }]);

            const result = await facade.delete(["del2/ok.txt", "../escape.txt"]);

            expect(result.deleted).toEqual(["del2/ok.txt"]);
            expect(result.errors?.length).toBe(1);
            expect(result.errors?.[0]?.key).toBe("../escape.txt");
            expect(result.errors?.[0]?.error.message).toMatch(/Invalid file id|InvalidFileName/);

            await expect(facade.exists("del2/ok.txt")).resolves.toBe(false);
        });

        it("respects a custom concurrency limit", async () => {
            const { facade } = makeFiles(directory);

            const items = Array.from({ length: 12 }, (_, index) => {
                return {
                    body: String(index),
                    key: `c/${index}.txt`,
                };
            });

            const result = await facade.upload(items, { concurrency: 3 });

            expect(result.uploaded).toHaveLength(12);
        });

        it("bulk operations work under a constructor prefix and strip the prefix from results", async () => {
            const adapter = new DiskStorage<File>({ directory, maxUploadSize: "100MB" });
            const facade = new Files({ adapter, prefix: "tenant-1" });

            const upload = await facade.upload([
                { body: "a", key: "p/a.txt" },
                { body: "b", key: "p/b.txt" },
            ]);

            expect(upload.uploaded.map((file) => file.key).toSorted()).toEqual(["p/a.txt", "p/b.txt"]);

            // Files actually land under the prefixed path on disk
            await expect(fsp.readFile(join(directory, "tenant-1/p/a.txt"), "utf8")).resolves.toBe("a");

            const del = await facade.delete(["p/a.txt", "p/b.txt"]);

            expect(del.deleted.toSorted()).toEqual(["p/a.txt", "p/b.txt"]);
        });
    });
});
