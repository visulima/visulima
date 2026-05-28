import { describe, expect, it } from "vitest";

import formatExampleReference from "../../../src/swagger/utils/format-example-ref";
import formatSchemaReference from "../../../src/swagger/utils/format-schema-ref";

describe(formatSchemaReference, () => {
    it("should produce a #/components/schemas/<name> reference", () => {
        expect.assertions(1);
        expect(formatSchemaReference("User")).toBe("#/components/schemas/User");
    });
});

describe(formatExampleReference, () => {
    it("should produce a #/components/examples/<name> reference", () => {
        expect.assertions(1);
        expect(formatExampleReference("User")).toBe("#/components/examples/User");
    });
});
