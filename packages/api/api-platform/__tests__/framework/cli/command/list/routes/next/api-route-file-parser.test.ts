import { join, resolve } from "@visulima/path";
import { describe, expect, it } from "vitest";

import apiRouteFileParser from "../../../../../../../src/framework/cli/command/list/routes/next/api-route-file-parser";

const cwdPath = resolve(__dirname, "../../../../../../../", "__fixtures__");
const apiRoutesPath = resolve(cwdPath, "pages/api");

describe("api-route-file-parser", () => {
    it("parse all files in pages/api", () => {
        expect.assertions(1);

        const parsedApiRouteFiles = [
            join(apiRoutesPath, "[customerId].js"),
            join(apiRoutesPath, "corsheader.ts"),
            join(apiRoutesPath, "defaultroute.ts"),
            join(apiRoutesPath, "hello.ts"),
            join(apiRoutesPath, "jsdefaultroute.js"),
        ].map((rpath) => apiRouteFileParser(rpath, cwdPath));

        expect(parsedApiRouteFiles).toStrictEqual([
            [
                {
                    file: "__fixtures__/pages/api/[customerId].js",
                    method: "GET|HEAD",
                    path: "/pages/api/[customerId]",
                    tags: [],
                },
                {
                    file: "__fixtures__/pages/api/[customerId].js",
                    method: "DELETE",
                    path: "/pages/api/[customerId]",
                    tags: [],
                },
                {
                    file: "__fixtures__/pages/api/[customerId].js",
                    method: "POST",
                    path: "/pages/api/[customerId]",
                    tags: [],
                },
            ],
            [
                {
                    file: "__fixtures__/pages/api/corsheader.ts",
                    method: "GET",
                    path: "/api/cors",
                    tags: ["root"],
                },
            ],
            [
                {
                    file: "__fixtures__/pages/api/defaultroute.ts",
                    method: "GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS",
                    path: "/pages/api/defaultroute",
                    tags: [],
                },
            ],
            [
                {
                    file: "__fixtures__/pages/api/hello.ts",
                    method: "GET",
                    path: "/api/hello",
                    tags: ["root"],
                },
            ],
            [
                {
                    file: "__fixtures__/pages/api/jsdefaultroute.js",
                    method: "GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS",
                    path: "/pages/api/jsdefaultroute",
                    tags: [],
                },
            ],
        ]);
    });
});
