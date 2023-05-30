import { describe, expect, it } from "vitest";

import { RouteType } from "../../src";
import getAccessibleRoutes from "../../src/utils/get-accessible-routes";

describe("Expose strategy", () => {
    it("should expose all routes", () => {
        expect(getAccessibleRoutes(undefined, undefined, "all")).toEqual([
            RouteType.READ_ALL,
            RouteType.READ_ONE,
            RouteType.UPDATE,
            RouteType.DELETE,
            RouteType.CREATE,
        ]);
    });

    it("should expose no routes", () => {
        expect(getAccessibleRoutes([], undefined, "all")).toEqual([]);
        expect(getAccessibleRoutes(undefined, undefined, "none")).toEqual([]);
    });

    it("should expose only CREATE and READ_ALL routes", () => {
        expect(getAccessibleRoutes([RouteType.CREATE, RouteType.READ_ALL], undefined, "all")).toEqual([RouteType.CREATE, RouteType.READ_ALL]);
    });

    it("should expose not expose DELETE route", () => {
        expect(getAccessibleRoutes(undefined, [RouteType.DELETE], "all")).toEqual([RouteType.READ_ALL, RouteType.READ_ONE, RouteType.UPDATE, RouteType.CREATE]);
    });

    it("should only expose CREATE route", () => {
        expect(getAccessibleRoutes([RouteType.DELETE, RouteType.CREATE], [RouteType.DELETE], "all")).toEqual([RouteType.CREATE]);
    });

    it("should only expose DELETE route", () => {
        expect(getAccessibleRoutes([RouteType.DELETE], undefined, "none")).toEqual([RouteType.DELETE]);
    });
});
