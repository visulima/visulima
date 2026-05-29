// @vitest-environment node
import { describe, expect, it } from "vitest";

import matcher from "../../src/vite/matcher";

describe("vite/matcher", () => {
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

        it("matches when any pattern in a mixed list matches", () => {
            expect.assertions(2);

            const patterns = ["/never/*.js", /\.svg$/];

            expect(matcher(patterns, "/icons/logo.svg")).toBe(true);
            expect(matcher(patterns, "/icons/logo.png")).toBe(false);
        });
    });
});
