import { beforeEach, describe, expect, it, vi } from "vitest";

import AwsLightMetaStorage from "../../../src/storage/aws-light/aws-light-meta-storage";
import type { AwsLightMetaStorageOptions } from "../../../src/storage/aws-light/types";
import { metafile } from "../../__helpers__/config";

// Mock aws-light-api-adapter
vi.mock(import("../../../src/storage/aws-light/aws-light-api-adapter"), () => {
    class MockAwsLightApiAdapter {
        public checkBucketAccess = vi.fn().mockResolvedValue(undefined);

        public deleteObject = vi.fn().mockResolvedValue(undefined);

        public headObject = vi.fn();

        public putObject = vi.fn().mockResolvedValue(undefined);
    }

    return {
        default: MockAwsLightApiAdapter,
    };
});

describe(AwsLightMetaStorage, () => {
    let metaStorage: AwsLightMetaStorage;

    const options: AwsLightMetaStorageOptions = {
        accessKeyId: "test-access-key",
        bucket: "test-bucket",
        region: "us-east-1",
        secretAccessKey: "test-secret-key",
    };

    beforeEach(() => {
        vi.clearAllMocks();
        metaStorage = new AwsLightMetaStorage(options);
    });

    describe(".save()", () => {
        it("should save metadata to S3", async () => {
            expect.assertions(1);

            await metaStorage.save(metafile.id, metafile);

            // Access the adapter instance through the metaStorage instance
            const adapterInstance = (metaStorage as { adapter?: { putObject?: ReturnType<typeof vi.fn> } }).adapter;

            expect(adapterInstance?.putObject).toHaveBeenCalledTimes(1);
        });

        it("should encode metadata correctly", async () => {
            expect.assertions(1);

            await metaStorage.save(metafile.id, metafile);

            // Access the adapter instance through the metaStorage instance
            const adapterInstance = (metaStorage as { adapter?: { putObject?: ReturnType<typeof vi.fn> } }).adapter;
            const putCall = adapterInstance?.putObject?.mock.calls[0]?.[0];

            expect(putCall?.Metadata?.metadata).toBeDefined();
        });
    });

    describe(".get()", () => {
        it("should retrieve metadata from S3", async () => {
            expect.assertions(1);

            const adapterInstance = (metaStorage as { adapter?: { headObject?: ReturnType<typeof vi.fn> } }).adapter;

            const metadata = encodeURIComponent(
                JSON.stringify({
                    ...metafile,
                    bytesWritten: 0,
                    createdAt: new Date().toISOString(),
                    status: "created",
                }),
            );

            adapterInstance?.headObject?.mockResolvedValueOnce({
                Metadata: { metadata },
            });

            const file = await metaStorage.get(metafile.id);

            expect(file.id).toBe(metafile.id);
        });

        it("should throw error when metadata not found", async () => {
            expect.assertions(1);

            const adapterInstance = (metaStorage as { adapter?: { headObject?: ReturnType<typeof vi.fn> } }).adapter;

            adapterInstance?.headObject?.mockResolvedValueOnce({
                Metadata: {},
            });

            await expect(metaStorage.get("non-existent-id")).rejects.toThrow("Metafile non-existent-id not found");
        });

        it("should delete expired metadata", async () => {
            expect.assertions(2);

            const adapterInstance = (metaStorage as { adapter?: { deleteObject?: ReturnType<typeof vi.fn>; headObject?: ReturnType<typeof vi.fn> } }).adapter;

            const expiredDate = new Date(Date.now() - 1000 * 60 * 60); // 1 hour ago
            const metadata = encodeURIComponent(
                JSON.stringify({
                    ...metafile,
                    bytesWritten: 0,
                    createdAt: new Date().toISOString(),
                    status: "created",
                }),
            );

            adapterInstance?.headObject?.mockResolvedValueOnce({
                Expires: expiredDate,
                Metadata: { metadata },
            });

            await expect(metaStorage.get(metafile.id)).rejects.toThrow(`Metafile ${metafile.id} not found`);

            expect(adapterInstance?.deleteObject).toHaveBeenCalledTimes(1);
        });
    });

    describe(".delete()", () => {
        it("should delete metadata from S3", async () => {
            expect.assertions(1);

            const adapterInstance = (metaStorage as { adapter?: { deleteObject?: ReturnType<typeof vi.fn> } }).adapter;

            await metaStorage.delete(metafile.id);

            expect(adapterInstance?.deleteObject).toHaveBeenCalledTimes(1);
        });
    });

    describe(".touch()", () => {
        it("should call save method", async () => {
            expect.assertions(1);

            const result = await metaStorage.touch(metafile.id, metafile);

            expect(result).toBe(metafile);
        });
    });
});
