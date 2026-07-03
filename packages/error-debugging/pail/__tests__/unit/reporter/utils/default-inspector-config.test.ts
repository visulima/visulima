import { describe, expect, it } from "vitest";

import defaultInspectorConfig from "../../../../src/reporter/utils/default-inspector-config";

describe("defaultInspectorConfig", () => {
    it("should colorize a known style type", () => {
        expect.assertions(1);

        expect(defaultInspectorConfig.stylize?.("123", "number")).toContain("123");
    });

    it("should return the input unchanged for an unknown style type", () => {
        expect.assertions(1);

        expect(defaultInspectorConfig.stylize?.("raw", "unknown-style")).toBe("raw");
    });
});
