import { describe, expect, it } from "vitest";

import GoogleDriveFile from "../../../src/storage/google-drive/google-drive-file";

describe(GoogleDriveFile, () => {
    it("should expose Drive-specific properties", () => {
        expect.assertions(3);

        const file = new GoogleDriveFile({ contentType: "video/mp4", metadata: { foo: "bar" }, originalName: "test.mp4" });

        file.driveFileId = "abc123";
        file.mimeType = "video/mp4";
        file.publicUrl = "https://drive.google.com/uc?id=abc123";

        expect(file.driveFileId).toBe("abc123");
        expect(file.mimeType).toBe("video/mp4");
        expect(file.publicUrl).toBe("https://drive.google.com/uc?id=abc123");
    });

    it("should extend the File base class", () => {
        expect.assertions(1);

        const file = new GoogleDriveFile({ contentType: "video/mp4", metadata: { foo: "bar" }, originalName: "test.mp4" });

        expect(file).toHaveProperty("metadata");
    });
});
