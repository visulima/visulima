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
                method: "GET|HEAD",
                // eslint-disable-next-line radar/no-duplicate-string
                path: "/pages/api/[customerId]",
                tags: ["test"],
                // eslint-disable-next-line radar/no-duplicate-string
                file: "__fixtures__/pages/api/[customerId].js",
            },
            {
                method: "DELETE",
                path: "/pages/api/[customerId]",
                tags: ["test"],
                file: "__fixtures__/pages/api/[customerId].js",
            },
            {
                method: "POST",
                path: "/pages/api/[customerId]",
                tags: ["test2"],
                file: "__fixtures__/pages/api/[customerId].js",
            },
        ];

        const result = routesGroupBy(routes, (item) => item.tags[0] || "unsorted");

        expect(result.get("test")).toEqual([
            {
                method: "GET|HEAD",
                // eslint-disable-next-line radar/no-duplicate-string
                path: "/pages/api/[customerId]",
                tags: ["test"],
                // eslint-disable-next-line radar/no-duplicate-string
                file: "__fixtures__/pages/api/[customerId].js",
            },
            {
                method: "DELETE",
                path: "/pages/api/[customerId]",
                tags: ["test"],
                file: "__fixtures__/pages/api/[customerId].js",
            },
        ]);

        expect(result.get("test2")).toEqual([
            {
                method: "POST",
                path: "/pages/api/[customerId]",
                tags: ["test2"],
                file: "__fixtures__/pages/api/[customerId].js",
            },
        ]);
    });

    it("routesGroupBy handles list of routes with single element", () => {
        const routes = [
            {
                method: "POST",
                path: "/pages/api/[customerId]",
                tags: ["test2"],
                file: "__fixtures__/pages/api/[customerId].js",
            },
        ];

        const result = routesGroupBy(routes, (item) => item.tags[0] || "unsorted");

        expect(result.get("test2")).toEqual([
            {
                method: "POST",
                path: "/pages/api/[customerId]",
                tags: ["test2"],
                file: "__fixtures__/pages/api/[customerId].js",
            },
        ]);
    });

    it("routesGroupBy throws error when keyGetter is not a function", () => {
        const routes = [
            {
                method: "POST",
                path: "/pages/api/[customerId]",
                tags: ["test2"],
                file: "__fixtures__/pages/api/[customerId].js",
            },
        ];

        // @ts-expect-error
        expect(() => routesGroupBy(routes, "invalid key getter")).toThrowError();
    });
});
