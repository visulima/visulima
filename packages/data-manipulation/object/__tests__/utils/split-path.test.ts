import { describe, expect, it } from "vitest";

import splitPath from "../../src/utils/split-path";

describe("split-path", () => {
    it("splits a plain dot path", () => {
        expect.assertions(1);

        expect(splitPath("a.b.c")).toStrictEqual(["a", "b", "c"]);
    });

    it("treats an escaped dot as a literal character", () => {
        expect.assertions(1);

        expect(splitPath(String.raw`a\.b.c`)).toStrictEqual(["a.b", "c"]);
    });

    it("unescapes an escaped backslash", () => {
        expect.assertions(1);

        const backslash = String.fromCodePoint(92);

        expect(splitPath(`a${backslash}${backslash}.b`)).toStrictEqual([`a${backslash}`, "b"]);
    });

    it("preserves a single trailing backslash", () => {
        expect.assertions(1);

        const backslash = String.fromCodePoint(92);

        expect(splitPath(`a${backslash}`)).toStrictEqual([`a${backslash}`]);
    });

    it("returns a single empty segment for an empty string", () => {
        expect.assertions(1);

        expect(splitPath("")).toStrictEqual([""]);
    });
});
