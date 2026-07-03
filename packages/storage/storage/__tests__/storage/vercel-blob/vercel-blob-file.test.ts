import { describe, expect, it } from "vitest";

import VercelBlobFile from "../../../src/storage/vercel-blob/vercel-blob-file";

describe(VercelBlobFile, () => {
    it("should include Vercel Blob-specific properties and match snapshot", () => {
        expect.assertions(1);

        const file = new VercelBlobFile({ metadata: { foo: "bar" } });

        file.url = "https://example.com/blob/test-file";
        file.downloadUrl = "https://example.com/blob/test-file/download";
        file.pathname = "test-path";
        file.id = "PsRqecfPghVJE6veB-IcX";
        file.originalName = "testfile.mp4";

        expect(file).toMatchSnapshot();
    });

    it("should extend File base class", () => {
        expect.assertions(1);

        const file = new VercelBlobFile({ metadata: { foo: "bar" } });

        expect(file).toHaveProperty("metadata");
    });
});
