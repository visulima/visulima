import { beforeEach, describe, expect, it, vi } from "vitest";

import DropboxStorage from "../../../src/storage/dropbox/dropbox-storage";
import type { DropboxStorageOptions } from "../../../src/storage/dropbox/types";
import { storageOptions } from "../../__helpers__/config";

const makeMockClient = () => ({
    auth: {
        getAccessToken: vi.fn(() => "tok"),
        setAccessToken: vi.fn(),
    },
    filesCopyV2: vi.fn(),
    filesDeleteV2: vi.fn(),
    filesDownload: vi.fn(),
    filesGetTemporaryLink: vi.fn(),
    filesMoveV2: vi.fn(),
    filesUpload: vi.fn(),
    sharingCreateSharedLinkWithSettings: vi.fn(),
    sharingListSharedLinks: vi.fn(),
});

let mockClient: ReturnType<typeof makeMockClient>;

vi.mock(import("dropbox"), () => {
    class FakeDropboxResponseError extends Error {
        public error: unknown;

        public status: number;

        public constructor(status: number, errorBody: unknown) {
            super("Dropbox error");
            this.status = status;
            this.error = errorBody;
        }
    }

    return {
        Dropbox: class {
            public constructor() {
                return mockClient as unknown as typeof this;
            }
        },
        DropboxAuth: class {
            public constructor() {}
        },
        DropboxResponseError: FakeDropboxResponseError,
    };
});

// Reference the mocked class via the module so factory and tests share one identity.
const { DropboxResponseError: FakeDropboxResponseError } = await import("dropbox");

describe(DropboxStorage, () => {
    beforeEach(() => {
        mockClient = makeMockClient();

        delete process.env.DROPBOX_ACCESS_TOKEN;
        delete process.env.DROPBOX_APP_KEY;
        delete process.env.DROPBOX_APP_SECRET;
        delete process.env.DROPBOX_REFRESH_TOKEN;
    });

    describe("auth resolution", () => {
        it("rejects both accessToken and refreshToken at once", () => {
            expect.assertions(1);

            expect(() => new DropboxStorage({
                ...(storageOptions as DropboxStorageOptions),
                accessToken: "tok",
                appKey: "k",
                refreshToken: "rt",
            })).toThrow(/exactly one of `accessToken` or `refreshToken`/);
        });

        it("rejects refreshToken without appKey", () => {
            expect.assertions(1);

            expect(() => new DropboxStorage({
                ...(storageOptions as DropboxStorageOptions),
                refreshToken: "rt",
            })).toThrow(/refresh-token auth requires both `refreshToken` and `appKey`/);
        });

        it("rejects when no auth source is configured", () => {
            expect.assertions(1);

            expect(() => new DropboxStorage({
                ...(storageOptions as DropboxStorageOptions),
            })).toThrow(/missing auth/);
        });

        it("accepts a pre-built client without any other auth", () => {
            expect.assertions(1);

            const storage = new DropboxStorage({
                ...(storageOptions as DropboxStorageOptions),
                client: mockClient as unknown as DropboxStorageOptions["client"],
            });

            expect(storage.raw).toBe(mockClient);
        });

        it("falls back to DROPBOX_ACCESS_TOKEN env var", () => {
            expect.assertions(1);

            process.env.DROPBOX_ACCESS_TOKEN = "env-tok";

            const storage = new DropboxStorage({
                ...(storageOptions as DropboxStorageOptions),
            });

            expect(storage.raw).toBeDefined();
        });

        it("sets the static access token on the underlying client", () => {
            expect.assertions(1);

            void new DropboxStorage({
                ...(storageOptions as DropboxStorageOptions),
                accessToken: "static-tok",
            });

            expect(mockClient.auth.setAccessToken).toHaveBeenCalledWith("static-tok");
        });
    });

    describe(".delete()", () => {
        it("calls filesDeleteV2 with the key-prefixed path", async () => {
            expect.assertions(2);

            const storage = new DropboxStorage({
                ...(storageOptions as DropboxStorageOptions),
                accessToken: "tok",
            });

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta")
                .mockRejectedValue(new Error("not found"));

            const result = await storage.delete({ id: "folder/file.mp4" });

            expect(mockClient.filesDeleteV2).toHaveBeenCalledWith({ path: "/folder/file.mp4" });
            expect(result.status).toBe("deleted");
        });

        it("swallows Dropbox 404 errors", async () => {
            expect.assertions(1);

            const storage = new DropboxStorage({
                ...(storageOptions as DropboxStorageOptions),
                accessToken: "tok",
            });

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta")
                .mockRejectedValue(new Error("not found"));

            mockClient.filesDeleteV2.mockRejectedValueOnce(new FakeDropboxResponseError(404, {}));

            await expect(storage.delete({ id: "missing.mp4" })).resolves.toMatchObject({ status: "deleted" });
        });

        it("swallows Dropbox not-found tagged errors", async () => {
            expect.assertions(1);

            const storage = new DropboxStorage({
                ...(storageOptions as DropboxStorageOptions),
                accessToken: "tok",
            });

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta")
                .mockRejectedValue(new Error("not found"));

            mockClient.filesDeleteV2.mockRejectedValueOnce(
                new FakeDropboxResponseError(409, {
                    error: { ".tag": "path_lookup", path_lookup: { ".tag": "not_found" } },
                }),
            );

            await expect(storage.delete({ id: "missing.mp4" })).resolves.toMatchObject({ status: "deleted" });
        });
    });

    describe(".copy()", () => {
        it("calls filesCopyV2 with normalized source and destination paths", async () => {
            expect.assertions(2);

            const storage = new DropboxStorage({
                ...(storageOptions as DropboxStorageOptions),
                accessToken: "tok",
            });

            mockClient.filesCopyV2.mockResolvedValueOnce({ result: { metadata: { id: "id:1" } } });

            const result = await storage.copy("src.mp4", "dst/copy.mp4");

            expect(mockClient.filesCopyV2).toHaveBeenCalledWith({
                from_path: "/src.mp4",
                to_path: "/dst/copy.mp4",
            });
            expect(result.path).toBe("/dst/copy.mp4");
        });

        it("prefixes paths with rootFolderPath when configured", async () => {
            expect.assertions(1);

            const storage = new DropboxStorage({
                ...(storageOptions as DropboxStorageOptions),
                accessToken: "tok",
                rootFolderPath: "uploads",
            });

            mockClient.filesCopyV2.mockResolvedValueOnce({ result: {} });

            await storage.copy("src.mp4", "dst.mp4");

            expect(mockClient.filesCopyV2).toHaveBeenCalledWith({
                from_path: "/uploads/src.mp4",
                to_path: "/uploads/dst.mp4",
            });
        });
    });

    describe(".getReadUrl()", () => {
        it("returns a temporary link by default", async () => {
            expect.assertions(2);

            const storage = new DropboxStorage({
                ...(storageOptions as DropboxStorageOptions),
                accessToken: "tok",
            });

            mockClient.filesGetTemporaryLink.mockResolvedValueOnce({ result: { link: "https://dl.dropboxusercontent.com/x" } });

            const url = await storage.getReadUrl("file.mp4");

            expect(mockClient.filesGetTemporaryLink).toHaveBeenCalledWith({ path: "/file.mp4" });
            expect(url).toBe("https://dl.dropboxusercontent.com/x");
        });

        it("rejects expiresIn above the 4-hour Dropbox cap", async () => {
            expect.assertions(1);

            const storage = new DropboxStorage({
                ...(storageOptions as DropboxStorageOptions),
                accessToken: "tok",
            });

            await expect(storage.getReadUrl("file.mp4", { expiresIn: 20_000 }))
                .rejects.toThrow(/exceeds the 14400s/);
        });

        it("rejects responseContentDisposition", async () => {
            expect.assertions(1);

            const storage = new DropboxStorage({
                ...(storageOptions as DropboxStorageOptions),
                accessToken: "tok",
            });

            await expect(storage.getReadUrl("file.mp4", { responseContentDisposition: "attachment" }))
                .rejects.toThrow(/responseContentDisposition.*not supported/);
        });

        it("returns a permanent shared link when publicByDefault is true", async () => {
            expect.assertions(2);

            const storage = new DropboxStorage({
                ...(storageOptions as DropboxStorageOptions),
                accessToken: "tok",
                publicByDefault: true,
            });

            mockClient.sharingCreateSharedLinkWithSettings.mockResolvedValueOnce({
                result: { url: "https://www.dropbox.com/s/abc?dl=0" },
            });

            const url = await storage.getReadUrl("file.mp4");

            // The adapter rewrites ?dl=0 → ?dl=1 so the link serves raw bytes.
            expect(url).toBe("https://www.dropbox.com/s/abc?dl=1");
            expect(mockClient.sharingCreateSharedLinkWithSettings).toHaveBeenCalled();
        });

        it("recovers from shared_link_already_exists by querying the existing link", async () => {
            expect.assertions(1);

            const storage = new DropboxStorage({
                ...(storageOptions as DropboxStorageOptions),
                accessToken: "tok",
                publicByDefault: true,
            });

            mockClient.sharingCreateSharedLinkWithSettings.mockRejectedValueOnce(
                new FakeDropboxResponseError(409, {
                    shared_link_already_exists: { metadata: { url: "https://www.dropbox.com/s/existing?dl=0" } },
                }),
            );

            const url = await storage.getReadUrl("file.mp4");

            expect(url).toBe("https://www.dropbox.com/s/existing?dl=1");
        });
    });

    describe(".getUploadUrl()", () => {
        it("throws METHOD_NOT_ALLOWED", async () => {
            expect.assertions(1);

            const storage = new DropboxStorage({
                ...(storageOptions as DropboxStorageOptions),
                accessToken: "tok",
            });

            await expect(storage.getUploadUrl("file.mp4")).rejects.toThrow(/presigned upload URLs.*POST with a raw body/);
        });
    });
});
