// @vitest-environment node
import { describe, expect, it } from "vitest";

import matcher, { compileMatcher } from "../../src/vite/matcher";

describe("vite/matcher", () => {
    describe(compileMatcher, () => {
        it("returns a predicate that behaves like matcher for globs and RegExps", () => {
            expect.assertions(4);

            const isMatch = compileMatcher(["/never/*.js", /\.svg$/]);

            expect(isMatch("/icons/logo.svg")).toBe(true);
            expect(isMatch("/never/a.js")).toBe(true);
            expect(isMatch("/icons/logo.png")).toBe(false);
            expect(isMatch("/never/nested/a.js")).toBe(false);
        });

        it("anchors glob patterns", () => {
            expect.assertions(2);

            const isMatch = compileMatcher(["Button"]);

            expect(isMatch("Button")).toBe(true);
            expect(isMatch("IconButton")).toBe(false);
        });

        it("never matches when the pattern list is empty", () => {
            expect.assertions(1);

            expect(compileMatcher([])("anything")).toBe(false);
        });
    });

    describe(matcher, () => {
        it("matches a plain literal glob", () => {
            expect.assertions(2);

            expect(matcher(["/src/index.ts"], "/src/index.ts")).toBe(true);
            expect(matcher(["/src/index.ts"], "/src/other.ts")).toBe(false);
        });

        it("treats * as a single-segment wildcard that does not cross slashes", () => {
            expect.assertions(2);

            expect(matcher(["/src/*.ts"], "/src/index.ts")).toBe(true);
            // * stops at the path separator, so a nested file does not match.
            expect(matcher(["/src/*.ts"], "/src/nested/index.ts")).toBe(false);
        });

        it("treats ** as a multi-segment wildcard", () => {
            expect.assertions(2);

            expect(matcher(["/src/**/index.ts"], "/src/a/b/index.ts")).toBe(true);
            expect(matcher(["/src/**.css"], "/src/a/b/style.css")).toBe(true);
        });

        it("escapes regex special characters in glob literals", () => {
            expect.assertions(2);

            expect(matcher(["/a.b/file.ts"], "/a.b/file.ts")).toBe(true);
            // The dot must be a literal, so a different char in that slot does not match.
            expect(matcher(["/a.b/file.ts"], "/axb/file.ts")).toBe(false);
        });

        it("tests RegExp patterns directly", () => {
            expect.assertions(2);

            expect(matcher([/\.tsx?$/], "/component.tsx")).toBe(true);
            expect(matcher([/\.tsx?$/], "/style.css")).toBe(false);
        });

        it("anchors glob patterns so they do not over-match substrings", () => {
            expect.assertions(4);

            // A bare component-name glob must not match names that merely contain it.
            expect(matcher(["Button"], "Button")).toBe(true);
            expect(matcher(["Button"], "IconButton")).toBe(false);
            // A path glob must not match a value with extra leading/trailing characters.
            expect(matcher(["src/foo.tsx"], "src/foo.tsx")).toBe(true);
            expect(matcher(["src/foo.tsx"], "zzz/src/foo.tsxxx")).toBe(false);
        });

        it("matches when any pattern in a mixed list matches", () => {
            expect.assertions(2);

            const patterns = ["/never/*.js", /\.svg$/];

            expect(matcher(patterns, "/icons/logo.svg")).toBe(true);
            expect(matcher(patterns, "/icons/logo.png")).toBe(false);
        });
    });
});
