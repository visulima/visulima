/* eslint-disable max-classes-per-file, @typescript-eslint/no-extraneous-class, no-constructor-return -- mock SDK classes for vendor library shape */
import { Readable } from "node:stream";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UploadThingStorageOptions } from "../../../src/storage/uploadthing/types";
import UploadThingFile from "../../../src/storage/uploadthing/uploadthing-file";
import UploadThingStorage from "../../../src/storage/uploadthing/uploadthing-storage";
import { metafile, storageOptions } from "../../__helpers__/config";

const validToken = Buffer.from(JSON.stringify({ apiKey: "sk_test_abc", appId: "test-app" })).toString("base64");

const makeMockUtapi = () => {
    return {
        deleteFiles: vi.fn(),
        generateSignedURL: vi.fn(),
        listFiles: vi.fn(),
        uploadFiles: vi.fn(),
    };
};

let mockUtapi: ReturnType<typeof makeMockUtapi>;

vi.mock(import("uploadthing/server"), () => {
    return {
        UTApi: class {
            public constructor() {
                return mockUtapi;
            }
        },
        UTFile: class {
            public customId?: string;

            public name: string;

            public type?: string;

            public constructor(_chunks: unknown[], name: string, options?: { customId?: string; type?: string }) {
                this.name = name;
                this.customId = options?.customId;
                this.type = options?.type;
            }
        },
    };
});

const buildOptions = (overrides: Partial<UploadThingStorageOptions> = {}): UploadThingStorageOptions => ({
    ...(storageOptions as UploadThingStorageOptions),
    token: validToken,
    ...overrides,
});

const bufferToStream = (buffer: Buffer): Readable => Readable.from([buffer]);

describe(`${UploadThingStorage.name} additional coverage`, () => {
    beforeEach(() => {
        mockUtapi = makeMockUtapi();

        delete process.env.UPLOADTHING_TOKEN;

        // Stub global fetch for .get() tests
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                arrayBuffer: vi.fn().mockResolvedValue(Buffer.from("payload").buffer),
                headers: new Headers({ "content-type": "image/png", etag: "etag-xyz" }),
                ok: true,
                status: 200,
                statusText: "OK",
            }),
        );
    });

    describe(".create()", () => {
        it("creates new metadata when getMeta throws", async () => {
            expect.assertions(2);

            const storage = new UploadThingStorage(buildOptions());

            vi.spyOn(storage, "getMeta").mockRejectedValue(new Error("not found"));
            vi.spyOn(storage, "saveMeta").mockImplementation(async (file) => file);

            const onCreateSpy = vi.fn();

            storage.onCreate = onCreateSpy;

            const file = await storage.create({
                contentType: "video/mp4",
                metadata: { name: "newfile.mp4" },
                originalName: "newfile.mp4",
                size: 1024,
            });

            expect(file.bytesWritten).toBe(0);
            expect(onCreateSpy).toHaveBeenCalledTimes(1);
        });

        it("returns existing file when meta already exists", async () => {
            expect.assertions(1);

            const storage = new UploadThingStorage(buildOptions());

            vi.spyOn(storage, "getMeta").mockResolvedValue({
                ...metafile,
                bytesWritten: 200,
            });

            const file = await storage.create({
                contentType: "video/mp4",
                metadata: { name: metafile.name },
                originalName: metafile.name,
                size: 1024,
            });

            expect(file.bytesWritten).toBe(200);
        });
    });

    describe(".write()", () => {
        const makeBaseFile = (): UploadThingFile =>
            Object.assign(new UploadThingFile({
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

        it("uploads via uploadFiles and updates file metadata", async () => {
            expect.assertions(4);

            const storage = new UploadThingStorage(buildOptions());

            vi.spyOn(storage, "getMeta").mockResolvedValue(makeBaseFile());
            vi.spyOn(storage, "saveMeta").mockImplementation(async (file) => file);

            mockUtapi.uploadFiles.mockResolvedValue({
                data: {
                    fileHash: "hash-abc",
                    key: "ufs-key-1",
                    ufsUrl: "https://test-app.ufs.sh/f/hash-abc",
                    url: "https://uploadthing.com/f/hash-abc",
                },
            });

            const result = await storage.write({
                body: bufferToStream(Buffer.from("xz".repeat(32))),
                contentLength: metafile.size,
                id: metafile.id,
                start: 0,
            });

            expect(mockUtapi.uploadFiles).toHaveBeenCalledTimes(1);
            expect(result.bytesWritten).toBe(metafile.size);
            expect(result.ufsKey).toBe("ufs-key-1");
            expect(result.url).toBe("https://test-app.ufs.sh/f/hash-abc");
        });

        it("throws when uploadFiles returns an error", async () => {
            expect.assertions(1);

            const storage = new UploadThingStorage(buildOptions());

            vi.spyOn(storage, "getMeta").mockResolvedValue(makeBaseFile());
            vi.spyOn(storage, "saveMeta").mockImplementation(async (file) => file);

            mockUtapi.uploadFiles.mockResolvedValue({
                error: { message: "Upload denied" },
            });

            await expect(
                storage.write({
                    body: bufferToStream(Buffer.from("xz".repeat(32))),
                    contentLength: metafile.size,
                    id: metafile.id,
                    start: 0,
                }),
            ).rejects.toThrow(/Upload denied/);
        });

        it("returns file unchanged when status is completed", async () => {
            expect.assertions(2);

            const storage = new UploadThingStorage(buildOptions());

            const completedFile = Object.assign(Object.create(UploadThingFile.prototype), {
                ...makeBaseFile(),
                status: "completed" as const,
            });

            vi.spyOn(storage, "getMeta").mockResolvedValue(completedFile);

            const result = await storage.write({ id: metafile.id });

            expect(result.status).toBe("completed");
            expect(mockUtapi.uploadFiles).not.toHaveBeenCalled();
        });
    });

    describe(".delete() — extra paths", () => {
        it("removes file metadata and invokes onDelete when meta is present", async () => {
            expect.assertions(3);

            const storage = new UploadThingStorage(buildOptions());

            vi.spyOn(storage, "getMeta").mockResolvedValue({
                ...metafile,
                customId: metafile.name,
            } as UploadThingFile);
            vi.spyOn(storage, "deleteMeta").mockResolvedValue(undefined);

            const onDeleteSpy = vi.fn();

            storage.onDelete = onDeleteSpy;

            mockUtapi.deleteFiles.mockResolvedValueOnce({ success: true });

            const result = await storage.delete({ id: metafile.id });

            expect(mockUtapi.deleteFiles).toHaveBeenCalledWith(metafile.name);
            expect(result.status).toBe("deleted");
            expect(onDeleteSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe(".get()", () => {
        it("fetches content from public CDN URL", async () => {
            expect.assertions(2);

            const storage = new UploadThingStorage(buildOptions({ acl: "public-read" }));

            vi.spyOn(storage, "getMeta").mockResolvedValue({
                ...metafile,
                customId: metafile.name,
            } as UploadThingFile);

            const result = await storage.get({ id: metafile.id });

            expect(global.fetch).toHaveBeenCalledWith(`https://test-app.ufs.sh/f/${encodeURIComponent(metafile.name)}`);
            expect(result.content?.toString()).toContain("payload");
        });

        it("fetches content via signed URL when ACL is private", async () => {
            expect.assertions(1);

            const storage = new UploadThingStorage(buildOptions({ acl: "private" }));

            vi.spyOn(storage, "getMeta").mockResolvedValue({
                ...metafile,
                customId: metafile.name,
            } as UploadThingFile);

            mockUtapi.generateSignedURL.mockResolvedValue({
                ufsUrl: "https://signed.example/file?sig=abc",
            });

            await storage.get({ id: metafile.id });

            expect(global.fetch).toHaveBeenCalledWith("https://signed.example/file?sig=abc");
        });

        it("falls back to id when meta cannot be loaded", async () => {
            expect.assertions(2);

            const storage = new UploadThingStorage(buildOptions({ acl: "public-read" }));

            vi.spyOn(storage, "getMeta").mockRejectedValue(new Error("missing"));

            const result = await storage.get({ id: "user/orphan.png" });

            expect(global.fetch).toHaveBeenCalledWith(`https://test-app.ufs.sh/f/${encodeURIComponent("user/orphan.png")}`);
            expect(result.id).toBe("user/orphan.png");
        });

        it("throws when fetch returns non-ok status", async () => {
            expect.assertions(1);

            const storage = new UploadThingStorage(buildOptions({ acl: "public-read" }));

            vi.spyOn(storage, "getMeta").mockResolvedValue({
                ...metafile,
                customId: metafile.name,
            } as UploadThingFile);

            vi.stubGlobal(
                "fetch",
                vi.fn().mockResolvedValue({
                    arrayBuffer: vi.fn().mockResolvedValue(Buffer.alloc(0).buffer),
                    headers: new Headers(),
                    ok: false,
                    status: 404,
                    statusText: "Not Found",
                }),
            );

            await expect(storage.get({ id: metafile.id })).rejects.toThrow(/fetch failed: 404/);
        });
    });

    describe(".copy() and .move()", () => {
        it("copy() downloads source then re-uploads with new customId", async () => {
            expect.assertions(3);

            const storage = new UploadThingStorage(buildOptions({ acl: "public-read" }));

            vi.spyOn(storage, "getMeta").mockResolvedValue({
                ...metafile,
                customId: metafile.name,
            } as UploadThingFile);

            mockUtapi.uploadFiles.mockResolvedValue({
                data: {
                    fileHash: "hash-copy",
                    key: "ufs-key-copy",
                    ufsUrl: "https://test-app.ufs.sh/f/hash-copy",
                },
            });

            const result = await storage.copy(metafile.id, "user/dest.mp4");

            expect(mockUtapi.uploadFiles).toHaveBeenCalledTimes(1);
            expect(result.id).toBe("user/dest.mp4");
            expect(result.url).toBe("https://test-app.ufs.sh/f/hash-copy");
        });

        it("copy() throws when uploadFiles returns an error", async () => {
            expect.assertions(1);

            const storage = new UploadThingStorage(buildOptions({ acl: "public-read" }));

            vi.spyOn(storage, "getMeta").mockResolvedValue({
                ...metafile,
                customId: metafile.name,
            } as UploadThingFile);

            mockUtapi.uploadFiles.mockResolvedValue({ error: { message: "boom" } });

            await expect(storage.copy(metafile.id, "user/dest.mp4")).rejects.toThrow(/boom/);
        });

        it("move() calls copy then delete", async () => {
            expect.assertions(2);

            const storage = new UploadThingStorage(buildOptions());

            const copySpy = vi
                .spyOn(storage, "copy")
                .mockResolvedValue(
                    Object.assign(new UploadThingFile({
                        contentType: "video/mp4",
                        metadata: {},
                        originalName: "dest",
                    }), { id: "dest", name: "dest" }),
                );
            const deleteSpy = vi
                .spyOn(storage, "delete")
                .mockResolvedValue(
                    Object.assign(new UploadThingFile({
                        contentType: "video/mp4",
                        metadata: {},
                        originalName: "src",
                    }), { id: "src", status: "deleted" as const }),
                );

            await storage.move("src", "dest");

            expect(copySpy).toHaveBeenCalledWith("src", "dest", undefined);
            expect(deleteSpy).toHaveBeenCalledWith({ id: "src" }, undefined);
        });
    });

    describe(".list()", () => {
        it("returns files from listFiles result", async () => {
            expect.assertions(3);

            const storage = new UploadThingStorage(buildOptions());

            mockUtapi.listFiles.mockResolvedValue({
                files: [
                    {
                        customId: "user/file-a",
                        key: "ufs-a",
                        size: 100,
                        uploadedAt: new Date("2024-01-01").getTime(),
                    },
                    { key: "ufs-b", size: 200 },
                ],
            });

            const result = await storage.list();

            expect(result).toHaveLength(2);
            expect(result[0]?.id).toBe("user/file-a");
            expect(result[1]?.id).toBe("ufs-b");
        });
    });
});
