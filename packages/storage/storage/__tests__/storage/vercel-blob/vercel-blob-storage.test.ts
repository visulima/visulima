import { Readable } from "node:stream";

import { copy, del, list, put } from "@vercel/blob";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
            });

            // Mock fetch HEAD request to return success
            (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
                ok: true,
                status: 200,
            });

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
            });

            const exists = await storage.exists({ id: metafile.id });

            expect(exists).toBe(false);
        });

        it("should return false when metadata exists but Vercel Blob does not exist", async () => {
            expect.assertions(1);

            // Mock getMeta to return metadata with URL
            vi.spyOn(storage, "getMeta").mockResolvedValue({
                ...metafile,
                url: "https://example.com/blob/test-file",
            });

            // Mock fetch HEAD request to return 404 (doesn't exist)
            (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
                ok: false,
                status: 404,
            });

            const exists = await storage.exists({ id: metafile.id });

            expect(exists).toBe(false);
        });

        it("should return false when fetch throws an error", async () => {
            expect.assertions(1);

            // Mock getMeta to return metadata with URL
            vi.spyOn(storage, "getMeta").mockResolvedValue({
                ...metafile,
                url: "https://example.com/blob/test-file",
            });

            // Mock fetch to throw error
            (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

            const exists = await storage.exists({ id: metafile.id });

            expect(exists).toBe(false);
        });
    });

    describe("credential resolution", () => {
        const envBackup = {
            BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
            BLOB_STORE_ID: process.env.BLOB_STORE_ID,
            VERCEL_BLOB_TOKEN: process.env.VERCEL_BLOB_TOKEN,
            VERCEL_OIDC_TOKEN: process.env.VERCEL_OIDC_TOKEN,
        };

        beforeEach(() => {
            delete process.env.BLOB_READ_WRITE_TOKEN;
            delete process.env.VERCEL_BLOB_TOKEN;
            delete process.env.VERCEL_OIDC_TOKEN;
            delete process.env.BLOB_STORE_ID;
        });

        afterEach(() => {
            // Restore each known env key without touching unrelated process.env entries.
            const restore = (key: keyof typeof envBackup, value: string | undefined): void => {
                if (value === undefined) {
                    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                    delete process.env[key];
                } else {
                    process.env[key] = value;
                }
            };

            restore("BLOB_READ_WRITE_TOKEN", envBackup.BLOB_READ_WRITE_TOKEN);
            restore("BLOB_STORE_ID", envBackup.BLOB_STORE_ID);
            restore("VERCEL_BLOB_TOKEN", envBackup.VERCEL_BLOB_TOKEN);
            restore("VERCEL_OIDC_TOKEN", envBackup.VERCEL_OIDC_TOKEN);
        });

        it("throws when no credentials are provided", () => {
            expect.assertions(1);

            expect(() => new VercelBlobStorage({ ...(storageOptions as VercelBlobStorageOptions) })).toThrow(/credentials are required/i);
        });

        it("throws when only oidcToken is provided (partial OIDC config)", () => {
            expect.assertions(1);

            expect(
                () =>
                    new VercelBlobStorage({
                        ...(storageOptions as VercelBlobStorageOptions),
                        oidcToken: "oidc-only",
                    }),
            ).toThrow(/OIDC auth requires both/i);
        });

        it("throws when only storeId is provided (partial OIDC config)", () => {
            expect.assertions(1);

            expect(
                () =>
                    new VercelBlobStorage({
                        ...(storageOptions as VercelBlobStorageOptions),
                        storeId: "abc123",
                    }),
            ).toThrow(/OIDC auth requires both/i);
        });

        it("throws when VERCEL_OIDC_TOKEN is set without BLOB_STORE_ID", () => {
            expect.assertions(1);

            process.env.VERCEL_OIDC_TOKEN = "env-oidc";

            expect(() => new VercelBlobStorage({ ...(storageOptions as VercelBlobStorageOptions) })).toThrow(/OIDC auth requires both/i);
        });

        it("uses explicit token when provided", () => {
            expect.assertions(1);

            const s = new VercelBlobStorage({
                ...(storageOptions as VercelBlobStorageOptions),
                token: "rw-explicit",
            });

            expect(s.raw.credentials).toStrictEqual({ token: "rw-explicit" });
        });

        it("explicit token wins over OIDC env", () => {
            expect.assertions(1);

            process.env.VERCEL_OIDC_TOKEN = "env-oidc";
            process.env.BLOB_STORE_ID = "store_envstore";

            const s = new VercelBlobStorage({
                ...(storageOptions as VercelBlobStorageOptions),
                token: "rw-explicit",
            });

            expect(s.raw.credentials).toStrictEqual({ token: "rw-explicit" });
        });

        it("explicit token wins over BLOB_READ_WRITE_TOKEN env", () => {
            expect.assertions(1);

            process.env.BLOB_READ_WRITE_TOKEN = "env-rw";

            const s = new VercelBlobStorage({
                ...(storageOptions as VercelBlobStorageOptions),
                token: "rw-explicit",
            });

            expect(s.raw.credentials).toStrictEqual({ token: "rw-explicit" });
        });

        it("uses explicit oidcToken + storeId pair", () => {
            expect.assertions(1);

            const s = new VercelBlobStorage({
                ...(storageOptions as VercelBlobStorageOptions),
                oidcToken: "oidc-explicit",
                storeId: "abc123",
            });

            expect(s.raw.credentials).toStrictEqual({ oidcToken: "oidc-explicit", storeId: "abc123" });
        });

        it("strips `store_` prefix from explicit storeId", () => {
            expect.assertions(1);

            const s = new VercelBlobStorage({
                ...(storageOptions as VercelBlobStorageOptions),
                oidcToken: "oidc-explicit",
                storeId: "store_abc123",
            });

            expect(s.raw.credentials).toStrictEqual({ oidcToken: "oidc-explicit", storeId: "abc123" });
        });

        it("resolves OIDC pair from env", () => {
            expect.assertions(1);

            process.env.VERCEL_OIDC_TOKEN = "env-oidc";
            process.env.BLOB_STORE_ID = "store_envstore";

            const s = new VercelBlobStorage({ ...(storageOptions as VercelBlobStorageOptions) });

            expect(s.raw.credentials).toStrictEqual({ oidcToken: "env-oidc", storeId: "envstore" });
        });

        it("uses OIDC env even when BLOB_READ_WRITE_TOKEN env is also set", () => {
            expect.assertions(1);

            process.env.VERCEL_OIDC_TOKEN = "env-oidc";
            process.env.BLOB_STORE_ID = "envstore";
            process.env.BLOB_READ_WRITE_TOKEN = "env-rw";

            const s = new VercelBlobStorage({ ...(storageOptions as VercelBlobStorageOptions) });

            expect(s.raw.credentials).toStrictEqual({ oidcToken: "env-oidc", storeId: "envstore" });
        });

        it("falls back to BLOB_READ_WRITE_TOKEN env when no other credentials are set", () => {
            expect.assertions(1);

            process.env.BLOB_READ_WRITE_TOKEN = "env-rw";

            const s = new VercelBlobStorage({ ...(storageOptions as VercelBlobStorageOptions) });

            expect(s.raw.credentials).toStrictEqual({ token: "env-rw" });
        });

        it("falls back to VERCEL_BLOB_TOKEN env when BLOB_READ_WRITE_TOKEN is not set", () => {
            expect.assertions(1);

            process.env.VERCEL_BLOB_TOKEN = "env-vbt";

            const s = new VercelBlobStorage({ ...(storageOptions as VercelBlobStorageOptions) });

            expect(s.raw.credentials).toStrictEqual({ token: "env-vbt" });
        });
    });

    describe("credentials are forwarded to every SDK call", () => {
        const credentials = { oidcToken: "oidc-fwd", storeId: "fwdstore" };

        let oidcStorage: VercelBlobStorage;

        beforeEach(() => {
            oidcStorage = new VercelBlobStorage({
                ...(storageOptions as VercelBlobStorageOptions),
                ...credentials,
            });
        });

        it("forwards credentials to put()", async () => {
            expect.assertions(1);

            const meta = {
                ...metafile,
                bytesWritten: 0,
                contentType: "video/mp4",
                name: "anonymous/test.mp4",
                size: 4,
            };

            vi.spyOn(oidcStorage, "getMeta").mockResolvedValue(meta);
            vi.spyOn(oidcStorage, "saveMeta").mockResolvedValue();
            vi.spyOn(oidcStorage, "deleteMeta").mockResolvedValue();

            vi.mocked(put).mockResolvedValue({
                contentDisposition: "",
                contentType: "video/mp4",
                downloadUrl: "https://blob.example/test.mp4?d=1",
                pathname: meta.name,
                url: "https://blob.example/test.mp4",
            });

            await oidcStorage.write({
                body: Readable.from([Buffer.from("data")]),
                contentLength: 4,
                id: meta.id,
                size: 4,
                start: 0,
            });

            expect(vi.mocked(put)).toHaveBeenCalledWith(meta.name, expect.any(Blob), expect.objectContaining(credentials));
        });

        it("forwards credentials to del()", async () => {
            expect.assertions(1);

            vi.spyOn(oidcStorage, "getMeta").mockResolvedValue({
                ...metafile,
                url: "https://blob.example/test.mp4",
            });

            await oidcStorage.delete({ id: metafile.id });

            expect(vi.mocked(del)).toHaveBeenCalledWith("https://blob.example/test.mp4", expect.objectContaining(credentials));
        });

        it("forwards credentials to copy()", async () => {
            expect.assertions(1);

            vi.spyOn(oidcStorage, "getMeta").mockResolvedValue({
                ...metafile,
                url: "https://blob.example/src.mp4",
            });

            vi.mocked(copy).mockResolvedValue({
                contentDisposition: "",
                contentType: "video/mp4",
                downloadUrl: "https://blob.example/dst.mp4?d=1",
                pathname: "dst.mp4",
                url: "https://blob.example/dst.mp4",
            });

            await oidcStorage.copy("src.mp4", "dst.mp4");

            expect(vi.mocked(copy)).toHaveBeenCalledWith("https://blob.example/src.mp4", "dst.mp4", expect.objectContaining(credentials));
        });

        it("forwards credentials to list()", async () => {
            expect.assertions(1);

            vi.mocked(list).mockResolvedValue({ blobs: [], cursor: undefined, hasMore: false });

            await oidcStorage.list(50);

            expect(vi.mocked(list)).toHaveBeenCalledWith(expect.objectContaining({ limit: 50, ...credentials }));
        });
    });
});
