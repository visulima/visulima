import chalk from "chalk";
import { describe, expect, it } from "vitest";

import routesRender from "../../../../../../src/framework/cli/command/list/routes/routes-render";

describe("list printer", () => {
    it("print get route", () => {
        expect.assertions(1);

        const view = routesRender([
            {
                file: "__fixtures__/pages/api/corsheader.ts",
                method: "GET",
                path: "/api/cors",

                tags: ["root"],
            },
        ]);

        expect(view).toStrictEqual([`  ${chalk.blue("GET")}${chalk.grey("|HEAD")}      /api/cors`]);
    });

    it("print get|head route", () => {
        expect.assertions(1);

        const view = routesRender([
            {
                file: "__fixtures__/pages/api/corsheader.ts",
                method: "GET|HEAD",
                path: "/api/cors",
                tags: ["root"],
            },
        ]);

        expect(view).toStrictEqual([`  ${chalk.blue("GET")}${chalk.grey("|HEAD")}      /api/cors`]);
    });

    it("print head route", () => {
        expect.assertions(1);

        const view = routesRender([
            {
                file: "__fixtures__/pages/api/corsheader.ts",
                method: "HEAD",
                path: "/api/cors",
                tags: ["root"],
            },
        ]);

        expect(view).toStrictEqual([`  ${chalk.hex("#6C7280")("HEAD")}          /api/cors`]);
    });

    it("print post route", () => {
        expect.assertions(1);

        const view = routesRender([
            {
                file: "__fixtures__/pages/api/corsheader.ts",
                method: "POST",
                path: "/api/cors",
                tags: ["root"],
            },
        ]);

        expect(view).toStrictEqual([`  ${chalk.yellow("POST")}          /api/cors`]);
    });

    it("print patch route", () => {
        expect.assertions(1);

        const view = routesRender([
            {
                file: "__fixtures__/pages/api/corsheader.ts",
                method: "PATCH",
                path: "/api/cors",
                tags: ["root"],
            },
        ]);

        expect(view).toStrictEqual([`  ${chalk.yellow("PATCH")}         /api/cors`]);
    });

    it("print put route", () => {
        expect.assertions(1);

        const view = routesRender([
            {
                file: "__fixtures__/pages/api/corsheader.ts",
                method: "PUT",
                path: "/api/cors",
                tags: ["root"],
            },
        ]);

        expect(view).toStrictEqual([`  ${chalk.yellow("PUT")}           /api/cors`]);
    });

    it("print delete route", () => {
        expect.assertions(1);

        const view = routesRender([
            {
                file: "__fixtures__/pages/api/corsheader.ts",
                method: "DELETE",
                path: "/api/cors",
                tags: ["root"],
            },
        ]);

        expect(view).toStrictEqual([`  ${chalk.redBright("DELETE")}        /api/cors`]);
    });

    it("print options route", () => {
        expect.assertions(1);

        const view = routesRender([
            {
                file: "__fixtures__/pages/api/corsheader.ts",
                method: "OPTIONS",
                path: "/api/cors",
                tags: ["root"],
            },
        ]);

        expect(view).toStrictEqual([`  ${chalk.hex("#6C7280")("OPTIONS")}       /api/cors`]);
    });

    it("print all method route", () => {
        expect.assertions(1);

        const view = routesRender([
            {
                file: "__fixtures__/pages/api/corsheader.ts",
                method: "GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS",
                path: "/api/cors",
                tags: ["root"],
            },
        ]);

        expect(view).toStrictEqual([`  ${chalk.redBright("ANY")}           /api/cors`]);
    });
});
