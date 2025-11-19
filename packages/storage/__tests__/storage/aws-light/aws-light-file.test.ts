import { describe, expect, it } from "vitest";

import AwsLightFile from "../../../src/storage/aws-light/aws-light-file";

describe(AwsLightFile, () => {
    it("should have extra params", () => {
        expect.assertions(1);

        const file = new AwsLightFile({ metadata: { foo: "bar" } });

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
