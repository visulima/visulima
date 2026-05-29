import { describe, expect, it } from "vitest";

import { getIndent, indentedJoin } from "../../src/utils/indent";

describe("getIndent", () => {
    it("returns a tab-based indent for `\\t`", () => {
        expect.assertions(1);

        expect(getIndent("\t", 0)).toStrictEqual({ base: "\t", prev: "\n" });
    });

    it("returns a space-based indent for a positive integer", () => {
        expect.assertions(1);

        expect(getIndent(2, 0)).toStrictEqual({ base: "  ", prev: "\n" });
    });

    it("returns undefined for a zero or negative indent", () => {
        expect.assertions(2);

        expect(getIndent(0, 1)).toBeUndefined();
        expect(getIndent(-1 as unknown as number, 1)).toBeUndefined();
    });
});

describe("indentedJoin", () => {
    it("returns an empty string when there are no values", () => {
        expect.assertions(1);

        expect(indentedJoin("", { base: "  ", prev: "\n" })).toBe("");
    });

    it("joins comma-separated values across indented lines", () => {
        expect.assertions(1);

        expect(indentedJoin("a: 1, b: 2", { base: "  ", prev: "\n" })).toBe("\n  a: 1,\n  b: 2\n");
    });
});
