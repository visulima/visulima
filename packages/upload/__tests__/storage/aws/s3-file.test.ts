import {
    describe, expect, it,
} from "vitest";

import S3File from "../../../src/storage/aws/s3-file";

describe("S3File", () => {
    it("should have extra params", () => {
        const file = new S3File({ metadata: { foo: "bar" } });

        file.uri = "uri";
        file.Parts = [];
        file.UploadId = "UploadId";
        file.partsUrls = [];
        file.partSize = 1;
        // eslint-disable-next-line no-secrets/no-secrets
        file.id = "8sUP8GVW46Ijxg2wPuhaK";
        // eslint-disable-next-line no-secrets/no-secrets
        file.originalName = "8sUP8GVW46Ijxg2wPuhaK";

        expect(file).toMatchSnapshot();
    });
});