import { join, resolve } from "@visulima/path";
import { describe, expect, it } from "vitest";

import collectApiRouteFiles from "../../../../../../../src/framework/cli/command/list/routes/next/collect-api-route-files";

const fixturesPath = resolve(__dirname, "../../../../../../../", "__fixtures__/collect");

describe("collect-api-route-files", () => {
    it("find all files in pages/api", async () => {
        expect.assertions(1);

        const apiRouteFiles = await collectApiRouteFiles(resolve(fixturesPath, "pages-example"));

        expect(apiRouteFiles).toStrictEqual([
            join(fixturesPath, "pages-example", "pages", "api", "hello.ts"),
            join(fixturesPath, "pages-example", "pages", "api", "jsdefaultroute.js"),
        ]);
    });

    it("find all files in pages/api and ignore src/pages/api", async () => {
        expect.assertions(1);

        const apiRouteFiles = await collectApiRouteFiles(resolve(fixturesPath, "src-and-pages-example"));

        expect(apiRouteFiles).toStrictEqual([
            join(fixturesPath, "src-and-pages-example", "pages", "api", "hello.ts"),
            join(fixturesPath, "src-and-pages-example", "pages", "api", "jsdefaultroute.js"),
        ]);
    });

    it("find all files in src/pages/api", async () => {
        expect.assertions(1);

        const apiRouteFiles = await collectApiRouteFiles(resolve(fixturesPath, "src-example"));

        expect(apiRouteFiles).toStrictEqual([
            join(fixturesPath, "src-example", "src", "pages", "api", "hello.ts"),
            join(fixturesPath, "src-example", "src", "pages", "api", "jsdefaultroute.js"),
        ]);
    });
});
