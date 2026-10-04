import { BlobServiceClient } from "@azure/storage-blob";
import { instance } from "gaxios";
import { afterEach, describe, vi } from "vitest";

import AzureStorage from "../../src/storage/azure/azure-storage";
import GCStorage from "../../src/storage/gcs/gcs-storage";
import { createAzureFake } from "../__helpers__/fakes/azure";
import { createGcsFake } from "../__helpers__/fakes/gcs";
import { describeMatrix } from "../__helpers__/matrix";

vi.mock(import("@azure/storage-blob"), async (importOriginal) => {
    const actual = await importOriginal();

    return { ...actual, BlobServiceClient: vi.fn() };
});

describe("azure storage matrix (container fake)", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    describeMatrix({
        resumable: true,
        setup: () => {
            const azure = createAzureFake();

            // eslint-disable-next-line func-names, prefer-arrow-callback -- constructor mock
            vi.mocked(BlobServiceClient).mockImplementation(function () {
                return azure.service as unknown as BlobServiceClient;
            });

            return {
                createStorage: (options) =>
                    new AzureStorage({ accountKey: "a2V5", accountName: "acct", containerName: "files", retryConfig: { maxRetries: 0 }, ...options }),
                hasObject: (key) => azure.blobs.has(key),
                putObject: (key, content) => {
                    azure.put(key, Buffer.from(content), {});
                },
            };
        },
    });
});

describe("gcs storage matrix (JSON API fake)", () => {
    afterEach(() => {
        instance.defaults = {};
    });

    describeMatrix({
        customNamePurgeGap: "GCSMetaStorage can't list its records; purge looks uploads up by object name",
        resumable: true,
        setup: () => {
            const gcs = createGcsFake();

            instance.defaults = { fetchImplementation: gcs.fetch as never };

            return {
                createStorage: (options) =>
                    new GCStorage({
                        bucket: "uploads",
                        projectId: "test",
                        retryOptions: { retry: 0 },
                        storageAPI: "https://gcs.test/storage/v1/b",
                        uploadAPI: "https://gcs.test/upload/storage/v1/b",
                        ...options,
                    }),
                hasObject: (key) => gcs.objects.has(key),
                putObject: (key, content) => {
                    gcs.objects.set(key, { body: Buffer.from(content), contentType: "text/plain", generation: 1, updated: new Date() });
                },
            };
        },
    });
});
