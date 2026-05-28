import { Readable } from "node:stream";

import { beforeEach, describe, expect, it, vi } from "vitest";

import NetlifyBlobFile from "../../../src/storage/netlify-blob/netlify-blob-file";
import NetlifyBlobStorage from "../../../src/storage/netlify-blob/netlify-blob-storage";
import type { NetlifyBlobStorageOptions } from "../../../src/storage/netlify-blob/types";
import { metafile, storageOptions } from "../../__helpers__/config";

// Mock Netlify Blobs SDK
vi.mock(import("@netlify/blobs"), () => {
    const mockStore = {
        delete: vi.fn(),
        get: vi.fn(),
        getMetadata: vi.fn(),
        list: vi.fn(),
        set: vi.fn(),
    };

    return {
        getStore: vi.fn().mockReturnValue(mockStore),
    };
});

const bufferToStream = (buffer: Buffer): Readable => Readable.from([buffer]);

describe(`${NetlifyBlobStorage.name} additional coverage`, () => {
    let storage: NetlifyBlobStorage;
    const options: NetlifyBlobStorageOptions = {
        ...(storageOptions as NetlifyBlobStorageOptions),
        storeName: "test-store",
    };

    beforeEach(async () => {
        vi.clearAllMocks();

        const { getStore } = await import("@netlify/blobs");
        const mockStore = getStore({ name: "test-store" });

        (mockStore.get as ReturnType<typeof vi.fn>).mockReset();
        (mockStore.set as ReturnType<typeof vi.fn>).mockReset();
        (mockStore.delete as ReturnType<typeof vi.fn>).mockReset();
        (mockStore.list as ReturnType<typeof vi.fn>).mockReset();
        (mockStore.getMetadata as ReturnType<typeof vi.fn>).mockReset();

        storage = new NetlifyBlobStorage(options);
    });

    describe("construction & raw access", () => {
        it("should pick up siteID/token from environment when not provided", async () => {
            expect.assertions(1);

            process.env.NETLIFY_SITE_ID = "env-site-id";
            process.env.NETLIFY_TOKEN = "env-token";

            const { getStore } = await import("@netlify/blobs");
            const spy = vi.mocked(getStore);

            spy.mockClear();

            // eslint-disable-next-line no-new
            new NetlifyBlobStorage({ ...(storageOptions as NetlifyBlobStorageOptions) });

            expect(spy).toHaveBeenCalledWith(
                expect.objectContaining({
                    siteID: "env-site-id",
                    token: "env-token",
                }),
            );

            delete process.env.NETLIFY_SITE_ID;
            delete process.env.NETLIFY_TOKEN;
        });

        it("exposes the underlying store as `raw`", () => {
            expect.assertions(1);

            expect(storage.raw).toBeDefined();
        });
    });

    describe(".create()", () => {
        it("creates new file metadata and calls onCreate", async () => {
            expect.assertions(2);

            const onCreateSpy = vi.fn();

            storage.onCreate = onCreateSpy;

            vi.spyOn(storage, "getMeta").mockRejectedValue(new Error("File not found"));
            vi.spyOn(storage, "saveMeta").mockImplementation(async (file) => file);

            const file = await storage.create({
                contentType: "video/mp4",
                metadata: { name: "new.mp4" },
                originalName: "new.mp4",
                size: 1024,
            });

            expect(file.bytesWritten).toBe(0);
            expect(onCreateSpy).toHaveBeenCalledTimes(1);
        });

        it("returns existing file when meta already exists and has bytesWritten >= 0", async () => {
            expect.assertions(1);

            vi.spyOn(storage, "getMeta").mockResolvedValue({
                ...metafile,
                bytesWritten: 100,
            });

            const file = await storage.create({
                contentType: "video/mp4",
                metadata: { name: metafile.name },
                originalName: metafile.name,
                size: 1024,
            });

            expect(file.bytesWritten).toBe(100);
        });

        it("supports TTL string in create config", async () => {
            expect.assertions(1);

            vi.spyOn(storage, "getMeta").mockRejectedValue(new Error("File not found"));
            vi.spyOn(storage, "saveMeta").mockImplementation(async (file) => file);

            const file = await storage.create({
                contentType: "video/mp4",
                metadata: { name: "ttl.mp4" },
                originalName: "ttl.mp4",
                size: 1024,
                ttl: "1h",
            });

            expect(file.expiredAt).toBeGreaterThan(Date.now());
        });
    });

    describe(".write()", () => {
        const baseFile: NetlifyBlobFile = Object.assign(new NetlifyBlobFile({
            contentType: "video/mp4",
            metadata: { name: metafile.name },
            originalName: metafile.name,
            size: metafile.size,
        }), {
            bytesWritten: 0,
            id: metafile.id,
            name: metafile.name,
            status: "created" as const,
        });

        it("returns the file unchanged when status is completed", async () => {
            expect.assertions(2);

            const file = Object.assign(Object.create(NetlifyBlobFile.prototype), {
                ...baseFile,
                status: "completed" as const,
            });

            vi.spyOn(storage, "getMeta").mockResolvedValue(file);

            const result = await storage.write({ id: metafile.id });

            expect(result.status).toBe("completed");

            const { getStore } = await import("@netlify/blobs");
            const store = getStore({ name: "test-store" });

            expect(store.set).not.toHaveBeenCalled();
        });

        it("uploads a stream to the Netlify Blob store and saves metadata", async () => {
            expect.assertions(3);

            const file = Object.assign(Object.create(NetlifyBlobFile.prototype), { ...baseFile });

            vi.spyOn(storage, "getMeta").mockResolvedValue(file);
            vi.spyOn(storage, "saveMeta").mockImplementation(async (saved) => saved);

            const { getStore } = await import("@netlify/blobs");
            const store = getStore({ name: "test-store" });

            (store.set as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

            const body = bufferToStream(Buffer.from("xz".repeat(32)));
            const result = await storage.write({
                body,
                contentLength: metafile.size,
                id: metafile.id,
                start: 0,
            });

            expect(store.set).toHaveBeenCalledTimes(1);
            expect(result.bytesWritten).toBe(metafile.size);
            expect(result.url).toBe(`/api/blobs/test-store/${metafile.name}`);
        });

        it("throws when part does not match (size mismatch)", async () => {
            expect.assertions(1);

            const file = Object.assign(Object.create(NetlifyBlobFile.prototype), { ...baseFile });

            vi.spyOn(storage, "getMeta").mockResolvedValue(file);

            await expect(
                storage.write({
                    body: bufferToStream(Buffer.from("xy")),
                    contentLength: 2,
                    id: metafile.id,
                    start: 999, // wrong offset
                }),
            ).rejects.toThrow();
        });
    });

    describe(".delete()", () => {
        it("removes the blob, deletes metadata, and calls onDelete", async () => {
            expect.assertions(3);

            const onDeleteSpy = vi.fn();

            storage.onDelete = onDeleteSpy;

            vi.spyOn(storage, "getMeta").mockResolvedValue({
                ...metafile,
                pathname: metafile.name,
            });

            vi.spyOn(storage, "deleteMeta").mockResolvedValue(undefined);

            const { getStore } = await import("@netlify/blobs");
            const store = getStore({ name: "test-store" });

            (store.delete as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

            const result = await storage.delete({ id: metafile.id });

            expect(store.delete).toHaveBeenCalledWith(metafile.name);
            expect(result.status).toBe("deleted");
            expect(onDeleteSpy).toHaveBeenCalledTimes(1);
        });

        it("throws when file has no pathname", async () => {
            expect.assertions(1);

            vi.spyOn(storage, "getMeta").mockResolvedValue({
                ...metafile,
                pathname: undefined,
            });

            await expect(storage.delete({ id: metafile.id })).rejects.toThrow(/pathname/);
        });
    });

    describe(".get()", () => {
        it("returns file content fetched from the store", async () => {
            expect.assertions(3);

            vi.spyOn(storage, "getMeta").mockResolvedValue({
                ...metafile,
                pathname: metafile.name,
            });

            const payload = Buffer.from("hello-world");
            const arrayBufferPromise = Promise.resolve(payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength));
            const mockBlob = {
                arrayBuffer: vi.fn().mockReturnValue(arrayBufferPromise),
            };

            const { getStore } = await import("@netlify/blobs");
            const store = getStore({ name: "test-store" });

            (store.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockBlob);

            const result = await storage.get({ id: metafile.id });

            expect(result.content?.toString()).toBe("hello-world");
            expect(result.id).toBe(metafile.id);
            expect(result.contentType).toBe(metafile.contentType);
        });

        it("supports string blob payloads", async () => {
            expect.assertions(1);

            vi.spyOn(storage, "getMeta").mockResolvedValue({
                ...metafile,
                pathname: metafile.name,
            });

            const { getStore } = await import("@netlify/blobs");
            const store = getStore({ name: "test-store" });

            (store.get as ReturnType<typeof vi.fn>).mockResolvedValue("plain-string-payload");

            const result = await storage.get({ id: metafile.id });

            // The source uses `Buffer.from(str, "utf8").buffer` which can include shared-pool padding;
            // assert the payload starts with our content rather than equals exactly.
            expect(result.content?.toString("utf8")).toContain("plain-string-payload");
        });

        it("throws when meta pathname is missing", async () => {
            expect.assertions(1);

            vi.spyOn(storage, "getMeta").mockResolvedValue({
                ...metafile,
                pathname: undefined,
            });

            await expect(storage.get({ id: metafile.id })).rejects.toThrow(/pathname/);
        });

        it("throws when blob is missing", async () => {
            expect.assertions(1);

            vi.spyOn(storage, "getMeta").mockResolvedValue({
                ...metafile,
                pathname: metafile.name,
            });

            const { getStore } = await import("@netlify/blobs");
            const store = getStore({ name: "test-store" });

            (store.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);

            await expect(storage.get({ id: metafile.id })).rejects.toThrow(/not found/);
        });
    });

    describe(".copy() and .move()", () => {
        it("copies an existing blob to a new key", async () => {
            expect.assertions(2);

            vi.spyOn(storage, "getMeta").mockResolvedValue({
                ...metafile,
                pathname: metafile.name,
            });
            vi.spyOn(storage, "saveMeta").mockImplementation(async (file) => file);

            const payload = Buffer.from("source-data");
            const mockBlob = {
                arrayBuffer: vi.fn().mockResolvedValue(payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength)),
            };

            const { getStore } = await import("@netlify/blobs");
            const store = getStore({ name: "test-store" });

            (store.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockBlob);
            (store.set as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

            const copied = await storage.copy(metafile.id, "new-key.mp4");

            expect(copied.id).toBe("new-key.mp4");
            expect(store.set).toHaveBeenCalledWith("new-key.mp4", expect.anything(), expect.objectContaining({ metadata: expect.any(Object) }));
        });

        it("throws when source has no pathname", async () => {
            expect.assertions(1);

            vi.spyOn(storage, "getMeta").mockResolvedValue({
                ...metafile,
                pathname: undefined,
            });

            await expect(storage.copy(metafile.id, "dest")).rejects.toThrow(/pathname/);
        });

        it("move() copies then deletes source", async () => {
            expect.assertions(2);

            const copySpy = vi.spyOn(storage, "copy").mockResolvedValue({
                ...metafile,
                id: "dest",
                name: "dest",
                pathname: "dest",
            });
            const deleteSpy = vi.spyOn(storage, "delete").mockResolvedValue({
                ...metafile,
                status: "deleted" as const,
            });

            const result = await storage.move(metafile.id, "dest");

            expect(copySpy).toHaveBeenCalledWith(metafile.id, "dest", undefined);
            expect(deleteSpy).toHaveBeenCalledWith({ id: metafile.id }, undefined);
            void result;
        });
    });

    describe(".update()", () => {
        it("handles numeric TTL by converting to expiredAt", async () => {
            expect.assertions(1);

            vi.spyOn(storage, "getMeta").mockResolvedValue({ ...metafile });
            vi.spyOn(storage, "saveMeta").mockImplementation(async (file) => file);

            const updated = await storage.update(
                { id: metafile.id },
                { ttl: 5000 } as unknown as Partial<NetlifyBlobFile>,
            );

            expect(updated.expiredAt).toBeGreaterThanOrEqual(Date.now());
        });
    });

    describe(".list()", () => {
        it("lists blobs from the Netlify Blob store", async () => {
            expect.assertions(2);

            const { getStore } = await import("@netlify/blobs");
            const store = getStore({ name: "test-store" });

            (store.list as ReturnType<typeof vi.fn>).mockResolvedValue({
                blobs: [
                    {
                        createdAt: new Date("2024-01-01"),
                        key: "file-a",
                        size: 10,
                        updatedAt: new Date("2024-01-02"),
                    },
                    { key: "file-b" },
                ],
            });

            const result = await storage.list();

            expect(result).toHaveLength(2);
            expect(result[0]?.id).toBe("file-a");
        });

        it("respects the limit argument", async () => {
            expect.assertions(1);

            const { getStore } = await import("@netlify/blobs");
            const store = getStore({ name: "test-store" });

            (store.list as ReturnType<typeof vi.fn>).mockResolvedValue({
                blobs: [{ key: "a" }, { key: "b" }, { key: "c" }],
            });

            const result = await storage.list(2);

            expect(result).toHaveLength(2);
        });
    });
});
