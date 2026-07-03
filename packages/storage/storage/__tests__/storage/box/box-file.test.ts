import { describe, expect, it } from "vitest";

import BoxFile from "../../../src/storage/box/box-file";

describe(BoxFile, () => {
    it("should expose Box-specific properties", () => {
        expect.assertions(3);

        const file = new BoxFile({ contentType: "video/mp4", metadata: { foo: "bar" }, originalName: "test.mp4" });

        file.boxFileId = "1234567890";
        file.eTag = "0";
        file.publicUrl = "https://app.box.com/s/abc";

        expect(file.boxFileId).toBe("1234567890");
        expect(file.eTag).toBe("0");
        expect(file.publicUrl).toBe("https://app.box.com/s/abc");
    });

    it("should extend the File base class", () => {
        expect.assertions(1);

        const file = new BoxFile({ contentType: "video/mp4", metadata: { foo: "bar" }, originalName: "test.mp4" });

        expect(file).toHaveProperty("metadata");
    });
});
