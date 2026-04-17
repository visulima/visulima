import { fileURLToPath } from "node:url";

import { join, resolve } from "@visulima/path";
import { describe, expect, it } from "vitest";

import glob from "../../../src/find/glob";
import globSync from "../../../src/find/glob-sync";

// __fixtures__/glob/
//   a.js
//   b.ts
//   sub/c.js
//   sub/d.ts
//   sub/nested/e.ts
//   ignored/f.ts
//   loc/{en,de}.po
//   loc/{one,two}/{en,de}.po
const fixture = join(resolve(fileURLToPath(import.meta.url), "../../../../__fixtures__"), "glob");

describe.each([
    ["glob", glob],
    ["globSync", globSync],
])("%s", (name: string, function_) => {
    it("matches files relative to cwd", async () => {
        expect.assertions(1);

        let matches = function_("**/*.ts", { cwd: fixture });

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "glob") {
            matches = await matches;
        }

        expect((matches as string[]).toSorted((a, b) => a.localeCompare(b))).toStrictEqual(["b.ts", "ignored/f.ts", "sub/d.ts", "sub/nested/e.ts"]);
    });

    it("accepts an array of patterns with negations", async () => {
        expect.assertions(1);

        let matches = function_(["**/*.ts", "!ignored/**"], { cwd: fixture });

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "glob") {
            matches = await matches;
        }

        expect((matches as string[]).toSorted((a, b) => a.localeCompare(b))).toStrictEqual(["b.ts", "sub/d.ts", "sub/nested/e.ts"]);
    });

    it("honours the ignore option", async () => {
        expect.assertions(1);

        let matches = function_("**/*.ts", { cwd: fixture, ignore: ["**/nested/**"] });

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "glob") {
            matches = await matches;
        }

        expect((matches as string[]).toSorted((a, b) => a.localeCompare(b))).toStrictEqual(["b.ts", "ignored/f.ts", "sub/d.ts"]);
    });

    it("applies negated extglobs at arbitrary depth (tinyglobby #188)", async () => {
        expect.assertions(1);

        // `loc/**/!(en.po)` should match every .po file except `en.po` at any depth.
        // Without the #188 fix tinyglobby returns 8 files (leaking `loc/one/en.po` and
        // `loc/two/en.po`); with the fix it returns 6 — matching fast-glob.
        let matches = function_(["loc/**/!(en.po)"], { cwd: fixture });

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "glob") {
            matches = await matches;
        }

        expect((matches as string[]).toSorted((a, b) => a.localeCompare(b))).toStrictEqual(["loc/de.po", "loc/one/de.po", "loc/two/de.po"]);
    });

    it("un-ignores entries matched by a negated ignore pattern", async () => {
        expect.assertions(1);

        // `ignore: ["ignored/**", "!ignored/f.ts"]` ignores the whole `ignored/` subtree but
        // brings `ignored/f.ts` back via the leading-`!` negation.
        let matches = function_("**/*.ts", { cwd: fixture, ignore: ["ignored/**", "!ignored/f.ts"] });

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "glob") {
            matches = await matches;
        }

        expect((matches as string[]).toSorted((a, b) => a.localeCompare(b))).toStrictEqual(["b.ts", "ignored/f.ts", "sub/d.ts", "sub/nested/e.ts"]);
    });

    it("returns absolute paths when absolute is true", async () => {
        expect.assertions(2);

        let matches = function_("**/*.js", { absolute: true, cwd: fixture });

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "glob") {
            matches = await matches;
        }

        expect((matches as string[])).toHaveLength(2);
        expect((matches as string[]).every((entry) => entry.startsWith(fixture))).toBe(true);
    });

    it("returns an empty array when nothing matches", async () => {
        expect.assertions(1);

        let matches = function_("**/*.doesnotexist", { cwd: fixture });

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "glob") {
            matches = await matches;
        }

        expect(matches).toStrictEqual([]);
    });
});
