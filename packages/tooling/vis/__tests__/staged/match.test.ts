import { describe, expect, it } from "vitest";

import { applyIgnore, matchFiles } from "../../src/staged/match";

const cwd = "/repo";
const files = ["/repo/src/index.ts", "/repo/src/lib/util.ts", "/repo/src/lib/util.test.ts", "/repo/docs/readme.md", "/repo/package.json"];

describe(matchFiles, () => {
    it("matches basename-style globs across the whole tree", () => {
        expect.assertions(1);

        expect(matchFiles("*.ts", files, cwd)).toEqual(["/repo/src/index.ts", "/repo/src/lib/util.ts", "/repo/src/lib/util.test.ts"]);
    });

    it("matches path-style globs relative to cwd", () => {
        expect.assertions(1);

        expect(matchFiles("src/**/*.ts", files, cwd)).toEqual(["/repo/src/index.ts", "/repo/src/lib/util.ts", "/repo/src/lib/util.test.ts"]);
    });

    it("returns an empty list when nothing matches", () => {
        expect.assertions(1);

        expect(matchFiles("*.rs", files, cwd)).toEqual([]);
    });

    it("treats a single exact basename as a literal match", () => {
        expect.assertions(1);

        expect(matchFiles("package.json", files, cwd)).toEqual(["/repo/package.json"]);
    });
});

describe(applyIgnore, () => {
    it("returns the original list when no ignore patterns are supplied", () => {
        expect.assertions(2);

        expect(applyIgnore(files, undefined, cwd)).toEqual(files);
        expect(applyIgnore(files, [], cwd)).toEqual(files);
    });

    it("drops files matching a basename-style ignore pattern", () => {
        expect.assertions(1);

        expect(applyIgnore(files, ["*.test.ts"], cwd)).toEqual(["/repo/src/index.ts", "/repo/src/lib/util.ts", "/repo/docs/readme.md", "/repo/package.json"]);
    });

    it("drops files matching a path-style ignore pattern", () => {
        expect.assertions(1);

        expect(applyIgnore(files, ["docs/**"], cwd)).toEqual([
            "/repo/src/index.ts",
            "/repo/src/lib/util.ts",
            "/repo/src/lib/util.test.ts",
            "/repo/package.json",
        ]);
    });

    it("combines multiple ignore patterns as a union", () => {
        expect.assertions(1);

        expect(applyIgnore(files, ["*.test.ts", "docs/**"], cwd)).toEqual(["/repo/src/index.ts", "/repo/src/lib/util.ts", "/repo/package.json"]);
    });
});

describe("matchFiles — caseInsensitive", () => {
    const cwdCase = "/repo";
    const filesCase = ["/repo/src/Index.ts", "/repo/src/lib/Util.TS", "/repo/README.md"];

    it("misses mixed-case extensions when caseInsensitive is off (default POSIX behavior)", () => {
        expect.assertions(1);

        // `.ts` matches, `.TS` doesn't — case-sensitive default drops the uppercase extension.
        expect(matchFiles("*.ts", filesCase, cwdCase)).toEqual(["/repo/src/Index.ts"]);
    });

    it("matches regardless of case when caseInsensitive is on (macOS/Windows filesystems)", () => {
        expect.assertions(1);

        expect(matchFiles("*.ts", filesCase, cwdCase, { caseInsensitive: true })).toEqual(["/repo/src/Index.ts", "/repo/src/lib/Util.TS"]);
    });

    it("applies caseInsensitive to path-style globs as well", () => {
        expect.assertions(1);

        expect(matchFiles("SRC/**/*.TS", filesCase, cwdCase, { caseInsensitive: true })).toEqual(["/repo/src/Index.ts", "/repo/src/lib/Util.TS"]);
    });

    it("applies caseInsensitive to the ignore list", () => {
        expect.assertions(1);

        expect(applyIgnore(filesCase, ["*.MD"], cwdCase, { caseInsensitive: true })).toEqual(["/repo/src/Index.ts", "/repo/src/lib/Util.TS"]);
    });
});
