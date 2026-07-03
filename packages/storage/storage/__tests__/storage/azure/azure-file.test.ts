import { describe, expect, it } from "vitest";

import AzureFile from "../../../src/storage/azure/azure-file";

describe(AzureFile, () => {
    it("should include Azure-specific properties and match snapshot", () => {
        expect.assertions(1);

        const file = new AzureFile({ metadata: { foo: "bar" } });

        file.requestId = "requestId";
        file.uri = "uri";

        file.id = "PsRqecfPghVJE6veB-IcX";

        file.originalName = "PsRqecfPghVJE6veB-IcX";

        expect(file).toMatchSnapshot();
    });
});
