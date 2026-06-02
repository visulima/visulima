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
