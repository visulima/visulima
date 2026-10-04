import { Readable } from "node:stream";

import type { BlockBlobClient, ContainerClient } from "@azure/storage-blob";
import { BlobServiceClient } from "@azure/storage-blob";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AzureStorage from "../../../src/storage/azure/azure-storage";
import type { AzureStorageOptions } from "../../../src/storage/azure/types";
import { metafile, storageOptions } from "../../__helpers__/config";

// Mock Azure Storage Blob SDK
vi.mock(import("@azure/storage-blob"), async () => {
    const actual = await vi.importActual<typeof import("@azure/storage-blob")>("@azure/storage-blob");

    // Create a mock constructor that can be configured in beforeEach
    const MockBlobServiceClient = vi.fn();

    return {
        ...actual,
        BlobServiceClient: MockBlobServiceClient,
    };
});

describe(AzureStorage, () => {
    vi.useFakeTimers().setSystemTime(new Date("2022-02-02"));

    let storage: AzureStorage;
    let mockContainerClient: ContainerClient;
    let mockBlobClient: BlockBlobClient;

    const options: AzureStorageOptions = {
        ...(storageOptions as AzureStorageOptions),
        accountKey: "test-account-key",
        accountName: "test-account",
        containerName: "test-container",
    };

    beforeEach(() => {
        vi.clearAllMocks();

        // Create mock blob client
        mockBlobClient = {
            downloadToBuffer: vi.fn(),
            exists: vi.fn(),
            getProperties: vi.fn(),
        } as unknown as BlockBlobClient;

        // Create mock container client
        mockContainerClient = {
            getBlockBlobClient: vi.fn().mockReturnValue(mockBlobClient),
            listBlobsFlat: vi.fn(),
        } as unknown as ContainerClient;

        // Mock BlobServiceClient constructor to return our mock instance
        // Note: Must use 'function' declaration, not arrow function, for constructor mocks
        // eslint-disable-next-line func-names, prefer-arrow-callback
        (BlobServiceClient as ReturnType<typeof vi.fn>).mockImplementation(function () {
            return {
                getContainerClient: vi.fn().mockReturnValue(mockContainerClient),
            };
        });

        storage = new AzureStorage(options);
    });

    describe(".exists()", () => {
        it("should return true when both metadata and Azure blob exist", async () => {
            expect.assertions(1);

            // Mock getMeta to return metadata
            vi.spyOn(storage, "getMeta").mockResolvedValue({ ...metafile });

            // Mock blob exists to return true
            (mockBlobClient.exists as ReturnType<typeof vi.fn>).mockResolvedValue(true);

            const exists = await storage.exists({ id: metafile.id });

            expect(exists).toBe(true);
        });

        it("should return false when metadata does not exist", async () => {
            expect.assertions(1);

            // Mock getMeta to throw error (metadata doesn't exist)
            vi.spyOn(storage, "getMeta").mockRejectedValue(new Error("File not found"));

            const exists = await storage.exists({ id: "non-existent-id" });

            expect(exists).toBe(false);
        });

        it("should return false when metadata exists but Azure blob does not exist", async () => {
            expect.assertions(1);

            // Mock getMeta to return metadata
            vi.spyOn(storage, "getMeta").mockResolvedValue({ ...metafile });

            // Mock blob exists to return false
            (mockBlobClient.exists as ReturnType<typeof vi.fn>).mockResolvedValue(false);

            const exists = await storage.exists({ id: metafile.id });

            expect(exists).toBe(false);
        });
    });

    describe(".getCompletedFile()", () => {
        it("answers from the blob properties without downloading", async () => {
            expect.assertions(5);

            (mockBlobClient.getProperties as ReturnType<typeof vi.fn>).mockResolvedValue({ contentLength: 321, contentType: "video/mp4", etag: "etag-1" });

            const file = await storage.getCompletedFile("video.mp4");

            expect(file).toMatchObject({
                bytesWritten: 321,
                ETag: "etag-1",
                id: "video.mp4",
                size: 321,
                status: "completed",
            });
            expect(file?.contentType).toBe("video/mp4");
            expect(mockBlobClient.getProperties).toHaveBeenCalledTimes(1);
            expect(mockBlobClient.downloadToBuffer).not.toHaveBeenCalled();
            expect(mockContainerClient.getBlockBlobClient).toHaveBeenCalledWith(expect.stringContaining("video.mp4"));
        });

        it("returns undefined when the blob does not exist", async () => {
            expect.assertions(3);

            (mockBlobClient.getProperties as ReturnType<typeof vi.fn>).mockRejectedValue(Object.assign(new Error("BlobNotFound"), { statusCode: 404 }));

            await expect(storage.getCompletedFile("missing.mp4")).resolves.toBeUndefined();
            expect(mockBlobClient.downloadToBuffer).not.toHaveBeenCalled();

            (mockBlobClient.getProperties as ReturnType<typeof vi.fn>).mockRejectedValue(Object.assign(new Error("AuthorizationFailure"), { statusCode: 403 }));

            await expect(storage.getCompletedFile("file.mp4")).rejects.toThrow("AuthorizationFailure");
        });
    });

    describe(".list()", () => {
        const listing = (names: string[]): void => {
            vi.mocked(mockContainerClient.listBlobsFlat).mockReturnValue({
                byPage: () => {
                    return {
                        next: async () => {
                            return {
                                value: {
                                    segment: {
                                        blobItems: names.map((name) => {
                                            return { deleted: false, name, properties: { createdOn: new Date(), lastModified: new Date() } };
                                        }),
                                    },
                                },
                            };
                        },
                    };
                },
            } as unknown as ReturnType<ContainerClient["listBlobsFlat"]>);
        };

        it("skips the metadata sidecars stored in the same container", async () => {
            expect.assertions(1);

            listing(["a.bin", "a.bin.META"]);

            await expect(storage.list()).resolves.toStrictEqual([expect.objectContaining({ id: "a.bin" })]);
        });

        it("lists under root and assetFolder and returns ids that round-trip", async () => {
            expect.assertions(3);

            const scoped = new AzureStorage({ ...options, assetFolder: "assets", root: "/tenant/" });

            listing(["tenant/assets/a.bin"]);

            const files = await scoped.list();

            expect(mockContainerClient.listBlobsFlat).toHaveBeenCalledWith(
                expect.objectContaining({ prefix: "tenant/assets/" }),
            );
            expect(files.map((file) => file.id)).toStrictEqual(["a.bin"]);

            await scoped.getCompletedFile("a.bin").catch(() => undefined);

            expect(mockContainerClient.getBlockBlobClient).toHaveBeenLastCalledWith("tenant/assets/a.bin");
        });
    });

    describe(".write()", () => {
        const blockId = (offset: number): string => Buffer.from(`visulima-${String(offset).padStart(16, "0")}`).toString("base64");
        const chunk = (length: number): Readable => Readable.from(Buffer.alloc(length));

        beforeEach(() => {
            Object.assign(mockBlobClient, {
                commitBlockList: vi.fn().mockResolvedValue({ _response: { headers: { get: () => undefined } }, requestId: "commit" }),
                getBlockList: vi.fn(),
                stageBlock: vi.fn().mockResolvedValue({ requestId: "stage" }),
            });
        });

        it("stages each chunk as a block keyed by its offset and persists the new offset", async () => {
            expect.assertions(4);

            vi.spyOn(storage, "getMeta").mockResolvedValue({ ...metafile, bytesWritten: 0, size: 20 });

            const saveMeta = vi.spyOn(storage, "saveMeta").mockImplementation(async (file) => file);
            const body = chunk(10);

            const file = await storage.write({ body, contentLength: 10, id: metafile.id, start: 0 });

            expect(mockBlobClient.stageBlock).toHaveBeenCalledWith(blockId(0), expect.anything(), 10, expect.any(Object));
            expect(file.bytesWritten).toBe(10);
            expect(saveMeta).toHaveBeenCalledWith(expect.objectContaining({ bytesWritten: 10 }));
            expect(mockBlobClient.commitBlockList).not.toHaveBeenCalled();
        });

        it("commits the contiguous block chain in offset order with the blob headers on completion", async () => {
            expect.assertions(6);

            vi.spyOn(storage, "getMeta").mockResolvedValue({ ...metafile, bytesWritten: 10, size: 20 });

            const deleteMeta = vi.spyOn(storage, "deleteMeta").mockResolvedValue(undefined);
            const saveMeta = vi.spyOn(storage, "saveMeta").mockImplementation(async (file) => file);

            (mockBlobClient.getBlockList as ReturnType<typeof vi.fn>).mockResolvedValue({
                uncommittedBlocks: [
                    { name: blockId(10), size: 10 },
                    // A stale block from an abandoned PATCH that is not part of the chain.
                    { name: blockId(15), size: 5 },
                    { name: blockId(0), size: 10 },
                ],
            });

            const file = await storage.write({ body: chunk(10), contentLength: 10, id: metafile.id, start: 10 });

            expect(mockBlobClient.stageBlock).toHaveBeenCalledWith(blockId(10), expect.anything(), 10, expect.any(Object));
            expect(file.status).toBe("completed");
            expect(mockBlobClient.commitBlockList).toHaveBeenCalledWith(
                [blockId(0), blockId(10)],
                expect.objectContaining({
                    blobHTTPHeaders: { blobContentType: metafile.contentType },
                    metadata: expect.objectContaining({ originalName: metafile.originalName }),
                }),
            );
            // Completed uploads keep their metadata.
            expect(deleteMeta).not.toHaveBeenCalled();
            expect(saveMeta).toHaveBeenCalledWith(expect.objectContaining({ id: metafile.id, status: "completed" }));
            expect(file.bytesWritten).toBe(20);
        });

        it("rejects a chunk that does not start at the persisted offset", async () => {
            expect.assertions(2);

            vi.spyOn(storage, "getMeta").mockResolvedValue({ ...metafile, bytesWritten: 10, size: 20 });

            await expect(storage.write({ body: chunk(10), contentLength: 10, id: metafile.id, start: 0 })).rejects.toMatchObject({
                UploadErrorCode: "FileConflict",
            });
            expect(mockBlobClient.stageBlock).not.toHaveBeenCalled();
        });

        it("rejects a chunk larger than the 4000 MiB Put Block limit before staging it", async () => {
            expect.assertions(2);

            const size = 5 * 1024 * 1024 * 1024;

            vi.spyOn(storage, "getMeta").mockResolvedValue({ ...metafile, bytesWritten: 0, size });

            await expect(storage.write({ body: chunk(10), contentLength: 4000 * 1024 * 1024 + 1, id: metafile.id, start: 0 })).rejects.toMatchObject({
                UploadErrorCode: "RequestEntityTooLarge",
            });
            expect(mockBlobClient.stageBlock).not.toHaveBeenCalled();
        });

        it("refuses to commit when the staged blocks do not cover the whole upload", async () => {
            expect.assertions(2);

            vi.spyOn(storage, "getMeta").mockResolvedValue({ ...metafile, bytesWritten: 10, size: 20 });

            (mockBlobClient.getBlockList as ReturnType<typeof vi.fn>).mockResolvedValue({ uncommittedBlocks: [{ name: blockId(10), size: 10 }] });

            await expect(storage.write({ body: chunk(10), contentLength: 10, id: metafile.id, start: 10 })).rejects.toMatchObject({
                UploadErrorCode: "FileError",
            });
            expect(mockBlobClient.commitBlockList).not.toHaveBeenCalled();
        });

        it("passes an md5 checksum to Azure and maps Md5Mismatch to a checksum mismatch", async () => {
            expect.assertions(2);

            vi.spyOn(storage, "getMeta").mockResolvedValue({ ...metafile, bytesWritten: 0, size: 20 });

            (mockBlobClient.stageBlock as ReturnType<typeof vi.fn>).mockRejectedValue(Object.assign(new Error("md5 mismatch"), { code: "Md5Mismatch" }));

            await expect(
                storage.write({
                    body: chunk(10),
                    checksum: "1B2M2Y8AsgTpgAmY7PhCfg==",
                    checksumAlgorithm: "md5",
                    contentLength: 10,
                    id: metafile.id,
                    start: 0,
                }),
            ).rejects.toMatchObject({ UploadErrorCode: "ChecksumMismatch" });
            expect(mockBlobClient.stageBlock).toHaveBeenCalledWith(
                blockId(0),
                expect.anything(),
                10,
                expect.objectContaining({ transactionalContentMD5: Buffer.from("1B2M2Y8AsgTpgAmY7PhCfg==", "base64") }),
            );
        });

        it("rejects checksum algorithms Azure cannot verify", async () => {
            expect.assertions(2);

            expect(storage.checksumTypes).toStrictEqual(["md5"]);

            vi.spyOn(storage, "getMeta").mockResolvedValue({ ...metafile, bytesWritten: 0, size: 20 });

            await expect(
                storage.write({ body: chunk(10), checksum: "x", checksumAlgorithm: "sha1", contentLength: 10, id: metafile.id, start: 0 }),
            ).rejects.toMatchObject({ UploadErrorCode: "UnsupportedChecksumAlgorithm" });
        });
    });
});

describe("azureStorage authentication & signed URLs", () => {
    const baseOptions = {
        ...(storageOptions as AzureStorageOptions),
        containerName: "test-container",
    };

    const blobUrl = "https://test-account.blob.core.windows.net/c/file.txt";

    let generateSasUrlMock: ReturnType<typeof vi.fn>;
    let generateUserDelegationSasUrlMock: ReturnType<typeof vi.fn>;
    let getUserDelegationKeyMock: ReturnType<typeof vi.fn>;
    let beginCopyFromUrlMock: ReturnType<typeof vi.fn>;
    let mockBlobClient: Record<string, unknown>;
    let mockBlockBlobClient: Record<string, unknown>;
    let mockContainerClient: ContainerClient;

    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.AZURE_STORAGE_ACCOUNT_KEY;
        delete process.env.AZURE_STORAGE_ACCOUNT;
        delete process.env.AZURE_STORAGE_CONNECTION_STRING;
        delete process.env.AZURE_STORAGE_SAS_TOKEN;

        generateSasUrlMock = vi.fn().mockResolvedValue(`${blobUrl}?sig=shared-key`);
        generateUserDelegationSasUrlMock = vi.fn().mockResolvedValue(`${blobUrl}?sig=user-delegation`);
        getUserDelegationKeyMock = vi.fn().mockResolvedValue({ value: "delegation-key" });
        beginCopyFromUrlMock = vi.fn().mockResolvedValue({ pollUntilDone: vi.fn().mockResolvedValue(undefined) });

        mockBlobClient = {
            generateSasUrl: generateSasUrlMock,
            generateUserDelegationSasUrl: generateUserDelegationSasUrlMock,
            url: blobUrl,
        };

        mockBlockBlobClient = {
            beginCopyFromURL: beginCopyFromUrlMock,
            deleteIfExists: vi.fn().mockResolvedValue(undefined),
            downloadToBuffer: vi.fn().mockResolvedValue(Buffer.from("data")),
            exists: vi.fn().mockResolvedValue(true),
            getProperties: vi.fn().mockResolvedValue({ contentLength: 4, contentType: "text/plain", metadata: {} }),
            url: blobUrl,
        };

        mockContainerClient = {
            getBlobClient: vi.fn().mockReturnValue(mockBlobClient),
            getBlockBlobClient: vi.fn().mockReturnValue(mockBlockBlobClient),
        } as unknown as ContainerClient;

        const serviceClient = {
            getContainerClient: vi.fn().mockReturnValue(mockContainerClient),
            getUserDelegationKey: getUserDelegationKeyMock,
        };

        // eslint-disable-next-line func-names, prefer-arrow-callback
        (BlobServiceClient as ReturnType<typeof vi.fn>).mockImplementation(function () {
            return serviceClient;
        });
        // eslint-disable-next-line vitest/prefer-spy-on -- the mocked constructor has no real method to spy on
        (BlobServiceClient as unknown as { fromConnectionString: ReturnType<typeof vi.fn> }).fromConnectionString = vi.fn().mockReturnValue(serviceClient);
    });

    it("signs read/upload URLs with a service SAS when given an account key", async () => {
        expect.assertions(3);

        const storage = new AzureStorage({
            ...baseOptions,
            accountKey: "test-account-key",
            accountName: "test-account",
        });

        const readUrl = await storage.getReadUrl("file.txt", { expiresIn: 600 });

        expect(readUrl).toBe("https://test-account.blob.core.windows.net/c/file.txt?sig=shared-key");
        expect(generateSasUrlMock).toHaveBeenCalledTimes(1);

        await storage.getUploadUrl("file.txt", { expiresIn: 600 });

        expect(generateSasUrlMock).toHaveBeenCalledTimes(2);
    });

    it("rejects unenforceable contentType/contentLength on upload URLs", async () => {
        expect.assertions(2);

        const storage = new AzureStorage({
            ...baseOptions,
            accountKey: "test-account-key",
            accountName: "test-account",
        });

        await expect(storage.getUploadUrl("file.txt", { contentType: "text/plain" })).rejects.toThrow(/contentType.*not supported/u);
        await expect(storage.getUploadUrl("file.txt", { contentLength: 1024 })).rejects.toThrow(/not supported/u);
    });

    it("rejects responseContentDisposition on the pre-issued sasToken read path", async () => {
        expect.assertions(1);

        const storage = new AzureStorage({
            ...baseOptions,
            accountName: "test-account",
            sasToken: "sv=2021-08-06&sig=preissued",
        });

        await expect(storage.getReadUrl("file.txt", { responseContentDisposition: "attachment" })).rejects.toThrow(
            /not supported|require a freshly minted SAS/u,
        );
    });

    it("mints a User Delegation SAS when given a Microsoft Entra credential", async () => {
        expect.assertions(3);

        const credential = { getToken: vi.fn() };
        const storage = new AzureStorage({
            ...baseOptions,
            accountName: "test-account",
            credential,
        });

        const url = await storage.getReadUrl("file.txt");

        expect(url).toBe("https://test-account.blob.core.windows.net/c/file.txt?sig=user-delegation");
        expect(getUserDelegationKeyMock).toHaveBeenCalledTimes(1);
        expect(generateUserDelegationSasUrlMock).toHaveBeenCalledTimes(1);
    });

    it("caches the User Delegation Key across repeated URL generation", async () => {
        expect.assertions(1);

        const storage = new AzureStorage({
            ...baseOptions,
            accountName: "test-account",
            credential: { getToken: vi.fn() },
        });

        await storage.getReadUrl("a.txt");
        await storage.getReadUrl("b.txt");

        expect(getUserDelegationKeyMock).toHaveBeenCalledTimes(1);
    });

    it("does not sign URLs when useUserDelegationSas is false", async () => {
        expect.assertions(1);

        const storage = new AzureStorage({
            ...baseOptions,
            accountName: "test-account",
            credential: { getToken: vi.fn() },
            useUserDelegationSas: false,
        });

        await expect(storage.getReadUrl("file.txt")).rejects.toThrow(/cannot produce a read URL/);
    });

    it("signs the copy source with a User Delegation SAS in token mode", async () => {
        expect.assertions(2);

        const storage = new AzureStorage({
            ...baseOptions,
            accountName: "test-account",
            credential: { getToken: vi.fn() },
        });

        vi.spyOn(storage, "getMeta").mockResolvedValue({ ...metafile });

        await storage.copy("file.txt", "dest.txt");

        expect(generateUserDelegationSasUrlMock).toHaveBeenCalledTimes(1);
        expect(beginCopyFromUrlMock).toHaveBeenCalledWith(`${blobUrl}?sig=user-delegation`, expect.anything());
    });

    it("appends a pre-issued SAS token to read and upload URLs", async () => {
        expect.assertions(2);

        const storage = new AzureStorage({
            ...baseOptions,
            accountName: "test-account",
            sasToken: "sv=2023-01-01&sig=preissued",
        });

        await expect(storage.getReadUrl("file.txt")).resolves.toBe(`${blobUrl}?sv=2023-01-01&sig=preissued`);
        await expect(storage.getUploadUrl("file.txt")).resolves.toBe(`${blobUrl}?sv=2023-01-01&sig=preissued`);
    });

    it("signs URLs with a service SAS from a connection string carrying an account key", async () => {
        expect.assertions(2);

        const storage = new AzureStorage({
            ...baseOptions,
            connectionString: "DefaultEndpointsProtocol=https;AccountName=test-account;AccountKey=dGVzdC1rZXk=;EndpointSuffix=core.windows.net",
        });

        const url = await storage.getReadUrl("file.txt");

        expect(url).toBe(`${blobUrl}?sig=shared-key`);
        expect(generateSasUrlMock).toHaveBeenCalledTimes(1);
    });

    it("serves an unsigned read URL but rejects uploads for anonymous adapters", async () => {
        expect.assertions(2);

        const storage = new AzureStorage({
            ...baseOptions,
            accountName: "test-account",
        });

        await expect(storage.getReadUrl("file.txt")).resolves.toBe(blobUrl);
        await expect(storage.getUploadUrl("file.txt")).rejects.toThrow(/read-only/);
    });

    it("resolves account key and name from environment variables", async () => {
        expect.assertions(1);

        process.env.AZURE_STORAGE_ACCOUNT_KEY = "env-account-key";
        process.env.AZURE_STORAGE_ACCOUNT = "env-account";

        const storage = new AzureStorage(baseOptions);

        const url = await storage.getReadUrl("file.txt");

        expect(url).toBe("https://test-account.blob.core.windows.net/c/file.txt?sig=shared-key");
    });

    it("appends a pre-issued SAS token to the copy source URL", async () => {
        expect.assertions(1);

        const storage = new AzureStorage({
            ...baseOptions,
            accountName: "test-account",
            sasToken: "sv=2023-01-01&sig=preissued",
        });

        vi.spyOn(storage, "getMeta").mockResolvedValue({ ...metafile });

        await storage.copy("file.txt", "dest.txt");

        expect(beginCopyFromUrlMock).toHaveBeenCalledWith(`${blobUrl}?sv=2023-01-01&sig=preissued`, expect.anything());
    });

    it("dedupes the User Delegation Key fetch across concurrent URL requests", async () => {
        expect.assertions(1);

        const storage = new AzureStorage({
            ...baseOptions,
            accountName: "test-account",
            credential: { getToken: vi.fn() },
        });

        await Promise.all([storage.getReadUrl("a.txt"), storage.getReadUrl("b.txt")]);

        expect(getUserDelegationKeyMock).toHaveBeenCalledTimes(1);
    });

    it("resolves get()/exists() against the assetFolder-prefixed blob path", async () => {
        expect.assertions(2);

        const storage = new AzureStorage({
            ...baseOptions,
            accountKey: "test-account-key",
            accountName: "test-account",
            assetFolder: "uploads",
        });

        vi.spyOn(storage, "getMeta").mockResolvedValue({ ...metafile });

        await storage.exists({ id: "file.txt" });
        await storage.get({ id: "file.txt" });

        expect(mockContainerClient.getBlockBlobClient).toHaveBeenCalledWith("uploads/file.txt");
        expect(mockContainerClient.getBlockBlobClient).not.toHaveBeenCalledWith("file.txt");
    });

    it("cannot produce signed URLs from a connection string without an account key", async () => {
        expect.assertions(1);

        const storage = new AzureStorage({
            ...baseOptions,
            connectionString: "BlobEndpoint=https://test-account.blob.core.windows.net;SharedAccessSignature=sv=2023-01-01&sig=x",
        });

        await expect(storage.getReadUrl("file.txt")).rejects.toThrow(/cannot produce a read URL/);
    });

    it("throws when constructed without any Azure credentials", () => {
        expect.assertions(1);

        expect(() => new AzureStorage(baseOptions)).toThrow(/Missing required Azure credentials/);
    });
});
