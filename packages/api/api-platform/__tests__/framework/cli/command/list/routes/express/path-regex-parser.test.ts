import { describe, expect, it } from "vitest";

import { oneDynamicPath, staticPath, twoDynamicPaths } from "../../../../../../../__fixtures__/express/const";
import pathRegexParser from "../../../../../../../src/framework/cli/command/list/routes/express/path-regex-parser";
import type { ExpressRegex } from "../../../../../../../src/framework/cli/command/list/routes/express/types";

describe("path-regex-parser", () => {
    it("handles static regex route", () => {
        expect.assertions(1);

        expect(pathRegexParser(staticPath, [])).toBe("sub-route2");
    });

    it("handles one dynamic path parameters", () => {
        expect.assertions(1);

        expect(pathRegexParser(oneDynamicPath().regex, oneDynamicPath().keys)).toBe("sub-route/:test1");
    });

    it("handles two dynamic path parameters", () => {
        expect.assertions(1);

        expect(pathRegexParser(twoDynamicPaths().regex, twoDynamicPaths().keys)).toBe("sub-sub-route/:test2/:test3");
    });

    it("handles normal string", () => {
        expect.assertions(1);

        expect(pathRegexParser("testing/test", [])).toBe("testing/test");
    });

    it("handles fast slash", () => {
        expect.assertions(1);

        const fastSlash = /test/ as ExpressRegex;

        fastSlash.fast_slash = true;
        fastSlash.fast_star = false;

        expect(pathRegexParser(fastSlash, [])).toBe("");
    });

    it("handles fast star", () => {
        expect.assertions(1);

        const fastStar = /test/ as ExpressRegex;

        fastStar.fast_slash = false;
        fastStar.fast_star = true;

        expect(pathRegexParser(fastStar, [])).toBe("*");
    });

    it("handles custom regex path", () => {
        expect.assertions(1);

        expect(pathRegexParser(/test/ as ExpressRegex, [])).toBe("/test/");
    });
});
