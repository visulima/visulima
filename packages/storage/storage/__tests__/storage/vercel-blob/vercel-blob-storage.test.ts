import { beforeEach, describe, expect, it, vi } from "vitest";

import type { VercelBlobStorageOptions } from "../../../src/storage/vercel-blob/types";
import VercelBlobStorage from "../../../src/storage/vercel-blob/vercel-blob-storage";
import { metafile, storageOptions } from "../../__helpers__/config";

// Mock Vercel Blob SDK
vi.mock(import("@vercel/blob"), () => {
    return {
        copy: vi.fn(),
        del: vi.fn(),
        list: vi.fn(),
        put: vi.fn(),
    };
});

// Mock fetch globally for HEAD requests
vi.spyOn(globalThis, "fetch").mockImplementation();

describe(VercelBlobStorage, () => {
    vi.useFakeTimers().setSystemTime(new Date("2022-02-02"));

    let storage: VercelBlobStorage;

    const options: VercelBlobStorageOptions = {
        ...(storageOptions as VercelBlobStorageOptions),
        token: "test-token",
    };

    beforeEach(() => {
        vi.clearAllMocks();

        // Reset fetch mock
        (globalThis.fetch as ReturnType<typeof vi.fn>).mockReset();

        storage = new VercelBlobStorage(options);
    });

    describe(".exists()", () => {
        it("should return true when both metadata and Vercel Blob exist", async () => {
            expect.assertions(1);

            // Mock getMeta to return metadata with URL
            vi.spyOn(storage, "getMeta").mockResolvedValue({
                ...metafile,
                url: "https://example.com/blob/test-file",
            } as never);

            // Mock fetch HEAD request to return success
            (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
                ok: true,
                status: 200,
            } as Response);

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

        it("should return false when metadata exists but URL is missing", async () => {
            expect.assertions(1);

            // Mock getMeta to return metadata without URL
            vi.spyOn(storage, "getMeta").mockResolvedValue({
                ...metafile,
                url: undefined,
            } as never);

            const exists = await storage.exists({ id: metafile.id });

            expect(exists).toBe(false);
        });

        it("should return false when metadata exists but Vercel Blob does not exist", async () => {
            expect.assertions(1);

            // Mock getMeta to return metadata with URL
            vi.spyOn(storage, "getMeta").mockResolvedValue({
                ...metafile,
                url: "https://example.com/blob/test-file",
            } as never);

            // Mock fetch HEAD request to return 404 (doesn't exist)
            (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
                ok: false,
                status: 404,
            } as Response);

            const exists = await storage.exists({ id: metafile.id });

            expect(exists).toBe(false);
        });

        it("should return false when fetch throws an error", async () => {
            expect.assertions(1);

            // Mock getMeta to return metadata with URL
            vi.spyOn(storage, "getMeta").mockResolvedValue({
                ...metafile,
                url: "https://example.com/blob/test-file",
            } as never);

            // Mock fetch to throw error
            (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

            const exists = await storage.exists({ id: metafile.id });

            expect(exists).toBe(false);
        });
    });
});
