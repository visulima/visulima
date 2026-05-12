import { describe, expect, it } from "vitest";

import BunnyFile from "../../../src/storage/bunny/bunny-file";

describe(BunnyFile, () => {
    it("should expose Bunny-specific properties", () => {
        expect.assertions(2);

        const file = new BunnyFile({ contentType: "video/mp4", metadata: { foo: "bar" }, originalName: "test.mp4" });

        file.bunnyPath = "/uploads/test.mp4";
        file.bunnyChecksum = "DEADBEEF";

        expect(file.bunnyPath).toBe("/uploads/test.mp4");
        expect(file.bunnyChecksum).toBe("DEADBEEF");
    });

    it("should extend the File base class", () => {
        expect.assertions(1);

        const file = new BunnyFile({ contentType: "video/mp4", metadata: { foo: "bar" }, originalName: "test.mp4" });

        expect(file).toHaveProperty("metadata");
    });
});
