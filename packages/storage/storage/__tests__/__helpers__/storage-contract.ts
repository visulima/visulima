import { Readable } from "node:stream";
import { text } from "node:stream/consumers";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import RestFetch from "../../src/handler/rest/rest-fetch";
import type MetaStorage from "../../src/storage/meta-storage";
import type { BaseStorage } from "../../src/storage/storage";
import type { ExpirationOptions } from "../../src/storage/types";
import { ERRORS } from "../../src/utils/errors";
import { createdAgo, HOUR } from "./clock";

/** What the contract needs from a provider's fake backend. */
export interface StorageContractSetup {
    /** A storage over the backend. */
    createStorage: (options?: { expiration?: ExpirationOptions }) => BaseStorage;

    /** Makes every call to the backend fail (a server error, or the backend refusing it), or work again. */
    failBackend: (failing: boolean) => void;

    /** Whether the backend stores an object under `key`. */
    hasObject: (key: string) => boolean;

    /** Stores an object under `key` as an app sharing the backend would: without upload metadata. */
    putObject: (key: string, content: string) => Promise<void> | void;
}

export type StorageContractScenario = "copy and move" | "expired upload" | "REST lifecycle";

const upload = async (storage: BaseStorage, content: string): Promise<string> => {
    const file = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "a.txt", size: content.length });

    await storage.write({ body: Readable.from([Buffer.from(content)]), contentLength: content.length, id: file.id, start: 0 });

    return file.id;
};

const metaOf = (storage: BaseStorage): MetaStorage => (storage as unknown as { meta: MetaStorage }).meta;

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
            expect(backend.hasObject(id)).toBe(false);
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

        it("should purge expired uploads and never an object without upload metadata", async () => {
            expect.assertions(3);

            const storage = backend.createStorage({ expiration: { maxAge: "1h" } });
            const old = await createdAgo(2 * HOUR, async () => {
                await backend.putObject("foreign-object", "app data");

                return upload(storage, "old");
            });
            const fresh = await upload(storage, "new");

            const purged = await storage.purge();

            expect(purged.items.map((item) => item.id)).toStrictEqual([old]);
            expect(backend.hasObject("foreign-object")).toBe(true);
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

        it("should not read a failing meta store as a missing upload", async () => {
            expect.assertions(3);

            const storage = backend.createStorage({ expiration: { maxAge: "1h" } });
            const id = await createdAgo(2 * HOUR, async () => upload(storage, "hello"));

            vi.spyOn(metaOf(storage), "get").mockRejectedValue(new Error("meta store down"));

            await expect(storage.deleteUpload(id)).rejects.toThrow("meta store down");
            // Purge either fails or skips the upload, whose record it can't read; it never deletes it.
            await expect(storage.purge().then(({ items }) => items, () => [])).resolves.toStrictEqual([]);
            expect(backend.hasObject(id)).toBe(true);
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
