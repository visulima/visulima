import { describe, expect, it } from "vitest";

import formatResourceId from "../../src/utils/format-resource-id";

describe("Format resource", () => {
    it("should format a resource id from string to number", () => {
        expect(formatResourceId("1")).toBe(1);
    });

    it("should format a resource id from string to another string", () => {
        expect(formatResourceId("some-slug")).toBe("some-slug");
    });
});
