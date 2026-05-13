import { beforeEach, describe, expect, it, vi } from "vitest";

import BunnyStorage from "../../../src/storage/bunny/bunny-storage";
import type { BunnyStorageOptions } from "../../../src/storage/bunny/types";
import { ERRORS } from "../../../src/utils/errors";
import { storageOptions } from "../../__helpers__/config";

const makeStorageFile = (overrides: Record<string, unknown> = {}) => {
    return {
        _tag: "StorageFile" as const,
        checksum: "ABCD1234",
        contentType: "application/octet-stream",
        data: vi.fn(async () => {
            return {
                length: 7,
                response: new Response("payload"),
                stream: new ReadableStream<Uint8Array>({
                    start(controller) {
                        controller.enqueue(new TextEncoder().encode("payload"));
                        controller.close();
                    },
                }),
            };
        }),
        dateCreated: new Date("2026-01-01T00:00:00Z"),
        guid: "guid-1",
        isDirectory: false,
        lastChanged: new Date("2026-01-02T00:00:00Z"),
        length: 7,
        objectName: "file.bin",
        path: "/zone/",
        replicatedZones: null,
        serverId: 1,
        storageZoneId: 1,
        storageZoneName: "zone",
        userId: "user",
        ...overrides,
    };
};

const { fileMock, zoneMock } = vi.hoisted(() => {
    return {
        fileMock: {
            get: vi.fn(),
            list: vi.fn(),
            remove: vi.fn(),
            upload: vi.fn(),
        },
        zoneMock: {
            connect_with_accesskey: vi.fn(() => {
                return { _tag: "StorageZone", accessKey: "ak", name: "test-zone", region: "de" };
            }),
            name: vi.fn(() => "test-zone"),
        },
    };
});

vi.mock(import("@bunny.net/storage-sdk"), () => {
    return {
        file: fileMock,
        regions: {
            StorageRegion: {
                Falkenstein: "de",
                Johannesburg: "jh",
                London: "uk",
                LosAngeles: "la",
                NewYork: "ny",
                SaoPaulo: "br",
                Singapore: "sg",
                Stockholm: "se",
                Sydney: "syd",
            },
        },
        zone: zoneMock,
    };
});

const baseOptions: BunnyStorageOptions = {
    ...(storageOptions as BunnyStorageOptions),
    accessKey: "test-key",
    region: "de",
    zone: "test-zone",
};

describe(BunnyStorage, () => {
    beforeEach(() => {
        fileMock.get.mockReset();
        fileMock.list.mockReset();
        fileMock.remove.mockReset();
        fileMock.upload.mockReset();
        zoneMock.connect_with_accesskey.mockClear();
        zoneMock.name.mockClear();

        delete process.env.BUNNY_STORAGE_ZONE;
        delete process.env.STORAGE_ZONE;
        delete process.env.BUNNY_STORAGE_ACCESS_KEY;
        delete process.env.BUNNY_ACCESS_KEY;
        delete process.env.STORAGE_ACCESS_KEY;
        delete process.env.BUNNY_STORAGE_REGION;
        delete process.env.STORAGE_REGION;
    });

    describe("construction", () => {
        it("rejects when credentials are missing", () => {
            expect.assertions(1);

            expect(() => new BunnyStorage({ ...(storageOptions as BunnyStorageOptions) })).toThrow(/missing credentials/);
        });

        it("rejects unsupported regions", () => {
            expect.assertions(1);

            expect(
                () =>
                    new BunnyStorage({
                        ...(storageOptions as BunnyStorageOptions),
                        accessKey: "k",
                        region: "atlantis" as never,
                        zone: "z",
                    }),
            ).toThrow(/unsupported region/);
        });

        it("falls back to BUNNY_STORAGE_* env vars", () => {
            expect.assertions(2);

            process.env.BUNNY_STORAGE_ZONE = "env-zone";
            process.env.BUNNY_STORAGE_ACCESS_KEY = "env-key";
            process.env.BUNNY_STORAGE_REGION = "ny";

            const storage = new BunnyStorage({ ...(storageOptions as BunnyStorageOptions) });

            expect(zoneMock.connect_with_accesskey).toHaveBeenCalledWith("ny", "env-zone", "env-key");
            expect(storage.zone).toBe("test-zone");
        });

        it("falls back to STORAGE_* SDK env aliases", () => {
            expect.assertions(2);

            process.env.STORAGE_ZONE = "alias-zone";
            process.env.STORAGE_ACCESS_KEY = "alias-key";
            process.env.STORAGE_REGION = "syd";

            const storage = new BunnyStorage({ ...(storageOptions as BunnyStorageOptions) });

            expect(storage.zone).toBe("test-zone");
            expect(zoneMock.connect_with_accesskey).toHaveBeenCalledWith("syd", "alias-zone", "alias-key");
        });

        it("uses a pre-built client when supplied", () => {
            expect.assertions(2);

            const client = { _tag: "StorageZone", accessKey: "x", name: "pre", region: "de" } as never;
            const storage = new BunnyStorage({
                ...(storageOptions as BunnyStorageOptions),
                client,
            });

            expect(zoneMock.connect_with_accesskey).not.toHaveBeenCalled();
            expect(storage.raw).toBe(client);
        });
    });

    describe(".delete()", () => {
        it("calls remove with the resolved Bunny path", async () => {
            expect.assertions(2);

            const storage = new BunnyStorage(baseOptions);

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new Error("not found"));

            fileMock.remove.mockResolvedValueOnce(true);

            const result = await storage.delete({ id: "user/file.mp4" });

            expect(fileMock.remove).toHaveBeenCalledWith(expect.anything(), "/user/file.mp4");
            expect(result.status).toBe("deleted");
        });

        it("treats a falsy SDK response as a best-effort delete (Bunny's remove returns boolean, never throws on 404)", async () => {
            expect.assertions(2);

            const storage = new BunnyStorage(baseOptions);

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new Error("not found"));

            // Real SDK: `(await fetch(...)).ok` — returns `false` for any non-2xx
            // (incl. 404). We rely on idempotent delete: missing key = success.
            fileMock.remove.mockResolvedValueOnce(false);

            const result = await storage.delete({ id: "user/file.mp4" });

            expect(fileMock.remove).toHaveBeenCalledWith(expect.anything(), "/user/file.mp4");
            expect(result.status).toBe("deleted");
        });

        it("wraps network errors thrown by remove() via wrapBunnyError", async () => {
            expect.assertions(1);

            const storage = new BunnyStorage(baseOptions);

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new Error("not found"));

            fileMock.remove.mockRejectedValueOnce(new TypeError("fetch failed"));

            await expect(storage.delete({ id: "user/file.mp4" })).rejects.toMatchObject({
                name: "UploadError",
            });
        });
    });

    describe(".get()", () => {
        it("returns the entry buffer with normalized metadata", async () => {
            expect.assertions(3);

            const storage = new BunnyStorage(baseOptions);

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new Error("not found"));

            fileMock.get.mockResolvedValueOnce(makeStorageFile());

            const result = await storage.get({ id: "user/file.bin" });

            expect(fileMock.get).toHaveBeenCalledWith(expect.anything(), "/user/file.bin");
            expect(result.content.toString()).toBe("payload");
            expect(result.contentType).toBe("application/octet-stream");
        });

        it("wraps the SDK's 'File not found' Error into UploadError with FILE_NOT_FOUND", async () => {
            expect.assertions(2);

            const storage = new BunnyStorage(baseOptions);

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new Error("not found"));

            // The real SDK throws a plain `Error` whose message is
            // `File not found: ${path}` with NO status/statusCode field.
            // Bunny's `wrapBunnyError` must infer the status from the message.
            fileMock.get.mockRejectedValueOnce(new Error("File not found: /missing"));

            await expect(storage.get({ id: "missing" })).rejects.toMatchObject({
                name: "UploadError",
                UploadErrorCode: ERRORS.FILE_NOT_FOUND,
            });

            expect(fileMock.get).toHaveBeenCalledWith(expect.anything(), "/missing");
        });

        it("wraps the SDK's 'Unauthorized access' Error into UploadError with FORBIDDEN", async () => {
            expect.assertions(1);

            const storage = new BunnyStorage(baseOptions);

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new Error("not found"));

            fileMock.get.mockRejectedValueOnce(new Error("Unauthorized access to storage zone: test-zone"));

            await expect(storage.get({ id: "secret" })).rejects.toMatchObject({
                name: "UploadError",
                UploadErrorCode: ERRORS.FORBIDDEN,
            });
        });

        // Regression guard for the SDK's default branch (5xx and similar).
        // If a future @bunny.net/storage-sdk release changes this message, the
        // status inference in `wrapBunnyError` would silently fall through —
        // this test pins the fallback so an upgrade fails loud here first.
        it("falls back to STORAGE_ERROR for the SDK's generic 'unknown error' message", async () => {
            expect.assertions(1);

            const storage = new BunnyStorage(baseOptions);

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new Error("not found"));

            fileMock.get.mockRejectedValueOnce(new Error("An unknown error has occurred during the request."));

            await expect(storage.get({ id: "anything" })).rejects.toMatchObject({
                name: "UploadError",
                UploadErrorCode: ERRORS.STORAGE_ERROR,
            });
        });
    });

    // Regression guard locking the four SDK error formats produced by the
    // internal `u()` helper in @bunny.net/storage-sdk@0.3.1 (esm-node/lib.mjs).
    // If a future release renames these, the regex inference in
    // `wrapBunnyError` would silently fall through to STORAGE_ERROR — this
    // suite traps that drift at the test layer.
    describe("sdk error format regression guard (pin @bunny.net/storage-sdk@0.3.1)", () => {
        it("maps 'Unable to upload file. ...' (400) to BAD_REQUEST on upload (via copy)", async () => {
            expect.assertions(1);

            const storage = new BunnyStorage(baseOptions);

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new Error("not found"));

            fileMock.get.mockResolvedValueOnce(makeStorageFile());
            fileMock.upload.mockRejectedValueOnce(new Error("Unable to upload file. Either invalid path specified, either provided checksum invalid"));

            await expect(storage.copy("user/src.bin", "user/dst.bin")).rejects.toMatchObject({
                UploadErrorCode: ERRORS.BAD_REQUEST,
            });
        });

        it("preserves the original SDK Error in UploadError.detail (so callers can inspect the SDK message)", async () => {
            expect.assertions(2);

            const storage = new BunnyStorage(baseOptions);

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new Error("not found"));

            const sdkError = new Error("File not found: /missing");

            fileMock.get.mockRejectedValueOnce(sdkError);

            try {
                await storage.get({ id: "missing" });
            } catch (error) {
                expect((error as { UploadErrorCode: string }).UploadErrorCode).toBe(ERRORS.FILE_NOT_FOUND);
                expect((error as { detail?: unknown }).detail).toBe(sdkError);
            }
        });
    });

    describe(".list()", () => {
        // Bunny's `GET /{zone}/{path}/` is NON-recursive — it returns only the
        // immediate children of a single directory. The SDK call sent by
        // `BunnyStorage.list()` is `file.list(client, "/")`, so the mock
        // models the response shape of "root of the zone": files at the root
        // and directory entries (which would have to be fetched separately to
        // descend into them). The adapter is expected to filter directories
        // out and surface only files — without trying to descend.
        it("filters directories and returns only top-level files", async () => {
            expect.assertions(4);

            const storage = new BunnyStorage(baseOptions);

            fileMock.list.mockResolvedValueOnce([
                makeStorageFile({ isDirectory: true, length: 0, objectName: "subdir", path: "/zone/" }),
                makeStorageFile({ objectName: "a.bin", path: "/zone/" }),
                makeStorageFile({ checksum: null, objectName: "b.bin", path: "/zone/" }),
            ]);

            const items = await storage.list();

            expect(fileMock.list).toHaveBeenCalledWith(expect.anything(), "/");
            expect(items).toHaveLength(2);
            expect(items.map((f) => f.name)).toStrictEqual(["zone/a.bin", "zone/b.bin"]);
            expect(items.some((f) => f.name?.includes("subdir"))).toBe(false);
        });

        it("does NOT descend into subdirectories (Bunny list is non-recursive)", async () => {
            expect.assertions(2);

            const storage = new BunnyStorage(baseOptions);

            // Real Bunny would only return immediate children of "/". The
            // adapter must therefore never expose nested entries from a
            // single `list("/")` call — even if a misbehaving mock supplied
            // them. We verify the adapter doesn't issue follow-up requests
            // and reports exactly what the SDK gave back.
            fileMock.list.mockResolvedValueOnce([
                makeStorageFile({ isDirectory: true, length: 0, objectName: "nested", path: "/zone/" }),
                makeStorageFile({ objectName: "top.bin", path: "/zone/" }),
            ]);

            const items = await storage.list();

            expect(fileMock.list).toHaveBeenCalledTimes(1);
            expect(items.map((f) => f.name)).toStrictEqual(["zone/top.bin"]);
        });

        it("respects the limit", async () => {
            expect.assertions(1);

            const storage = new BunnyStorage(baseOptions);

            fileMock.list.mockResolvedValueOnce([
                makeStorageFile({ objectName: "a.bin", path: "/zone/" }),
                makeStorageFile({ objectName: "b.bin", path: "/zone/" }),
                makeStorageFile({ objectName: "c.bin", path: "/zone/" }),
            ]);

            const items = await storage.list(2);

            expect(items).toHaveLength(2);
        });
    });

    describe(".getReadUrl()", () => {
        it("requires publicBaseUrl", async () => {
            expect.assertions(1);

            const storage = new BunnyStorage(baseOptions);

            await expect(storage.getReadUrl("user/file.bin")).rejects.toThrow(/requires `publicBaseUrl`/);
        });

        it("rejects responseContentDisposition", async () => {
            expect.assertions(1);

            const storage = new BunnyStorage({
                ...baseOptions,
                publicBaseUrl: "https://cdn.example.com",
            });

            await expect(storage.getReadUrl("user/file.bin", { responseContentDisposition: "attachment" })).rejects.toThrow(
                /responseContentDisposition.*not supported/,
            );
        });

        it("returns a joined Pull Zone URL when publicBaseUrl is set", async () => {
            expect.assertions(1);

            const storage = new BunnyStorage({
                ...baseOptions,
                publicBaseUrl: "https://cdn.example.com/",
            });

            await expect(storage.getReadUrl("user/file.bin")).resolves.toBe("https://cdn.example.com/user/file.bin");
        });
    });

    describe(".getUploadUrl()", () => {
        it("throws METHOD_NOT_ALLOWED (no presigned PUT primitive)", async () => {
            expect.assertions(1);

            const storage = new BunnyStorage(baseOptions);

            await expect(storage.getUploadUrl("user/file.bin")).rejects.toThrow(/presigned PUT URLs are not supported/);
        });
    });

    describe(".copy()", () => {
        it("does a download + reupload roundtrip", async () => {
            expect.assertions(3);

            const storage = new BunnyStorage(baseOptions);

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new Error("not found"));

            fileMock.get.mockResolvedValueOnce(makeStorageFile());
            fileMock.upload.mockResolvedValueOnce(true);

            const file = await storage.copy("user/source.bin", "user/dest.bin");

            expect(file.name).toBe("user/dest.bin");
            expect(fileMock.upload).toHaveBeenCalledTimes(1);
            expect(fileMock.upload.mock.calls[0]?.[1]).toBe("/user/dest.bin");
        });
    });
});
