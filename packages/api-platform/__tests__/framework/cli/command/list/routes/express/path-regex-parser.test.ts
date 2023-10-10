import { describe, expect, it } from "vitest";

import { oneDynamicPath, staticPath, twoDynamicPaths } from "../../../../../../../__fixtures__/express/const";
import pathRegexParser from "../../../../../../../src/framework/cli/command/list/routes/express/path-regex-parser";
import type { ExpressRegex } from "../../../../../../../src/framework/cli/command/list/routes/express/types";

describe("path-regex-parser", () => {
    it("handles static regex route", () => {
        expect(pathRegexParser(staticPath, [])).toBe("sub-route2");
    });

    it("handles one dynamic path parameters", () => {
        expect(pathRegexParser(oneDynamicPath().regex, oneDynamicPath().keys)).toBe("sub-route/:test1");
    });

    it("handles two dynamic path parameters", () => {
        expect(pathRegexParser(twoDynamicPaths().regex, twoDynamicPaths().keys)).toBe("sub-sub-route/:test2/:test3");
    });

    it("handles normal string", () => {
        expect(pathRegexParser("testing/test", [])).toBe("testing/test");
    });

    it("handles fast slash", () => {
        // eslint-disable-next-line require-unicode-regexp
        const fastSlash = /test/ as ExpressRegex;
        fastSlash.fast_slash = true;
        fastSlash.fast_star = false;
        expect(pathRegexParser(fastSlash, [])).toBe("");
    });

    it("handles fast star", () => {
        // eslint-disable-next-line require-unicode-regexp
        const fastStar = /test/ as ExpressRegex;
        fastStar.fast_slash = false;
        fastStar.fast_star = true;
        expect(pathRegexParser(fastStar, [])).toBe("*");
    });

    it("handles custom regex path", () => {
        // eslint-disable-next-line require-unicode-regexp
        expect(pathRegexParser(/test/ as ExpressRegex, [])).toBe("/test/");
    });
});
