import { describe, expect, it } from "vitest";

import UploadThingFile from "../../../src/storage/uploadthing/uploadthing-file";

describe(UploadThingFile, () => {
    it("should expose UploadThing-specific properties", () => {
        expect.assertions(4);

        const file = new UploadThingFile({ contentType: "video/mp4", metadata: { foo: "bar" }, originalName: "test.mp4" });

        file.customId = "user/test.mp4";
        file.fileHash = "deadbeef";
        file.ufsKey = "uk-abc";
        file.url = "https://app.ufs.sh/f/uk-abc";

        expect(file.customId).toBe("user/test.mp4");
        expect(file.fileHash).toBe("deadbeef");
        expect(file.ufsKey).toBe("uk-abc");
        expect(file.url).toBe("https://app.ufs.sh/f/uk-abc");
    });

    it("should extend the File base class", () => {
        expect.assertions(1);

        const file = new UploadThingFile({ contentType: "video/mp4", metadata: { foo: "bar" }, originalName: "test.mp4" });

        expect(file).toHaveProperty("metadata");
    });
});
