import { describe, expect, it } from "vitest";
import colors from "chalk";

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

        expect(view).toStrictEqual([`  ${colors.blue("GET")}${colors.grey("|HEAD")}      /api/cors`]);
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

        expect(view).toStrictEqual([`  ${colors.blue("GET")}${colors.grey("|HEAD")}      /api/cors`]);
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

        expect(view).toStrictEqual([`  ${colors.hex("#6C7280")("HEAD")}          /api/cors`]);
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

        expect(view).toStrictEqual([`  ${colors.yellow("POST")}          /api/cors`]);
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

        expect(view).toStrictEqual([`  ${colors.yellow("PATCH")}         /api/cors`]);
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

        expect(view).toStrictEqual([`  ${colors.yellow("PUT")}           /api/cors`]);
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

        expect(view).toStrictEqual([`  ${colors.redBright("DELETE")}        /api/cors`]);
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

        expect(view).toStrictEqual([`  ${colors.hex("#6C7280")("OPTIONS")}       /api/cors`]);
    });

    it("print all method route", () => {
        const view = routesRender(
            [
                {
                    path: "/api/cors",
                    method: "GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS",
                    tags: ["root"],
                    file: "__fixtures__/pages/api/corsheader.ts",
                },
            ],
        );

        expect(view).toStrictEqual([`  ${colors.redBright("ANY")}           /api/cors`]);
    });
});
