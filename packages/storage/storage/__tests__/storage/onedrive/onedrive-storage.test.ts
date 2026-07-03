import { beforeEach, describe, expect, it, vi } from "vitest";

import OneDriveStorage from "../../../src/storage/onedrive/onedrive-storage";
import type { OneDriveStorageOptions } from "../../../src/storage/onedrive/types";
import { ERRORS, isUploadError } from "../../../src/utils/errors";
import { storageOptions } from "../../__helpers__/config";

interface ApiCall {
    delete: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    responseType: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    url: string;
}

const apiCalls: ApiCall[] = [];

const makeApi = (url: string): ApiCall => {
    const call: ApiCall = {
        delete: vi.fn().mockResolvedValue(undefined),
        get: vi.fn().mockResolvedValue({}),
        patch: vi.fn().mockResolvedValue({}),
        post: vi.fn().mockResolvedValue({}),
        put: vi.fn().mockResolvedValue({}),
        responseType: vi.fn(),
        select: vi.fn(),
        url,
    };

    call.responseType.mockReturnValue(call);
    call.select.mockReturnValue(call);

    return call;
};

const mockClient = {
    api: vi.fn((url: string) => {
        const call = makeApi(url);

        apiCalls.push(call);

        return call;
    }),
};

vi.mock(import("@microsoft/microsoft-graph-client"), () => {
    const GraphError = class extends Error {
        public statusCode?: number;

        public code?: string;
    };

    return {
        Client: {
            initWithMiddleware: vi.fn(() => mockClient),
        },
        GraphError,
        ResponseType: { ARRAYBUFFER: "arraybuffer", RAW: "raw", TEXT: "text" },
    };
});

describe(OneDriveStorage, () => {
    beforeEach(() => {
        apiCalls.length = 0;
        mockClient.api.mockClear();

        delete process.env.ONEDRIVE_ACCESS_TOKEN;
        delete process.env.ONEDRIVE_CLIENT_ID;
        delete process.env.ONEDRIVE_CLIENT_SECRET;
        delete process.env.ONEDRIVE_TENANT_ID;
        delete process.env.ONEDRIVE_REFRESH_TOKEN;
    });

    describe("constructor & targeting", () => {
        it("rejects more than one of driveId / siteId / userId", () => {
            expect.assertions(1);

            expect(
                () =>
                    new OneDriveStorage({
                        ...(storageOptions as OneDriveStorageOptions),
                        accessToken: "tok",
                        driveId: "d",
                        siteId: "s",
                    }),
            ).toThrow(/at most one of `driveId`, `siteId`, or `userId`/);
        });

        it("rejects clientCredentials without an explicit target", () => {
            expect.assertions(1);

            expect(
                () =>
                    new OneDriveStorage({
                        ...(storageOptions as OneDriveStorageOptions),
                        clientCredentials: { clientId: "id", clientSecret: "s", tenantId: "t" },
                    }),
            ).toThrow(/clientCredentials.*requires.*driveId.*siteId.*userId/);
        });

        it("rejects more than one auth option", () => {
            expect.assertions(1);

            expect(
                () =>
                    new OneDriveStorage({
                        ...(storageOptions as OneDriveStorageOptions),
                        accessToken: "tok",
                        oauth: { clientId: "id", refreshToken: "rt" },
                    }),
            ).toThrow(/exactly one of `accessToken`, `clientCredentials`, or `oauth`/);
        });

        it("rejects when no auth source is configured", () => {
            expect.assertions(1);

            expect(
                () =>
                    new OneDriveStorage({
                        ...(storageOptions as OneDriveStorageOptions),
                    }),
            ).toThrow(/missing auth/);
        });

        it("accepts a pre-built client without any other auth", () => {
            expect.assertions(1);

            const storage = new OneDriveStorage({
                ...(storageOptions as OneDriveStorageOptions),
                client: mockClient as unknown as OneDriveStorageOptions["client"],
            });

            expect(storage.raw).toBe(mockClient);
        });

        it("falls back to ONEDRIVE_ACCESS_TOKEN env var", () => {
            expect.assertions(1);

            process.env.ONEDRIVE_ACCESS_TOKEN = "env-tok";

            const storage = new OneDriveStorage({
                ...(storageOptions as OneDriveStorageOptions),
            });

            expect(storage.raw).toBe(mockClient);
        });
    });

    describe("path traversal guards", () => {
        it("rejects a rootFolderPath containing .. segments at construction", () => {
            expect.assertions(1);

            expect(
                () =>
                    new OneDriveStorage({
                        ...(storageOptions as OneDriveStorageOptions),
                        accessToken: "tok",
                        rootFolderPath: "../escape",
                    }),
            ).toThrow(/path segments/);
        });

        it("rejects a key containing .. segments before building the Graph item URL", async () => {
            expect.assertions(1);

            const storage = new OneDriveStorage({
                ...(storageOptions as OneDriveStorageOptions),
                accessToken: "tok",
            });

            await expect(storage.getUploadUrl("../../other/file.mp4")).rejects.toThrow(/path segments/);
        });
    });

    describe(".delete()", () => {
        it("uses bare path without trailing colon for non-root items", async () => {
            expect.assertions(2);

            const storage = new OneDriveStorage({
                ...(storageOptions as OneDriveStorageOptions),
                accessToken: "tok",
            });

            // delete looks up meta first (will fail to find), then deletes by id
            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new Error("not found"));

            await storage.delete({ id: "folder/sub/file.mp4" });

            const deleteCall = apiCalls.find((c) => c.delete.mock.calls.length > 0);

            expect(deleteCall).toBeDefined();
            // Bare path: no trailing colon, action separator only used for actions
            expect(deleteCall?.url).toBe("/me/drive/root:/folder/sub/file.mp4");
        });

        it("targets /drives/{driveId} when driveId is configured", async () => {
            expect.assertions(1);

            const storage = new OneDriveStorage({
                ...(storageOptions as OneDriveStorageOptions),
                accessToken: "tok",
                driveId: "drive-xyz",
            });

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new Error("not found"));

            await storage.delete({ id: "file.mp4" });

            const deleteCall = apiCalls.find((c) => c.delete.mock.calls.length > 0);

            expect(deleteCall?.url).toBe("/drives/drive-xyz/root:/file.mp4");
        });

        it("encodes path segments individually so slashes survive", async () => {
            expect.assertions(1);

            const storage = new OneDriveStorage({
                ...(storageOptions as OneDriveStorageOptions),
                accessToken: "tok",
            });

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new Error("not found"));

            await storage.delete({ id: "foo bar/baz qux.mp4" });

            const deleteCall = apiCalls.find((c) => c.delete.mock.calls.length > 0);

            expect(deleteCall?.url).toBe("/me/drive/root:/foo%20bar/baz%20qux.mp4");
        });

        it("swallows 404 from Graph without throwing", async () => {
            expect.assertions(1);

            const storage = new OneDriveStorage({
                ...(storageOptions as OneDriveStorageOptions),
                accessToken: "tok",
            });

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new Error("not found"));

            mockClient.api.mockImplementationOnce((url: string) => {
                const call = makeApi(url);

                call.delete.mockRejectedValue(Object.assign(new Error("not found"), { statusCode: 404 }));

                apiCalls.push(call);

                return call;
            });

            await expect(storage.delete({ id: "missing.mp4" })).resolves.toMatchObject({ status: "deleted" });
        });
    });

    describe(".copy()", () => {
        it("uses /drive/root: prefix for parentReference.path regardless of basePath", async () => {
            expect.assertions(3);

            const storage = new OneDriveStorage({
                ...(storageOptions as OneDriveStorageOptions),
                accessToken: "tok",
                driveId: "drive-xyz",
            });

            // First api() call is for /copy POST — returns 202 with Location header.
            mockClient.api.mockImplementationOnce((url: string) => {
                const call = makeApi(url);

                call.post.mockResolvedValue({
                    headers: new Headers({ Location: "https://graph.microsoft.com/v1.0/monitor" }),
                    status: 202,
                    statusText: "Accepted",
                });

                apiCalls.push(call);

                return call;
            });

            const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
                headers: new Headers(),
                json: async () => {
                    return { resourceId: "01ITEM", status: "completed" };
                },
                ok: true,
                status: 200,
            } as Response);

            const result = await storage.copy("src/file.mp4", "dst/folder/file.mp4");

            const copyCall = apiCalls[0]!;

            expect(copyCall.url).toBe("/drives/drive-xyz/root:/src/file.mp4:/copy");
            expect(copyCall.post).toHaveBeenCalledWith({
                name: "file.mp4",
                parentReference: { path: "/drive/root:/dst/folder" },
            });
            expect(result.driveItemId).toBe("01ITEM");

            fetchSpy.mockRestore();
        });

        it("throws when copy response lacks Location header", async () => {
            expect.assertions(1);

            const storage = new OneDriveStorage({
                ...(storageOptions as OneDriveStorageOptions),
                accessToken: "tok",
            });

            mockClient.api.mockImplementationOnce((url: string) => {
                const call = makeApi(url);

                call.post.mockResolvedValue({
                    headers: new Headers(),
                    status: 202,
                    statusText: "Accepted",
                });

                apiCalls.push(call);

                return call;
            });

            await expect(storage.copy("src.mp4", "dst.mp4")).rejects.toThrow(/missing Location/);
        });

        it("throws when copy POST returns non-202", async () => {
            expect.assertions(3);

            const storage = new OneDriveStorage({
                ...(storageOptions as OneDriveStorageOptions),
                accessToken: "tok",
            });

            mockClient.api.mockImplementationOnce((url: string) => {
                const call = makeApi(url);

                call.post.mockResolvedValue({
                    headers: new Headers(),
                    status: 500,
                    statusText: "Server Error",
                    text: async () => "boom",
                });

                apiCalls.push(call);

                return call;
            });

            const error = await storage.copy("src.mp4", "dst.mp4").catch((error_: unknown) => error_);

            expect(isUploadError(error)).toBe(true);
            expect((error as { UploadErrorCode: ERRORS }).UploadErrorCode).toBe(ERRORS.STORAGE_ERROR);
            expect((error as Error).message).toMatch(/OneDrive: copy failed — boom/);
        });
    });

    describe(".move()", () => {
        it("patches with parentReference.path prefixed by /drive/root:", async () => {
            expect.assertions(2);

            const storage = new OneDriveStorage({
                ...(storageOptions as OneDriveStorageOptions),
                accessToken: "tok",
            });

            mockClient.api.mockImplementationOnce((url: string) => {
                const call = makeApi(url);

                call.patch.mockResolvedValue({ id: "01ITEM", name: "file.mp4" });

                apiCalls.push(call);

                return call;
            });

            await storage.move("src.mp4", "dst/folder/file.mp4");

            const patchCall = apiCalls[0]!;

            expect(patchCall.url).toBe("/me/drive/root:/src.mp4");
            expect(patchCall.patch).toHaveBeenCalledWith({
                name: "file.mp4",
                parentReference: { path: "/drive/root:/dst/folder" },
            });
        });
    });

    describe(".getReadUrl()", () => {
        it("creates an anonymous link when publicByDefault is true", async () => {
            expect.assertions(2);

            const storage = new OneDriveStorage({
                ...(storageOptions as OneDriveStorageOptions),
                accessToken: "tok",
                publicByDefault: true,
            });

            mockClient.api.mockImplementationOnce((url: string) => {
                const call = makeApi(url);

                call.post.mockResolvedValue({ link: { webUrl: "https://share.example/abc" } });

                apiCalls.push(call);

                return call;
            });

            const url = await storage.getReadUrl("path/file.mp4");

            expect(apiCalls[0]!.url).toBe("/me/drive/root:/path/file.mp4:/createLink");
            expect(url).toBe("https://share.example/abc");
        });

        it("returns the short-lived downloadUrl when publicByDefault is false", async () => {
            expect.assertions(2);

            const storage = new OneDriveStorage({
                ...(storageOptions as OneDriveStorageOptions),
                accessToken: "tok",
            });

            mockClient.api.mockImplementationOnce((url: string) => {
                const call = makeApi(url);

                call.get.mockResolvedValue({ "@microsoft.graph.downloadUrl": "https://dl.example/x" });

                apiCalls.push(call);

                return call;
            });

            const url = await storage.getReadUrl("file.mp4");

            expect(apiCalls[0]!.url).toBe("/me/drive/root:/file.mp4");
            expect(url).toBe("https://dl.example/x");
        });

        it("rejects responseContentDisposition / responseContentType", async () => {
            expect.assertions(1);

            const storage = new OneDriveStorage({
                ...(storageOptions as OneDriveStorageOptions),
                accessToken: "tok",
            });

            await expect(storage.getReadUrl("file.mp4", { responseContentDisposition: "attachment" })).rejects.toThrow(
                /responseContentDisposition.*not supported/,
            );
        });
    });

    describe(".getUploadUrl()", () => {
        it("creates an upload session and returns its uploadUrl", async () => {
            expect.assertions(2);

            const storage = new OneDriveStorage({
                ...(storageOptions as OneDriveStorageOptions),
                accessToken: "tok",
            });

            mockClient.api.mockImplementationOnce((url: string) => {
                const call = makeApi(url);

                call.post.mockResolvedValue({ uploadUrl: "https://upload.example/session" });

                apiCalls.push(call);

                return call;
            });

            const url = await storage.getUploadUrl("path/file.mp4");

            expect(apiCalls[0]!.url).toBe("/me/drive/root:/path/file.mp4:/createUploadSession");
            expect(url).toBe("https://upload.example/session");
        });
    });
});
