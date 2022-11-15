import path from "node:path";
import { describe, expect, it } from "vitest";

import collectApiRouteFiles from "../../../../src/next/cli/list/collect-api-route-files";
// eslint-disable-next-line unicorn/prefer-module
const fixturesPath = path.resolve(__dirname, "../../../..", "__fixtures__/collect");

describe("collect-api-route-files", () => {
    it("find all files in pages/api", async () => {
        const apiRouteFiles = await collectApiRouteFiles(path.resolve(fixturesPath, "pages-example"));

        expect(apiRouteFiles).toStrictEqual([
            path.join(fixturesPath, "pages-example/pages/api/hello.ts"),
            path.join(fixturesPath, "pages-example/pages/api/jsdefaultroute.js"),
        ]);
    });

    it("find all files in pages/api and ignore src/pages/api", async () => {
        const apiRouteFiles = await collectApiRouteFiles(path.resolve(fixturesPath, "src-and-pages-example"));

        expect(apiRouteFiles).toStrictEqual([
            path.join(fixturesPath, "src-and-pages-example/pages/api/hello.ts"),
            path.join(fixturesPath, "src-and-pages-example/pages/api/jsdefaultroute.js"),
        ]);
    });

    it("find all files in src/pages/api", async () => {
        const apiRouteFiles = await collectApiRouteFiles(path.resolve(fixturesPath, "src-example"));

        expect(apiRouteFiles).toStrictEqual([
            path.join(fixturesPath, "src-example/src/pages/api/hello.ts"),
            path.join(fixturesPath, "src-example/src/pages/api/jsdefaultroute.js"),
        ]);
    });
});
