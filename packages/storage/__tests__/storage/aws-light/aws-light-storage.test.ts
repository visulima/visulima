import { createRequest } from "node-mocks-http";
import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

// Mock aws4fetch - must use vi.mock (not vi.doMock) for hoisting
// The factory function will be called when the module is imported
// MUST be defined before importing AwsLightStorage to ensure it intercepts import calls
vi.mock("aws4fetch", () => {
    // Create the mock fetch function inside the factory since we can't access outer scope variables
    // Store it in globalThis so tests can access it
    const sharedMockFetch = vi.fn();
    (globalThis as Record<string, unknown>)["__aws4fetchMockFetch"] = sharedMockFetch;
    
    // Return a mock AwsClient class that uses the shared mock fetch
    return {
        AwsClient: class MockAwsClient {
            public get fetch() {
                return sharedMockFetch;
            }

            public constructor(_config: unknown) {
                // Constructor does nothing, fetch is accessed via getter
            }
        },
    };
});

// Import AFTER the mock is set up to ensure import calls are intercepted
import AwsLightStorage from "../../../src/storage/aws-light/aws-light-storage";
import type { AwsLightStorageOptions } from "../../../src/storage/aws-light/types";
import { metafile, storageOptions, testfile } from "../../__helpers__/config";

// Helper function to get the shared mock fetch function from globalThis
const getMockFetch = (): ReturnType<typeof vi.fn> => {
    return (globalThis as Record<string, ReturnType<typeof vi.fn>>)["__aws4fetchMockFetch"] || vi.fn();
};

// Legacy mockStore for backward compatibility (deprecated, use getMockFetch() instead)
const mockStore: { fetch: ReturnType<typeof vi.fn> } = {
    get fetch() {
        return getMockFetch();
    },
    set fetch(value: ReturnType<typeof vi.fn>) {
        (globalThis as Record<string, ReturnType<typeof vi.fn>>)["__aws4fetchMockFetch"] = value;
    },
};

describe(AwsLightStorage, () => {
    vi.useFakeTimers().setSystemTime(new Date("2022-02-02"));

    const options: AwsLightStorageOptions = {
        ...(storageOptions as AwsLightStorageOptions),
        accessKeyId: "test-access-key",
        bucket: "bucket",
        region: "us-east-1",
        secretAccessKey: "test-secret-key",
    };

    const request = createRequest();

    let storage: AwsLightStorage;

    const metafileResponse = {
        Metadata: {
            metadata: encodeURIComponent(
                JSON.stringify({
                    ...metafile,
                    bytesWritten: 0,
                    createdAt: new Date().toISOString(),
                    status: "created",
                    UploadId: "987654321",
                }),
            ),
        },
    };

    beforeEach(async () => {
        vi.clearAllMocks();
        getMockFetch().mockClear();
    });

    describe(".create()", () => {
        it("should request api and set status and UploadId", async () => {
            expect.assertions(1);

            // Mock HEAD request (file not found)
            getMockFetch().mockResolvedValueOnce({
                ok: false,
                status: 404,
                text: vi.fn().mockResolvedValue(""),
            });

            // Mock create multipart upload
            const createMultipartUploadResponse = "<?xml version=\"1.0\" encoding=\"UTF-8\"?><InitiateMultipartUploadResult><UploadId>123456789</UploadId></InitiateMultipartUploadResult>";
            getMockFetch().mockResolvedValueOnce({
                ok: true,
                status: 200,
                text: vi.fn().mockResolvedValue(createMultipartUploadResponse),
            });


            // Create storage instance after mocks are set up
            storage = new AwsLightStorage(options);


            const awsLightFile = await storage.create(metafile);


            expect(awsLightFile).toMatchSnapshot({
                createdAt: expect.any(String),
                expiredAt: expect.any(Number),
            });
        });

        it("should handle existing", async () => {
            expect.assertions(1);

            // Mock HEAD request (file exists)
            getMockFetch().mockResolvedValueOnce({
                headers: new Headers({
                    "x-amz-meta-metadata": metafileResponse.Metadata.metadata,
                }),
                ok: true,
                status: 200,
                text: async () => "",
            });

            // Create storage instance after mocks are set up
            storage = new AwsLightStorage(options);

            const awsLightFile = await storage.create(metafile);

            expect(awsLightFile).toMatchSnapshot();
        });

        it("should send error on invalid s3 response", async () => {
            expect.assertions(1);

            getMockFetch().mockResolvedValueOnce({
                ok: false,
                status: 404,
                text: async () => "",
            });
            getMockFetch().mockResolvedValueOnce({
                ok: true,
                status: 200,
                text: async () => "<?xml version=\"1.0\" encoding=\"UTF-8\"?><InitiateMultipartUploadResult></InitiateMultipartUploadResult>",
            });

            // Create storage instance after mocks are set up
            storage = new AwsLightStorage(options);

            await expect(storage.create(metafile)).rejects.toMatchSnapshot();
        });

        it("should handle TTL option", async () => {
            expect.assertions(3);

            getMockFetch().mockResolvedValueOnce({
                ok: false,
                status: 404,
                text: async () => "",
            });
            getMockFetch().mockResolvedValueOnce({
                ok: true,
                status: 200,
                text: async () =>
                    "<?xml version=\"1.0\" encoding=\"UTF-8\"?><InitiateMultipartUploadResult><UploadId>123456789</UploadId></InitiateMultipartUploadResult>",
            });

            // Create storage instance after mocks are set up
            storage = new AwsLightStorage(options);

            const awsLightFile = await storage.create({ ...metafile, ttl: "30d" });

            expect(awsLightFile.expiredAt).toBeDefined();

            expectTypeOf(awsLightFile.expiredAt).toBeNumber();

            // TTL should be converted to expiredAt timestamp
            const expectedExpiry = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days in ms

            expect(awsLightFile.expiredAt).toBeGreaterThan(expectedExpiry - 1000); // Allow 1s tolerance
            expect(awsLightFile.expiredAt).toBeLessThan(expectedExpiry + 1000);
        });
    });

    describe(".write()", () => {
        it("should request api and set status and bytesWritten", async () => {
            expect.assertions(1);

            // Mock HEAD request
            getMockFetch().mockResolvedValueOnce({
                headers: new Headers({
                    "x-amz-meta-metadata": metafileResponse.Metadata.metadata,
                }),
                ok: true,
                status: 200,
                text: async () => "",
            });

            // Mock list parts (empty)
            getMockFetch().mockResolvedValueOnce({
                ok: true,
                status: 200,
                text: async () => "<?xml version=\"1.0\" encoding=\"UTF-8\"?><ListPartsResult></ListPartsResult>",
            });

            // Mock upload part
            getMockFetch().mockResolvedValueOnce({
                headers: new Headers({
                    ETag: "\"1234\"",
                }),
                ok: true,
                status: 200,
                text: async () => "",
            });

            // Mock complete multipart upload
            getMockFetch().mockResolvedValueOnce({
                ok: true,
                status: 200,
                text: async () =>
                    "<?xml version=\"1.0\" encoding=\"UTF-8\"?><CompleteMultipartUploadResult><Location>/1234</Location><ETag>\"etag123\"</ETag></CompleteMultipartUploadResult>",
            });

            // Create storage instance after mocks are set up
            storage = new AwsLightStorage(options);

            const part = {
                body: testfile.asReadable,
                contentLength: metafile.size,
                id: metafile.id,
                name: metafile.name,
                start: 0,
            };
            const awsLightFile = await storage.write(part);

            expect(awsLightFile).toMatchSnapshot();
        });

        it("should request api and set status and bytesWritten on resume", async () => {
            expect.assertions(1);

            // Mock HEAD request
            getMockFetch().mockResolvedValueOnce({
                headers: new Headers({
                    "x-amz-meta-metadata": metafileResponse.Metadata.metadata,
                }),
                ok: true,
                status: 200,
                text: async () => "",
            });

            // Mock list parts (empty)
            getMockFetch().mockResolvedValueOnce({
                ok: true,
                status: 200,
                text: async () => "<?xml version=\"1.0\" encoding=\"UTF-8\"?><ListPartsResult></ListPartsResult>",
            });

            // Create storage instance after mocks are set up
            storage = new AwsLightStorage(options);

            const part = {
                contentLength: 0,
                id: metafile.id,
                name: metafile.name,
            };
            const awsLightFile = await storage.write(part);

            expect(awsLightFile).toMatchSnapshot();
        });
    });

    describe("delete()", () => {
        it("should set status", async () => {
            expect.assertions(1);

            // Mock HEAD request
            getMockFetch().mockResolvedValueOnce({
                headers: new Headers({
                    "x-amz-meta-metadata": metafileResponse.Metadata.metadata,
                }),
                ok: true,
                status: 200,
                text: async () => "",
            });

            // Mock DELETE request
            getMockFetch().mockResolvedValueOnce({
                ok: true,
                status: 204,
                text: async () => "",
            });

            // Mock abort multipart upload (if needed)
            getMockFetch().mockResolvedValueOnce({
                ok: true,
                status: 204,
                text: async () => "",
            });

            // Create storage instance after mocks are set up
            storage = new AwsLightStorage(options);

            const deleted = await storage.delete(metafile);

            expect(deleted.status).toBe("deleted");
        });

        it("should return full file object when file exists", async () => {
            expect.assertions(2);

            // Mock HEAD request
            getMockFetch().mockResolvedValueOnce({
                headers: new Headers({
                    "x-amz-meta-metadata": metafileResponse.Metadata.metadata,
                }),
                ok: true,
                status: 200,
                text: async () => "",
            });

            // Mock DELETE request
            getMockFetch().mockResolvedValueOnce({
                ok: true,
                status: 204,
                text: async () => "",
            });

            // Mock abort multipart upload
            getMockFetch().mockResolvedValueOnce({
                ok: true,
                status: 204,
                text: async () => "",
            });

            // Create storage instance after mocks are set up
            storage = new AwsLightStorage(options);

            const deleted = await storage.delete(metafile);

            expect(deleted.id).toBe(metafile.id);
            expect(deleted.status).toBe("deleted");
        });

        it("should throw error when file does not exist", async () => {
            expect.assertions(1);

            // Mock HEAD request (file not found)
            getMockFetch().mockResolvedValueOnce({
                ok: false,
                status: 404,
                text: async () => "File not found",
            });

            // Create storage instance after mocks are set up
            storage = new AwsLightStorage(options);

            await expect(storage.delete(metafile)).rejects.toThrow();
        });
    });

    describe("copy()", () => {
        it("relative", async () => {
            expect.assertions(2);

            // Mock HEAD request for source file
            getMockFetch().mockResolvedValueOnce({
                headers: new Headers({
                    "x-amz-meta-metadata": metafileResponse.Metadata.metadata,
                }),
                ok: true,
                status: 200,
                text: async () => "",
            });

            // Mock COPY request
            getMockFetch().mockResolvedValueOnce({
                ok: true,
                status: 200,
                text: async () => "",
            });

            // Create storage instance after mocks are set up
            storage = new AwsLightStorage(options);

            const result = await storage.copy("name", "new name");

            expect(mockStore.fetch).toHaveBeenCalledWith(
                expect.stringContaining("new name"),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        "x-amz-copy-source": expect.stringContaining("bucket/name"),
                    }),
                    method: "PUT",
                }),
            );
            expect(result.name).toBe("new name");
        });

        it("absolute", async () => {
            expect.assertions(2);

            // Mock HEAD request for source file
            getMockFetch().mockResolvedValueOnce({
                headers: new Headers({
                    "x-amz-meta-metadata": metafileResponse.Metadata.metadata,
                }),
                ok: true,
                status: 200,
                text: async () => "",
            });

            // Mock COPY request
            getMockFetch().mockResolvedValueOnce({
                ok: true,
                status: 200,
                text: async () => "",
            });

            // Create storage instance after mocks are set up
            storage = new AwsLightStorage(options);

            const result = await storage.copy("name", "/otherBucket/new name");

            expect(mockStore.fetch).toHaveBeenCalledWith(
                expect.stringContaining("otherBucket"),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        "x-amz-copy-source": expect.stringContaining("bucket/name"),
                    }),
                    method: "PUT",
                }),
            );
            expect(result.name).toBe("new name");
        });
    });

    describe(".update()", () => {
        it("should update changed metadata keys", async () => {
            expect.assertions(2);

            // Mock HEAD request
            getMockFetch().mockResolvedValueOnce({
                headers: new Headers({
                    "x-amz-meta-metadata": metafileResponse.Metadata.metadata,
                }),
                ok: true,
                status: 200,
                text: async () => "",
            });

            // Create storage instance after mocks are set up
            storage = new AwsLightStorage(options);

            const awsLightFile = await storage.update(metafile, { metadata: { name: "newname.mp4" } });

            expect(awsLightFile.metadata.name).toBe("newname.mp4");
            expect(awsLightFile.metadata.mimeType).toBe(metafile.metadata.mimeType);
        });

        it("should reject if not found", async () => {
            expect.assertions(1);

            // Mock HEAD request (file not found)
            getMockFetch().mockResolvedValueOnce({
                ok: false,
                status: 404,
                text: async () => "File not found",
            });

            // Create storage instance after mocks are set up
            storage = new AwsLightStorage(options);

            await expect(storage.update(metafile, { metadata: { name: "newname.mp4" } })).rejects.toHaveProperty("UploadErrorCode", "FileNotFound");
        });

        it("should handle TTL option in update", async () => {
            expect.assertions(3);

            // Mock HEAD request
            getMockFetch().mockResolvedValueOnce({
                headers: new Headers({
                    "x-amz-meta-metadata": metafileResponse.Metadata.metadata,
                }),
                ok: true,
                status: 200,
                text: async () => "",
            });

            // Create storage instance after mocks are set up
            storage = new AwsLightStorage(options);

            const awsLightFile = await storage.update(metafile, { ttl: "1h" });

            expect(awsLightFile.expiredAt).toBeDefined();

            expectTypeOf(awsLightFile.expiredAt).toBeNumber();

            // TTL should be converted to expiredAt timestamp
            const expectedExpiry = Date.now() + 60 * 60 * 1000; // 1 hour in ms

            expect(awsLightFile.expiredAt).toBeGreaterThan(expectedExpiry - 1000); // Allow 1s tolerance
            expect(awsLightFile.expiredAt).toBeLessThan(expectedExpiry + 1000);
        });
    });

    describe("normalizeError", () => {
        it("aws-light error", () => {
            expect.assertions(1);

            const error = {
                code: "SomeServiceException",
                message: "SomeServiceException",
                name: "SomeError",
                statusCode: 400,
            };

            expect(storage.normalizeError(error)).toMatchSnapshot();
        });

        it("not aws-light error", () => {
            expect.assertions(1);

            expect(storage.normalizeError(new Error("unknown"))).toMatchSnapshot();
        });
    });
});

describe("awsLightPresignedStorage", () => {
    vi.useFakeTimers().setSystemTime(new Date("2022-02-02"));

    const options: AwsLightStorageOptions = {
        ...(storageOptions as AwsLightStorageOptions),
        accessKeyId: "test-access-key",
        bucket: "bucket",
        clientDirectUpload: true,
        region: "us-east-1",
        secretAccessKey: "test-secret-key",
    };

    let storage: AwsLightStorage;

    const metafileResponse = {
        Metadata: {
            metadata: encodeURIComponent(
                JSON.stringify({
                    ...metafile,
                    bytesWritten: 0,
                    createdAt: new Date().toISOString(),
                    status: "created",
                    UploadId: "987654321",
                }),
            ),
        },
    };

    beforeEach(async () => {
        vi.clearAllMocks();
        getMockFetch().mockClear();
    });

    describe(".create()", () => {
        it("should request api and set status and UploadId", async () => {
            expect.assertions(2);

            // Mock HEAD request (file not found)
            getMockFetch().mockResolvedValueOnce({
                ok: false,
                status: 404,
                text: async () => "",
            });

            // Mock create multipart upload
            getMockFetch().mockResolvedValueOnce({
                ok: true,
                status: 200,
                text: async () =>
                    "<?xml version=\"1.0\" encoding=\"UTF-8\"?><InitiateMultipartUploadResult><UploadId>123456789</UploadId></InitiateMultipartUploadResult>",
            });

            // Mock list parts (empty)
            getMockFetch().mockResolvedValueOnce({
                ok: true,
                status: 200,
                text: async () => "<?xml version=\"1.0\" encoding=\"UTF-8\"?><ListPartsResult></ListPartsResult>",
            });

            // Create storage instance after mocks are set up
            storage = new AwsLightStorage(options);

            const awsLightFile = await storage.create(metafile);

            expect(awsLightFile.partsUrls?.length).toBeGreaterThan(0);
            expect(awsLightFile.partSize).toBeGreaterThan(0);
        });
    });

    describe("update", () => {
        it("should add partsUrls", async () => {
            expect.assertions(1);

            // Mock HEAD request
            getMockFetch().mockResolvedValueOnce({
                headers: new Headers({
                    "x-amz-meta-metadata": metafileResponse.Metadata.metadata,
                }),
                ok: true,
                status: 200,
                text: async () => "",
            });

            // Mock list parts (empty)
            getMockFetch().mockResolvedValueOnce({
                ok: true,
                status: 200,
                text: async () => "<?xml version=\"1.0\" encoding=\"UTF-8\"?><ListPartsResult></ListPartsResult>",
            });

            // Create storage instance after mocks are set up
            storage = new AwsLightStorage(options);

            const awsLightFile = await storage.update(metafile, metafile);

            expect(awsLightFile.partsUrls?.length).toBeGreaterThan(0);
        });

        it("should complete", async () => {
            expect.assertions(1);

            // Mock HEAD request
            getMockFetch().mockResolvedValueOnce({
                headers: new Headers({
                    "x-amz-meta-metadata": metafileResponse.Metadata.metadata,
                }),
                ok: true,
                status: 200,
                text: async () => "",
            });

            const preCompleted = {
                ...metafile,
                Parts: [{ ETag: "123456789", PartNumber: 1, Size: 64 }],
                partSize: 16_777_216,
                partsUrls: ["https://api.s3.example.com?signed"],
                UploadId: "123456789",
            };

            // Mock complete multipart upload
            getMockFetch().mockResolvedValueOnce({
                ok: true,
                status: 200,
                text: async () =>
                    "<?xml version=\"1.0\" encoding=\"UTF-8\"?><CompleteMultipartUploadResult><Location>/1234</Location><ETag>\"etag123\"</ETag></CompleteMultipartUploadResult>",
            });

            // Create storage instance after mocks are set up
            storage = new AwsLightStorage(options);

            const awsLightFile = await storage.update({ id: metafile.id }, preCompleted);

            expect(awsLightFile.status).toBe("completed");
        });

        it("should complete (empty payload)", async () => {
            expect.assertions(1);

            // Mock HEAD request
            getMockFetch().mockResolvedValueOnce({
                headers: new Headers({
                    "x-amz-meta-metadata": metafileResponse.Metadata.metadata,
                }),
                ok: true,
                status: 200,
                text: async () => "",
            });

            // Mock list parts
            getMockFetch().mockResolvedValueOnce({
                ok: true,
                status: 200,
                text: async () =>
                    "<?xml version=\"1.0\" encoding=\"UTF-8\"?><ListPartsResult><Part><ETag>123456789</ETag><PartNumber>1</PartNumber><Size>64</Size></Part></ListPartsResult>",
            });

            // Mock complete multipart upload
            getMockFetch().mockResolvedValueOnce({
                ok: true,
                status: 200,
                text: async () =>
                    "<?xml version=\"1.0\" encoding=\"UTF-8\"?><CompleteMultipartUploadResult><Location>/1234</Location><ETag>\"etag123\"</ETag></CompleteMultipartUploadResult>",
            });

            // Create storage instance after mocks are set up
            storage = new AwsLightStorage(options);

            const awsLightFile = await storage.update({ id: metafile.id }, {});

            expect(awsLightFile.status).toBe("completed");
        });
    });
});
