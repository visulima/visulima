import { describe, expect, it } from "vitest";

import globParent from "../../src/glob-parent";

describe(globParent, () => {
    it.each([
        ["src/**/*.ts", "src"],
        ["foo/{a,b}/*.js", "foo"],
        ["foo/[a-z]/*.js", "foo"],
        ["foo/@(a|b)/*.js", "foo"],
        ["**/*.ts", "."],
        ["*.ts", "."],
        ["!foo/*.js", "."],
    ])("extracts parent of glob pattern %s", (pattern, expected) => {
        expect.assertions(1);

        expect(globParent(pattern)).toBe(expected);
    });

    it("returns the directory for non-glob inputs", () => {
        expect.assertions(2);

        expect(globParent("foo/bar.js")).toBe("foo");
        expect(globParent("index.ts")).toBe(".");
    });
});
