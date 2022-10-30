import { describe, expect, it } from "vitest";

import routesRender from "../../../../src/next/cli/list/routes-render";

describe("list printer", () => {
    it("print get route", () => {
        const view = routesRender(
            [
                {
                    path: "/api/cors",
                    method: "GET",
                    tags: ["root"],
                    // eslint-disable-next-line radar/no-duplicate-string
                    file: "__fixtures__/pages/api/corsheader.ts",
                },
            ],
        );

        expect(view).toStrictEqual(["  \u001B[34mGET\u001B[39m\u001B[90m|HEAD\u001B[39m      /api/cors"]);
    });

    it("print get|head route", () => {
        const view = routesRender(
            [
                {
                    path: "/api/cors",
                    method: "GET|HEAD",
                    tags: ["root"],
                    file: "__fixtures__/pages/api/corsheader.ts",
                },
            ],
        );

        expect(view).toStrictEqual(["  \u001B[92mGET\u001B[39m\u001B[90m|HEAD\u001B[39m      /api/cors"]);
    });

    it("print head route", () => {
        const view = routesRender(
            [
                {
                    path: "/api/cors",
                    method: "HEAD",
                    tags: ["root"],
                    file: "__fixtures__/pages/api/corsheader.ts",
                },
            ],
        );

        expect(view).toStrictEqual(["  \u001B[38;5;103mHEAD\u001B[39m          /api/cors"]);
    });

    it("print post route", () => {
        const view = routesRender(
            [
                {
                    path: "/api/cors",
                    method: "POST",
                    tags: ["root"],
                    file: "__fixtures__/pages/api/corsheader.ts",
                },
            ],
        );

        expect(view).toStrictEqual(["  \u001B[33mPOST\u001B[39m          /api/cors"]);
    });

    it("print patch route", () => {
        const view = routesRender(
            [
                {
                    path: "/api/cors",
                    method: "PATCH",
                    tags: ["root"],
                    file: "__fixtures__/pages/api/corsheader.ts",
                },
            ],
        );

        expect(view).toStrictEqual(["  \u001B[33mPATCH\u001B[39m         /api/cors"]);
    });

    it("print put route", () => {
        const view = routesRender(
            [
                {
                    path: "/api/cors",
                    method: "PUT",
                    tags: ["root"],
                    file: "__fixtures__/pages/api/corsheader.ts",
                },
            ],
        );

        expect(view).toStrictEqual(["  \u001B[33mPUT\u001B[39m           /api/cors"]);
    });

    it("print delete route", () => {
        const view = routesRender(
            [
                {
                    path: "/api/cors",
                    method: "DELETE",
                    tags: ["root"],
                    file: "__fixtures__/pages/api/corsheader.ts",
                },
            ],
        );

        expect(view).toStrictEqual(["  \u001B[91mDELETE\u001B[39m        /api/cors"]);
    });

    it("print options route", () => {
        const view = routesRender(
            [
                {
                    path: "/api/cors",
                    method: "OPTIONS",
                    tags: ["root"],
                    file: "__fixtures__/pages/api/corsheader.ts",
                },
            ],
        );

        expect(view).toStrictEqual(["  \u001B[38;5;103mOPTIONS\u001B[39m       /api/cors"]);
    });

    it("print all method route", () => {
        const view = routesRender(
            [
                {
                    path: "/api/cors",
                    method: "GET|POST|PUT|PATCH|HEAD|DELETE|OPTIONS",
                    tags: ["root"],
                    file: "__fixtures__/pages/api/corsheader.ts",
                },
            ],
        );

        expect(view).toStrictEqual(["  \u001B[91mANY\u001B[39m           /api/cors"]);
    });
});
