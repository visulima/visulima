import { describe, expect, it } from "vitest";

import { oneDynamicPath, staticPath, twoDynamicPaths } from "../../../../../../../__fixtures__/express/const";
import mapKeysToPath from "../../../../../../../src/framework/cli/command/list/routes/express/map-keys-to-path";
import { ExpressRegex } from "../../../../../../../src/framework/cli/command/list/routes/express/types";

describe("mapKeysToPath", () => {
    it("handles one dynamic path parameter", () => {
        expect(mapKeysToPath(oneDynamicPath().regex, oneDynamicPath().keys)).toBe("/sub-route/:test1");
    });

    it("handles two dynamic path parameters", () => {
        expect(mapKeysToPath(twoDynamicPaths().regex, twoDynamicPaths().keys)).toBe("/sub-sub-route/:test2/:test3");
    });

    it("handles empty keys", () => {
        expect(() => mapKeysToPath(staticPath, [])).toThrow();
    });

    it("handles optional parameters", () => {
        const optional = twoDynamicPaths();

        // eslint-disable-next-line unicorn/better-regex,optimize-regex/optimize-regex,no-useless-escape
        optional.regex = /^\/sub-sub-route(?:\/([^\/]+?))?\/(?:([^\/]+?))\/?(?=\/|$)/i as ExpressRegex;

        (optional.keys[0] as { [key: string]: any }).optional = true;

        expect(mapKeysToPath(optional.regex, optional.keys)).toBe("/sub-sub-route/:test2?/:test3");
    });
});
