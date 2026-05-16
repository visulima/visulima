import { Readable } from "node:stream";

import { beforeEach, describe, expect, it, vi } from "vitest";

import FirebaseFile from "../../../src/storage/firebase/firebase-file";
import FirebaseStorage from "../../../src/storage/firebase/firebase-storage";
import type { FirebaseStorageOptions } from "../../../src/storage/firebase/types";
import { storageOptions } from "../../__helpers__/config";

const initializeApp = vi.fn(() => {
    return { name: "[DEFAULT]" };
});
const cert = vi.fn((value: unknown) => value);
const getApps = vi.fn((): { name: string }[] => []);
const getApp = vi.fn((name?: string) => {
    return { name: name ?? "[DEFAULT]" };
});
const getStorage = vi.fn();

vi.mock(import("firebase-admin/app"), () => {
    return {
        cert: (value: unknown) => cert(value),
        getApp: (name?: string) => getApp(name),
        getApps: () => getApps(),
        initializeApp: (config: unknown, name?: string) => initializeApp(config, name),
    };
});

vi.mock(import("firebase-admin/storage"), () => {
    return {
        getStorage: (app: unknown) => getStorage(app),
    };
});

const makeGcsFile = () => {
    return {
        copy: vi.fn().mockResolvedValue([{}]),
        delete: vi.fn().mockResolvedValue([{}]),
        download: vi.fn().mockResolvedValue([Buffer.from("hello")]),
        exists: vi.fn().mockResolvedValue([true]),
        getMetadata: vi.fn().mockResolvedValue([{ contentType: "video/mp4", etag: "etag-1", size: 5, updated: "2024-01-01T00:00:00.000Z" }]),
        getSignedUrl: vi.fn().mockResolvedValue(["https://signed.example/url"]),
        move: vi.fn().mockResolvedValue([{}]),
        name: "file.mp4",
        save: vi.fn().mockResolvedValue([{}]),
    };
};

const makeMockBucket = (gcsFile: ReturnType<typeof makeGcsFile>) => {
    return {
        file: vi.fn(() => gcsFile),
        getFiles: vi.fn().mockResolvedValue([[{ name: "a.mp4" }, { name: "b.mp4" }]]),
        name: "test-bucket.appspot.com",
    };
};

let gcsFile: ReturnType<typeof makeGcsFile>;
let mockBucket: ReturnType<typeof makeMockBucket>;

const asApp = (bucket: ReturnType<typeof makeMockBucket>): FirebaseStorageOptions["app"] => bucket;

const makeStorage = () =>
    new FirebaseStorage({
        ...(storageOptions as FirebaseStorageOptions),
        app: asApp(mockBucket),
    });

describe(FirebaseStorage, () => {
    beforeEach(() => {
        gcsFile = makeGcsFile();
        mockBucket = makeMockBucket(gcsFile);

        initializeApp.mockClear();
        cert.mockClear();
        getApps.mockClear();
        getApp.mockClear();
        getStorage.mockClear();
        getApps.mockReturnValue([]);
        getStorage.mockReturnValue({ bucket: vi.fn(() => mockBucket) });

        delete process.env.FIREBASE_STORAGE_BUCKET;
        delete process.env.FIREBASE_PROJECT_ID;
        delete process.env.GOOGLE_CLOUD_PROJECT;
        delete process.env.GCLOUD_PROJECT;
        delete process.env.FIREBASE_CLIENT_EMAIL;
        delete process.env.FIREBASE_PRIVATE_KEY;
        delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    });

    describe("construction", () => {
        it("uses a pre-built Bucket via the app escape hatch", () => {
            expect.assertions(2);

            const storage = makeStorage();

            expect(storage.raw).toBe(mockBucket);
            expect(initializeApp).not.toHaveBeenCalled();
        });

        it("rejects when bucket is unresolvable", () => {
            expect.assertions(1);

            expect(
                () =>
                    new FirebaseStorage({
                        ...(storageOptions as FirebaseStorageOptions),
                    }),
            ).toThrow(/`bucket` is required/);
        });

        it("rejects when credentials are missing", () => {
            expect.assertions(1);

            expect(
                () =>
                    new FirebaseStorage({
                        ...(storageOptions as FirebaseStorageOptions),
                        bucket: "test-bucket.appspot.com",
                    }),
            ).toThrow(/service-account credentials are required/);
        });

        it("initializes a firebase app from credentials + env bucket", () => {
            expect.assertions(3);

            process.env.FIREBASE_STORAGE_BUCKET = "env-bucket.appspot.com";

            const storage = new FirebaseStorage({
                ...(storageOptions as FirebaseStorageOptions),
                credentials: { clientEmail: "svc@example.com", privateKey: "-----KEY-----" },
                projectId: "my-project",
            });

            expect(initializeApp).toHaveBeenCalledTimes(1);
            expect(cert).toHaveBeenCalledWith(expect.objectContaining({ clientEmail: "svc@example.com", projectId: "my-project" }));
            expect(storage.raw).toBe(mockBucket);
        });

        it("reuses an existing firebase app when present", () => {
            expect.assertions(2);

            getApps.mockReturnValue([{ name: "[DEFAULT]" }]);

            const storage = new FirebaseStorage({
                ...(storageOptions as FirebaseStorageOptions),
                bucket: "test-bucket.appspot.com",
            });

            expect(storage.raw).toBe(mockBucket);
            expect(initializeApp).not.toHaveBeenCalled();
        });
    });

    describe(".create()", () => {
        it("creates a new file and saves meta", async () => {
            expect.assertions(2);

            const storage = makeStorage();

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new Error("not found"));
            const saveMeta = vi.spyOn(storage as unknown as { saveMeta: (f: unknown) => Promise<unknown> }, "saveMeta").mockResolvedValue(undefined);

            const file = await storage.create({ contentType: "video/mp4", metadata: { name: "v.mp4", size: 5 }, originalName: "v.mp4", size: 5 });

            expect(file.status).toBe("created");
            expect(saveMeta).toHaveBeenCalledWith(file);
        });
    });

    describe(".write()", () => {
        it("buffers the part stream and calls file.save", async () => {
            expect.assertions(3);

            const storage = makeStorage();

            const file = new FirebaseFile({
                contentType: "video/mp4",
                metadata: { name: "v.mp4", size: 5 },
                originalName: "v.mp4",
                size: 5,
            });

            file.name = "v.mp4";
            file.path = "v.mp4";
            file.bytesWritten = 0;

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockResolvedValue(file);
            vi.spyOn(storage as unknown as { saveMeta: (f: unknown) => Promise<unknown> }, "saveMeta").mockResolvedValue(undefined);
            vi.spyOn(storage as unknown as { deleteMeta: () => Promise<unknown> }, "deleteMeta").mockResolvedValue(undefined);

            const result = await storage.write({
                body: Readable.from([Buffer.from("hello")]),
                contentLength: 5,
                id: file.id,
                size: 5,
                start: 0,
            });

            expect(gcsFile.save).toHaveBeenCalledTimes(1);
            expect(result.bytesWritten).toBe(5);
            expect(result.size).toBe(5);
        });
    });

    describe(".get()", () => {
        it("downloads the file content and metadata", async () => {
            expect.assertions(3);

            const storage = makeStorage();

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new Error("not found"));

            const result = await storage.get({ id: "file.mp4" });

            expect(gcsFile.download).toHaveBeenCalledTimes(1);
            expect(result.content.toString()).toBe("hello");
            expect(result.contentType).toBe("video/mp4");
        });
    });

    describe(".delete()", () => {
        it("calls file.delete with ignoreNotFound", async () => {
            expect.assertions(2);

            const storage = makeStorage();

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new Error("not found"));

            const result = await storage.delete({ id: "file.mp4" });

            expect(gcsFile.delete).toHaveBeenCalledWith({ ignoreNotFound: true });
            expect(result.status).toBe("deleted");
        });
    });

    describe(".exists()", () => {
        it("returns the boolean from file.exists", async () => {
            expect.assertions(1);

            const storage = makeStorage();

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new Error("not found"));

            await expect(storage.exists({ id: "file.mp4" })).resolves.toBe(true);
        });

        it("returns false when file.exists throws", async () => {
            expect.assertions(1);

            const storage = makeStorage();

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new Error("not found"));
            gcsFile.exists.mockRejectedValueOnce(new Error("boom"));

            await expect(storage.exists({ id: "file.mp4" })).resolves.toBe(false);
        });
    });

    describe(".copy()", () => {
        it("copies source to destination", async () => {
            expect.assertions(2);

            const storage = makeStorage();

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new Error("not found"));

            const file = await storage.copy("source.mp4", "dest.mp4");

            expect(gcsFile.copy).toHaveBeenCalledTimes(1);
            expect(file.path).toBe("dest.mp4");
        });
    });

    describe(".move()", () => {
        it("moves source to destination", async () => {
            expect.assertions(2);

            const storage = makeStorage();

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new Error("not found"));

            const file = await storage.move("source.mp4", "renamed.mp4");

            expect(gcsFile.move).toHaveBeenCalledWith("renamed.mp4");
            expect(file.path).toBe("renamed.mp4");
        });
    });

    describe(".list()", () => {
        it("maps bucket.getFiles entries to FirebaseFile", async () => {
            expect.assertions(3);

            const storage = makeStorage();

            const files = await storage.list(50);

            expect(mockBucket.getFiles).toHaveBeenCalledWith({ maxResults: 50 });
            expect(files).toHaveLength(2);
            expect(files[0]?.name).toBe("a.mp4");
        });
    });

    describe(".getReadUrl()", () => {
        it("returns a signed read URL", async () => {
            expect.assertions(2);

            const storage = makeStorage();

            const url = await storage.getReadUrl("file.mp4", { expiresIn: 600 });

            expect(gcsFile.getSignedUrl).toHaveBeenCalledWith(expect.objectContaining({ action: "read" }));
            expect(url).toBe("https://signed.example/url");
        });

        it("returns a public URL when publicBaseUrl is set", async () => {
            expect.assertions(1);

            const storage = new FirebaseStorage({
                ...(storageOptions as FirebaseStorageOptions),
                app: asApp(mockBucket),
                publicBaseUrl: "https://cdn.example.com/",
            });

            await expect(storage.getReadUrl("file.mp4")).resolves.toBe("https://cdn.example.com/file.mp4");
        });
    });

    describe(".getUploadUrl()", () => {
        it("returns a signed write URL", async () => {
            expect.assertions(2);

            const storage = makeStorage();

            const url = await storage.getUploadUrl("file.mp4", { contentType: "video/mp4" });

            expect(gcsFile.getSignedUrl).toHaveBeenCalledWith(expect.objectContaining({ action: "write", contentType: "video/mp4" }));
            expect(url).toBe("https://signed.example/url");
        });
    });
});
