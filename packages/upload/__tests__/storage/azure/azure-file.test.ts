import { describe, expect, it } from "vitest";

import AzureFile from "../../../src/storage/azure/azure-file";

describe("AzureFile", () => {
    it("should have extra params", () => {
        const file = new AzureFile({ metadata: { foo: "bar" } });

        file.requestId = "requestId";
        file.uri = "uri";
        // eslint-disable-next-line no-secrets/no-secrets
        file.id = "PsRqecfPghVJE6veB-IcX";
        // eslint-disable-next-line no-secrets/no-secrets
        file.originalName = "PsRqecfPghVJE6veB-IcX";

        expect(file).toMatchSnapshot();
    });
});
