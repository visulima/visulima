import { describe, expect, it } from "vitest";

import GCSFile from "../../../src/storage/gcs/gcs-file";

describe(GCSFile, () => {
    it("should include GCS-specific properties and match snapshot", () => {
        expect.assertions(1);

        const file = new GCSFile({ metadata: { foo: "bar" } });

        file.GCSUploadURI = "https://storage.googleapis.com/upload/example";
        file.uri = "gs://bucket-name/file-name";

        // eslint-disable-next-line no-secrets/no-secrets -- Test ID, not a secret
        file.id = "GCSFileTestId123456789";

        // eslint-disable-next-line no-secrets/no-secrets -- Test ID, not a secret
        file.originalName = "GCSFileTestId123456789";

        expect(file).toMatchSnapshot();
    });
});
