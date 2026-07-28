import { rm } from "node:fs/promises";

import { temporaryDirectory } from "tempy";
import { afterEach, describe, expect, it, vi } from "vitest";

import DiskStorage from "../../../src/storage/local/disk-storage";
import { storageOptions } from "../../__helpers__/config";

const wait = (ms: number): Promise<void> =>
    new Promise((resolve) => {
        setTimeout(resolve, ms);
    });

describe("diskStorage auto-purge lifecycle", () => {
    let directory: string | undefined;

    afterEach(async () => {
        vi.restoreAllMocks();

        if (directory) {
            await rm(directory, { force: true, recursive: true });
            directory = undefined;
        }
    });

    it("runs purge on the configured interval and stopAutoPurge halts it", async () => {
        expect.assertions(3);

        directory = temporaryDirectory();

        const storage = new DiskStorage({ ...storageOptions, directory, expiration: { maxAge: "1h", purgeInterval: 20 } });
        const purgeSpy = vi.spyOn(storage, "purge").mockResolvedValue([]);

        await wait(90);

        expect(purgeSpy.mock.calls.length).toBeGreaterThanOrEqual(2);

        storage.stopAutoPurge();

        const callsAfterStop = purgeSpy.mock.calls.length;

        expect((storage as unknown as { autoPurgeTimer?: unknown }).autoPurgeTimer).toBeUndefined();

        await wait(90);

        // No further purges once the timer is cleared.
        expect(purgeSpy.mock.calls.length).toBe(callsAfterStop);
    });
});
