import path from "node:path";
import { describe, expect, it } from "vitest";

import apiRouteFileParser from "../../../../../../../src/framework/cli/command/list/routes/next/api-route-file-parser";

const cwdPath = path.resolve(__dirname, "../../../../../../../", "__fixtures__");
const apiRoutesPath = path.resolve(cwdPath, "pages/api");

const isWin = process.platform === "win32";

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
                    // eslint-disable-next-line no-use-extend-native/no-use-extend-native
                    file: "__fixtures__/pages/api/[customerId].js".replaceAll("/", isWin ? "\\" : "/"),

                    method: "GET|HEAD",
                    path: "/pages/api/[customerId]",

                    tags: [],
                },
                {
                    // eslint-disable-next-line no-use-extend-native/no-use-extend-native
                    file: "__fixtures__/pages/api/[customerId].js".replaceAll("/", isWin ? "\\" : "/"),
                    method: "DELETE",
                    path: "/pages/api/[customerId]",
                    tags: [],
                },
                {
                    // eslint-disable-next-line no-use-extend-native/no-use-extend-native
                    file: "__fixtures__/pages/api/[customerId].js".replaceAll("/", isWin ? "\\" : "/"),
                    method: "POST",
                    path: "/pages/api/[customerId]",
                    tags: [],
                },
            ],
            [
                {
                    // eslint-disable-next-line no-use-extend-native/no-use-extend-native
                    file: "__fixtures__/pages/api/corsheader.ts".replaceAll("/", isWin ? "\\" : "/"),
                    method: "GET",
                    path: "/api/cors",
                    tags: ["root"],
                },
            ],
            [
                {
                    // eslint-disable-next-line no-use-extend-native/no-use-extend-native
                    file: "__fixtures__/pages/api/defaultroute.ts".replaceAll("/", isWin ? "\\" : "/"),
                    method: "GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS",
                    path: "/pages/api/defaultroute",
                    tags: [],
                },
            ],
            [
                {
                    // eslint-disable-next-line no-use-extend-native/no-use-extend-native
                    file: "__fixtures__/pages/api/hello.ts".replaceAll("/", isWin ? "\\" : "/"),
                    method: "GET",
                    path: "/api/hello",
                    tags: ["root"],
                },
            ],
            [
                {
                    // eslint-disable-next-line no-use-extend-native/no-use-extend-native
                    file: "__fixtures__/pages/api/jsdefaultroute.js".replaceAll("/", isWin ? "\\" : "/"),
                    method: "GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS",
                    path: "/pages/api/jsdefaultroute",
                    tags: [],
                },
            ],
        ]);
    });
});
