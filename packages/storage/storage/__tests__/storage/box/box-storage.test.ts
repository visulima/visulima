/* eslint-disable max-classes-per-file, @typescript-eslint/no-extraneous-class, no-constructor-return, sonarjs/public-static-readonly -- mock SDK classes for vendor library shape */
import { beforeEach, describe, expect, it, vi } from "vitest";

import BoxStorage from "../../../src/storage/box/box-storage";
import type { BoxStorageOptions } from "../../../src/storage/box/types";
import { storageOptions } from "../../__helpers__/config";

const makeMockClient = () => {
    return {
        chunkedUploads: {
            uploadBigFile: vi.fn(),
        },
        downloads: {
            getDownloadFileUrl: vi.fn(),
        },
        files: {
            copyFile: vi.fn(),
            deleteFileById: vi.fn(),
            getFileById: vi.fn(),
            updateFileById: vi.fn(),
        },
        folders: {
            createFolder: vi.fn(),
            getFolderItems: vi.fn(),
        },
        sharedLinksFiles: {
            addShareLinkToFile: vi.fn(),
            getSharedLinkForFile: vi.fn(),
        },
        uploads: {
            uploadFile: vi.fn(),
            uploadFileVersion: vi.fn(),
        },
    };
};

let mockClient: ReturnType<typeof makeMockClient>;
const constructorCalls: { args: unknown[]; auth: string }[] = [];

vi.mock(import("box-typescript-sdk-gen"), () => {
    const recordConstructor = (auth: string) =>
        class {
            public constructor(...args: unknown[]) {
                constructorCalls.push({ args, auth });
            }
        };

    return {
        BoxCcgAuth: recordConstructor("ccg"),
        BoxClient: class {
            public constructor() {
                Object.assign(this, mockClient);

                return mockClient;
            }
        },
        BoxDeveloperTokenAuth: recordConstructor("developer"),
        BoxJwtAuth: recordConstructor("jwt"),
        BoxOAuth: class {
            public tokenStorage = { store: vi.fn().mockResolvedValue(undefined) };

            public constructor(...args: unknown[]) {
                constructorCalls.push({ args, auth: "oauth" });
            }
        },
        CcgConfig: class {
            public constructor(...args: unknown[]) {
                constructorCalls.push({ args, auth: "ccgConfig" });
            }
        },
        JwtConfig: class {
            public static fromConfigFile = vi.fn(() => {
                return {};
            });

            public static fromConfigJsonString = vi.fn(() => {
                return {};
            });
        },
        OAuthConfig: class {
            public constructor(...args: unknown[]) {
                constructorCalls.push({ args, auth: "oauthConfig" });
            }
        },
    };
});

describe(BoxStorage, () => {
    beforeEach(() => {
        constructorCalls.length = 0;
        mockClient = makeMockClient();

        delete process.env.BOX_DEVELOPER_TOKEN;
    });

    describe("auth resolution", () => {
        it("rejects more than one auth method", () => {
            expect.assertions(1);

            expect(
                () =>
                    new BoxStorage({
                        ...(storageOptions as BoxStorageOptions),
                        developerToken: "dev",
                        oauth: { clientId: "c", clientSecret: "s", refreshToken: "r" },
                    }),
            ).toThrow(/exactly one of `developerToken`, `oauth`, `ccg`, or `jwt`/);
        });

        it("rejects ccg without enterpriseId or userId", () => {
            expect.assertions(1);

            expect(
                () =>
                    new BoxStorage({
                        ...(storageOptions as BoxStorageOptions),
                        ccg: { clientId: "c", clientSecret: "s" },
                    }),
            ).toThrow(/ccg.*requires.*enterpriseId.*userId/);
        });

        it("rejects when no auth source is configured", () => {
            expect.assertions(1);

            expect(
                () =>
                    new BoxStorage({
                        ...(storageOptions as BoxStorageOptions),
                    }),
            ).toThrow(/missing auth/);
        });

        it("accepts a pre-built client without any other auth", () => {
            expect.assertions(2);

            const storage = new BoxStorage({
                ...(storageOptions as BoxStorageOptions),
                client: mockClient as unknown as BoxStorageOptions["client"],
            });

            expect(storage.raw).toBe(mockClient);
            expect(constructorCalls).toHaveLength(0);
        });

        it("falls back to BOX_DEVELOPER_TOKEN env var", () => {
            expect.assertions(1);

            process.env.BOX_DEVELOPER_TOKEN = "env-tok";

            const storage = new BoxStorage({
                ...(storageOptions as BoxStorageOptions),
            });

            expect(storage.raw).toBeDefined();
        });

        it("constructs BoxDeveloperTokenAuth from `developerToken`", () => {
            expect.assertions(1);

            void new BoxStorage({
                ...(storageOptions as BoxStorageOptions),
                developerToken: "tok",
            });

            expect(constructorCalls).toContainEqual({ args: [{ token: "tok" }], auth: "developer" });
        });
    });

    describe(".delete()", () => {
        it("calls deleteFileById with the resolved file id", async () => {
            expect.assertions(2);

            const storage = new BoxStorage({
                ...(storageOptions as BoxStorageOptions),
                developerToken: "tok",
            });

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new Error("not found"));

            mockClient.folders.getFolderItems.mockResolvedValueOnce({
                entries: [{ id: "FID", name: "file.mp4", type: "file" }],
            });

            const result = await storage.delete({ id: "file.mp4" });

            expect(mockClient.files.deleteFileById).toHaveBeenCalledWith("FID");
            expect(result.status).toBe("deleted");
        });

        it("swallows Box 404 from deleteFileById without throwing", async () => {
            expect.assertions(1);

            const storage = new BoxStorage({
                ...(storageOptions as BoxStorageOptions),
                developerToken: "tok",
            });

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new Error("not found"));

            mockClient.folders.getFolderItems.mockResolvedValueOnce({
                entries: [{ id: "FID", name: "file.mp4", type: "file" }],
            });
            mockClient.files.deleteFileById.mockRejectedValueOnce({
                responseInfo: { body: { code: "not_found" }, statusCode: 404 },
            });

            await expect(storage.delete({ id: "file.mp4" })).resolves.toMatchObject({ status: "deleted" });
        });
    });

    describe(".copy()", () => {
        it("resolves source + dest folder and calls copyFile with proper body", async () => {
            expect.assertions(3);

            const storage = new BoxStorage({
                ...(storageOptions as BoxStorageOptions),
                developerToken: "tok",
            });

            // resolveFileId: find source
            mockClient.folders.getFolderItems
                .mockResolvedValueOnce({ entries: [{ id: "SRCID", name: "src.mp4", type: "file" }] })
                // resolveFolderId: walk "dst" — not found, then create
                .mockResolvedValueOnce({ entries: [] });

            mockClient.folders.createFolder.mockResolvedValueOnce({ id: "DSTFOLDER" });
            mockClient.files.copyFile.mockResolvedValueOnce({ etag: "1", id: "NEWID" });

            const result = await storage.copy("src.mp4", "dst/copy.mp4");

            expect(mockClient.files.copyFile).toHaveBeenCalledWith("SRCID", {
                name: "copy.mp4",
                parent: { id: "DSTFOLDER" },
            });
            expect(result.boxFileId).toBe("NEWID");
            expect(result.eTag).toBe("1");
        });
    });

    describe(".move()", () => {
        it("wraps updateFileById body in `requestBody`", async () => {
            expect.assertions(2);

            const storage = new BoxStorage({
                ...(storageOptions as BoxStorageOptions),
                developerToken: "tok",
            });

            mockClient.folders.getFolderItems
                .mockResolvedValueOnce({ entries: [{ id: "SRCID", name: "src.mp4", type: "file" }] })
                .mockResolvedValueOnce({ entries: [{ id: "DSTFOLDER", name: "dst", type: "folder" }] });

            mockClient.files.updateFileById.mockResolvedValueOnce({ etag: "2", id: "MOVEDID" });

            const result = await storage.move("src.mp4", "dst/moved.mp4");

            expect(mockClient.files.updateFileById).toHaveBeenCalledWith("SRCID", {
                requestBody: { name: "moved.mp4", parent: { id: "DSTFOLDER" } },
            });
            expect(result.boxFileId).toBe("MOVEDID");
        });
    });

    describe(".getReadUrl()", () => {
        it("creates a shared link when publicByDefault is true", async () => {
            expect.assertions(2);

            const storage = new BoxStorage({
                ...(storageOptions as BoxStorageOptions),
                developerToken: "tok",
                publicByDefault: true,
            });

            mockClient.folders.getFolderItems.mockResolvedValueOnce({
                entries: [{ id: "FID", name: "file.mp4", type: "file" }],
            });
            mockClient.sharedLinksFiles.addShareLinkToFile.mockResolvedValueOnce({
                sharedLink: { url: "https://app.box.com/s/share123" },
            });

            const url = await storage.getReadUrl("file.mp4");

            expect(mockClient.sharedLinksFiles.addShareLinkToFile).toHaveBeenCalledWith("FID", { sharedLink: { access: "open" } }, { fields: "shared_link" });
            expect(url).toBe("https://app.box.com/s/share123");
        });

        it("falls back to getSharedLinkForFile on conflict", async () => {
            expect.assertions(2);

            const storage = new BoxStorage({
                ...(storageOptions as BoxStorageOptions),
                developerToken: "tok",
                publicByDefault: true,
            });

            mockClient.folders.getFolderItems.mockResolvedValueOnce({
                entries: [{ id: "FID", name: "file.mp4", type: "file" }],
            });

            const conflictError = { responseInfo: { body: { code: "item_name_in_use" }, statusCode: 409 } };

            mockClient.sharedLinksFiles.addShareLinkToFile.mockRejectedValueOnce(conflictError);
            mockClient.sharedLinksFiles.getSharedLinkForFile.mockResolvedValueOnce({
                sharedLink: { url: "https://app.box.com/s/existing" },
            });

            const url = await storage.getReadUrl("file.mp4");

            expect(mockClient.sharedLinksFiles.getSharedLinkForFile).toHaveBeenCalledWith("FID", { fields: "shared_link" });
            expect(url).toBe("https://app.box.com/s/existing");
        });

        it("returns the short-lived download URL when publicByDefault is false", async () => {
            expect.assertions(2);

            const storage = new BoxStorage({
                ...(storageOptions as BoxStorageOptions),
                developerToken: "tok",
            });

            mockClient.folders.getFolderItems.mockResolvedValueOnce({
                entries: [{ id: "FID", name: "file.mp4", type: "file" }],
            });
            mockClient.downloads.getDownloadFileUrl.mockResolvedValueOnce("https://dl.box/x");

            const url = await storage.getReadUrl("file.mp4");

            expect(mockClient.downloads.getDownloadFileUrl).toHaveBeenCalledWith("FID");
            expect(url).toBe("https://dl.box/x");
        });

        it("rejects responseContentDisposition / responseContentType", async () => {
            expect.assertions(1);

            const storage = new BoxStorage({
                ...(storageOptions as BoxStorageOptions),
                developerToken: "tok",
            });

            await expect(storage.getReadUrl("file.mp4", { responseContentType: "video/mp4" })).rejects.toThrow(
                /responseContentDisposition.*responseContentType.*not supported/,
            );
        });
    });

    describe(".getUploadUrl()", () => {
        it("throws METHOD_NOT_ALLOWED", async () => {
            expect.assertions(1);

            const storage = new BoxStorage({
                ...(storageOptions as BoxStorageOptions),
                developerToken: "tok",
            });

            await expect(storage.getUploadUrl("file.mp4")).rejects.toThrow(/getUploadUrl.*not supported/);
        });
    });
});
