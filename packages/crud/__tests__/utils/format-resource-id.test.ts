import { describe, expect, it } from "vitest";

import formatResourceId from "../../src/utils/format-resource-id";

describe("format resource", () => {
    it("should format a resource id from string to number", () => {
        expect.assertions(1);

        expect(formatResourceId("1")).toBe(1);
    });

    it("should format a resource id from string to another string", () => {
        expect.assertions(1);

        expect(formatResourceId("some-slug")).toBe("some-slug");
    });
});
