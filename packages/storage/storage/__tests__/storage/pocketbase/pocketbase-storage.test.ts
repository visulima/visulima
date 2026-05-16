/* eslint-disable @typescript-eslint/no-extraneous-class, no-constructor-return, max-classes-per-file -- mock SDK classes for vendor library shape */
import { beforeEach, describe, expect, it, vi } from "vitest";

import PocketBaseStorage from "../../../src/storage/pocketbase/pocketbase-storage";
import type { PocketBaseStorageOptions } from "../../../src/storage/pocketbase/types";
import { storageOptions } from "../../__helpers__/config";

const { MockClientResponseError } = vi.hoisted(() => {
    class MockClientResponseErrorClass extends Error {
        public status: number;

        public constructor(status: number) {
            super(`status ${status}`);
            this.name = "ClientResponseError";
            this.status = status;
        }
    }

    return { MockClientResponseError: MockClientResponseErrorClass };
});

const makeCollectionApi = () => {
    return {
        authWithPassword: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
        getFirstListItem: vi.fn(),
        getList: vi.fn(),
        update: vi.fn(),
    };
};

const makeMockClient = (collectionApi: ReturnType<typeof makeCollectionApi>) => {
    return {
        authStore: { isValid: true, save: vi.fn() },
        collection: vi.fn(() => collectionApi),
        files: {
            getToken: vi.fn(),
            getURL: vi.fn(),
        },
        filter: vi.fn((raw: string) => raw),
    };
};

let collectionApi: ReturnType<typeof makeCollectionApi>;
let mockClient: ReturnType<typeof makeMockClient>;

vi.mock(import("pocketbase"), () => {
    return {
        ClientResponseError: MockClientResponseError,
        default: class {
            public constructor() {
                return mockClient;
            }
        },
    };
});

const options = (extra: Partial<PocketBaseStorageOptions>): PocketBaseStorageOptions => {
    return {
        ...(storageOptions as PocketBaseStorageOptions),
        collection: "uploads",
        ...extra,
    };
};

const withClient = (extra: Partial<PocketBaseStorageOptions> = {}): PocketBaseStorage =>
    new PocketBaseStorage(
        options({
            client: mockClient,
            ...extra,
        }),
    );

describe(PocketBaseStorage, () => {
    beforeEach(() => {
        collectionApi = makeCollectionApi();
        mockClient = makeMockClient(collectionApi);

        delete process.env.POCKETBASE_URL;
        delete process.env.POCKETBASE_ADMIN_EMAIL;
        delete process.env.POCKETBASE_ADMIN_PASSWORD;
        delete process.env.POCKETBASE_AUTH_TOKEN;
    });

    describe("construction", () => {
        it("rejects when collection is missing", () => {
            expect.assertions(1);

            expect(
                () =>
                    new PocketBaseStorage({
                        ...(storageOptions as PocketBaseStorageOptions),
                        collection: "",
                        url: "https://pb.example.com",
                    }),
            ).toThrow(/`collection` is required/);
        });

        it("rejects when url is missing and no client", () => {
            expect.assertions(1);

            expect(() => new PocketBaseStorage(options({ url: undefined }))).toThrow(/`url` is required/);
        });

        it("falls back to env vars for url", () => {
            expect.assertions(1);

            process.env.POCKETBASE_URL = "https://pb.example.com";

            const storage = new PocketBaseStorage(options({}));

            expect(storage.raw).toBe(mockClient);
        });

        it("saves the auth token from env", () => {
            expect.assertions(2);

            process.env.POCKETBASE_URL = "https://pb.example.com";
            process.env.POCKETBASE_AUTH_TOKEN = "tok-123";

            const storage = new PocketBaseStorage(options({}));

            expect(storage.raw).toBe(mockClient);
            expect(mockClient.authStore.save).toHaveBeenCalledWith("tok-123", null);
        });

        it("accepts a pre-built client without url", () => {
            expect.assertions(1);

            const storage = withClient();

            expect(storage.raw).toBe(mockClient);
        });
    });

    describe(".create()", () => {
        it("creates metadata for a new upload", async () => {
            expect.assertions(2);

            const storage = withClient();

            const file = await storage.create({ contentType: "video/mp4", metadata: {}, originalName: "a.mp4" });

            expect(file.bytesWritten).toBe(0);
            expect(file.bucket).toBe("uploads");
        });
    });

    describe(".write()", () => {
        it("uploads buffered content and completes", async () => {
            expect.assertions(2);

            const storage = withClient();

            const created = await storage.create({ contentType: "video/mp4", metadata: {}, originalName: "a.mp4", size: 4 });

            collectionApi.getFirstListItem.mockRejectedValue(new MockClientResponseError(404));
            collectionApi.create.mockResolvedValue({ file: "a.mp4", id: "rec1" });

            const result = await storage.write({
                body: (async function* bodyStream() {
                    yield Buffer.from("data");
                })() as unknown as NodeJS.ReadableStream,
                id: created.id,
                size: 4,
                start: 0,
            } as never);

            expect(collectionApi.create).toHaveBeenCalledWith(expect.any(FormData));
            expect(result.bytesWritten).toBe(4);
        });
    });

    describe(".get()", () => {
        it("fetches the file URL and returns content", async () => {
            expect.assertions(2);

            const storage = withClient();

            collectionApi.getFirstListItem.mockResolvedValue({ file: "stored.mp4", id: "rec1" });
            mockClient.files.getURL.mockReturnValue("https://pb.example.com/file");

            const fetchSpy = vi
                .spyOn(globalThis, "fetch")
                .mockResolvedValue(new Response(Buffer.from("hello"), { headers: { "content-type": "video/mp4" }, status: 200 }));

            const result = await storage.get({ id: "key.mp4" });

            expect(fetchSpy).toHaveBeenCalledWith("https://pb.example.com/file");
            expect(result.content.toString()).toBe("hello");

            fetchSpy.mockRestore();
        });
    });

    describe(".delete()", () => {
        it("deletes the matching record", async () => {
            expect.assertions(2);

            const storage = withClient();

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new Error("not found"));

            collectionApi.getFirstListItem.mockResolvedValue({ file: "f.mp4", id: "rec1" });
            collectionApi.delete.mockResolvedValue(true);

            const result = await storage.delete({ id: "f.mp4" });

            expect(collectionApi.delete).toHaveBeenCalledWith("rec1");
            expect(result.status).toBe("deleted");
        });

        it("swallows 404 from PocketBase", async () => {
            expect.assertions(1);

            const storage = withClient();

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new Error("not found"));

            collectionApi.getFirstListItem.mockRejectedValue(new MockClientResponseError(404));

            await expect(storage.delete({ id: "missing.mp4" })).resolves.toMatchObject({ status: "deleted" });
        });
    });

    describe(".exists()", () => {
        it("returns true when a record is found", async () => {
            expect.assertions(1);

            const storage = withClient();

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new Error("not found"));
            collectionApi.getFirstListItem.mockResolvedValue({ file: "f.mp4", id: "rec1" });

            await expect(storage.exists({ id: "f.mp4" })).resolves.toBe(true);
        });

        it("returns false on 404", async () => {
            expect.assertions(1);

            const storage = withClient();

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new Error("not found"));
            collectionApi.getFirstListItem.mockRejectedValue(new MockClientResponseError(404));

            await expect(storage.exists({ id: "missing.mp4" })).resolves.toBe(false);
        });
    });

    describe(".copy()", () => {
        it("downloads the source and creates the destination record", async () => {
            expect.assertions(2);

            const storage = withClient();

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new Error("not found"));

            collectionApi.getFirstListItem.mockResolvedValueOnce({ file: "src.mp4", id: "rec1" });
            mockClient.files.getURL.mockReturnValue("https://pb.example.com/src");

            const fetchSpy = vi
                .spyOn(globalThis, "fetch")
                .mockResolvedValue(new Response(Buffer.from("bytes"), { headers: { "content-type": "video/mp4" }, status: 200 }));

            collectionApi.getFirstListItem.mockRejectedValueOnce(new MockClientResponseError(404));
            collectionApi.create.mockResolvedValue({ file: "dest.mp4", id: "rec2" });

            const file = await storage.copy("src.mp4", "dest.mp4");

            expect(file.path).toBe("dest.mp4");
            expect(collectionApi.create).toHaveBeenCalledWith(expect.any(FormData));

            fetchSpy.mockRestore();
        });
    });

    describe(".move()", () => {
        it("copies then deletes the source record", async () => {
            expect.assertions(2);

            const storage = withClient();

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new Error("not found"));

            collectionApi.getFirstListItem
                .mockResolvedValueOnce({ file: "src.mp4", id: "rec1" })
                .mockRejectedValueOnce(new MockClientResponseError(404))
                .mockResolvedValueOnce({ file: "src.mp4", id: "rec1" });
            mockClient.files.getURL.mockReturnValue("https://pb.example.com/src");
            collectionApi.create.mockResolvedValue({ file: "dest.mp4", id: "rec2" });
            collectionApi.delete.mockResolvedValue(true);

            const fetchSpy = vi
                .spyOn(globalThis, "fetch")
                .mockResolvedValue(new Response(Buffer.from("bytes"), { headers: { "content-type": "video/mp4" }, status: 200 }));

            const file = await storage.move("src.mp4", "dest.mp4");

            expect(file.path).toBe("dest.mp4");
            expect(collectionApi.delete).toHaveBeenCalledWith("rec1");

            fetchSpy.mockRestore();
        });
    });

    describe(".list()", () => {
        it("maps records to PocketBaseFile entries", async () => {
            expect.assertions(2);

            const storage = withClient();

            collectionApi.getList.mockResolvedValue({
                items: [{ file: "a.mp4", id: "rec1", key: "alpha" }],
            });

            const files = await storage.list(10);

            expect(collectionApi.getList).toHaveBeenCalledWith(1, 10);
            expect(files[0]?.id).toBe("alpha");
        });
    });

    describe(".getReadUrl()", () => {
        it("returns publicBaseUrl path when configured", async () => {
            expect.assertions(1);

            const storage = withClient({ publicBaseUrl: "https://cdn.example.com" });

            await expect(storage.getReadUrl("key.mp4")).resolves.toBe("https://cdn.example.com/key.mp4");
        });

        it("requests a fresh token for protected files", async () => {
            expect.assertions(2);

            const storage = withClient();

            vi.spyOn(storage as unknown as { getMetaSafe: () => Promise<unknown> }, "getMetaSafe").mockResolvedValue(undefined);

            collectionApi.getFirstListItem.mockResolvedValue({ file: "f.mp4", id: "rec1" });
            mockClient.files.getToken.mockResolvedValue("tok-xyz");
            mockClient.files.getURL.mockReturnValue("https://pb.example.com/f.mp4?token=tok-xyz");

            const url = await storage.getReadUrl("key.mp4");

            expect(mockClient.files.getToken).toHaveBeenCalledWith();
            expect(url).toBe("https://pb.example.com/f.mp4?token=tok-xyz");
        });
    });
});
