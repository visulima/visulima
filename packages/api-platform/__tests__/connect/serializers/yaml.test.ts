import { describe, expect, it } from "vitest";

import yamlTransformer from "../../../src/connect/serializers/yaml";

describe("yaml-transformer", () => {
    it("should be able to transform object to yaml", () => {
        expect(yamlTransformer({ foo: "bar" })).toBe("foo: bar\n");
    });
});
