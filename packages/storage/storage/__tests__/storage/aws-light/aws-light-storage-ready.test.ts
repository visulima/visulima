import { beforeEach, describe, expect, it, vi } from "vitest";

import { waitForStorage } from "../../../src/handler/utils/storage-utils";
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

    it("should not probe the bucket from the constructor", () => {
        expect.assertions(2);

        const storage = new AwsLightStorage(options);

        expect(storage.isReady).toBe(false);
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should probe the bucket once on the first request and become ready", async () => {
        expect.assertions(3);

        mockFetch.mockResolvedValue({ ok: true, status: 200, text: async () => "" });

        const storage = new AwsLightStorage(options);

        await waitForStorage(storage);
        await waitForStorage(storage);

        expect(storage.isReady).toBe(true);
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch.mock.calls[0]?.[1]).toStrictEqual({ method: "HEAD" });
    });

    it("should surface a failed probe and retry it on the next request", async () => {
        expect.assertions(4);

        mockFetch.mockResolvedValueOnce({ ok: false, status: 403, text: async () => "AccessDenied" });
        mockFetch.mockResolvedValueOnce({ ok: true, status: 200, text: async () => "" });

        const storage = new AwsLightStorage(options);

        await expect(waitForStorage(storage)).rejects.toThrow("Failed to access bucket: 403 AccessDenied");

        expect(storage.isReady).toBe(false);

        await waitForStorage(storage);

        expect(storage.isReady).toBe(true);
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should keep the base storage options and defaults it does not handle itself", () => {
        expect.assertions(4);

        const onComplete = vi.fn();
        const storage = new AwsLightStorage({ ...options, allowMIME: ["image/*"], maxUploadSize: 100, onComplete });

        expect(storage.maxUploadSize).toBe(100);
        expect(storage.config.allowMIME).toStrictEqual(["image/*"]);
        expect(storage.onComplete).toBe(onComplete);
        // `filename` was forwarded as undefined and replaced the default naming function.
        expect(storage.config.filename?.({ id: "abc" } as never)).toBe("abc");
    });
});
