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
});
