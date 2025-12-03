import { describe, expect, it } from "vitest";

import NetlifyBlobFile from "../../../src/storage/netlify-blob/netlify-blob-file";

describe(NetlifyBlobFile, () => {
    it("should include Netlify Blob-specific properties and match snapshot", () => {
        expect.assertions(1);

        const file = new NetlifyBlobFile({ metadata: { foo: "bar" } });

        file.url = "https://example.com/blob/test-file";
        file.pathname = "test-path";
        file.id = "PsRqecfPghVJE6veB-IcX";
        file.originalName = "testfile.mp4";

        expect(file).toMatchSnapshot();
    });

    it("should extend File base class", () => {
        expect.assertions(1);

        const file = new NetlifyBlobFile({ metadata: { foo: "bar" } });

        expect(file).toHaveProperty("metadata");
    });
});
