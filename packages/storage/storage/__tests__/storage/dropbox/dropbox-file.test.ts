import { describe, expect, it } from "vitest";

import DropboxFile from "../../../src/storage/dropbox/dropbox-file";

describe(DropboxFile, () => {
    it("should expose Dropbox-specific properties", () => {
        expect.assertions(3);

        const file = new DropboxFile({ contentType: "video/mp4", metadata: { foo: "bar" }, originalName: "test.mp4" });

        file.path = "/folder/test.mp4";
        file.rev = "0123abc";
        file.publicUrl = "https://www.dropbox.com/s/abc?dl=1";

        expect(file.path).toBe("/folder/test.mp4");
        expect(file.rev).toBe("0123abc");
        expect(file.publicUrl).toBe("https://www.dropbox.com/s/abc?dl=1");
    });

    it("should extend the File base class", () => {
        expect.assertions(1);

        const file = new DropboxFile({ contentType: "video/mp4", metadata: { foo: "bar" }, originalName: "test.mp4" });

        expect(file).toHaveProperty("metadata");
    });
});
