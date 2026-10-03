import { afterEach, describe, expect, it, vi } from "vitest";

import { waitForStorage } from "../../../src/handler/utils/storage-utils";

describe(waitForStorage, () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it("should return immediately for a ready storage without running its check", async () => {
        expect.assertions(1);

        const ensureReady = vi.fn();

        await waitForStorage({ ensureReady, isReady: true });

        expect(ensureReady).not.toHaveBeenCalled();
    });

    it("should time out when the access check never settles", async () => {
        expect.assertions(1);

        vi.useFakeTimers();

        const pending = waitForStorage({ ensureReady: async () => new Promise<void>(() => {}), isReady: false }, 1000).catch((error: unknown) => error);

        await vi.advanceTimersByTimeAsync(1000);

        await expect(pending).resolves.toStrictEqual(new Error("Storage initialization timeout"));
    });

    it("should poll a storage without an access check until it reports ready", async () => {
        expect.assertions(1);

        vi.useFakeTimers();

        const storage = { ensureReady: async () => {}, isReady: false };
        const pending = waitForStorage(storage, 1000);

        await vi.advanceTimersByTimeAsync(200);
        storage.isReady = true;
        await vi.advanceTimersByTimeAsync(100);

        await expect(pending).resolves.toBeUndefined();
    });

    it("should share one timeout between the access check and the polling after it", async () => {
        expect.assertions(1);

        vi.useFakeTimers();

        // The check settles just before the deadline without making the storage ready.
        const ensureReady = async () =>
            new Promise<void>((resolve) => {
                setTimeout(resolve, 900);
            });
        const pending = waitForStorage({ ensureReady, isReady: false }, 1000).catch((error: unknown) => error);

        await vi.advanceTimersByTimeAsync(1200);

        await expect(pending).resolves.toStrictEqual(new Error("Storage initialization timeout"));
    });

    it("should time out a storage that never reports ready", async () => {
        expect.assertions(1);

        vi.useFakeTimers();

        const pending = waitForStorage({ isReady: false }, 500).catch((error: unknown) => error);

        await vi.advanceTimersByTimeAsync(600);

        await expect(pending).resolves.toStrictEqual(new Error("Storage initialization timeout"));
    });
});
