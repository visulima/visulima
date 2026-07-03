import { describe, expect, it } from "vitest";

import { INDENT_SEPARATOR } from "../../src/constants";
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

    it("joins sentinel-separated values across indented lines", () => {
        expect.assertions(1);

        expect(indentedJoin(`a: 1${INDENT_SEPARATOR}b: 2`, { base: "  ", prev: "\n" })).toBe("\n  a: 1,\n  b: 2\n");
    });

    it("does not split entries that themselves contain a comma-space", () => {
        expect.assertions(1);

        // The value `'x, y'` contains a literal ", " — it must stay on one line and
        // only the sentinel between the two entries should become a line break.
        expect(indentedJoin(`a: 'x, y'${INDENT_SEPARATOR}b: 2`, { base: "  ", prev: "\n" })).toBe("\n  a: 'x, y',\n  b: 2\n");
    });
});
