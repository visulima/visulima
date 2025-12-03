import { describe, expect, it } from "vitest";

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
});
