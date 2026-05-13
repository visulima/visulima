/* eslint-disable @typescript-eslint/no-extraneous-class, no-constructor-return -- mock SDK classes for vendor library shape */
import { beforeEach, describe, expect, it, vi } from "vitest";

import SupabaseStorage from "../../../src/storage/supabase/supabase-storage";
import type { SupabaseStorageOptions } from "../../../src/storage/supabase/types";
import { storageOptions } from "../../__helpers__/config";

const makeBucketApi = () => { return {
    copy: vi.fn(),
    createSignedUploadUrl: vi.fn(),
    createSignedUrl: vi.fn(),
    download: vi.fn(),
    exists: vi.fn(),
    list: vi.fn(),
    move: vi.fn(),
    remove: vi.fn(),
    upload: vi.fn(),
}; };

const makeMockClient = (bucketApi: ReturnType<typeof makeBucketApi>) => { return {
    from: vi.fn(() => bucketApi),
}; };

let bucketApi: ReturnType<typeof makeBucketApi>;
let mockClient: ReturnType<typeof makeMockClient>;

vi.mock(import("@supabase/storage-js"), () => {
    return {
        StorageClient: class {
            public constructor() {
                return mockClient;
            }
        },
    };
});

describe(SupabaseStorage, () => {
    beforeEach(() => {
        bucketApi = makeBucketApi();
        mockClient = makeMockClient(bucketApi);

        delete process.env.SUPABASE_URL;
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;
        delete process.env.SUPABASE_KEY;
    });

    describe("construction", () => {
        it("rejects when url is missing", () => {
            expect.assertions(1);

            expect(
                () =>
                    new SupabaseStorage({
                        ...(storageOptions as SupabaseStorageOptions),
                        bucket: "b",
                        serviceKey: "k",
                    }),
            ).toThrow(/`url` is required/);
        });

        it("rejects when serviceKey is missing", () => {
            expect.assertions(1);

            expect(
                () =>
                    new SupabaseStorage({
                        ...(storageOptions as SupabaseStorageOptions),
                        bucket: "b",
                        url: "https://example.supabase.co",
                    }),
            ).toThrow(/`serviceKey` is required/);
        });

        it("falls back to env vars for url and key", () => {
            expect.assertions(1);

            process.env.SUPABASE_URL = "https://example.supabase.co";
            process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";

            const storage = new SupabaseStorage({
                ...(storageOptions as SupabaseStorageOptions),
                bucket: "b",
            });

            expect(storage.raw).toBe(mockClient);
        });

        it("accepts a pre-built client without url/key", () => {
            expect.assertions(1);

            const storage = new SupabaseStorage({
                ...(storageOptions as SupabaseStorageOptions),
                bucket: "b",
                client: mockClient as unknown as SupabaseStorageOptions["client"],
            });

            expect(storage.raw).toBe(mockClient);
        });
    });

    describe(".delete()", () => {
        it("calls bucket.remove with the resolved path", async () => {
            expect.assertions(2);

            const storage = new SupabaseStorage({
                ...(storageOptions as SupabaseStorageOptions),
                bucket: "avatars",
                client: mockClient as unknown as SupabaseStorageOptions["client"],
            });

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new Error("not found"));

            bucketApi.remove.mockResolvedValueOnce({ data: [{ name: "file.mp4" }], error: null });

            const result = await storage.delete({ id: "file.mp4" });

            expect(bucketApi.remove).toHaveBeenCalledWith(["file.mp4"]);
            expect(result.status).toBe("deleted");
        });

        it("swallows not-found errors from Supabase", async () => {
            expect.assertions(1);

            const storage = new SupabaseStorage({
                ...(storageOptions as SupabaseStorageOptions),
                bucket: "avatars",
                client: mockClient as unknown as SupabaseStorageOptions["client"],
            });

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new Error("not found"));

            bucketApi.remove.mockResolvedValueOnce({
                data: null,
                error: { message: "Object not found" },
            });

            await expect(storage.delete({ id: "missing.mp4" })).resolves.toMatchObject({ status: "deleted" });
        });

        it("throws on other errors", async () => {
            expect.assertions(1);

            const storage = new SupabaseStorage({
                ...(storageOptions as SupabaseStorageOptions),
                bucket: "avatars",
                client: mockClient as unknown as SupabaseStorageOptions["client"],
            });

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new Error("not found"));

            bucketApi.remove.mockResolvedValueOnce({
                data: null,
                error: { message: "Bucket forbidden" },
            });

            await expect(storage.delete({ id: "file.mp4" })).rejects.toMatchObject({ message: "Bucket forbidden" });
        });
    });

    describe(".copy()", () => {
        it("calls bucket.copy with virtual path → destination", async () => {
            expect.assertions(2);

            const storage = new SupabaseStorage({
                ...(storageOptions as SupabaseStorageOptions),
                bucket: "avatars",
                client: mockClient as unknown as SupabaseStorageOptions["client"],
            });

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new Error("not found"));

            bucketApi.copy.mockResolvedValueOnce({ data: { path: "dest.mp4" }, error: null });

            const file = await storage.copy("source.mp4", "dest.mp4");

            expect(bucketApi.copy).toHaveBeenCalledWith("source.mp4", "dest.mp4");
            expect(file.path).toBe("dest.mp4");
        });
    });

    describe(".move()", () => {
        it("calls bucket.move with virtual path → destination", async () => {
            expect.assertions(2);

            const storage = new SupabaseStorage({
                ...(storageOptions as SupabaseStorageOptions),
                bucket: "avatars",
                client: mockClient as unknown as SupabaseStorageOptions["client"],
            });

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new Error("not found"));

            bucketApi.move.mockResolvedValueOnce({ data: { path: "renamed.mp4" }, error: null });

            const file = await storage.move("source.mp4", "renamed.mp4");

            expect(bucketApi.move).toHaveBeenCalledWith("source.mp4", "renamed.mp4");
            expect(file.path).toBe("renamed.mp4");
        });
    });

    describe(".getReadUrl()", () => {
        it("returns a signed URL with the configured expiresIn", async () => {
            expect.assertions(2);

            const storage = new SupabaseStorage({
                ...(storageOptions as SupabaseStorageOptions),
                bucket: "avatars",
                client: mockClient as unknown as SupabaseStorageOptions["client"],
            });

            bucketApi.createSignedUrl.mockResolvedValueOnce({
                data: { signedUrl: "https://example.supabase.co/storage/v1/object/sign/avatars/file.mp4?token=abc" },
                error: null,
            });

            const url = await storage.getReadUrl("file.mp4", { expiresIn: 600 });

            expect(bucketApi.createSignedUrl).toHaveBeenCalledWith("file.mp4", 600, { download: undefined });
            expect(url).toBe("https://example.supabase.co/storage/v1/object/sign/avatars/file.mp4?token=abc");
        });

        it("clamps expiresIn to the 7-day max", async () => {
            expect.assertions(1);

            const storage = new SupabaseStorage({
                ...(storageOptions as SupabaseStorageOptions),
                bucket: "avatars",
                client: mockClient as unknown as SupabaseStorageOptions["client"],
            });

            bucketApi.createSignedUrl.mockResolvedValueOnce({
                data: { signedUrl: "https://x" },
                error: null,
            });

            await storage.getReadUrl("file.mp4", { expiresIn: 999_999_999 });

            expect(bucketApi.createSignedUrl).toHaveBeenCalledWith("file.mp4", 60 * 60 * 24 * 7, { download: undefined });
        });

        it("extracts the filename from attachment; filename=...", async () => {
            expect.assertions(1);

            const storage = new SupabaseStorage({
                ...(storageOptions as SupabaseStorageOptions),
                bucket: "avatars",
                client: mockClient as unknown as SupabaseStorageOptions["client"],
            });

            bucketApi.createSignedUrl.mockResolvedValueOnce({
                data: { signedUrl: "https://x" },
                error: null,
            });

            await storage.getReadUrl("file.mp4", { responseContentDisposition: "attachment; filename=report.pdf" });

            expect(bucketApi.createSignedUrl).toHaveBeenCalledWith("file.mp4", 3600, { download: "report.pdf" });
        });

        it('extracts a quoted filename from attachment; filename="..."', async () => {
            expect.assertions(1);

            const storage = new SupabaseStorage({
                ...(storageOptions as SupabaseStorageOptions),
                bucket: "avatars",
                client: mockClient as unknown as SupabaseStorageOptions["client"],
            });

            bucketApi.createSignedUrl.mockResolvedValueOnce({
                data: { signedUrl: "https://x" },
                error: null,
            });

            await storage.getReadUrl("file.mp4", { responseContentDisposition: 'attachment; filename="Q1 Report.pdf"' });

            expect(bucketApi.createSignedUrl).toHaveBeenCalledWith("file.mp4", 3600, { download: "Q1 Report.pdf" });
        });

        it("decodes RFC 5987 filename* (UTF-8'')", async () => {
            expect.assertions(1);

            const storage = new SupabaseStorage({
                ...(storageOptions as SupabaseStorageOptions),
                bucket: "avatars",
                client: mockClient as unknown as SupabaseStorageOptions["client"],
            });

            bucketApi.createSignedUrl.mockResolvedValueOnce({
                data: { signedUrl: "https://x" },
                error: null,
            });

            await storage.getReadUrl("file.mp4", { responseContentDisposition: "attachment; filename*=UTF-8''r%C3%A9sum%C3%A9.pdf" });

            expect(bucketApi.createSignedUrl).toHaveBeenCalledWith("file.mp4", 3600, { download: "résumé.pdf" });
        });

        it("forwards attachment without filename as download:true", async () => {
            expect.assertions(1);

            const storage = new SupabaseStorage({
                ...(storageOptions as SupabaseStorageOptions),
                bucket: "avatars",
                client: mockClient as unknown as SupabaseStorageOptions["client"],
            });

            bucketApi.createSignedUrl.mockResolvedValueOnce({
                data: { signedUrl: "https://x" },
                error: null,
            });

            await storage.getReadUrl("file.mp4", { responseContentDisposition: "attachment" });

            expect(bucketApi.createSignedUrl).toHaveBeenCalledWith("file.mp4", 3600, { download: true });
        });

        it("ignores prefixes that only start with 'attachment' (e.g. attachment-style)", async () => {
            expect.assertions(1);

            const storage = new SupabaseStorage({
                ...(storageOptions as SupabaseStorageOptions),
                bucket: "avatars",
                client: mockClient as unknown as SupabaseStorageOptions["client"],
            });

            bucketApi.createSignedUrl.mockResolvedValueOnce({
                data: { signedUrl: "https://x" },
                error: null,
            });

            await storage.getReadUrl("file.mp4", { responseContentDisposition: "attachment-style" });

            expect(bucketApi.createSignedUrl).toHaveBeenCalledWith("file.mp4", 3600, { download: undefined });
        });

        it("matches Attachment case-insensitively (RFC 6266)", async () => {
            expect.assertions(1);

            const storage = new SupabaseStorage({
                ...(storageOptions as SupabaseStorageOptions),
                bucket: "avatars",
                client: mockClient as unknown as SupabaseStorageOptions["client"],
            });

            bucketApi.createSignedUrl.mockResolvedValueOnce({
                data: { signedUrl: "https://x" },
                error: null,
            });

            await storage.getReadUrl("file.mp4", { responseContentDisposition: "Attachment; filename=report.pdf" });

            expect(bucketApi.createSignedUrl).toHaveBeenCalledWith("file.mp4", 3600, { download: "report.pdf" });
        });

        it("treats inline disposition as undefined download", async () => {
            expect.assertions(1);

            const storage = new SupabaseStorage({
                ...(storageOptions as SupabaseStorageOptions),
                bucket: "avatars",
                client: mockClient as unknown as SupabaseStorageOptions["client"],
            });

            bucketApi.createSignedUrl.mockResolvedValueOnce({
                data: { signedUrl: "https://x" },
                error: null,
            });

            await storage.getReadUrl("file.mp4", { responseContentDisposition: "inline" });

            expect(bucketApi.createSignedUrl).toHaveBeenCalledWith("file.mp4", 3600, { download: undefined });
        });

        it("throws when createSignedUrl returns an error", async () => {
            expect.assertions(1);

            const storage = new SupabaseStorage({
                ...(storageOptions as SupabaseStorageOptions),
                bucket: "avatars",
                client: mockClient as unknown as SupabaseStorageOptions["client"],
            });

            bucketApi.createSignedUrl.mockResolvedValueOnce({
                data: null,
                error: { message: "permission denied" },
            });

            await expect(storage.getReadUrl("file.mp4")).rejects.toThrow(/permission denied/);
        });
    });

    describe(".getUploadUrl()", () => {
        it("returns a signed upload URL", async () => {
            expect.assertions(2);

            const storage = new SupabaseStorage({
                ...(storageOptions as SupabaseStorageOptions),
                bucket: "avatars",
                client: mockClient as unknown as SupabaseStorageOptions["client"],
            });

            bucketApi.createSignedUploadUrl.mockResolvedValueOnce({
                data: { signedUrl: "https://example.supabase.co/storage/v1/upload/sign/avatars/file.mp4?token=xyz" },
                error: null,
            });

            const url = await storage.getUploadUrl("file.mp4");

            expect(bucketApi.createSignedUploadUrl).toHaveBeenCalledWith("file.mp4");
            expect(url).toBe("https://example.supabase.co/storage/v1/upload/sign/avatars/file.mp4?token=xyz");
        });

        it("throws when createSignedUploadUrl returns an error", async () => {
            expect.assertions(1);

            const storage = new SupabaseStorage({
                ...(storageOptions as SupabaseStorageOptions),
                bucket: "avatars",
                client: mockClient as unknown as SupabaseStorageOptions["client"],
            });

            bucketApi.createSignedUploadUrl.mockResolvedValueOnce({
                data: null,
                error: { message: "quota exceeded" },
            });

            await expect(storage.getUploadUrl("file.mp4")).rejects.toThrow(/quota exceeded/);
        });
    });
});
