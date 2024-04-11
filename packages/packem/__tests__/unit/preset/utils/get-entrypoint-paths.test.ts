import { describe, expect,it } from "vitest";

import getEntrypointPaths from "../../../../src/preset/utils/get-entrypoint-paths";

describe("getEntrypointPaths", () => {
    it("produces a list of possible paths", () => {
        expect.assertions(2);

        // eslint-disable-next-line vitest/valid-expect
        expect(getEntrypointPaths("./dist/foo/bar.js")).to.deep.equal(["dist/foo/bar.js", "foo/bar.js", "bar.js"]);
        // eslint-disable-next-line vitest/valid-expect
        expect(getEntrypointPaths("./dist/foo/")).to.deep.equal(["dist/foo/", "foo/"]);
    });
});
