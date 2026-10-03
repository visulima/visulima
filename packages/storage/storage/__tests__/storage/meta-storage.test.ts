import { describe, expect, it, vi } from "vitest";

import MetaStorage from "../../src/storage/meta-storage";
import { metafile } from "../__helpers__/config";

const notImplementedMessage = "Not implemented";

describe(MetaStorage, () => {
    const metaStorage = new MetaStorage();

    it("should have correct default properties", () => {
        expect.assertions(2);

        expect(metaStorage).toHaveProperty("prefix", "");
        expect(metaStorage).toHaveProperty("suffix", ".META");
    });

    it("should save metadata successfully", async () => {
        expect.assertions(1);

        await expect(metaStorage.save(metafile.id, metafile)).resolves.toBe(metafile);
    });

    it("should throw error when getting metadata (not implemented)", async () => {
        expect.assertions(1);

        await expect(metaStorage.get(metafile.id)).rejects.toThrow(notImplementedMessage);
    });

    it("should throw error when deleting metadata (not implemented)", async () => {
        expect.assertions(1);

        await expect(metaStorage.delete(metafile.id)).rejects.toThrow(notImplementedMessage);
    });

    describe("ensureAccess()", () => {
        class ProbedMetaStorage extends MetaStorage {
            public constructor(probe?: () => Promise<void>) {
                super();

                this.accessProbe = probe;
            }

            public async check(): Promise<void> {
                await this.ensureAccess();
            }
        }

        it("returns without probing when no probe is set", async () => {
            expect.assertions(1);

            await expect(new ProbedMetaStorage().check()).resolves.toBeUndefined();
        });

        it("runs the probe once and retries it after a failure", async () => {
            expect.assertions(2);

            const probe = vi.fn<() => Promise<void>>().mockRejectedValueOnce(new Error("down")).mockResolvedValue(undefined);
            const storage = new ProbedMetaStorage(probe);

            await expect(storage.check()).rejects.toThrow("down");

            await storage.check();
            await storage.check();

            expect(probe).toHaveBeenCalledTimes(2);
        });
    });
});
