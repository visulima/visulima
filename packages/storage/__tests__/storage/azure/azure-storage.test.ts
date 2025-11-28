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
            vi.spyOn(storage, "getMeta").mockResolvedValue({ ...metafile } as never);

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
            vi.spyOn(storage, "getMeta").mockResolvedValue({ ...metafile } as never);

            // Mock blob exists to return false
            (mockBlobClient.exists as ReturnType<typeof vi.fn>).mockResolvedValue(false);

            const exists = await storage.exists({ id: metafile.id });

            expect(exists).toBe(false);
        });
    });
});
