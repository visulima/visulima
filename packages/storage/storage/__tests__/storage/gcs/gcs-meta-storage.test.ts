import type { GoogleAuth } from "google-auth-library";
import type { Response as NodeFetchResponse } from "node-fetch";
import { beforeEach, describe, expect, it, vi } from "vitest";

import GCSMetaStorage from "../../../src/storage/gcs/gcs-meta-storage";
import type { GCSMetaStorageOptions } from "../../../src/storage/gcs/types";
import { metafile } from "../../__helpers__/config";

const mockAuthRequest = vi.fn();

vi.mock(import("google-auth-library"), () => {
    return {
        GoogleAuth: vi.fn().mockImplementation(function GoogleAuthMock(this: GoogleAuth, _config: GCSMetaStorageOptions) {
            this.request = mockAuthRequest;

            return this;
        }),
    };
});

describe(GCSMetaStorage, async () => {
    const { Response } = await vi.importActual<{ Response: typeof NodeFetchResponse }>("node-fetch");

    vi.useFakeTimers().setSystemTime(new Date("2022-02-02"));

    let metaStorage: GCSMetaStorage;

    const options: GCSMetaStorageOptions = {
        bucket: "test-bucket",
        projectId: "test-project",
    };

    beforeEach(() => {
        vi.clearAllMocks();

        mockAuthRequest.mockResolvedValueOnce({ bucket: "ok" });

        metaStorage = new GCSMetaStorage(options);
    });

    describe("bucket access check", () => {
        it("reports a missing bucket by name and retries the probe on the next operation", async () => {
            expect.assertions(2);

            mockAuthRequest.mockReset();
            mockAuthRequest.mockRejectedValueOnce(Object.assign(new Error("Not Found"), { code: "404" }));

            await expect(metaStorage.save(metafile.id, metafile)).rejects.toThrow("Bucket test-bucket does not exist");

            mockAuthRequest.mockResolvedValue({ status: 200 });

            await metaStorage.save(metafile.id, metafile);

            expect(mockAuthRequest).toHaveBeenCalledTimes(3); // failed probe + probe + save
        });

        it("does not probe a caller-supplied auth client", async () => {
            expect.assertions(1);

            mockAuthRequest.mockReset();

            const request = vi.fn().mockResolvedValue({ status: 200 });
            const storage = new GCSMetaStorage({ ...options, authClient: { request } as unknown as GoogleAuth });

            await storage.save(metafile.id, metafile);

            expect(request).toHaveBeenCalledTimes(1);
        });
    });

    describe(".save()", () => {
        it("should save metadata to GCS", async () => {
            expect.assertions(1);

            mockAuthRequest.mockResolvedValueOnce({ status: 200 });

            await metaStorage.save(metafile.id, metafile);

            expect(mockAuthRequest).toHaveBeenCalledTimes(2); // accessCheck + save
        });
    });

    describe(".get()", () => {
        it("should retrieve metadata from GCS", async () => {
            expect.assertions(1);

            mockAuthRequest.mockResolvedValueOnce({
                data: {
                    ...metafile,
                    bytesWritten: 0,
                    createdAt: new Date().toISOString(),
                    status: "created",
                },
                status: 200,
            });

            const file = await metaStorage.get(metafile.id);

            expect(file.id).toBe(metafile.id);
        });

        it("should parse metadata correctly", async () => {
            expect.assertions(1);

            // Metadata should be in the format: "key base64value" (comma-separated)
            // For {foo: "bar"}, it should be: "foo " + base64("bar")
            const metadataString = `foo ${Buffer.from("bar", "utf8").toString("base64")}`;

            const fileWithStringMetadata = {
                ...metafile,
                bytesWritten: 0,
                createdAt: new Date().toISOString(),
                metadata: metadataString,
                status: "created",
            };

            mockAuthRequest.mockResolvedValueOnce({
                data: fileWithStringMetadata,
                status: 200,
            });

            const file = await metaStorage.get(metafile.id);

            expect(file.metadata).toEqual({ foo: "bar" });
        });
    });

    describe(".delete()", () => {
        it("should delete metadata from GCS", async () => {
            expect.assertions(1);

            mockAuthRequest.mockResolvedValueOnce({ status: 204 });

            await metaStorage.delete(metafile.id);

            expect(mockAuthRequest).toHaveBeenCalledTimes(2); // accessCheck + delete
        });
    });

    describe(".touch()", () => {
        it("should call save method", async () => {
            expect.assertions(1);

            mockAuthRequest.mockResolvedValueOnce({ status: 200 });

            const result = await metaStorage.touch(metafile.id, metafile);

            expect(result).toBe(metafile);
        });
    });
});
