import { describe, expect, it } from "vitest";

import yamlTransformer from "../../../src/serializers/transformer/yaml";

describe("yaml-transformer", () => {
    it("should be able to transform object to yaml", () => {
        expect.assertions(1);

        expect(yamlTransformer({ foo: "bar" })).toBe("foo: bar\n");
    });
});
