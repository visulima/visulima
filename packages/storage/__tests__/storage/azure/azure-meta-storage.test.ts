import type { AppendBlobClient, ContainerClient } from "@azure/storage-blob";
import { BlobServiceClient } from "@azure/storage-blob";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AzureMetaStorage from "../../../src/storage/azure/azure-meta-storage";
import type { AzureMetaStorageOptions } from "../../../src/storage/azure/types";
import { ERRORS } from "../../../src/utils/errors";
import { metafile } from "../../__helpers__/config";

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

describe(AzureMetaStorage, () => {
    let metaStorage: AzureMetaStorage;
    let mockContainerClient: ContainerClient;
    let mockAppendBlobClient: AppendBlobClient;

    const options: AzureMetaStorageOptions = {
        accountKey: "test-account-key",
        accountName: "test-account",
        containerName: "test-container",
    };

    beforeEach(() => {
        vi.clearAllMocks();

        // Create mock append blob client
        mockAppendBlobClient = {
            deleteIfExists: vi.fn(),
            getProperties: vi.fn(),
            setMetadata: vi.fn(),
        } as unknown as AppendBlobClient;

        // Create mock container client
        mockContainerClient = {
            getAppendBlobClient: vi.fn().mockReturnValue(mockAppendBlobClient),
            getBlockBlobClient: vi.fn().mockReturnValue({
                deleteIfExists: vi.fn(),
            }),
            listBlobsFlat: vi.fn().mockReturnValue({
                async* [Symbol.asyncIterator]() {
                    // Empty iterator
                },
            }),
        } as unknown as ContainerClient;

        // Mock BlobServiceClient constructor to return our mock instance
        (BlobServiceClient as ReturnType<typeof vi.fn>).mockImplementation(() => {
            return {
                getContainerClient: vi.fn().mockReturnValue(mockContainerClient),
            };
        });

        metaStorage = new AzureMetaStorage(options);
    });

    describe(".save()", () => {
        it("should save metadata to Azure", async () => {
            expect.assertions(1);

            (mockAppendBlobClient.setMetadata as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

            await metaStorage.save(metafile.id, metafile);

            expect(mockAppendBlobClient.setMetadata).toHaveBeenCalledTimes(1);
        });
    });

    describe(".get()", () => {
        it("should retrieve metadata from Azure", async () => {
            expect.assertions(1);

            (mockAppendBlobClient.getProperties as ReturnType<typeof vi.fn>).mockResolvedValue({
                metadata: {
                    ...metafile,
                    bytesWritten: 0,
                    createdAt: new Date().toISOString(),
                    status: "created",
                },
            });

            const file = await metaStorage.get(metafile.id);

            expect(file.id).toBe(metafile.id);
        });

        it("should throw error when metadata not found", async () => {
            expect.assertions(1);

            (mockAppendBlobClient.getProperties as ReturnType<typeof vi.fn>).mockResolvedValue({
                metadata: undefined,
            });

            await expect(metaStorage.get("non-existent-id")).rejects.toHaveProperty("UploadErrorCode", ERRORS.FILE_NOT_FOUND);
        });

        it("should throw error when getProperties fails", async () => {
            expect.assertions(1);

            (mockAppendBlobClient.getProperties as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Blob not found"));

            await expect(metaStorage.get("non-existent-id")).rejects.toHaveProperty("UploadErrorCode", ERRORS.UNKNOWN_ERROR);
        });
    });

    describe(".delete()", () => {
        it("should delete metadata from Azure", async () => {
            expect.assertions(1);

            const mockBlockBlobClient = {
                deleteIfExists: vi.fn().mockResolvedValue({ succeeded: true }),
            };

            (mockContainerClient.getBlockBlobClient as ReturnType<typeof vi.fn>).mockReturnValue(mockBlockBlobClient);

            await metaStorage.delete(metafile.id);

            expect(mockBlockBlobClient.deleteIfExists).toHaveBeenCalledTimes(1);
        });
    });

    describe(".touch()", () => {
        it("should call save method", async () => {
            expect.assertions(1);

            (mockAppendBlobClient.setMetadata as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

            const result = await metaStorage.touch(metafile.id, metafile);

            expect(result).toBe(metafile);
        });
    });
});
