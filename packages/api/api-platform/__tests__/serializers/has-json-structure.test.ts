import { describe, expect, it } from "vitest";

import hasJsonStructure from "../../src/serializers/has-json-structure";

describe("has-json-structure", () => {
    it("should return false if value is not a string", () => {
        expect.assertions(1);

        const result = hasJsonStructure(null);

        expect(result).toBe(false);
    });

    it("should return true if the data is a valid json structure", () => {
        expect.assertions(1);

        const result = hasJsonStructure(JSON.stringify({ test: "data" }));

        expect(result).toBe(true);
    });
});
