import { describe, expect, it } from "vitest";

import { oneDynamicPath, staticPath, twoDynamicPaths } from "../../../../../../../__fixtures__/express/const";
import mapKeysToPath from "../../../../../../../src/framework/cli/command/list/routes/express/map-keys-to-path";
import type { ExpressRegex } from "../../../../../../../src/framework/cli/command/list/routes/express/types.d";

describe(mapKeysToPath, () => {
    it("handles one dynamic path parameter", () => {
        expect.assertions(1);

        expect(mapKeysToPath(oneDynamicPath().regex, oneDynamicPath().keys)).toBe("/sub-route/:test1");
    });

    it("handles two dynamic path parameters", () => {
        expect.assertions(1);

        expect(mapKeysToPath(twoDynamicPaths().regex, twoDynamicPaths().keys)).toBe("/sub-sub-route/:test2/:test3");
    });

    it("handles empty keys", () => {
        expect.assertions(1);

        expect(() => mapKeysToPath(staticPath, [])).toThrow("must include at least one key to map");
    });

    it("handles optional parameters", () => {
        expect.assertions(1);

        const optional = twoDynamicPaths();

        // eslint-disable-next-line no-useless-escape,security/detect-unsafe-regex,regexp/no-useless-escape,regexp/no-useless-non-capturing-group,regexp/no-useless-lazy
        optional.regex = /^\/sub-sub-route(?:\/([^\/]+?))?\/(?:([^\/]+?))\/?(?=\/|$)/i as ExpressRegex;

        (optional.keys[0] as Record<string, any>).optional = true;

        expect(mapKeysToPath(optional.regex, optional.keys)).toBe("/sub-sub-route/:test2?/:test3");
    });
});
