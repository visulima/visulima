import type { AppendBlobClient, ContainerClient } from "@azure/storage-blob";
import { BlobServiceClient } from "@azure/storage-blob";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AzureMetaStorage from "../../../src/storage/azure/azure-meta-storage";
import type { AzureMetaStorageOptions } from "../../../src/storage/azure/types";
import { getMetaVersion } from "../../../src/storage/meta-storage";
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
            // Default: the sidecar already exists, so save() falls through to setMetadata.
            createIfNotExists: vi.fn().mockResolvedValue({ succeeded: false }),
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
                async *[Symbol.asyncIterator]() {
                    // Empty iterator
                },
            }),
        } as unknown as ContainerClient;

        // Mock BlobServiceClient constructor to return our mock instance
        // Note: Must use 'function' declaration, not arrow function, for constructor mocks
        // eslint-disable-next-line func-names, prefer-arrow-callback
        (BlobServiceClient as ReturnType<typeof vi.fn>).mockImplementation(function () {
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

        it("creates the sidecar blob with the metadata on the first save", async () => {
            expect.assertions(2);

            (mockAppendBlobClient.createIfNotExists as ReturnType<typeof vi.fn>).mockResolvedValue({ succeeded: true });

            await metaStorage.save(metafile.id, metafile);

            expect(mockAppendBlobClient.createIfNotExists).toHaveBeenCalledWith({ metadata: { file: expect.stringContaining(metafile.id) } });
            expect(mockAppendBlobClient.setMetadata).not.toHaveBeenCalled();
        });

        it("round-trips the upload record through a single JSON metadata value", async () => {
            expect.assertions(4);

            let stored: Record<string, string> = {};

            (mockAppendBlobClient.setMetadata as ReturnType<typeof vi.fn>).mockImplementation(async (metadata: Record<string, string>) => {
                stored = metadata;
            });

            await metaStorage.save(metafile.id, { ...metafile, bytesWritten: 10, metadata: { name: "ünïcode.mp4" }, size: 64 });

            (mockAppendBlobClient.getProperties as ReturnType<typeof vi.fn>).mockResolvedValue({ metadata: stored });

            const file = await metaStorage.get(metafile.id);

            expect(Object.keys(stored)).toStrictEqual(["file"]);
            expect(file.bytesWritten).toBe(10);
            expect(file.size).toBe(64);
            expect(file.metadata).toStrictEqual({ name: "ünïcode.mp4" });
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

        it("restores numeric offsets and camelCase field names from a legacy per-field sidecar", async () => {
            expect.assertions(3);

            (mockAppendBlobClient.getProperties as ReturnType<typeof vi.fn>).mockResolvedValue({
                metadata: { byteswritten: "10", id: metafile.id, originalname: "a.mp4", size: "64" },
            });

            const file = await metaStorage.get(metafile.id);

            expect(file.bytesWritten).toBe(10);
            expect(file.size).toBe(64);
            expect(file.originalName).toBe("a.mp4");
        });

        it("should throw error when metadata not found", async () => {
            expect.assertions(1);

            (mockAppendBlobClient.getProperties as ReturnType<typeof vi.fn>).mockResolvedValue({
                metadata: undefined,
            });

            await expect(metaStorage.get("non-existent-id")).rejects.toHaveProperty("UploadErrorCode", ERRORS.FILE_NOT_FOUND);
        });

        it("should report a missing blob as not found", async () => {
            expect.assertions(1);

            (mockAppendBlobClient.getProperties as ReturnType<typeof vi.fn>).mockRejectedValue(Object.assign(new Error("Blob not found"), { statusCode: 404 }));

            await expect(metaStorage.get("non-existent-id")).rejects.toHaveProperty("UploadErrorCode", ERRORS.FILE_NOT_FOUND);
        });

        it("should rethrow other getProperties failures", async () => {
            expect.assertions(1);

            (mockAppendBlobClient.getProperties as ReturnType<typeof vi.fn>).mockRejectedValue(Object.assign(new Error("Server busy"), { statusCode: 503 }));

            await expect(metaStorage.get(metafile.id)).rejects.toThrow("Server busy");
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

    describe("conditional saves", () => {
        it("should attach the ETag read by get() and save with an ifMatch condition", async () => {
            expect.assertions(3);

            vi.mocked(mockAppendBlobClient.getProperties).mockResolvedValueOnce({
                etag: '"v1"',
                metadata: { file: encodeURIComponent(JSON.stringify(metafile)) },
            } as never);
            vi.mocked(mockAppendBlobClient.setMetadata).mockResolvedValueOnce({ etag: '"v2"' } as never);

            const file = await metaStorage.get(metafile.id);

            expect(getMetaVersion(file)).toBe('"v1"');

            await metaStorage.saveIfVersion(metafile.id, file, '"v1"');

            expect(mockAppendBlobClient.setMetadata).toHaveBeenCalledWith(expect.any(Object), { conditions: { ifMatch: '"v1"' } });
            expect(getMetaVersion(file)).toBe('"v2"');
        });

        it.each([412, 404])("should report a %d failed condition as undefined", async (statusCode) => {
            expect.assertions(1);

            vi.mocked(mockAppendBlobClient.setMetadata).mockRejectedValueOnce(Object.assign(new Error("ConditionNotMet"), { statusCode }));

            await expect(metaStorage.saveIfVersion(metafile.id, { ...metafile }, '"v1"')).resolves.toBeUndefined();
        });
    });
});
