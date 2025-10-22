import { describe, expect, it } from "vitest";

import getLongestLabel from "../../../src/utils/get-longest-label";

describe(getLongestLabel, () => {
    it("should return the longest label when all labels have different lengths", () => {
        expect.assertions(1);

        const types = {
            type1: { label: "short" },
            type2: { label: "very long label" },
            type3: { label: "medium" },
        };

        const result = getLongestLabel(types);

        expect(result).toBe("very long label");
    });

    it("should return an empty string when types is empty", () => {
        expect.assertions(1);

        const types = {};

        const result = getLongestLabel(types);

        expect(result).toBe("");
    });
});
