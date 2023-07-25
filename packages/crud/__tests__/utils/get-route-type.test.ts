import { describe, expect, it } from "vitest";

import { RouteType } from "../../src";
import type { GetRouteType } from "../../src/utils/get-route-type";
import getRouteType from "../../src/utils/get-route-type";

describe("getRouteType without query params", () => {
    it("should return READ_ALL type", () => {
        expect(getRouteType("GET", "/api/users", "users")).toStrictEqual<GetRouteType>({
            routeType: RouteType.READ_ALL,
        });
    });

    it("should return READ_ONE type", () => {
        expect(getRouteType("GET", "/api/users/1", "users")).toStrictEqual<GetRouteType>({
            resourceId: "1",
            routeType: RouteType.READ_ONE,
        });
    });

    it("should return CREATE type", () => {
        expect(getRouteType("POST", "/api/users", "users")).toStrictEqual<GetRouteType>({
            routeType: RouteType.CREATE,
        });
    });

    it("should return UPDATE type", () => {
        expect(getRouteType("PUT", "/api/users/1", "users")).toStrictEqual<GetRouteType>({
            resourceId: "1",
            routeType: RouteType.UPDATE,
        });

        expect(getRouteType("PATCH", "/api/users/1", "users")).toStrictEqual<GetRouteType>({
            resourceId: "1",
            routeType: RouteType.UPDATE,
        });
    });

    it("should return DELETE type", () => {
        expect(getRouteType("DELETE", "/api/users/1", "users")).toStrictEqual<GetRouteType>({
            resourceId: "1",
            routeType: RouteType.DELETE,
        });
    });

    it("should throw with an invalid resource name", () => {
        expect(() => getRouteType("GET", "/api/users", "foo")).toThrow("invalid resource name 'foo' for route '/api/users'");
    });

    it("should return null routeType with invalid path for POST", () => {
        const { routeType } = getRouteType("POST", "/api/foo/1", "foo");

        expect(routeType).toBeNull();
    });

    it("should return null routeType with invalid path for PUT", () => {
        const { routeType } = getRouteType("PUT", "/api/foo", "foo");

        expect(routeType).toBeNull();
    });

    it("should return null routeType with invalid path for PATCH", () => {
        const { routeType } = getRouteType("PATCH", "/api/foo", "foo");

        expect(routeType).toBeNull();
    });

    it("should return null routeType with invalid path for DELETE", () => {
        const { routeType } = getRouteType("DELETE", "/api/foo", "foo");

        expect(routeType).toBeNull();
    });
});

describe("getRouteType with query params", () => {
    it("should return READ_ALL type", () => {
        expect(getRouteType("GET", "/api/users?q=1", "users")).toStrictEqual<GetRouteType>({
            routeType: RouteType.READ_ALL,
        });
    });

    it("should return READ_ONE type", () => {
        expect(getRouteType("GET", "/api/users/1?q=1", "users")).toStrictEqual<GetRouteType>({
            resourceId: "1",
            routeType: RouteType.READ_ONE,
        });
    });

    it("should return CREATE type", () => {
        expect(getRouteType("POST", "/api/users?q=1", "users")).toStrictEqual<GetRouteType>({
            routeType: RouteType.CREATE,
        });
    });

    it("should return UPDATE type", () => {
        expect(getRouteType("PUT", "/api/users/1?q=1", "users")).toStrictEqual<GetRouteType>({
            resourceId: "1",
            routeType: RouteType.UPDATE,
        });

        expect(getRouteType("PATCH", "/api/users/1?q=1", "users")).toStrictEqual<GetRouteType>({
            resourceId: "1",
            routeType: RouteType.UPDATE,
        });
    });

    it("should return DELETE type", () => {
        expect(getRouteType("DELETE", "/api/users/1?q=1", "users")).toStrictEqual<GetRouteType>({
            resourceId: "1",
            routeType: RouteType.DELETE,
        });
    });

    it("should throw with an invalid resource name", () => {
        expect(() => getRouteType("GET", "/api/users?q=1", "foo")).toThrow("invalid resource name 'foo' for route '/api/users'");
    });
});
