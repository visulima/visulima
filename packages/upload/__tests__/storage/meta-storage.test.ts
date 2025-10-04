import { describe, expect, it } from "vitest";

import MetaStorage from "../../src/storage/meta-storage";
import { metafile } from "../__helpers__/config";

const notImplementedMessage = "Not implemented";

describe(MetaStorage, () => {
    const metaStorage = new MetaStorage();

    it("has props", () => {
        expect(metaStorage).toHaveProperty("prefix", "");
        expect(metaStorage).toHaveProperty("suffix", ".META");
    });

    it("save", async () => {
        await expect(metaStorage.save(metafile.id, metafile)).resolves.toBe(metafile);
    });

    it("get", async () => {
        await expect(metaStorage.get(metafile.id)).rejects.toThrow(notImplementedMessage);
    });

    it("delete", async () => {
        await expect(metaStorage.delete(metafile.id)).rejects.toThrow(notImplementedMessage);
    });
});
