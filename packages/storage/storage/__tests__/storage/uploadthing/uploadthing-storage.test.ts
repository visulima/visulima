/* eslint-disable max-classes-per-file, @typescript-eslint/no-extraneous-class, no-constructor-return -- mock SDK classes for vendor library shape */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UploadThingStorageOptions } from "../../../src/storage/uploadthing/types";
import UploadThingStorage from "../../../src/storage/uploadthing/uploadthing-storage";
import { storageOptions } from "../../__helpers__/config";

const validToken = Buffer.from(JSON.stringify({ apiKey: "sk_test_abc", appId: "test-app" })).toString("base64");

const makeMockUtapi = () => { return {
    deleteFiles: vi.fn(),
    generateSignedURL: vi.fn(),
    listFiles: vi.fn(),
    uploadFiles: vi.fn(),
}; };

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

describe(UploadThingStorage, () => {
    beforeEach(() => {
        mockUtapi = makeMockUtapi();

        delete process.env.UPLOADTHING_TOKEN;
    });

    describe("construction", () => {
        it("rejects when no token is configured", () => {
            expect.assertions(1);

            expect(
                () =>
                    new UploadThingStorage({
                        ...(storageOptions as UploadThingStorageOptions),
                    }),
            ).toThrow(/missing token/);
        });

        it("rejects malformed (non-base64) tokens", () => {
            expect.assertions(1);

            expect(
                () =>
                    new UploadThingStorage({
                        ...(storageOptions as UploadThingStorageOptions),
                        token: "not%%%base64",
                    }),
            ).toThrow(/UploadThing/);
        });

        it("rejects tokens that decode to JSON without apiKey/appId", () => {
            expect.assertions(1);

            const bad = Buffer.from(JSON.stringify({ apiKey: "x" })).toString("base64");

            expect(
                () =>
                    new UploadThingStorage({
                        ...(storageOptions as UploadThingStorageOptions),
                        token: bad,
                    }),
            ).toThrow(/missing `apiKey` or `appId`/);
        });

        it("falls back to UPLOADTHING_TOKEN env var", () => {
            expect.assertions(1);

            process.env.UPLOADTHING_TOKEN = validToken;

            const storage = new UploadThingStorage({
                ...(storageOptions as UploadThingStorageOptions),
            });

            expect(storage.raw).toBe(mockUtapi);
        });

        it("requires token even when a pre-built client is passed (for appId)", () => {
            expect.assertions(1);

            expect(
                () =>
                    new UploadThingStorage({
                        ...(storageOptions as UploadThingStorageOptions),
                        client: mockUtapi as unknown as UploadThingStorageOptions["client"],
                    }),
            ).toThrow(/`token` is required/);
        });
    });

    describe(".delete()", () => {
        it("calls deleteFiles with the resolved customId", async () => {
            expect.assertions(2);

            const storage = new UploadThingStorage({
                ...(storageOptions as UploadThingStorageOptions),
                token: validToken,
            });

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new Error("not found"));

            mockUtapi.deleteFiles.mockResolvedValueOnce({ success: true });

            const result = await storage.delete({ id: "user/file.mp4" });

            expect(mockUtapi.deleteFiles).toHaveBeenCalledWith("user/file.mp4");
            expect(result.status).toBe("deleted");
        });
    });

    describe(".getReadUrl()", () => {
        it("returns a public CDN URL for public-read ACL", async () => {
            expect.assertions(1);

            const storage = new UploadThingStorage({
                ...(storageOptions as UploadThingStorageOptions),
                acl: "public-read",
                token: validToken,
            });

            const url = await storage.getReadUrl("user/file.mp4");

            expect(url).toBe("https://test-app.ufs.sh/f/user%2Ffile.mp4");
        });

        it("returns a signed URL for private ACL", async () => {
            expect.assertions(2);

            const storage = new UploadThingStorage({
                ...(storageOptions as UploadThingStorageOptions),
                acl: "private",
                token: validToken,
            });

            mockUtapi.generateSignedURL.mockResolvedValueOnce({
                ufsUrl: "https://test-app.ufs.sh/f/user%2Ffile.mp4?x-ut-sig=abc",
            });

            const url = await storage.getReadUrl("user/file.mp4", { expiresIn: 600 });

            expect(mockUtapi.generateSignedURL).toHaveBeenCalledWith("user/file.mp4", {
                expiresIn: 600,
                keyType: "customId",
            });
            expect(url).toBe("https://test-app.ufs.sh/f/user%2Ffile.mp4?x-ut-sig=abc");
        });

        it("clamps signed URL expiresIn to the 7-day max", async () => {
            expect.assertions(1);

            const storage = new UploadThingStorage({
                ...(storageOptions as UploadThingStorageOptions),
                acl: "private",
                token: validToken,
            });

            mockUtapi.generateSignedURL.mockResolvedValueOnce({ ufsUrl: "https://x" });

            await storage.getReadUrl("user/file.mp4", { expiresIn: 999_999_999 });

            expect(mockUtapi.generateSignedURL).toHaveBeenCalledWith("user/file.mp4", {
                expiresIn: 60 * 60 * 24 * 7,
                keyType: "customId",
            });
        });

        it("rejects responseContentDisposition", async () => {
            expect.assertions(1);

            const storage = new UploadThingStorage({
                ...(storageOptions as UploadThingStorageOptions),
                token: validToken,
            });

            await expect(storage.getReadUrl("user/file.mp4", { responseContentDisposition: "attachment" })).rejects.toThrow(
                /responseContentDisposition.*not supported/,
            );
        });
    });

    describe(".getUploadUrl()", () => {
        it("throws METHOD_NOT_ALLOWED (UFS ingest signing out of scope)", async () => {
            expect.assertions(1);

            const storage = new UploadThingStorage({
                ...(storageOptions as UploadThingStorageOptions),
                token: validToken,
            });

            await expect(storage.getUploadUrl("user/file.mp4")).rejects.toThrow(/file-router pattern/);
        });
    });
});
