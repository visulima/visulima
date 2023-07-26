import { describe, expect, it } from "vitest";

import routesGroupBy from "../../../../../../src/framework/cli/command/list/routes/routes-group-by";
import type { Route } from "../../../../../../src/framework/cli/command/list/routes/types.d";

describe("routes-group-by", () => {
    it("routesGroupBy returns a Map", () => {
        const result = routesGroupBy([], (item) => item.tags[0] || "unsorted");

        expect(result).toBeInstanceOf(Map);
    });

    it("routesGroupBy groups routes by provided key", () => {
        const routes: Route[] = [
            {
                file: "__fixtures__/pages/api/[customerId].js",

                method: "GET|HEAD",
                path: "/pages/api/[customerId]",

                tags: ["test"],
            },
            {
                file: "__fixtures__/pages/api/[customerId].js",
                method: "DELETE",
                path: "/pages/api/[customerId]",
                tags: ["test"],
            },
            {
                file: "__fixtures__/pages/api/[customerId].js",
                method: "POST",
                path: "/pages/api/[customerId]",
                tags: ["test2"],
            },
        ];

        const result = routesGroupBy(routes, (item) => item.tags[0] || "unsorted");

        expect(result.get("test")).toStrictEqual([
            {
                file: "__fixtures__/pages/api/[customerId].js",

                method: "GET|HEAD",
                path: "/pages/api/[customerId]",

                tags: ["test"],
            },
            {
                file: "__fixtures__/pages/api/[customerId].js",
                method: "DELETE",
                path: "/pages/api/[customerId]",
                tags: ["test"],
            },
        ]);

        expect(result.get("test2")).toStrictEqual([
            {
                file: "__fixtures__/pages/api/[customerId].js",
                method: "POST",
                path: "/pages/api/[customerId]",
                tags: ["test2"],
            },
        ]);
    });

    it("routesGroupBy handles list of routes with single element", () => {
        const routes = [
            {
                file: "__fixtures__/pages/api/[customerId].js",
                method: "POST",
                path: "/pages/api/[customerId]",
                tags: ["test2"],
            },
        ];

        const result = routesGroupBy(routes, (item) => item.tags[0] || "unsorted");

        expect(result.get("test2")).toStrictEqual([
            {
                file: "__fixtures__/pages/api/[customerId].js",
                method: "POST",
                path: "/pages/api/[customerId]",
                tags: ["test2"],
            },
        ]);
    });

    it("routesGroupBy throws error when keyGetter is not a function", () => {
        const routes = [
            {
                file: "__fixtures__/pages/api/[customerId].js",
                method: "POST",
                path: "/pages/api/[customerId]",
                tags: ["test2"],
            },
        ];

        expect(() => routesGroupBy(routes, "invalid key getter")).toThrow("keyGetter is not a function");
    });
});
