import { describe, expect, it } from "vitest";

import { RouteType } from "../../src";
import getAccessibleRoutes from "../../src/utils/get-accessible-routes";

describe("expose strategy", () => {
    it("should expose all routes", () => {
        expect.assertions(1);

        expect(getAccessibleRoutes(undefined, undefined, "all")).toStrictEqual([
            RouteType.READ_ALL,
            RouteType.READ_ONE,
            RouteType.UPDATE,
            RouteType.DELETE,
            RouteType.CREATE,
        ]);
    });

    it("should expose no routes", () => {
        expect.assertions(2);

        expect(getAccessibleRoutes([], undefined, "all")).toStrictEqual([]);
        expect(getAccessibleRoutes(undefined, undefined, "none")).toStrictEqual([]);
    });

    it("should expose only CREATE and READ_ALL routes", () => {
        expect.assertions(1);

        expect(getAccessibleRoutes([RouteType.CREATE, RouteType.READ_ALL], undefined, "all")).toStrictEqual([RouteType.CREATE, RouteType.READ_ALL]);
    });

    it("should expose not expose DELETE route", () => {
        expect.assertions(1);

        expect(getAccessibleRoutes(undefined, [RouteType.DELETE], "all")).toStrictEqual([
            RouteType.READ_ALL,
            RouteType.READ_ONE,
            RouteType.UPDATE,
            RouteType.CREATE,
        ]);
    });

    it("should only expose CREATE route", () => {
        expect.assertions(1);

        expect(getAccessibleRoutes([RouteType.DELETE, RouteType.CREATE], [RouteType.DELETE], "all")).toStrictEqual([RouteType.CREATE]);
    });

    it("should only expose DELETE route", () => {
        expect.assertions(1);

        expect(getAccessibleRoutes([RouteType.DELETE], undefined, "none")).toStrictEqual([RouteType.DELETE]);
    });
});
