import { Readable } from "node:stream";

import { beforeEach, describe, expect, it, vi } from "vitest";

import CloudinaryStorage from "../../../src/storage/cloudinary/cloudinary-storage";
import type { CloudinaryStorageOptions } from "../../../src/storage/cloudinary/types";
import { ERRORS, UploadError } from "../../../src/utils/errors";
import { storageOptions } from "../../__helpers__/config";

const makeMockClient = () => {
    return {
        api: {
            resource: vi.fn(),
            resources: vi.fn(),
        },
        config: vi.fn(),
        uploader: {
            destroy: vi.fn(),
            rename: vi.fn(),
            upload: vi.fn(),
            upload_stream: vi.fn(),
        },
        url: vi.fn((id: string) => `https://res.cloudinary.com/demo/raw/upload/${id}`),
        utils: {
            private_download_url: vi.fn(),
        },
    };
};

let mockClient: ReturnType<typeof makeMockClient>;

vi.mock(import("cloudinary"), () => {
    return {
        get v2() {
            return mockClient;
        },
    };
});

describe(CloudinaryStorage, () => {
    beforeEach(() => {
        mockClient = makeMockClient();

        delete process.env.CLOUDINARY_CLOUD_NAME;
        delete process.env.CLOUDINARY_API_KEY;
        delete process.env.CLOUDINARY_API_SECRET;
        delete process.env.CLOUDINARY_URL;
    });

    const newStorage = (overrides: Partial<CloudinaryStorageOptions> = {}) => {
        const client = mockClient as unknown as CloudinaryStorageOptions["client"];

        return new CloudinaryStorage({
            ...(storageOptions as CloudinaryStorageOptions),
            client,
            ...overrides,
        });
    };

    describe("construction", () => {
        it("rejects when cloudName is missing", () => {
            expect.assertions(1);

            expect(
                () =>
                    new CloudinaryStorage({
                        ...(storageOptions as CloudinaryStorageOptions),
                        apiKey: "k",
                        apiSecret: "s",
                    }),
            ).toThrow(/`cloudName` is required/);
        });

        it("falls back to env vars", () => {
            expect.assertions(2);

            process.env.CLOUDINARY_CLOUD_NAME = "demo";
            process.env.CLOUDINARY_API_KEY = "key";
            process.env.CLOUDINARY_API_SECRET = "secret";

            const storage = new CloudinaryStorage({
                ...(storageOptions as CloudinaryStorageOptions),
            });

            expect(storage.raw).toBe(mockClient);
            expect(mockClient.config).toHaveBeenCalledWith(expect.objectContaining({ api_key: "key", api_secret: "secret", cloud_name: "demo" }));
        });

        it("parses CLOUDINARY_URL", () => {
            expect.assertions(2);

            process.env.CLOUDINARY_URL = "cloudinary://abc:def@my-cloud";

            const storage = new CloudinaryStorage({
                ...(storageOptions as CloudinaryStorageOptions),
            });

            expect(storage.raw).toBe(mockClient);
            expect(mockClient.config).toHaveBeenCalledWith(expect.objectContaining({ api_key: "abc", api_secret: "def", cloud_name: "my-cloud" }));
        });

        it("accepts a pre-built client without credentials", () => {
            expect.assertions(2);

            const storage = newStorage();

            expect(storage.raw).toBe(mockClient);
            expect(mockClient.config).not.toHaveBeenCalled();
        });
    });

    describe(".create()", () => {
        it("creates a new file and saves metadata", async () => {
            expect.assertions(2);

            const storage = newStorage();

            const file = await storage.create({
                contentType: "video/mp4",
                metadata: {},
                originalName: "video.mp4",
            });

            expect(file.name).toBe("anonymous/video.mp4");
            expect(file.bytesWritten).toBe(0);
        });
    });

    describe(".write()", () => {
        it("buffers the part stream and uploads via upload_stream", async () => {
            expect.assertions(3);

            const storage = newStorage();

            const created = await storage.create({
                contentType: "video/mp4",
                metadata: {},
                originalName: "video.mp4",
                size: 4,
            });

            mockClient.uploader.upload_stream.mockImplementation((_options: unknown, callback: (error: unknown, result: unknown) => void) => {
                return {
                    end: () => callback(null, { public_id: "anonymous/video.mp4", secure_url: "https://cdn/x", version: 42 }),
                };
            });

            const file = await storage.write({
                body: Readable.from([Buffer.from("data")]),
                id: created.id,
                size: 4,
                start: 0,
            });

            expect(mockClient.uploader.upload_stream).toHaveBeenCalledWith(
                expect.objectContaining({ overwrite: true, public_id: "anonymous/video.mp4" }),
                expect.any(Function),
            );
            expect(file.bytesWritten).toBe(4);
            expect(file.status).toBe("completed");
        });
    });

    describe(".get()", () => {
        it("returns metadata + bytes", async () => {
            expect.assertions(2);

            const storage = newStorage();

            mockClient.api.resource.mockResolvedValueOnce({ bytes: 4, format: "mp4", resource_type: "video", version: 7 });

            vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
                arrayBuffer: async () => Buffer.from("data"),
                ok: true,
            } as unknown as Response);

            const result = await storage.get({ id: "anonymous/video.mp4" });

            expect(result.content).toStrictEqual(Buffer.from("data"));
            expect(result.size).toBe(4);
        });
    });

    describe("private assets", () => {
        it("reads and copies them through signed download URLs", async () => {
            expect.assertions(3);

            const storage = newStorage({ type: "private" });
            const signed = "https://api.cloudinary.com/v1_1/demo/raw/download?signature=abc";

            mockClient.utils.private_download_url.mockReturnValue(signed);
            mockClient.api.resource.mockResolvedValueOnce({ bytes: 4, format: "mp4", resource_type: "raw", version: 7 });

            const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
                arrayBuffer: async () => Buffer.from("data"),
                ok: true,
            } as unknown as Response);

            await expect(storage.get({ id: "secret.mp4" })).resolves.toHaveProperty("content", Buffer.from("data"));
            expect(fetchSpy).toHaveBeenCalledWith(signed);

            await storage.copy("secret.mp4", "copy.mp4");

            expect(mockClient.uploader.upload).toHaveBeenCalledWith(signed, expect.objectContaining({ public_id: "copy.mp4", type: "private" }));

            fetchSpy.mockRestore();
        });
    });

    describe(".getCompletedFile()", () => {
        it("answers from the resource details without downloading the content", async () => {
            expect.assertions(5);

            const fetchSpy = vi.spyOn(globalThis, "fetch");

            fetchSpy.mockClear();
            mockClient.api.resource.mockResolvedValueOnce({ bytes: 4, format: "mp4", resource_type: "video", version: 7 });

            const file = await newStorage().getCompletedFile("anonymous/video.mp4");

            expect(file).toMatchObject({
                bytesWritten: 4,
                contentType: "video/mp4",
                ETag: "7",
                id: "anonymous/video.mp4",
                path: "anonymous/video.mp4",
                status: "completed",
            });
            expect(file?.size).toBe(4);
            expect(mockClient.api.resource).toHaveBeenCalledWith("anonymous/video.mp4", expect.objectContaining({ resource_type: expect.any(String) }));
            expect(fetchSpy).not.toHaveBeenCalled();
            expect(mockClient.url).not.toHaveBeenCalled();

            fetchSpy.mockRestore();
        });

        it("returns undefined when the resource is missing", async () => {
            expect.assertions(2);

            mockClient.api.resource.mockRejectedValueOnce({ error: { http_code: 404, message: "Resource not found" } });

            await expect(newStorage().getCompletedFile("missing")).resolves.toBeUndefined();

            mockClient.api.resource.mockRejectedValueOnce({ error: { http_code: 420, message: "Rate Limit Exceeded" } });

            await expect(newStorage().getCompletedFile("file")).rejects.toMatchObject({ error: { http_code: 420 } });
        });
    });

    describe(".delete()", () => {
        it("calls uploader.destroy with the resolved key", async () => {
            expect.assertions(2);

            const storage = newStorage();

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new UploadError(ERRORS.FILE_NOT_FOUND));

            mockClient.uploader.destroy.mockResolvedValueOnce({ result: "ok" });

            const result = await storage.delete({ id: "file.mp4" });

            expect(mockClient.uploader.destroy).toHaveBeenCalledWith("file.mp4", expect.objectContaining({ invalidate: true }));
            expect(result.status).toBe("deleted");
        });
    });

    describe(".exists()", () => {
        it("returns true when the resource is found", async () => {
            expect.assertions(1);

            const storage = newStorage();

            mockClient.api.resource.mockResolvedValueOnce({ public_id: "file.mp4" });

            await expect(storage.exists({ id: "file.mp4" })).resolves.toBe(true);
        });

        it("returns false when the resource is missing", async () => {
            expect.assertions(1);

            const storage = newStorage();

            mockClient.api.resource.mockRejectedValueOnce(Object.assign(new Error("not found"), { http_code: 404 }));

            await expect(storage.exists({ id: "missing.mp4" })).resolves.toBe(false);
        });

        it("throws when the lookup fails for another reason", async () => {
            expect.assertions(1);

            const storage = newStorage();

            mockClient.api.resource.mockRejectedValueOnce(Object.assign(new Error("unavailable"), { http_code: 503 }));

            await expect(storage.exists({ id: "file.mp4" })).rejects.toThrow("unavailable");
        });
    });

    describe(".copy()", () => {
        it("re-uploads from the source URL", async () => {
            expect.assertions(2);

            const storage = newStorage();

            mockClient.uploader.upload.mockResolvedValueOnce({ public_id: "dest.mp4" });

            const file = await storage.copy("source.mp4", "dest.mp4");

            expect(mockClient.uploader.upload).toHaveBeenCalledWith(
                "https://res.cloudinary.com/demo/raw/upload/source.mp4",
                expect.objectContaining({ public_id: "dest.mp4" }),
            );
            expect(file.path).toBe("dest.mp4");
        });
    });

    describe(".move()", () => {
        it("calls uploader.rename", async () => {
            expect.assertions(2);

            const storage = newStorage();

            mockClient.uploader.rename.mockResolvedValueOnce({ public_id: "renamed.mp4" });

            const file = await storage.move("source.mp4", "renamed.mp4");

            expect(mockClient.uploader.rename).toHaveBeenCalledWith("source.mp4", "renamed.mp4", expect.objectContaining({ resource_type: "raw" }));
            expect(file.path).toBe("renamed.mp4");
        });
    });

    describe(".list()", () => {
        it("maps resources to CloudinaryFile", async () => {
            expect.assertions(2);

            const storage = newStorage();

            mockClient.api.resources.mockResolvedValueOnce({
                resources: [{ bytes: 10, format: "mp4", public_id: "a.mp4", resource_type: "video", version: 1 }],
            });

            const files = await storage.list(50);

            expect(mockClient.api.resources).toHaveBeenCalledWith(expect.objectContaining({ max_results: 50 }));
            expect(files[0]?.id).toBe("a.mp4");
        });

        it("follows next_cursor across capped pages until the limit is reached", async () => {
            expect.assertions(2);

            const storage = newStorage();
            const ids = ["a", "b", "c", "d", "e"];

            // An account that answers at most two resources per page (the Admin API caps pages at 500).
            mockClient.api.resources.mockImplementation(async ({ max_results: maxResults, next_cursor: cursor }: { max_results: number; next_cursor?: string }) => {
                const start = Number(cursor ?? 0);
                const end = start + Math.min(maxResults, 2);

                return {
                    next_cursor: end < ids.length ? String(end) : undefined,
                    resources: ids.slice(start, end).map((id) => { return { public_id: id }; }),
                };
            });

            await expect(storage.list()).resolves.toHaveLength(5);
            await expect(storage.list(3)).resolves.toHaveLength(3);
        });
    });

    describe(".getReadUrl()", () => {
        it("returns a public delivery URL for upload type", async () => {
            expect.assertions(1);

            const storage = newStorage();

            const url = await storage.getReadUrl("file.mp4");

            expect(url).toBe("https://res.cloudinary.com/demo/raw/upload/file.mp4");
        });

        it("returns a signed download URL for private type", async () => {
            expect.assertions(2);

            const storage = newStorage({ type: "private" });

            mockClient.utils.private_download_url.mockReturnValueOnce("https://res.cloudinary.com/demo/private/file.mp4?signature=abc");

            const url = await storage.getReadUrl("file.mp4", { expiresIn: 600 });

            expect(mockClient.utils.private_download_url).toHaveBeenCalledWith("file.mp4", "mp4", expect.objectContaining({ type: "private" }));
            expect(url).toBe("https://res.cloudinary.com/demo/private/file.mp4?signature=abc");
        });
    });
});
