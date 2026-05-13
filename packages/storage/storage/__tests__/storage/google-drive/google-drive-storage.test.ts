/* eslint-disable max-classes-per-file, @typescript-eslint/no-useless-constructor, class-methods-use-this -- mock SDK classes for vendor library shape */
import { beforeEach, describe, expect, it, vi } from "vitest";

import GoogleDriveStorage from "../../../src/storage/google-drive/google-drive-storage";
import type { GoogleDriveStorageOptions } from "../../../src/storage/google-drive/types";
import { storageOptions } from "../../__helpers__/config";

const makeMockDrive = () => { return {
    files: {
        copy: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
        get: vi.fn(),
        list: vi.fn(),
    },
    permissions: {
        create: vi.fn(),
    },
}; };

let mockDrive: ReturnType<typeof makeMockDrive>;

vi.mock(import("@googleapis/drive"), () => {
    return {
        drive: vi.fn(() => mockDrive),
    };
});

vi.mock(import("google-auth-library"), () => {
    return {
        GoogleAuth: class {
            public constructor() {}

            public async getAccessToken(): Promise<string> {
                return "token-from-google-auth";
            }
        },
        JWT: class {
            public constructor() {}

            public async getAccessToken(): Promise<{ token: string }> {
                return { token: "token-from-jwt" };
            }
        },
        OAuth2Client: class {
            public constructor() {}

            public async getAccessToken(): Promise<{ token: string }> {
                return { token: "token-from-oauth" };
            }

            public setCredentials(): void {}
        },
    };
});

describe(GoogleDriveStorage, () => {
    beforeEach(() => {
        mockDrive = makeMockDrive();

        delete process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
        delete process.env.GOOGLE_DRIVE_PRIVATE_KEY;
        delete process.env.GOOGLE_DRIVE_KEY_FILE;
        delete process.env.GOOGLE_DRIVE_SUBJECT;
        delete process.env.GOOGLE_DRIVE_ID;
        delete process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
    });

    describe("auth resolution", () => {
        it("rejects when no auth source is configured", () => {
            expect.assertions(1);

            expect(
                () =>
                    new GoogleDriveStorage({
                        ...(storageOptions as GoogleDriveStorageOptions),
                    }),
            ).toThrow(/missing auth/);
        });

        it("accepts a pre-built client without any other auth", () => {
            expect.assertions(1);

            const storage = new GoogleDriveStorage({
                ...(storageOptions as GoogleDriveStorageOptions),
                client: mockDrive as unknown as GoogleDriveStorageOptions["client"],
            });

            expect(storage.raw).toBe(mockDrive);
        });

        it("accepts inline service-account credentials", () => {
            expect.assertions(1);

            const storage = new GoogleDriveStorage({
                ...(storageOptions as GoogleDriveStorageOptions),
                credentials: {
                    client_email: "svc@example.iam.gserviceaccount.com",
                    private_key: "-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----",
                },
            });

            expect(storage.raw).toBe(mockDrive);
        });

        it("accepts oauth refresh-token config", () => {
            expect.assertions(1);

            const storage = new GoogleDriveStorage({
                ...(storageOptions as GoogleDriveStorageOptions),
                oauth: { clientId: "cid", clientSecret: "csec", refreshToken: "rt" },
            });

            expect(storage.raw).toBe(mockDrive);
        });

        it("falls back to GOOGLE_DRIVE_CLIENT_EMAIL/PRIVATE_KEY env vars", () => {
            expect.assertions(1);

            process.env.GOOGLE_DRIVE_CLIENT_EMAIL = "svc@example.iam.gserviceaccount.com";
            process.env.GOOGLE_DRIVE_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----";

            const storage = new GoogleDriveStorage({
                ...(storageOptions as GoogleDriveStorageOptions),
            });

            expect(storage.raw).toBe(mockDrive);
        });
    });

    describe(".delete()", () => {
        it("resolves fileId via files.list when no cached entry, then calls files.delete", async () => {
            expect.assertions(2);

            const storage = new GoogleDriveStorage({
                ...(storageOptions as GoogleDriveStorageOptions),
                client: mockDrive as unknown as GoogleDriveStorageOptions["client"],
            });

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new Error("not found"));

            mockDrive.files.list.mockResolvedValueOnce({
                data: { files: [{ id: "file-1" }] },
            });
            mockDrive.files.delete.mockResolvedValueOnce({});

            await storage.delete({ id: "video.mp4" });

            expect(mockDrive.files.list).toHaveBeenCalledWith({
                fields: "files(id)",
                includeItemsFromAllDrives: true,
                pageSize: 2,
                q: "appProperties has { key='fsdkKey' and value='video.mp4' } and trashed=false",
                supportsAllDrives: true,
            });
            expect(mockDrive.files.delete).toHaveBeenCalledWith(expect.objectContaining({ fileId: "file-1" }));
        });

        it("swallows 404 from Drive", async () => {
            expect.assertions(1);

            const storage = new GoogleDriveStorage({
                ...(storageOptions as GoogleDriveStorageOptions),
                client: mockDrive as unknown as GoogleDriveStorageOptions["client"],
            });

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new Error("not found"));

            mockDrive.files.list.mockResolvedValueOnce({
                data: { files: [{ id: "file-1" }] },
            });
            mockDrive.files.delete.mockRejectedValueOnce(Object.assign(new Error("Not Found"), { code: 404 }));

            await expect(storage.delete({ id: "video.mp4" })).resolves.toMatchObject({ status: "deleted" });
        });
    });

    describe(".copy()", () => {
        it("resolves source by virtual key and copies into rootFolderId with appProperties", async () => {
            expect.assertions(2);

            const storage = new GoogleDriveStorage({
                ...(storageOptions as GoogleDriveStorageOptions),
                client: mockDrive as unknown as GoogleDriveStorageOptions["client"],
                rootFolderId: "folder-xyz",
            });

            mockDrive.files.list.mockResolvedValueOnce({
                data: { files: [{ id: "src-id" }] },
            });
            mockDrive.files.copy.mockResolvedValueOnce({
                data: { id: "dst-id", mimeType: "video/mp4", size: "1024" },
            });

            const result = await storage.copy("source.mp4", "dest/copy.mp4");

            expect(mockDrive.files.copy).toHaveBeenCalledWith(
                expect.objectContaining({
                    fileId: "src-id",
                    requestBody: expect.objectContaining({
                        appProperties: { fsdkKey: "dest/copy.mp4" },
                        name: "copy.mp4",
                        parents: ["folder-xyz"],
                    }),
                }),
            );
            expect(result.driveFileId).toBe("dst-id");
        });
    });

    describe(".getReadUrl()", () => {
        it("throws METHOD_NOT_ALLOWED when publicByDefault is false", async () => {
            expect.assertions(1);

            const storage = new GoogleDriveStorage({
                ...(storageOptions as GoogleDriveStorageOptions),
                client: mockDrive as unknown as GoogleDriveStorageOptions["client"],
            });

            await expect(storage.getReadUrl("file.mp4")).rejects.toThrow(/publicByDefault: true/);
        });

        it("rejects responseContentDisposition", async () => {
            expect.assertions(1);

            const storage = new GoogleDriveStorage({
                ...(storageOptions as GoogleDriveStorageOptions),
                client: mockDrive as unknown as GoogleDriveStorageOptions["client"],
                publicByDefault: true,
            });

            await expect(storage.getReadUrl("file.mp4", { responseContentDisposition: "attachment" })).rejects.toThrow(
                /responseContentDisposition.*not supported/,
            );
        });

        it("returns the Drive public download URL when publicByDefault is true", async () => {
            expect.assertions(1);

            const storage = new GoogleDriveStorage({
                ...(storageOptions as GoogleDriveStorageOptions),
                client: mockDrive as unknown as GoogleDriveStorageOptions["client"],
                publicByDefault: true,
            });

            mockDrive.files.list.mockResolvedValueOnce({
                data: { files: [{ id: "abc-123" }] },
            });

            const url = await storage.getReadUrl("file.mp4");

            expect(url).toBe("https://drive.google.com/uc?export=download&id=abc-123");
        });
    });

    describe(".getUploadUrl()", () => {
        it("throws when using a pre-built client (cannot mint token)", async () => {
            expect.assertions(1);

            const storage = new GoogleDriveStorage({
                ...(storageOptions as GoogleDriveStorageOptions),
                client: mockDrive as unknown as GoogleDriveStorageOptions["client"],
            });

            await expect(storage.getUploadUrl("file.mp4")).rejects.toThrow(/credentials.*keyFilename.*oauth/);
        });

        it("returns the session URL from the Location header", async () => {
            expect.assertions(2);

            const storage = new GoogleDriveStorage({
                ...(storageOptions as GoogleDriveStorageOptions),
                oauth: { clientId: "cid", clientSecret: "csec", refreshToken: "rt" },
            });

            const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
                headers: new Headers({ location: "https://upload.example/session/123" }),
                ok: true,
                status: 200,
            } as Response);

            const url = await storage.getUploadUrl("dir/file.mp4");

            expect(url).toBe("https://upload.example/session/123");
            expect(fetchSpy).toHaveBeenCalledWith(
                "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true",
                expect.objectContaining({ method: "POST" }),
            );

            fetchSpy.mockRestore();
        });

        it("throws when the resumable session response is missing Location", async () => {
            expect.assertions(1);

            const storage = new GoogleDriveStorage({
                ...(storageOptions as GoogleDriveStorageOptions),
                oauth: { clientId: "cid", clientSecret: "csec", refreshToken: "rt" },
            });

            const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
                headers: new Headers({}),
                ok: true,
                status: 200,
            } as Response);

            await expect(storage.getUploadUrl("file.mp4")).rejects.toThrow(/missing Location header/);

            fetchSpy.mockRestore();
        });
    });
});
