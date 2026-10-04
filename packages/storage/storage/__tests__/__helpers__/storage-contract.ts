import { Readable } from "node:stream";
import { text } from "node:stream/consumers";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Files, UploadControl } from "../../src/files";
import RestFetch from "../../src/handler/rest/rest-fetch";
import type MetaStorage from "../../src/storage/meta-storage";
import type { BaseStorage } from "../../src/storage/storage";
import type { ConditionalSupport, ExpirationOptions } from "../../src/storage/types";
import { ERRORS } from "../../src/utils/errors";
import { createdAgo, HOUR } from "./clock";

/** What the contract needs from a provider's fake backend. */
export interface StorageContractSetup {
    /** A storage over the backend. */
    createStorage: (options?: { expiration?: ExpirationOptions }) => BaseStorage;

    /** Makes every call to the backend fail (a server error, or the backend refusing it), or work again. */
    failBackend: (failing: boolean) => void;

    /** Whether the backend stores an object under `key`. */
    hasObject: (key: string) => Promise<boolean> | boolean;

    /** Stores an object under `key` as an app sharing the backend would: without upload metadata. */
    putObject: (key: string, content: string) => Promise<void> | void;
}

export type StorageContractScenario = "copy and move" | "expired upload" | "failing meta store" | "purge" | "resume across processes" | "REST lifecycle";

const upload = async (storage: BaseStorage, content: string): Promise<string> => {
    const file = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "a.txt", size: content.length });

    await storage.write({ body: Readable.from([Buffer.from(content)]), contentLength: content.length, id: file.id, start: 0 });

    return file.id;
};

/** S3's smallest non-final part, so one part size works for every adapter (also a multiple of GCS's 256 KiB). */
const PART_SIZE = 5 * 1024 * 1024;

/** Bytes the adapter was handed to store, over every `write` call. */
const bytesWritten = (write: { mock: { calls: unknown[][] } }): number =>
    write.mock.calls.reduce<number>((total, [part]) => total + ((part as { contentLength?: number }).contentLength ?? 0), 0);

const metaOf = (storage: BaseStorage): MetaStorage => (storage as unknown as { meta: MetaStorage }).meta;

const precondition = expect.objectContaining({ UploadErrorCode: ERRORS.PRECONDITION_FAILED });

const etagOf = async (files: Files, key: string): Promise<string> => {
    const { etag } = await files.download(key);

    return etag as string;
};

const textOf = async (files: Files, key: string): Promise<string> => {
    const { body } = await files.download(key);

    return body.toString();
};

/**
 * The behaviour every storage adapter shares, run against a provider's in-memory backend. Call it
 * inside the provider's describe block, so its hooks set up a fresh backend for every test first.
 * @param setup Hands out the backend of the current test
 * @param skip Scenarios the provider can't run, with the reason
 */
export const describeStorageContract = (setup: () => StorageContractSetup, skip: Partial<Record<StorageContractScenario, string>> = {}): void => {
    describe("storage contract", () => {
        let backend: StorageContractSetup;

        beforeEach(() => {
            backend = setup();
        });

        afterEach(() => {
            backend.failBackend(false);
            vi.useRealTimers();
        });

        it("should read back a finished upload and keep its metadata", async () => {
            expect.assertions(4);

            const storage = backend.createStorage();
            const id = await upload(storage, "hello");

            await expect(storage.get({ id })).resolves.toHaveProperty("content", Buffer.from("hello"));
            await expect(storage.getStream({ id }).then(async ({ stream }) => text(stream))).resolves.toBe("hello");
            await expect(storage.getMeta(id)).resolves.toHaveProperty("status", "completed");
            await expect(storage.exists({ id })).resolves.toBe(true);
        });

        it.skipIf(skip["copy and move"] !== undefined)("should copy and move an upload", async () => {
            expect.assertions(3);

            const storage = backend.createStorage();
            const id = await upload(storage, "hello");

            await storage.copy(id, "copied");
            await storage.move(id, "moved");

            await expect(storage.get({ id: "copied" })).resolves.toHaveProperty("content", Buffer.from("hello"));
            await expect(storage.get({ id: "moved" })).resolves.toHaveProperty("content", Buffer.from("hello"));
            await expect(Promise.resolve(backend.hasObject(id))).resolves.toBe(false);
        });

        it.skipIf(skip["expired upload"] !== undefined)("should answer GONE for an expired upload instead of writing or serving it", async () => {
            expect.assertions(1);

            const storage = backend.createStorage({ expiration: { maxAge: "1h" } });
            const file = await createdAgo(2 * HOUR, async () => storage.create({ contentType: "text/plain", metadata: {}, originalName: "a.txt", size: 5 }));
            const failure = (promise: Promise<unknown>): Promise<unknown> =>
                promise.then(
                    () => undefined,
                    (error: unknown) => error,
                );

            // Adapters refuse an expired upload on write, or on read when they only check it there.
            const error =
                (await failure(storage.write({ body: Readable.from([Buffer.from("hello")]), contentLength: 5, id: file.id, start: 0 }))) ??
                (await failure(storage.get({ id: file.id })));

            expect(error).toHaveProperty("UploadErrorCode", ERRORS.GONE);
        });

        it.skipIf(skip["expired upload"] !== undefined)("should answer GONE when reading an expired finished upload", async () => {
            expect.assertions(1);

            const storage = backend.createStorage({ expiration: { maxAge: "1h" } });
            const id = await createdAgo(2 * HOUR, async () => upload(storage, "hello"));

            await expect(storage.get({ id })).rejects.toHaveProperty("UploadErrorCode", ERRORS.GONE);
        });

        it.skipIf(skip.purge !== undefined)("should purge expired uploads and never an object without upload metadata", async () => {
            expect.assertions(3);

            const storage = backend.createStorage({ expiration: { maxAge: "1h" } });
            const old = await createdAgo(2 * HOUR, async () => {
                await backend.putObject("foreign-object", "app data");

                return upload(storage, "old");
            });
            const fresh = await upload(storage, "new");

            const purged = await storage.purge();

            expect(purged.items.map((item) => item.id)).toStrictEqual([old]);
            await expect(Promise.resolve(backend.hasObject("foreign-object"))).resolves.toBe(true);
            await expect(storage.exists({ id: fresh })).resolves.toBe(true);
        });

        it("should keep the metadata when deleting the object fails", async () => {
            expect.assertions(4);

            const storage = backend.createStorage();
            const id = await upload(storage, "hello");

            backend.failBackend(true);

            await expect(storage.delete({ id })).rejects.toBeDefined();

            backend.failBackend(false);

            await expect(storage.getMeta(id)).resolves.toHaveProperty("id", id);
            await expect(storage.delete({ id })).resolves.toHaveProperty("status", "deleted");
            await expect(storage.getMeta(id)).rejects.toHaveProperty("UploadErrorCode", ERRORS.FILE_NOT_FOUND);
        });

        it("should tell a missing object from a failing backend", async () => {
            expect.assertions(2);

            const storage = backend.createStorage();

            await expect(storage.findStoredObject("missing")).resolves.toBeUndefined();

            backend.failBackend(true);

            await expect(storage.findStoredObject("missing")).rejects.toBeDefined();
        });

        it.skipIf(skip["failing meta store"] !== undefined)("should not read a failing meta store as a missing upload", async () => {
            expect.assertions(3);

            const storage = backend.createStorage({ expiration: { maxAge: "1h" } });
            const id = await createdAgo(2 * HOUR, async () => upload(storage, "hello"));

            vi.spyOn(metaOf(storage), "get").mockRejectedValue(new Error("meta store down"));

            await expect(storage.deleteUpload(id)).rejects.toThrow("meta store down");
            // Purge either fails or skips the upload, whose record it can't read; it never deletes it.
            await expect(storage.purge().then(({ items }) => items, () => [])).resolves.toStrictEqual([]);
            await expect(Promise.resolve(backend.hasObject(id))).resolves.toBe(true);
        });

        describe("conditional operations, where the adapter claims them", () => {
            /** A `Files` facade over a fresh storage, or a skipped test when the adapter doesn't claim `kind`. */
            const facade = (kind: keyof ConditionalSupport, skipTest: (note: string) => void): Files => {
                const storage = backend.createStorage();

                if (!storage.conditionalSupport[kind]) {
                    skipTest(`no conditional ${kind}`);
                }

                return new Files({ adapter: storage });
            };

            it("should create only when the key is absent", async ({ skip: skipTest }) => {
                expect.assertions(3);

                const files = facade("create", skipTest);
                const created = await files.upload("created.txt", "one", { ifNoneMatch: "*" });

                await expect(files.upload("created.txt", "two", { ifNoneMatch: "*" })).rejects.toThrow(precondition);
                await expect(textOf(files, "created.txt")).resolves.toBe("one");
                await expect(etagOf(files, "created.txt")).resolves.toBe(created.etag);
            });

            it("should replace only the expected generation", async ({ skip: skipTest }) => {
                expect.assertions(3);

                const files = facade("replace", skipTest);

                await files.upload("replaced.txt", "first");

                const first = await etagOf(files, "replaced.txt");

                await files.upload("replaced.txt", "second", { ifMatch: first });

                await expect(textOf(files, "replaced.txt")).resolves.toBe("second");
                await expect(files.upload("replaced.txt", "third", { ifMatch: first })).rejects.toThrow(precondition);
                await expect(textOf(files, "replaced.txt")).resolves.toBe("second");
            });

            it("should read and head only the expected generation", async ({ skip: skipTest }) => {
                expect.assertions(3);

                const files = facade("read", skipTest);

                await files.upload("read.txt", "hello");

                const etag = await etagOf(files, "read.txt");

                await expect(files.download("read.txt", { ifMatch: etag })).resolves.toHaveProperty("body", Buffer.from("hello"));
                await expect(files.download("read.txt", { ifMatch: "stale" })).rejects.toThrow(precondition);
                await expect(files.head("read.txt", { ifMatch: "stale" })).rejects.toThrow(precondition);
            });

            it("should delete only the expected generation", async ({ skip: skipTest }) => {
                expect.assertions(2);

                const files = facade("delete", skipTest);

                await files.upload("deleted.txt", "hello");

                await expect(files.delete("deleted.txt", { ifMatch: "stale" })).rejects.toThrow(precondition);

                await files.delete("deleted.txt", { ifMatch: await etagOf(files, "deleted.txt") });

                await expect(files.exists("deleted.txt")).resolves.toBe(false);
            });

            it("should copy only when the source and destination predicates hold", async ({ skip: skipTest }) => {
                expect.assertions(4);

                const files = facade("copy", skipTest);

                await files.upload("source.txt", "source");
                await files.upload("taken.txt", "taken");

                const source = await etagOf(files, "source.txt");

                await expect(files.copy("source.txt", "target.txt", { sourceIfMatch: "stale" })).rejects.toThrow(precondition);
                await expect(files.copy("source.txt", "taken.txt", { ifNoneMatch: "*", sourceIfMatch: source })).rejects.toThrow(precondition);
                await expect(textOf(files, "taken.txt")).resolves.toBe("taken");

                await files.copy("source.txt", "target.txt", { ifNoneMatch: "*", sourceIfMatch: source });

                await expect(files.download("target.txt").then(({ body }) => body.toString())).resolves.toBe("source");
            });
        });

        describe.skipIf(skip["resume across processes"] !== undefined)("resumable uploads across processes", () => {
            const source = Buffer.alloc(2 * PART_SIZE + 1000);

            for (let index = 0; index < source.length; index += 1) {
                source[index] = index % 251;
            }

            /** Process A: stores the first part, then dies before the rest of the body arrives. */
            const startAndDie = async (storage: BaseStorage): Promise<string> => {
                const control = new UploadControl();
                const { promise: firstPartStored, resolve } = Promise.withResolvers<void>();
                const body = Readable.from(
                    (async function* dying() {
                        yield source.subarray(0, PART_SIZE);

                        await firstPartStored;

                        throw new Error("process died");
                    })(),
                );
                const onProgress = ({ loaded }: { loaded: number }): void => {
                    if (loaded >= PART_SIZE) {
                        resolve();
                    }
                };

                await expect(
                    new Files({ adapter: storage }).upload("big.bin", body, { control, multipart: { partSize: PART_SIZE }, onProgress, size: source.length }),
                ).rejects.toThrow("process died");

                return JSON.stringify(control);
            };

            it("should resume from the token without re-sending the stored bytes", async ({ skip: skipTest }) => {
                expect.assertions(4);

                const first = backend.createStorage();

                if (!first.supportsResumableWrites) {
                    skipTest("no resumable writes");
                }

                const token = await startAndDie(first);

                expect(JSON.parse(token)).toMatchObject({ adapter: first.constructor.name, key: "big.bin", loaded: PART_SIZE, size: source.length, version: 2 });

                // Process B: fresh instances over the same backend and metadata store.
                const second = backend.createStorage();
                const write = vi.spyOn(second, "write");
                const files = new Files({ adapter: second });

                await files.upload("big.bin", source, { control: UploadControl.from(token), multipart: { partSize: PART_SIZE } });

                expect(bytesWritten(write)).toBe(source.length - PART_SIZE);

                const { body } = await files.download("big.bin");

                expect(body.equals(source)).toBe(true);
            });

            it("should resume with a body that starts at the stored offset", async ({ skip: skipTest }) => {
                expect.assertions(2);

                const first = backend.createStorage();

                if (!first.supportsResumableWrites) {
                    skipTest("no resumable writes");
                }

                const token = await startAndDie(first);
                const second = backend.createStorage();
                const files = new Files({ adapter: second });
                const { loaded } = JSON.parse(token) as { loaded: number };

                await files.upload("big.bin", Readable.from([source.subarray(loaded)]), {
                    control: UploadControl.from(token),
                    multipart: { partSize: PART_SIZE },
                    resumeOffset: loaded,
                    size: source.length,
                });

                const { body } = await files.download("big.bin");

                expect(body.equals(source)).toBe(true);
            });

            it("should reject a token whose upload no longer exists", async ({ skip: skipTest }) => {
                expect.assertions(2);

                const first = backend.createStorage();

                if (!first.supportsResumableWrites) {
                    skipTest("no resumable writes");
                }

                const token = await startAndDie(first);

                await first.deleteUpload("big.bin");

                await expect(new Files({ adapter: backend.createStorage() }).upload("big.bin", source, { control: UploadControl.from(token) })).rejects.toHaveProperty(
                    "UploadErrorCode",
                    ERRORS.FILE_NOT_FOUND,
                );
            });

            it("should reject a resume token when the adapter can't resume", async ({ skip: skipTest }) => {
                expect.assertions(2);

                const storage = backend.createStorage();

                if (storage.supportsResumableWrites) {
                    skipTest("resumable writes");
                }

                const files = new Files({ adapter: storage });
                const control = UploadControl.from({ adapter: storage.constructor.name, key: "big.bin", loaded: 0, size: 5, uploadId: "big.bin", version: 2 });

                expect(files.capabilities.resumable).toBe(false);
                await expect(files.upload("big.bin", "hello", { control })).rejects.toHaveProperty("UploadErrorCode", ERRORS.METHOD_NOT_ALLOWED);
            });
        });

        it.skipIf(skip["REST lifecycle"] !== undefined)("should serve an upload without a content type by the extension in the URL", async () => {
            expect.assertions(3);

            const rest = new RestFetch({ storage: backend.createStorage() });
            const created = await rest.fetch(new Request("https://app.test/files", { body: new TextEncoder().encode("hello"), headers: { "content-length": "5" }, method: "POST" }));
            const { id } = (await created.json()) as { id: string };
            const response = await rest.fetch(new Request(`https://app.test/files/${id}.png`));

            expect(response.status).toBe(200);
            // The extension never picks the type of an untyped file.
            expect(response.headers.get("content-type")).toBe("application/octet-stream");
            await expect(response.text()).resolves.toBe("hello");
        });

        it.skipIf(skip["REST lifecycle"] !== undefined)("should serve a REST upload: POST, HEAD, PUT replace and DELETE", async () => {
            expect.assertions(5);

            const rest = new RestFetch({ storage: backend.createStorage() });
            const request = (url: string, method: string, body?: string): Request =>
                new Request(url, {
                    body,
                    headers: body === undefined ? {} : { "content-length": String(body.length), "content-type": "text/plain" },
                    method,
                });
            const created = await rest.fetch(request("https://app.test/files", "POST", "hello"));
            const location = created.headers.get("location") as string;

            expect(created.status).toBe(201);
            await expect(rest.fetch(request(location, "HEAD"))).resolves.toHaveProperty("status", 200);
            await expect(rest.fetch(request(location, "PUT", "world"))).resolves.toHaveProperty("status", 200);
            await expect(rest.fetch(request(location, "DELETE"))).resolves.toHaveProperty("status", 204);
            await expect(rest.fetch(request(location, "HEAD"))).resolves.toHaveProperty("status", 404);
        });
    });
};
