import path from "node:path";
import { describe, expect, it } from "vitest";

import apiRouteFileParser from "../../../../../../../src/framework/cli/command/list/routes/next/api-route-file-parser";

// eslint-disable-next-line unicorn/prefer-module
const cwdPath = path.resolve(__dirname, "../../../../../../../", "__fixtures__");
const apiRoutesPath = path.resolve(cwdPath, "pages/api");

describe("api-route-file-parser", () => {
    it("parse all files in pages/api", () => {
        const parsedApiRouteFiles = [
            path.join(apiRoutesPath, "[customerId].js"),
            path.join(apiRoutesPath, "corsheader.ts"),
            path.join(apiRoutesPath, "defaultroute.ts"),
            path.join(apiRoutesPath, "hello.ts"),
            path.join(apiRoutesPath, "jsdefaultroute.js"),
        ].map((rpath) => apiRouteFileParser(rpath, cwdPath));

        expect(parsedApiRouteFiles).toStrictEqual([
            [
                {
                    method: "GET|HEAD",
                    // eslint-disable-next-line sonarjs/no-duplicate-string
                    path: "/pages/api/[customerId]",
                    tags: [],
                    // eslint-disable-next-line sonarjs/no-duplicate-string
                    file: "__fixtures__/pages/api/[customerId].js",
                },
                {
                    method: "DELETE",
                    path: "/pages/api/[customerId]",
                    tags: [],
                    file: "__fixtures__/pages/api/[customerId].js",
                },
                {
                    method: "POST",
                    path: "/pages/api/[customerId]",
                    tags: [],
                    file: "__fixtures__/pages/api/[customerId].js",
                },
            ],
            [
                {
                    path: "/api/cors",
                    method: "GET",
                    tags: ["root"],
                    file: "__fixtures__/pages/api/corsheader.ts",
                },
            ],
            [
                {
                    method: "GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS",
                    path: "/pages/api/defaultroute",
                    tags: [],
                    file: "__fixtures__/pages/api/defaultroute.ts",
                },
            ],
            [
                {
                    path: "/api/hello",
                    method: "GET",
                    tags: ["root"],
                    file: "__fixtures__/pages/api/hello.ts",
                },
            ],
            [
                {
                    method: "GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS",
                    path: "/pages/api/jsdefaultroute",
                    tags: [],
                    file: "__fixtures__/pages/api/jsdefaultroute.js",
                },
            ],
        ]);
    });
});
