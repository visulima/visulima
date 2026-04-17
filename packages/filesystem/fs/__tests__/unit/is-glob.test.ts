import { describe, expect, it } from "vitest";

import isGlob from "../../src/is-glob";

describe(isGlob, () => {
    it.each([
        ["*.js", true],
        ["**/*.js", true],
        ["abc/*.js", true],
        ["abc/{a,b}.js", true],
        ["abc/[a-z].js", true],
        ["abc/@(a).js", true],
        ["abc/!(a).js", true],
        ["!foo.js", true],
    ])("returns true for glob pattern %s", (pattern, expected) => {
        expect.assertions(1);

        expect(isGlob(pattern)).toBe(expected);
    });

    it.each([
        ["abc.js", false],
        ["abc/def/ghi.js", false],
        [String.raw`abc/\*.js`, false],
        [String.raw`\!foo.js`, false],
    ])("returns false for plain path %s", (pattern, expected) => {
        expect.assertions(1);

        expect(isGlob(pattern)).toBe(expected);
    });

    it.each([[undefined], [null], [42], [[]], [""]])("returns false for non-string value %s", (value) => {
        expect.assertions(1);

        expect(isGlob(value)).toBe(false);
    });

    it("relaxes matching when strict is false", () => {
        expect.assertions(2);

        expect(isGlob("(abc)", { strict: true })).toBe(false);
        expect(isGlob("(abc)", { strict: false })).toBe(true);
    });
});
