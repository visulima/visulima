import { describe, expect, it } from "vitest";

import OneDriveFile from "../../../src/storage/onedrive/onedrive-file";

describe(OneDriveFile, () => {
    it("should expose OneDrive-specific properties", () => {
        expect.assertions(3);

        const file = new OneDriveFile({ contentType: "video/mp4", metadata: { foo: "bar" }, originalName: "test.mp4" });

        file.driveItemId = "01ABCDEF1234";
        file.eTag = "\"{ETAG},1\"";
        file.webUrl = "https://contoso-my.sharepoint.com/personal/_layouts/15/file";

        expect(file.driveItemId).toBe("01ABCDEF1234");
        expect(file.eTag).toBe("\"{ETAG},1\"");
        expect(file.webUrl).toBe("https://contoso-my.sharepoint.com/personal/_layouts/15/file");
    });

    it("should extend the File base class", () => {
        expect.assertions(1);

        const file = new OneDriveFile({ contentType: "video/mp4", metadata: { foo: "bar" }, originalName: "test.mp4" });

        expect(file).toHaveProperty("metadata");
    });
});
