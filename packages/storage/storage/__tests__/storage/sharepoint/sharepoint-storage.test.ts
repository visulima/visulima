import { beforeEach, describe, expect, it, vi } from "vitest";

import SharePointStorage from "../../../src/storage/sharepoint/sharepoint-storage";
import type { SharePointStorageOptions } from "../../../src/storage/sharepoint/types";
import { storageOptions } from "../../__helpers__/config";

const bodyStream = async function* (): AsyncIterableIterator<Buffer> {
    yield Buffer.from("hello world");
};

interface ApiCall {
    delete: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    header: ReturnType<typeof vi.fn>;
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
        header: vi.fn(),
        patch: vi.fn().mockResolvedValue({}),
        post: vi.fn().mockResolvedValue({}),
        put: vi.fn().mockResolvedValue({}),
        responseType: vi.fn(),
        select: vi.fn(),
        url,
    };

    call.header.mockReturnValue(call);
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

const baseOptions = (overrides: Partial<SharePointStorageOptions>): SharePointStorageOptions => {
    return {
        ...(storageOptions as SharePointStorageOptions),
        client: mockClient as unknown as SharePointStorageOptions["client"],
        ...overrides,
    };
};

describe(SharePointStorage, () => {
    beforeEach(() => {
        apiCalls.length = 0;
        mockClient.api.mockClear();

        delete process.env.SHAREPOINT_ACCESS_TOKEN;
        delete process.env.SHAREPOINT_CLIENT_ID;
        delete process.env.SHAREPOINT_CLIENT_SECRET;
        delete process.env.SHAREPOINT_TENANT_ID;
        delete process.env.SHAREPOINT_SITE_ID;
        delete process.env.SHAREPOINT_SITE_URL;
        delete process.env.SHAREPOINT_HOSTNAME;
        delete process.env.SHAREPOINT_DRIVE_ID;
        delete process.env.ONEDRIVE_ACCESS_TOKEN;
        delete process.env.ONEDRIVE_CLIENT_ID;
        delete process.env.ONEDRIVE_CLIENT_SECRET;
        delete process.env.ONEDRIVE_TENANT_ID;
        delete process.env.ONEDRIVE_REFRESH_TOKEN;
    });

    describe("construction & site resolution", () => {
        it("exposes the Graph client via raw", () => {
            expect.assertions(1);

            const storage = new SharePointStorage(baseOptions({ driveId: "drive-1" }));

            expect(storage.raw).toBe(mockClient);
        });

        it("short-circuits site resolution when driveId is set", async () => {
            expect.assertions(2);

            const storage = new SharePointStorage(baseOptions({ driveId: "drive-1" }));

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new Error("not found"));

            await storage.delete({ id: "file.mp4" });

            // No /sites lookups happened.
            expect(apiCalls.some((c) => c.url.startsWith("/sites/"))).toBe(false);

            const deleteCall = apiCalls.find((c) => c.delete.mock.calls.length > 0);

            expect(deleteCall?.url).toBe("/drives/drive-1/root:/file.mp4");
        });

        it("resolves siteId to the default drive", async () => {
            expect.assertions(2);

            mockClient.api.mockImplementationOnce((url: string) => {
                const call = makeApi(url);

                call.get.mockResolvedValue({ id: "drive-from-site" });

                apiCalls.push(call);

                return call;
            });

            const storage = new SharePointStorage(baseOptions({ siteId: "site-abc" }));

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new Error("not found"));

            await storage.delete({ id: "file.mp4" });

            expect(apiCalls[0]!.url).toBe("/sites/site-abc/drive");

            const deleteCall = apiCalls.find((c) => c.delete.mock.calls.length > 0);

            expect(deleteCall?.url).toBe("/drives/drive-from-site/root:/file.mp4");
        });

        it("matches a document library by display name", async () => {
            expect.assertions(2);

            mockClient.api.mockImplementationOnce((url: string) => {
                const call = makeApi(url);

                call.get.mockResolvedValue({
                    value: [
                        { id: "wrong-drive", name: "Other" },
                        { id: "docs-drive", name: "Documents" },
                    ],
                });

                apiCalls.push(call);

                return call;
            });

            const storage = new SharePointStorage(baseOptions({ documentLibrary: "Documents", siteId: "site-abc" }));

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new Error("not found"));

            await storage.delete({ id: "file.mp4" });

            expect(apiCalls[0]!.url).toBe("/sites/site-abc/drives");

            const deleteCall = apiCalls.find((c) => c.delete.mock.calls.length > 0);

            expect(deleteCall?.url).toBe("/drives/docs-drive/root:/file.mp4");
        });

        it("parses a siteUrl into hostname + path", async () => {
            expect.assertions(3);

            mockClient.api
                .mockImplementationOnce((url: string) => {
                    const call = makeApi(url);

                    call.get.mockResolvedValue({ id: "site-resolved" });

                    apiCalls.push(call);

                    return call;
                })
                .mockImplementationOnce((url: string) => {
                    const call = makeApi(url);

                    call.get.mockResolvedValue({ id: "drive-resolved" });

                    apiCalls.push(call);

                    return call;
                });

            const storage = new SharePointStorage(baseOptions({ siteUrl: "https://contoso.sharepoint.com/sites/Marketing" }));

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new Error("not found"));

            await storage.delete({ id: "file.mp4" });

            expect(apiCalls[0]!.url).toBe("/sites/contoso.sharepoint.com:/sites/Marketing");
            expect(apiCalls[1]!.url).toBe("/sites/site-resolved/drive");

            const deleteCall = apiCalls.find((c) => c.delete.mock.calls.length > 0);

            expect(deleteCall?.url).toBe("/drives/drive-resolved/root:/file.mp4");
        });

        it("throws when the site cannot be found", async () => {
            expect.assertions(1);

            mockClient.api.mockImplementationOnce((url: string) => {
                const call = makeApi(url);

                call.get.mockRejectedValue(Object.assign(new Error("not found"), { statusCode: 404 }));

                apiCalls.push(call);

                return call;
            });

            const storage = new SharePointStorage(baseOptions({ hostname: "contoso.sharepoint.com", sitePath: "/sites/Nope" }));

            await expect(storage.create({ contentType: "video/mp4", metadata: {}, originalName: "a.mp4" })).rejects.toThrow(/site not found/);
        });

        it("throws when the document library is missing", async () => {
            expect.assertions(1);

            mockClient.api.mockImplementationOnce((url: string) => {
                const call = makeApi(url);

                call.get.mockResolvedValue({ value: [{ id: "x", name: "Other" }] });

                apiCalls.push(call);

                return call;
            });

            const storage = new SharePointStorage(baseOptions({ documentLibrary: "Missing", siteId: "site-abc" }));

            await expect(storage.create({ contentType: "video/mp4", metadata: {}, originalName: "a.mp4" })).rejects.toThrow(
                /document library "Missing" not found/,
            );
        });

        it("throws when no site targeting is provided", async () => {
            expect.assertions(1);

            const storage = new SharePointStorage(baseOptions({}));

            await expect(storage.create({ contentType: "video/mp4", metadata: {}, originalName: "a.mp4" })).rejects.toThrow(/missing site targeting/);
        });

        it("falls back to SHAREPOINT_DRIVE_ID env var", async () => {
            expect.assertions(1);

            process.env.SHAREPOINT_DRIVE_ID = "env-drive";

            const storage = new SharePointStorage(baseOptions({}));

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new Error("not found"));

            await storage.delete({ id: "file.mp4" });

            const deleteCall = apiCalls.find((c) => c.delete.mock.calls.length > 0);

            expect(deleteCall?.url).toBe("/drives/env-drive/root:/file.mp4");
        });

        it("falls back to SHAREPOINT_SITE_ID env var", async () => {
            expect.assertions(1);

            process.env.SHAREPOINT_SITE_ID = "env-site";

            mockClient.api.mockImplementationOnce((url: string) => {
                const call = makeApi(url);

                call.get.mockResolvedValue({ id: "drive-env" });

                apiCalls.push(call);

                return call;
            });

            const storage = new SharePointStorage(baseOptions({}));

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new Error("not found"));

            await storage.delete({ id: "file.mp4" });

            expect(apiCalls[0]!.url).toBe("/sites/env-site/drive");
        });
    });

    describe("delegation to inner OneDrive", () => {
        const driveStorage = (): SharePointStorage => new SharePointStorage(baseOptions({ driveId: "drive-1" }));

        it("create delegates and stores metadata", async () => {
            expect.assertions(1);

            const storage = driveStorage();
            const file = await storage.create({ contentType: "video/mp4", metadata: {}, originalName: "video.mp4" });

            expect(file.name).toBe("anonymous/video.mp4");
        });

        it("write performs a simple upload via the inner Graph client", async () => {
            expect.assertions(2);

            const storage = driveStorage();
            const created = await storage.create({ contentType: "video/mp4", metadata: {}, originalName: "video.mp4" });

            mockClient.api.mockImplementationOnce((url: string) => {
                const call = makeApi(url);

                call.put.mockResolvedValue({ eTag: "etag-1", id: "item-1" });

                apiCalls.push(call);

                return call;
            });

            const result = await storage.write({
                body: bodyStream(),
                contentType: "video/mp4",
                id: created.id,
                metadata: {},
                name: created.name,
                size: 11,
                start: 0,
            });

            const putCall = apiCalls.find((c) => c.put.mock.calls.length > 0);

            expect(putCall?.url).toContain("anonymous/video.mp4");
            expect(result.bytesWritten).toBe(11);
        });

        it("get delegates to the inner Graph client", async () => {
            expect.assertions(1);

            const storage = driveStorage();

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new Error("not found"));

            mockClient.api
                .mockImplementationOnce((url: string) => {
                    const call = makeApi(url);

                    call.get.mockResolvedValue({ file: { mimeType: "video/mp4" }, id: "i", name: "file.mp4", size: 4 });

                    apiCalls.push(call);

                    return call;
                })
                .mockImplementationOnce((url: string) => {
                    const call = makeApi(url);

                    call.get.mockResolvedValue(new Uint8Array([1, 2, 3, 4]).buffer);

                    apiCalls.push(call);

                    return call;
                });

            const result = await storage.get({ id: "file.mp4" });

            expect(result.size).toBe(4);
        });

        it("delete delegates to the inner Graph client", async () => {
            expect.assertions(1);

            const storage = driveStorage();

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new Error("not found"));

            await storage.delete({ id: "del.mp4" });

            const deleteCall = apiCalls.find((c) => c.delete.mock.calls.length > 0);

            expect(deleteCall?.url).toBe("/drives/drive-1/root:/del.mp4");
        });

        it("copy delegates to the inner Graph client", async () => {
            expect.assertions(2);

            const storage = driveStorage();

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

            const result = await storage.copy("src.mp4", "dst.mp4");

            expect(apiCalls[0]!.url).toBe("/drives/drive-1/root:/src.mp4:/copy");
            expect(result.driveItemId).toBe("01ITEM");

            fetchSpy.mockRestore();
        });

        it("move delegates to the inner Graph client", async () => {
            expect.assertions(1);

            const storage = driveStorage();

            mockClient.api.mockImplementationOnce((url: string) => {
                const call = makeApi(url);

                call.patch.mockResolvedValue({ id: "01ITEM", name: "file.mp4" });

                apiCalls.push(call);

                return call;
            });

            await storage.move("src.mp4", "dst/file.mp4");

            expect(apiCalls[0]!.url).toBe("/drives/drive-1/root:/src.mp4");
        });

        it("list delegates to the inner Graph client", async () => {
            expect.assertions(1);

            const storage = driveStorage();

            mockClient.api.mockImplementationOnce((url: string) => {
                const call = makeApi(url);

                call.get.mockResolvedValue({
                    value: [{ file: { mimeType: "video/mp4" }, id: "i1", name: "a.mp4", parentReference: { path: "/drive/root:" }, size: 1 }],
                });

                apiCalls.push(call);

                return call;
            });

            const files = await storage.list();

            expect(files).toHaveLength(1);
        });

        it("getReadUrl delegates to the inner Graph client", async () => {
            expect.assertions(2);

            const storage = driveStorage();

            mockClient.api.mockImplementationOnce((url: string) => {
                const call = makeApi(url);

                call.get.mockResolvedValue({ "@microsoft.graph.downloadUrl": "https://dl.example/x" });

                apiCalls.push(call);

                return call;
            });

            const url = await storage.getReadUrl("file.mp4");

            expect(apiCalls[0]!.url).toBe("/drives/drive-1/root:/file.mp4");
            expect(url).toBe("https://dl.example/x");
        });
    });
});
