import { beforeEach, describe, expect, it, vi } from "vitest";

import { waitForStorage } from "../../../src/handler/utils/storage-utils";
import AwsLightMetaStorage from "../../../src/storage/aws-light/aws-light-meta-storage";
import AwsLightStorage from "../../../src/storage/aws-light/aws-light-storage";
import type { AwsLightStorageOptions } from "../../../src/storage/aws-light/types";

const { mockFetch } = vi.hoisted(() => {
    return { mockFetch: vi.fn() };
});

vi.mock(import("aws4fetch"), () => {
    return {
        AwsClient: class MockAwsClient {
            // eslint-disable-next-line class-methods-use-this
            public get fetch() {
                return mockFetch;
            }
        },
    };
});

const ok = { ok: true, status: 200, text: async () => "" };

// #905: the base constructor probed the bucket before the subclass created its client, so the
// storage never became ready and every request answered 503 after the readiness timeout.
describe("awsLightStorage readiness (#905)", () => {
    const options: AwsLightStorageOptions = {
        accessKeyId: "id",
        bucket: "uploads",
        endpoint: "https://acct.r2.cloudflarestorage.com",
        region: "auto",
        secretAccessKey: "secret",
    };

    beforeEach(() => {
        mockFetch.mockReset();
    });

    it("should probe the bucket once its client exists and become ready", async () => {
        expect.assertions(3);

        mockFetch.mockResolvedValue(ok);

        const storage = new AwsLightStorage(options);

        await waitForStorage(storage);
        await waitForStorage(storage);

        expect(storage.isReady).toBe(true);
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch.mock.calls[0]?.[1]).toStrictEqual({ method: "HEAD" });
    });

    it("should retry a failed startup probe on the next request and surface its error", async () => {
        expect.assertions(4);

        mockFetch.mockResolvedValueOnce({ ok: false, status: 403, text: async () => "AccessDenied" });
        mockFetch.mockResolvedValueOnce(ok);

        const storage = new AwsLightStorage(options);

        // The first request joins the failing startup probe instead of starting a second one.
        await expect(waitForStorage(storage)).rejects.toThrow("Failed to access bucket: 403 AccessDenied");

        expect(storage.isReady).toBe(false);

        await waitForStorage(storage);

        expect(storage.isReady).toBe(true);
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should forward the base storage options it does not handle itself", async () => {
        expect.assertions(5);

        mockFetch.mockResolvedValue(ok);

        const onComplete = vi.fn();
        const expiration = { maxAge: "1h", purgeInterval: "10min", rolling: true };
        const storage = new AwsLightStorage({ ...options, allowMIME: ["image/*"], expiration, maxUploadSize: 100, onComplete });

        try {
            expect(storage.maxUploadSize).toBe(100);
            expect(storage.config.allowMIME).toStrictEqual(["image/*"]);
            expect(storage.onComplete).toBe(onComplete);
            // purgeInterval and rolling used to be dropped, so auto-purge never started.
            expect(storage.config.expiration).toStrictEqual(expiration);
            expect((storage as unknown as { meta: unknown }).meta).toBeInstanceOf(AwsLightMetaStorage);
        } finally {
            await storage.close();
        }
    });
});
