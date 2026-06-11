/* eslint-disable max-classes-per-file -- one test file for the whole Files facade; a few small adapter stubs. */
import { createHash } from "node:crypto";
import { promises as fsp } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";

import { temporaryDirectory } from "tempy";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { HookEvent } from "../../src/files";
import { Files, sync, transfer, UploadControl } from "../../src/files";
import DiskStorage from "../../src/storage/local/disk-storage";
import MemoryStorage from "../../src/storage/memory/memory-storage";
import type { OperationOptions } from "../../src/storage/types";
import type { File } from "../../src/storage/utils/file";

const makeFiles = (directory: string): { adapter: DiskStorage; facade: Files<DiskStorage> } => {
    const adapter = new DiskStorage<File>({
        directory,
        maxUploadSize: "100MB",
    });

    return { adapter, facade: new Files({ adapter }) };
};

const makeMemoryFacade = (
    options: { hooks?: Parameters<typeof Files>[0]["hooks"]; initial?: Record<string, Buffer | Uint8Array | string>; prefix?: string } = {},
): { adapter: MemoryStorage; facade: Files<MemoryStorage> } => {
    const adapter = new MemoryStorage({ initial: options.initial });

    return {
        adapter,
        facade: new Files<MemoryStorage>({
            adapter,
            ...(options.hooks && { hooks: options.hooks }),
            ...(options.prefix !== undefined && { prefix: options.prefix }),
        }),
    };
};

/**
 * Memory adapter that advertises native delimiter support and records the resolved options the
 * facade hands it, so the native pushdown path can be exercised without a cloud backend.
 */
class NativeDelimiterStorage extends MemoryStorage {
    public override readonly supportsDelimiter: boolean = true;

    public lastDirectoryOptions?: OperationOptions & { delimiter: string; limit?: number; prefix?: string };

    public override async listDirectory(
        options?: OperationOptions & { delimiter: string; limit?: number; prefix?: string },
    ): Promise<{ files: Awaited<ReturnType<MemoryStorage["list"]>>; prefixes: string[] }> {
        this.lastDirectoryOptions = options;

        return {
            files: [{ id: "tenant/photos/cover.jpg", name: "tenant/photos/cover.jpg" }] as unknown as Awaited<ReturnType<MemoryStorage["list"]>>,
            prefixes: ["tenant/photos/2023/", "tenant/photos/2024/"],
        };
    }
}

/**
 * Memory adapter whose `list` returns only id/name (no size/etag), mimicking S3/GCS/Azure `list`.
 * Forces `sync` to fall back to heading the source for the strong comparison signals.
 */
class LeanListStorage extends MemoryStorage {
    public override async list(limit?: number, options?: OperationOptions): Promise<Awaited<ReturnType<MemoryStorage["list"]>>> {
        const files = await super.list(limit, options);

        return files.map((file) => {
            return { id: file.id, name: file.name };
        }) as unknown as Awaited<ReturnType<MemoryStorage["list"]>>;
    }
}

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

        it("rejects a prefix containing . or .. path segments at construction", () => {
            expect(() => makePrefixed(directory, "../escape")).toThrow(/path segments|InvalidFileName/);
            expect(() => makePrefixed(directory, "users/../admin")).toThrow(/path segments|InvalidFileName/);
        });

        it("rejects a prefixed key that escapes the namespace via .. segments", async () => {
            const { facade } = makePrefixed(directory, "users");

            await expect(facade.head("../admin/secret")).rejects.toThrow(/path segments|InvalidFileName/);
            await expect(facade.download("../../etc/passwd")).rejects.toThrow(/path segments|InvalidFileName/);
            await expect(facade.upload("../escape.txt", "x")).rejects.toThrow(/path segments|InvalidFileName/);
        });
    });

    describe("leading-slash key normalization", () => {
        it("strips a leading slash and treats the key as relative — with no prefix", async () => {
            const { facade } = makeFiles(directory);

            const uploaded = await facade.upload("/a.txt", "hello");

            expect(uploaded.key).toBe("a.txt");

            // The same object is reachable with or without the leading slash.
            const downloaded = await facade.download("/a.txt");

            expect(downloaded.body.toString("utf8")).toBe("hello");

            const head = await facade.head("a.txt");

            expect(head.key).toBe("a.txt");
        });

        it("strips a leading slash consistently when a prefix is configured", async () => {
            const adapter = new DiskStorage<File>({ directory, maxUploadSize: "100MB" });
            const facade = new Files({ adapter, prefix: "users" });

            const withSlash = await facade.upload("/b.txt", "x");
            const head = await facade.head("b.txt");

            expect(withSlash.key).toBe("b.txt");
            expect(head.key).toBe("b.txt");

            // Lands under the prefix on disk regardless of the leading slash.
            const onDisk = await fsp.readFile(join(directory, "users/b.txt"), "utf8");

            expect(onDisk).toBe("x");
        });
    });

    describe("ranged download (DiskStorage)", () => {
        it("returns only the requested byte slice without buffering the whole file", async () => {
            const { facade } = makeFiles(directory);

            await facade.upload("ranged.txt", "0123456789", { contentType: "text/plain" });

            const slice = await facade.download("ranged.txt", { range: { end: 5, start: 2 } });

            // end is inclusive (HTTP semantics): bytes 2..5 => "2345"
            expect(slice.body.toString("utf8")).toBe("2345");
            expect(slice.size).toBe(4);
        });

        it("reads from start to EOF when end is omitted", async () => {
            const { facade } = makeFiles(directory);

            await facade.upload("ranged2.txt", "0123456789");

            const slice = await facade.download("ranged2.txt", { range: { start: 7 } });

            expect(slice.body.toString("utf8")).toBe("789");
        });

        it("rejects an out-of-bounds range", async () => {
            const { facade } = makeFiles(directory);

            await facade.upload("ranged3.txt", "abc");

            await expect(facade.download("ranged3.txt", { range: { start: 100 } })).rejects.toThrow();
        });
    });

    describe("downloadStream", () => {
        it("returns a readable stream of the object body with metadata", async () => {
            const { facade } = makeFiles(directory);

            await facade.upload("big.bin", "streamed-content", { contentType: "text/plain" });

            const result = await facade.downloadStream("big.bin");

            expect(result.key).toBe("big.bin");
            expect(result.body).toBeInstanceOf(Readable);

            const chunks: Buffer[] = [];

            for await (const chunk of result.body) {
                chunks.push(chunk as Buffer);
            }

            expect(Buffer.concat(chunks).toString("utf8")).toBe("streamed-content");
        });

        it("normalizes a leading slash and rejects unsafe keys", async () => {
            const { facade } = makeFiles(directory);

            await facade.upload("docs/readme.md", "ok");

            const result = await facade.downloadStream("/docs/readme.md");
            const chunks: Buffer[] = [];

            for await (const chunk of result.body) {
                chunks.push(chunk as Buffer);
            }

            expect(Buffer.concat(chunks).toString("utf8")).toBe("ok");

            await expect(facade.downloadStream("../etc/passwd")).rejects.toThrow(/Invalid file id|InvalidFileName|path segments/);
        });
    });

    /* eslint-disable sonarjs/hashing -- sha1 is one of DiskStorage's supported checksum algorithms; this only validates upload-time integrity plumbing, not a security boundary. */
    describe("upload checksum", () => {
        it("forwards a matching checksum to the adapter and stores the object", async () => {
            const { facade } = makeFiles(directory);
            const body = "integrity-check";
            const sha = createHash("sha1").update(body).digest("base64");

            const uploaded = await facade.upload("checked.txt", body, {
                checksum: sha,
                checksumAlgorithm: "sha1",
            });

            expect(uploaded.key).toBe("checked.txt");

            const downloaded = await facade.download("checked.txt");

            expect(downloaded.body.toString("utf8")).toBe(body);
        });

        it("rejects the upload when the checksum does not match the body", async () => {
            const { facade } = makeFiles(directory);

            await expect(
                facade.upload("bad.txt", "real-body", {
                    checksum: createHash("sha1").update("different-body").digest("base64"),
                    checksumAlgorithm: "sha1",
                }),
            ).rejects.toThrow();
        });
    });
    /* eslint-enable sonarjs/hashing */

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

describe("memory storage adapter", () => {
    it("supports a full upload/download/exists/delete cycle", async () => {
        const { facade } = makeMemoryFacade();

        await facade.upload("a.txt", "hello");

        await expect(facade.exists("a.txt")).resolves.toBe(true);

        const dl = await facade.download("a.txt");

        expect(dl.body.toString("utf8")).toBe("hello");

        await facade.delete("a.txt");

        await expect(facade.exists("a.txt")).resolves.toBe(false);
    });

    it("declares supportsRange = true", () => {
        const { adapter } = makeMemoryFacade();

        expect(adapter.supportsRange).toBe(true);
    });

    it("exposes raw as the backing Map", async () => {
        const { adapter, facade } = makeMemoryFacade();

        await facade.upload("k.txt", "x");

        expect(adapter.raw.has("k.txt")).toBe(true);
    });

    it("returns memory:// URLs", async () => {
        const { facade } = makeMemoryFacade();

        await facade.upload("k.txt", "x");

        await expect(facade.url("k.txt")).resolves.toBe("memory://k.txt");
        await expect(facade.signedUploadUrl("k.txt")).resolves.toBe("memory://k.txt");
    });
});

describe("move() on the Files facade", () => {
    it("renames a single object via copy+delete", async () => {
        const { adapter, facade } = makeMemoryFacade();

        await facade.upload("from.txt", "payload");
        const result = await facade.move("from.txt", "to.txt");

        expect(result.key).toBe("to.txt");
        expect(adapter.raw.has("from.txt")).toBe(false);
        expect(adapter.raw.has("to.txt")).toBe(true);

        const moved = await facade.download("to.txt");

        expect(moved.body.toString("utf8")).toBe("payload");
    });

    it("is a no-op when source and destination match", async () => {
        const { facade } = makeMemoryFacade();

        await facade.upload("same.txt", "x");
        const result = await facade.move("same.txt", "same.txt");

        expect(result.key).toBe("same.txt");

        const downloaded = await facade.download("same.txt");

        expect(downloaded.body.toString("utf8")).toBe("x");
    });

    it("runs the bulk array form with per-item errors", async () => {
        const { facade } = makeMemoryFacade();

        await facade.upload("a.txt", "A");
        await facade.upload("b.txt", "B");

        const result = await facade.move([
            { from: "a.txt", to: "a2.txt" },
            { from: "b.txt", to: "b2.txt" },
            { from: "missing.txt", to: "ghost.txt" },
        ]);

        expect(result.moved.map((file) => file.key).toSorted()).toEqual(["a2.txt", "b2.txt"]);
        expect(result.errors).toBeDefined();
        expect(result.errors).toHaveLength(1);
        expect(result.errors?.[0]?.key).toBe("missing.txt");
    });

    it("strips the constructor prefix off the result key", async () => {
        const { facade } = makeMemoryFacade({ prefix: "tenant-x" });

        await facade.upload("a.txt", "A");
        const result = await facade.move("a.txt", "renamed/a.txt");

        expect(result.key).toBe("renamed/a.txt");
    });
});

describe("listAll() async iterable", () => {
    it("yields every uploaded object", async () => {
        const { facade } = makeMemoryFacade();

        await Promise.all([facade.upload("a.txt", "A"), facade.upload("b.txt", "B"), facade.upload("c.txt", "C")]);

        const collected: string[] = [];

        for await (const file of facade.listAll()) {
            collected.push(file.key);
        }

        expect(collected.toSorted()).toEqual(["a.txt", "b.txt", "c.txt"]);
    });

    it("filters by relative prefix and strips the constructor prefix", async () => {
        const { facade } = makeMemoryFacade({ prefix: "users" });

        await facade.upload("123/avatar.png", "x");
        await facade.upload("123/cover.png", "y");
        await facade.upload("456/avatar.png", "z");

        const collected: string[] = [];

        for await (const file of facade.listAll({ prefix: "123/" })) {
            collected.push(file.key);
        }

        expect(collected.toSorted()).toEqual(["123/avatar.png", "123/cover.png"]);
    });

    it("does not yield duplicates", async () => {
        const { facade } = makeMemoryFacade({ initial: { "x.txt": "x" } });

        // Re-pump through the page loop a few times by listing in batches of 1.
        const collected: string[] = [];

        for await (const file of facade.listAll({ limit: 1 })) {
            collected.push(file.key);
        }

        expect(collected).toEqual(["x.txt"]);
    });
});

describe("hooks", () => {
    it("fires onAction on success with timing", async () => {
        const onAction = vi.fn();
        const { facade } = makeMemoryFacade({ hooks: { onAction } });

        await facade.upload("k.txt", "hi");

        expect(onAction).toHaveBeenCalledTimes(1);

        const event = onAction.mock.calls.at(-1)?.[0] as HookEvent;

        expect(event.type).toBe("upload");
        expect(event.key).toBe("k.txt");

        expect(event.durationMs).toEqual(expect.any(Number));
    });

    it("fires onError when an operation throws", async () => {
        const onError = vi.fn();
        const { facade } = makeMemoryFacade({ hooks: { onError } });

        await expect(facade.download("missing.txt")).rejects.toThrow();
        expect(onError).toHaveBeenCalledTimes(1);

        const event = onError.mock.calls[0]?.[0] as HookEvent;

        expect(event.type).toBe("download");
        expect(event.error).toBeInstanceOf(Error);
    });

    it("does not let a throwing hook fail the operation", async () => {
        const { facade } = makeMemoryFacade({
            hooks: {
                onAction: () => {
                    throw new Error("hook boom");
                },
            },
        });

        await expect(facade.upload("k.txt", "x")).resolves.toBeDefined();
    });
});

describe("download({ range })", () => {
    it("returns only the requested byte slice from memory storage", async () => {
        const { facade } = makeMemoryFacade();

        await facade.upload("blob.bin", Buffer.from("0123456789"));

        const slice = await facade.download("blob.bin", { range: { end: 5, start: 2 } });

        expect(slice.body.toString("utf8")).toBe("2345");
    });

    it("reads to EOF when end is omitted", async () => {
        const { facade } = makeMemoryFacade();

        await facade.upload("blob.bin", Buffer.from("0123456789"));

        const slice = await facade.download("blob.bin", { range: { start: 7 } });

        expect(slice.body.toString("utf8")).toBe("789");
    });

    it("rejects an invalid range without calling the adapter", async () => {
        const { facade } = makeMemoryFacade();

        await facade.upload("blob.bin", "x");

        await expect(facade.download("blob.bin", { range: { end: 1, start: 5 } })).rejects.toThrow();
    });
});

describe("upload({ onProgress })", () => {
    it("reports per-chunk byte counts for a Node Readable", async () => {
        const { facade } = makeMemoryFacade();
        const events: { loaded: number; total?: number }[] = [];

        // Producing two chunks lets us observe progress monotonically increasing.
        const stream = Readable.from([Buffer.from("hello "), Buffer.from("world")]);

        await facade.upload("k.txt", stream, {
            onProgress: (event) => events.push(event),
            size: 11,
        });

        expect(events.length).toBeGreaterThan(0);
        expect(events.at(-1)?.loaded).toBe(11);
        expect(events.at(-1)?.total).toBe(11);
    });

    it("survives a throwing onProgress callback", async () => {
        const { facade } = makeMemoryFacade();

        await expect(
            facade.upload("k.txt", Buffer.from("xyz"), {
                onProgress: () => {
                    throw new Error("nope");
                },
            }),
        ).resolves.toBeDefined();
    });
});

describe("transfer(source, dest)", () => {
    it("streams every object from source to destination", async () => {
        const source = new Files({
            adapter: new MemoryStorage({
                initial: { "a.txt": "A", "b.txt": "B", "c.txt": "C" },
            }),
        });
        const destinationAdapter = new MemoryStorage();
        const destination = new Files({ adapter: destinationAdapter });

        const result = await transfer(source, destination);

        expect(result.transferred.toSorted()).toEqual(["a.txt", "b.txt", "c.txt"]);
        expect(result.skipped).toEqual([]);
        expect(destinationAdapter.raw.size).toBe(3);
    });

    it("skips keys that already exist at the destination by default", async () => {
        const source = new Files({ adapter: new MemoryStorage({ initial: { "k.txt": "new" } }) });
        const destinationAdapter = new MemoryStorage({ initial: { "k.txt": "old" } });
        const destination = new Files({ adapter: destinationAdapter });

        const result = await transfer(source, destination);

        expect(result.skipped).toEqual(["k.txt"]);
        expect(result.transferred).toEqual([]);

        const downloaded = await destination.download("k.txt");

        expect(downloaded.body.toString("utf8")).toBe("old");
    });

    it("overwrites when overwrite: true", async () => {
        const source = new Files({ adapter: new MemoryStorage({ initial: { "k.txt": "new" } }) });
        const destination = new Files({ adapter: new MemoryStorage({ initial: { "k.txt": "old" } }) });

        await transfer(source, destination, { overwrite: true });

        const downloaded = await destination.download("k.txt");

        expect(downloaded.body.toString("utf8")).toBe("new");
    });

    it("transforms keys via transformKey", async () => {
        const source = new Files({ adapter: new MemoryStorage({ initial: { "a.txt": "A" } }) });
        const destination = new Files({ adapter: new MemoryStorage() });

        await transfer(source, destination, { transformKey: (key) => `archive/${key}` });

        await expect(destination.exists("archive/a.txt")).resolves.toBe(true);
        await expect(destination.exists("a.txt")).resolves.toBe(false);
    });

    it("reports per-key progress", async () => {
        const source = new Files({ adapter: new MemoryStorage({ initial: { "a.txt": "A", "b.txt": "B" } }) });
        const destination = new Files({ adapter: new MemoryStorage() });

        const events: { key: string; status: string }[] = [];

        await transfer(source, destination, {
            onProgress: ({ key, status }) => events.push({ key, status }),
        });

        expect(events).toHaveLength(2);
        expect(events.every((event) => event.status === "transferred")).toBe(true);
    });

    it("stops dispatching new transfers when the signal is already aborted", async () => {
        const initial: Record<string, string> = {};

        for (let index = 0; index < 50; index += 1) {
            initial[`k-${index}.txt`] = String(index);
        }

        const source = new Files({ adapter: new MemoryStorage({ initial }) });
        const destinationAdapter = new MemoryStorage();
        const destination = new Files({ adapter: destinationAdapter });

        const controller = new AbortController();

        controller.abort();

        const result = await transfer(source, destination, {
            concurrency: 1,
            signal: controller.signal,
        });

        // Worker pool sees `signal.aborted` on entry and exits without transferring any key.
        expect(result.transferred).toEqual([]);
        expect(destinationAdapter.raw.size).toBe(0);
    });

    it("stops on the first failure when stopOnError is set", async () => {
        const source = new Files({ adapter: new MemoryStorage({ initial: { "a.txt": "A", "b.txt": "B", "c.txt": "C" } }) });
        const destinationAdapter = new MemoryStorage();
        const destination = new Files({ adapter: destinationAdapter });

        // Force the second `upload` to throw so we can see stopOnError stop after a.txt succeeds.
        const calls: string[] = [];
        const original = destination.upload.bind(destination);

        (destination as { upload: unknown }).upload = (...arguments_: Parameters<typeof original>) => {
            calls.push(arguments_[0] as string);

            if (calls.length === 2) {
                throw new Error("boom");
            }

            return original(...arguments_);
        };

        const result = await transfer(source, destination, { stopOnError: true });

        expect(result.errors).toBeDefined();
        expect(result.errors).toHaveLength(1);
        // a.txt was transferred before the failure; subsequent keys never ran.
        expect(result.transferred.length).toBeLessThan(3);
    });
});

describe("onRetry — retry() core", () => {
    it("invokes onRetry once per retry attempt with a 1-based index", async () => {
        const { retry } = await import("../../src/utils/retry");

        const events: { attempt: number; message: string }[] = [];
        let calls = 0;

        const result = await retry(
            async () => {
                calls += 1;

                if (calls < 3) {
                    const error = new Error("transient");

                    (error as Error & { code?: string }).code = "ECONNRESET";

                    throw error;
                }

                return "ok";
            },
            {
                initialDelay: 1,
                maxRetries: 5,
                onRetry: (attempt, error) => events.push({ attempt, message: (error as Error).message }),
            },
        );

        expect(result).toBe("ok");
        expect(events).toEqual([
            { attempt: 1, message: "transient" },
            { attempt: 2, message: "transient" },
        ]);
    });

    it("swallows exceptions thrown from onRetry", async () => {
        const { retry } = await import("../../src/utils/retry");

        let calls = 0;
        const result = await retry(
            async () => {
                calls += 1;

                if (calls === 1) {
                    const error = new Error("transient");

                    (error as Error & { code?: string }).code = "ECONNRESET";

                    throw error;
                }

                return "ok";
            },
            {
                initialDelay: 1,
                maxRetries: 1,
                onRetry: () => {
                    throw new Error("hook boom");
                },
            },
        );

        expect(result).toBe("ok");
    });
});

describe("onRetry — facade wiring", () => {
    /**
     * Minimal stub: a MemoryStorage subclass whose `getMeta` wraps the parent call in the
     * `retry()` helper, so the facade's `head()` → `adapter.getMeta(id, options)` path actually
     * threads `options.retries` through to the retry engine. Two transient failures then a
     * success exercises onRetry firing twice.
     */
    class FlakyMemoryStorage extends MemoryStorage {
        private calls = 0;

        public override async getMeta(id: string, options?: Parameters<MemoryStorage["getMeta"]>[1]) {
            const { retry } = await import("../../src/utils/retry");

            return retry(
                async () => {
                    this.calls += 1;

                    if (this.calls <= 2) {
                        const error = new Error("transient");

                        (error as Error & { code?: string }).code = "ECONNRESET";

                        throw error;
                    }

                    return super.getMeta(id, options);
                },
                typeof options?.retries === "number" ? { maxRetries: options.retries } : (options?.retries ?? {}),
            );
        }
    }

    it("forwards the facade hook with attempt + facade context on each retry", async () => {
        const adapter = new FlakyMemoryStorage();

        // Seed via a hook-free facade so the flaky path doesn't fire during setup.
        await new Files<MemoryStorage>({ adapter: new MemoryStorage() }).upload("seed", "ignored");
        // Now seed `k.txt` directly into the flaky adapter using the meta path it already exposes.
        const seedFacade = new Files<MemoryStorage>({ adapter });

        // Initial getMeta calls during upload will hit the flaky path and retry to success.
        await seedFacade.upload("k.txt", "hello");

        // Reset and rewire with hooks attached for the actual assertion call.
        (adapter as unknown as { calls: number }).calls = 0;

        const onRetry = vi.fn();
        const facade = new Files<MemoryStorage>({
            adapter,
            defaults: { retries: { initialDelay: 1, maxRetries: 3 } },
            hooks: { onRetry },
        });

        await facade.head("k.txt");

        expect(onRetry).toHaveBeenCalledTimes(2);

        const first = onRetry.mock.calls[0]?.[0] as HookEvent & { attempt: number; error: Error };

        expect(first.attempt).toBe(1);
        expect(first.type).toBe("head");
        expect(first.key).toBe("k.txt");
        expect(first.error).toBeInstanceOf(Error);
    });

    it("survives a throwing onRetry hook", async () => {
        const adapter = new FlakyMemoryStorage();

        await new Files<MemoryStorage>({ adapter }).upload("k.txt", "hello");

        (adapter as unknown as { calls: number }).calls = 0;

        const facade = new Files<MemoryStorage>({
            adapter,
            defaults: { retries: { initialDelay: 1, maxRetries: 3 } },
            hooks: {
                onRetry: () => {
                    throw new Error("hook boom");
                },
            },
        });

        await expect(facade.head("k.txt")).resolves.toBeDefined();
    });
});

describe("buildRangeHeader helper", () => {
    it("formats both bounds and clamps negative start", async () => {
        const { buildRangeHeader } = await import("../../src/storage/aws/s3-base-storage");

        expect(buildRangeHeader({ end: 10, start: 0 })).toBe("bytes=0-10");
        expect(buildRangeHeader({ end: 99, start: -5 })).toBe("bytes=0-99");
    });

    it("emits the open-ended form when end is omitted", async () => {
        const { buildRangeHeader } = await import("../../src/storage/aws/s3-base-storage");

        expect(buildRangeHeader({ start: 7 })).toBe("bytes=7-");
    });

    it("returns undefined for an absent range", async () => {
        const { buildRangeHeader } = await import("../../src/storage/aws/s3-base-storage");

        expect(buildRangeHeader(undefined)).toBeUndefined();
    });
});

describe("reportsUploadProgress=true adapter path", () => {
    it("forwards onProgress to the adapter and skips the facade's PassThrough emission", async () => {
        const adapter = new MemoryStorage();

        // Flip the capability flag for this test and observe how the facade routes onProgress.
        Object.defineProperty(adapter, "reportsUploadProgress", { value: true });

        const writeSpy = vi.spyOn(adapter, "write");
        const onProgress = vi.fn();

        const facade = new Files<MemoryStorage>({ adapter });

        await facade.upload("k.txt", Buffer.from("payload"), { onProgress });

        // Facade did NOT emit any synthetic events (no PassThrough wrap).
        expect(onProgress).not.toHaveBeenCalled();

        // ...but the adapter received the callback on the write part.
        const part = writeSpy.mock.calls[0]?.[0] as { onProgress?: unknown };

        expect(part.onProgress).toEqual(expect.any(Function));
    });
});

describe("listAll terminal hook event", () => {
    it("fires onAction even when the consumer breaks out of the for-await early", async () => {
        const onAction = vi.fn();
        const { facade } = makeMemoryFacade({
            hooks: { onAction },
            initial: { "a.txt": "A", "b.txt": "B", "c.txt": "C" },
        });

        for await (const _file of facade.listAll()) {
            break;
        }

        const types = onAction.mock.calls.map((call) => (call[0] as HookEvent).type);

        expect(types).toContain("listAll");
    });
});

describe("capabilities", () => {
    it("reports adapter flags and the writable mode", () => {
        const { facade } = makeMemoryFacade();

        expect(facade.capabilities).toStrictEqual({
            cacheControl: false,
            metadata: true,
            range: true,
            readonly: false,
        });
    });

    it("flips readonly on a derived view", () => {
        const { facade } = makeMemoryFacade();

        expect(facade.readonly().capabilities.readonly).toBe(true);
    });
});

describe("read-only Files instances", () => {
    it("rejects every mutating operation with a ReadOnly error", async () => {
        const { adapter } = makeMemoryFacade({ initial: { "a.txt": "hello" } });
        const facade = new Files<MemoryStorage>({ adapter, readonly: true });

        await expect(facade.upload("b.txt", "x")).rejects.toMatchObject({ UploadErrorCode: "ReadOnly" });
        await expect(facade.delete("a.txt")).rejects.toMatchObject({ UploadErrorCode: "ReadOnly" });
        await expect(facade.copy("a.txt", "c.txt")).rejects.toMatchObject({ UploadErrorCode: "ReadOnly" });
        await expect(facade.move("a.txt", "c.txt")).rejects.toMatchObject({ UploadErrorCode: "ReadOnly" });
        await expect(facade.signedUploadUrl("b.txt")).rejects.toMatchObject({ UploadErrorCode: "ReadOnly" });
    });

    it("never touches the adapter on a rejected write", async () => {
        const { adapter, facade } = makeMemoryFacade({ initial: { "a.txt": "hello" } });
        const readView = facade.readonly();

        await expect(readView.delete("a.txt")).rejects.toMatchObject({ UploadErrorCode: "ReadOnly" });

        // Adapter untouched — the key is still there.
        expect(adapter.raw.has("a.txt")).toBe(true);
    });

    it("still allows reads", async () => {
        const { facade } = makeMemoryFacade({ initial: { "a.txt": "hello" } });
        const readView = facade.readonly();

        await expect(readView.exists("a.txt")).resolves.toBe(true);

        const downloaded = await readView.download("a.txt");

        expect(downloaded.body.toString("utf8")).toBe("hello");

        const listed = await readView.list();

        expect(listed.map((file) => file.key)).toContain("a.txt");
    });
});

describe("delimiter / directory-style listing", () => {
    it("collapses keys into common prefixes and direct files", async () => {
        const { facade } = makeMemoryFacade({
            initial: {
                "photos/2023/a.jpg": "a",
                "photos/2023/b.jpg": "b",
                "photos/2024/c.jpg": "c",
                "photos/cover.jpg": "cover",
                "readme.txt": "top-level",
            },
        });

        const result = await facade.list({ delimiter: "/", prefix: "photos/" });

        expect(result.prefixes).toStrictEqual(["photos/2023/", "photos/2024/"]);
        expect(result.files.map((file) => file.key)).toStrictEqual(["photos/cover.jpg"]);
    });

    it("lists the bucket root by delimiter", async () => {
        const { facade } = makeMemoryFacade({
            initial: {
                "a/x.txt": "1",
                "b/y.txt": "2",
                "top.txt": "3",
            },
        });

        const result = await facade.list({ delimiter: "/" });

        expect(result.prefixes).toStrictEqual(["a/", "b/"]);
        expect(result.files.map((file) => file.key)).toStrictEqual(["top.txt"]);
    });

    it("returns a flat array when no delimiter is given", async () => {
        const { facade } = makeMemoryFacade({ initial: { "a.txt": "1", "b.txt": "2" } });

        const result = await facade.list();

        expect(Array.isArray(result)).toBe(true);
    });

    it("prefers the adapter's native listDirectory and strips the constructor prefix", async () => {
        const adapter = new NativeDelimiterStorage();
        const facade = new Files({ adapter, prefix: "tenant" });

        const result = await facade.list({ delimiter: "/", prefix: "photos/" });

        // Listing prefix resolved against the constructor prefix and pushed to the adapter.
        expect(adapter.lastDirectoryOptions?.delimiter).toBe("/");
        expect(adapter.lastDirectoryOptions?.prefix).toBe("tenant/photos/");

        // Constructor prefix stripped back off both files and common prefixes.
        expect(result.files.map((file) => file.key)).toStrictEqual(["photos/cover.jpg"]);
        expect(result.prefixes).toStrictEqual(["photos/2023/", "photos/2024/"]);
    });
});

describe("sync(source, destination)", () => {
    it("uploads keys missing at the destination", async () => {
        const source = new Files({ adapter: new MemoryStorage({ initial: { "a.txt": "1", "b.txt": "2" } }) });
        const destinationAdapter = new MemoryStorage();
        const destination = new Files({ adapter: destinationAdapter });

        const result = await sync(source, destination);

        expect(result.uploaded.toSorted()).toStrictEqual(["a.txt", "b.txt"]);
        expect(result.updated).toStrictEqual([]);
        expect(destinationAdapter.raw.has("a.txt")).toBe(true);
    });

    it("skips unchanged keys and re-uploads differing ones", async () => {
        const source = new Files({ adapter: new MemoryStorage({ initial: { "diff.txt": "longer-content", "same.txt": "identical" } }) });
        const destination = new Files({ adapter: new MemoryStorage({ initial: { "diff.txt": "x", "same.txt": "identical" } }) });

        const result = await sync(source, destination);

        expect(result.unchanged).toStrictEqual(["same.txt"]);
        expect(result.updated).toStrictEqual(["diff.txt"]);

        const downloaded = await destination.download("diff.txt");

        expect(downloaded.body.toString("utf8")).toBe("longer-content");
    });

    it("prunes destination keys absent from the source when prune=true", async () => {
        const source = new Files({ adapter: new MemoryStorage({ initial: { "keep.txt": "k" } }) });
        const destinationAdapter = new MemoryStorage({ initial: { "keep.txt": "k", "orphan.txt": "o" } });
        const destination = new Files({ adapter: destinationAdapter });

        const result = await sync(source, destination, { prune: true });

        expect(result.deleted).toStrictEqual(["orphan.txt"]);
        expect(destinationAdapter.raw.has("orphan.txt")).toBe(false);
        expect(destinationAdapter.raw.has("keep.txt")).toBe(true);
    });

    it("does not prune without prune=true", async () => {
        const source = new Files({ adapter: new MemoryStorage({ initial: { "keep.txt": "k" } }) });
        const destinationAdapter = new MemoryStorage({ initial: { "keep.txt": "k", "orphan.txt": "o" } });
        const destination = new Files({ adapter: destinationAdapter });

        const result = await sync(source, destination);

        expect(result.deleted).toStrictEqual([]);
        expect(destinationAdapter.raw.has("orphan.txt")).toBe(true);
    });

    it("heads the source for size/etag when the listing omits them", async () => {
        const source = new Files({ adapter: new LeanListStorage({ initial: { "diff.txt": "much-longer", "same.txt": "identical" } }) });
        const destination = new Files({ adapter: new MemoryStorage({ initial: { "diff.txt": "x", "same.txt": "identical" } }) });

        const result = await sync(source, destination);

        // Comparison still works even though the source walk surfaced no size/etag.
        expect(result.unchanged).toStrictEqual(["same.txt"]);
        expect(result.updated).toStrictEqual(["diff.txt"]);
    });

    it("computes a plan without writing under dryRun", async () => {
        const source = new Files({ adapter: new MemoryStorage({ initial: { "new.txt": "n" } }) });
        const destinationAdapter = new MemoryStorage({ initial: { "orphan.txt": "o" } });
        const destination = new Files({ adapter: destinationAdapter });

        const result = await sync(source, destination, { dryRun: true, prune: true });

        expect(result.uploaded).toStrictEqual(["new.txt"]);
        expect(result.deleted).toStrictEqual(["orphan.txt"]);

        // Nothing actually changed on disk.
        expect(destinationAdapter.raw.has("new.txt")).toBe(false);
        expect(destinationAdapter.raw.has("orphan.txt")).toBe(true);
    });
});

describe("upload control", () => {
    it("starts idle and exposes a non-aborted signal", () => {
        const control = new UploadControl();

        expect(control.state).toBe("idle");
        expect(control.signal.aborted).toBe(false);
        expect(control.loaded).toBe(0);
    });

    it("transitions through pause/resume/abort", () => {
        const control = new UploadControl();

        control.pause();

        expect(control.state).toBe("paused");

        control.resume();

        expect(control.state).toBe("uploading");

        control.abort();

        expect(control.state).toBe("aborted");
        expect(control.signal.aborted).toBe(true);

        // Abort wins — pause/resume are no-ops afterwards.
        control.resume();

        expect(control.state).toBe("aborted");
    });

    it("round-trips through serialize()/from()", () => {
        const control = new UploadControl({ key: "big.bin", loaded: 42 });
        const token = control.serialize();

        expect(token).toStrictEqual({ key: "big.bin", loaded: 42, version: 1 });

        const restored = UploadControl.from(JSON.stringify(token));

        expect(restored.key).toBe("big.bin");
        expect(restored.loaded).toBe(42);
        expect(restored.state).toBe("idle");
    });

    it("marks the control completed and records bytes after a successful upload", async () => {
        const { facade } = makeMemoryFacade();
        const control = new UploadControl();

        const payload = Buffer.from("streamed-bytes");

        await facade.upload("s.bin", Readable.from(payload), { control, size: payload.byteLength });

        expect(control.state).toBe("completed");
        expect(control.loaded).toBe(payload.byteLength);
        expect(control.key).toBe("s.bin");
    });
});
