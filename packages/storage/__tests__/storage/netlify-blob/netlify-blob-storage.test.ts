import { beforeEach, describe, expect, it, vi } from "vitest";

import NetlifyBlobStorage from "../../../src/storage/netlify-blob/netlify-blob-storage";
import type { NetlifyBlobStorageOptions } from "../../../src/storage/netlify-blob/types";
import { metafile, storageOptions } from "../../__helpers__/config";

// Mock Netlify Blobs SDK
vi.mock(import("@netlify/blobs"), () => {
    const mockStore = {
        delete: vi.fn(),
        get: vi.fn(),
        list: vi.fn(),
        set: vi.fn(),
    };

    return {
        getStore: vi.fn().mockReturnValue(mockStore),
    };
});

describe(NetlifyBlobStorage, () => {
    vi.useFakeTimers().setSystemTime(new Date("2022-02-02"));

    let storage: NetlifyBlobStorage;

    const options: NetlifyBlobStorageOptions = {
        ...(storageOptions as NetlifyBlobStorageOptions),
        storeName: "test-store",
    };

    beforeEach(async () => {
        vi.clearAllMocks();

        const { getStore } = await import("@netlify/blobs");
        const mockStore = getStore({ name: "test-store" });

        // Reset mock store methods
        (mockStore.get as ReturnType<typeof vi.fn>).mockReset();
        (mockStore.set as ReturnType<typeof vi.fn>).mockReset();
        (mockStore.delete as ReturnType<typeof vi.fn>).mockReset();
        (mockStore.list as ReturnType<typeof vi.fn>).mockReset();

        storage = new NetlifyBlobStorage(options);
    });

    describe(".exists()", () => {
        it("should return true when both metadata and Netlify Blob exist", async () => {
            expect.assertions(1);

            // Mock getMeta to return metadata with pathname
            vi.spyOn(storage, "getMeta").mockResolvedValue({
                ...metafile,
                pathname: "test-path",
            } as never);

            // Mock store.get to return a blob-like object (exists)
            const mockBlob = {
                arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
            };
            const { getStore } = await import("@netlify/blobs");
            const store = getStore({ name: "test-store" });

            (store.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockBlob);

            const exists = await storage.exists({ id: metafile.id });

            expect(exists).toBe(true);
        });

        it("should return false when metadata does not exist", async () => {
            expect.assertions(1);

            // Mock getMeta to throw error (metadata doesn't exist)
            vi.spyOn(storage, "getMeta").mockRejectedValue(new Error("File not found"));

            const exists = await storage.exists({ id: "non-existent-id" });

            expect(exists).toBe(false);
        });

        it("should return false when metadata exists but pathname is missing", async () => {
            expect.assertions(1);

            // Mock getMeta to return metadata without pathname
            vi.spyOn(storage, "getMeta").mockResolvedValue({
                ...metafile,
                pathname: undefined,
            } as never);

            const exists = await storage.exists({ id: metafile.id });

            expect(exists).toBe(false);
        });

        it("should return false when metadata exists but Netlify Blob does not exist", async () => {
            expect.assertions(1);

            // Mock getMeta to return metadata with pathname
            vi.spyOn(storage, "getMeta").mockResolvedValue({
                ...metafile,
                pathname: "test-path",
            } as never);

            // Mock store.get to return null (doesn't exist)
            const { getStore } = await import("@netlify/blobs");
            const store = getStore({ name: "test-store" });

            (store.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);

            const exists = await storage.exists({ id: metafile.id });

            expect(exists).toBe(false);
        });
    });

    describe(".update()", () => {
        it("should update changed metadata keys correctly", async () => {
            expect.assertions(3);

            // Mock getMeta to return existing file metadata
            vi.spyOn(storage, "getMeta").mockResolvedValue({
                ...metafile,
                metadata: {
                    name: "testfile.mp4",
                    mimeType: "video/mp4",
                },
            } as never);

            // Mock saveMeta to return the updated file
            vi.spyOn(storage, "saveMeta").mockImplementation(async (file) => file as never);

            const updatedFile = await storage.update({ id: metafile.id }, { metadata: { name: "newname.mp4" } });

            expect(updatedFile.metadata.name).toBe("newname.mp4");
            expect(updatedFile.metadata.mimeType).toBe("video/mp4");
            expect(updatedFile.status).toBe("updated");
        });

        it("should reject update operation when file is not found", async () => {
            expect.assertions(1);

            // Mock getMeta to throw error (file doesn't exist)
            vi.spyOn(storage, "getMeta").mockRejectedValue(new Error("File not found"));

            await expect(storage.update({ id: "non-existent-id" }, { metadata: { name: "newname.mp4" } })).rejects.toThrow();
        });

        it("should handle TTL option and set expiration timestamp during update", async () => {
            expect.assertions(4);

            // Mock getMeta to return existing file metadata
            vi.spyOn(storage, "getMeta").mockResolvedValue({
                ...metafile,
            } as never);

            // Mock saveMeta to return the updated file
            vi.spyOn(storage, "saveMeta").mockImplementation(async (file) => file as never);

            const updatedFile = await storage.update({ id: metafile.id }, { ttl: "2h" });

            expect(updatedFile.expiredAt).toBeDefined();
            expect(typeof updatedFile.expiredAt).toBe("number");

            // TTL should be converted to expiredAt timestamp
            const expectedExpiry = Date.now() + 2 * 60 * 60 * 1000; // 2 hours in ms

            expect(updatedFile.expiredAt).toBeGreaterThan(expectedExpiry - 1000); // Allow 1s tolerance
            expect(updatedFile.expiredAt).toBeLessThan(expectedExpiry + 1000);
        });

        it("should call onUpdate hook after updating metadata", async () => {
            expect.assertions(1);

            const onUpdateSpy = vi.fn();
            storage.onUpdate = onUpdateSpy;

            // Mock getMeta to return existing file metadata
            vi.spyOn(storage, "getMeta").mockResolvedValue({
                ...metafile,
            } as never);

            // Mock saveMeta to return the updated file
            vi.spyOn(storage, "saveMeta").mockImplementation(async (file) => file as never);

            await storage.update({ id: metafile.id }, { metadata: { name: "newname.mp4" } });

            expect(onUpdateSpy).toHaveBeenCalledTimes(1);
        });
    });
});
