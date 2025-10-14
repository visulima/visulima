import type { Express, NextFunction, Request, RequestHandler, Response } from "express";
import express, { Router } from "express";
import { beforeEach, describe, expect, it } from "vitest";

import { operationObject } from "../../../../../../../__fixtures__/express/const";
import expressPathParser from "../../../../../../../src/framework/cli/command/list/routes/express/express-path-parser";
import type { RouteMetaData } from "../../../../../../../src/framework/cli/command/list/routes/express/types";

// Wrapper function to allow us to attach meta-data to a route in a re-usable way
const middleware = (metadata: any): RequestHandler => {
    const m = (_request: Request, _response: Response, next: NextFunction) => {
        next();
    };

    m.metadata = metadata;

    return m;
};

const successResponse: RequestHandler = (_request: Request, response: Response) => {
    response.status(204).send();
};

describe("express-path-parser", () => {
    let app: Express;
    let router: Router;
    let subrouter: Router;

    beforeEach(() => {
        app = express();
        router = Router();
        subrouter = Router();
    });

    it("runs the example code", () => {
        expect.assertions(1);

        app.get("/resources/users/:id", middleware({ notes: "These are some notes", operationId: "getUserById" }), successResponse);

        // The middleware MUST be placed on a final route layer (app.get, router.post, app.patch, router.route, ect...)
        subrouter.get(
            "/:resourceId",
            middleware({
                hidden: true,
                operationId: "getResourceByEntity",
                schema: {
                    /* some schema data */
                },
            }),
            successResponse,
        );
        // This parser can handle nested, complex router projects
        router.use("/:entity", subrouter);
        app.use("/dashboard", router);

        const parsed = expressPathParser(app);

        expect(parsed).toStrictEqual([
            {
                metadata: { notes: "These are some notes", operationId: "getUserById" },
                method: "get",
                path: "/resources/users/:id",
                pathParams: [{ in: "path", name: "id", required: true }],
            },
            {
                metadata: { hidden: true, operationId: "getResourceByEntity", schema: {} },
                method: "get",
                path: "/dashboard/?:/([^/]+?))/:resourceId",
                pathParams: [
                    { in: "path", name: "entity", required: true },
                    { in: "path", name: "resourceId", required: true },
                ],
            },
        ]);
    });

    it("a route", () => {
        expect.assertions(3);

        app.get("/test/the/endpoint", successResponse);

        const parsed = expressPathParser(app);
        const { method, path, pathParams } = parsed[0] as RouteMetaData;

        expect(path).toBe("/test/the/endpoint");
        expect(method).toBe("get");
        expect(pathParams).toStrictEqual([]);
    });

    it("a path parameter", () => {
        expect.assertions(3);

        app.delete("/test/:id/endpoint", successResponse);

        const parsed = expressPathParser(app);
        const { method, path, pathParams } = parsed[0] as RouteMetaData;

        expect(path).toBe("/test/:id/endpoint");
        expect(method).toBe("delete");
        expect(pathParams).toStrictEqual([{ in: "path", name: "id", required: true }]);
    });

    it("a optional path parameter", () => {
        expect.assertions(3);

        app.patch("/test/:id?/endpoint", successResponse);

        const parsed = expressPathParser(app);
        const { method, path, pathParams } = parsed[0] as RouteMetaData;

        expect(path).toBe("/test/:id?/endpoint");
        expect(method).toBe("patch");
        expect(pathParams).toStrictEqual([{ in: "path", name: "id", required: false }]);
    });

    it("multiple path parameters", () => {
        expect.assertions(6);

        app.post("/test/:name/:id/:day", successResponse);
        app.get("/test/:id?/:test?/:cid?", successResponse);

        const parsed = expressPathParser(app);

        let { method, path, pathParams } = parsed[0] as RouteMetaData;

        expect(path).toBe("/test/:name/:id/:day");
        expect(method).toBe("post");
        expect(pathParams).toStrictEqual([
            { in: "path", name: "name", required: true },
            { in: "path", name: "id", required: true },
            { in: "path", name: "day", required: true },
        ]);

        ({ method, path, pathParams } = parsed[1] as RouteMetaData);

        expect(path).toBe("/test/:id?/:test?/:cid?");
        expect(method).toBe("get");
        expect(pathParams).toStrictEqual([
            { in: "path", name: "id", required: false },
            { in: "path", name: "test", required: false },
            { in: "path", name: "cid", required: false },
        ]);
    });

    it("regex path parameters", () => {
        expect.assertions(3);

        app.post(/\/abc|\/xyz/u, successResponse);

        const parsed = expressPathParser(app);
        const { method, path, pathParams } = parsed[0] as RouteMetaData;

        expect(path).toBe(String.raw`/\/abc|\/xyz/u`);
        expect(method).toBe("post");
        expect(pathParams).toStrictEqual([]);
    });

    it("array of path parameters", () => {
        expect.assertions(3);

        app.get(["/abcd", "/xyza", /\/lmn|\/pqr/u], successResponse);

        const parsed = expressPathParser(app);
        const { method, path, pathParams } = parsed[0] as RouteMetaData;

        expect(path).toBe(String.raw`/abcd,/xyza,/\/lmn|\/pqr/u`);
        expect(method).toBe("get");
        expect(pathParams).toStrictEqual([]);
    });

    it("paths with *,? and +", () => {
        expect.assertions(9);

        app.get("/abc?d", successResponse);
        app.get("/ab*cd", successResponse);
        app.get("/a(bc)?d", successResponse);

        const parsed = expressPathParser(app);

        let { method, path, pathParams } = parsed[0] as RouteMetaData;

        expect(path).toBe("/abc?d");
        expect(method).toBe("get");
        expect(pathParams).toStrictEqual([]);

        ({ method, path, pathParams } = parsed[1] as RouteMetaData);

        expect(path).toBe("/ab*cd");
        expect(method).toBe("get");
        expect(pathParams).toStrictEqual([{ in: "path", name: 0, required: true }]);

        ({ method, path, pathParams } = parsed[2] as RouteMetaData);

        expect(path).toBe("/a(bc)?d");
        expect(method).toBe("get");
        expect(pathParams).toStrictEqual([{ in: "path", name: 0, required: true }]);
    });

    it("route pattern", () => {
        expect.assertions(3);

        app.route("/test")
            .all((_request, _response, next) => next())
            .get(successResponse);

        const parsed = expressPathParser(app);
        const { method, path, pathParams } = parsed[0] as RouteMetaData;

        expect(path).toBe("/test");
        expect(method).toBe("get");
        expect(pathParams).toStrictEqual([]);
    });

    it("path with middleware", () => {
        expect.assertions(3);

        app.use((_request, _response, next) => next());
        app.get("/test", (_request, _response, next) => next(), successResponse);

        const parsed = expressPathParser(app);
        const { method, path, pathParams } = parsed[0] as RouteMetaData;

        expect(path).toBe("/test");
        expect(method).toBe("get");
        expect(pathParams).toStrictEqual([]);
    });

    it("an openApiPath middleware path doc extraction", () => {
        expect.assertions(4);

        app.get("/test", middleware({ operationId: "test", operationObject }), successResponse);

        const parsed = expressPathParser(app);
        const { metadata, method, path, pathParams } = parsed[0] as RouteMetaData;

        expect(path).toBe("/test");
        expect(method).toBe("get");
        expect(pathParams).toStrictEqual([]);
        expect(metadata).toStrictEqual({ operationId: "test", operationObject });
    });

    it("to handled multiple metadata middlewares on a route", () => {
        expect.assertions(1);

        app.get("/test", middleware({ operationId: "test", operationObject }), middleware({ operationId: "test", operationObject }), successResponse);

        expect(() => (expressPathParser(app)[0] as RouteMetaData).metadata).toThrow("Only one metadata middleware is allowed per route");
    });

    it("doesnt pick up middleware on use routes", () => {
        expect.assertions(1);

        app.use(middleware({ operationId: "test", operationObject }));
        app.get("/test", middleware({ operationId: "test", operationObject }), successResponse);

        expect((expressPathParser(app)[0] as RouteMetaData).metadata).toStrictEqual({ operationId: "test", operationObject });
    });

    it("sub-routes", () => {
        expect.assertions(3);

        subrouter.get("/endpoint", successResponse);
        router.use("/sub-route", subrouter);
        app.use("/test", router);

        const parsed = expressPathParser(app);
        const { method, path, pathParams } = parsed[0] as RouteMetaData;

        expect(path).toBe("/test/sub-route/endpoint");
        expect(method).toBe("get");
        expect(pathParams).toStrictEqual([]);
    });

    it("sub-routes with openApiMiddleware", () => {
        expect.assertions(4);

        subrouter.get("/endpoint", middleware({ location: "route", operationId: "test", operationObject }), successResponse);
        router.use("/sub-route", subrouter);
        app.use("/test", router);

        const parsed = expressPathParser(app);
        const { metadata, method, path, pathParams } = parsed[0] as RouteMetaData;

        expect(path).toBe("/test/sub-route/endpoint");
        expect(method).toBe("get");
        expect(pathParams).toStrictEqual([]);
        expect(metadata).toStrictEqual({ location: "route", operationId: "test", operationObject });
    });

    it("nested sub-routes with a path parameters Router", () => {
        expect.assertions(9);

        const router2 = Router();
        const subrouter2 = Router();

        subrouter.get("/endpoint", successResponse);
        subrouter.post("/endpoint2", successResponse);

        app.use("/sub-route/:test1", router);
        router.use("/sub-sub-route/:test2/:test3", subrouter);
        app.use("/sub-route2", router2);
        router2.use("/:test/qualifier", subrouter2);
        subrouter2.put("/:name/endpoint2/:id", successResponse);

        const parsed = expressPathParser(app);

        let { method, path, pathParams } = parsed[0] as RouteMetaData;

        expect(path).toBe("/sub-route(?:/([^/]+?))/sub-sub-route(?:/([^/]+?))(?:/([^/]+?))/endpoint");
        expect(pathParams).toStrictEqual([
            { in: "path", name: "test1", required: true },
            { in: "path", name: "test2", required: true },
            { in: "path", name: "test3", required: true },
        ]);
        expect(method).toBe("get");

        ({ method, path, pathParams } = parsed[1] as RouteMetaData);

        expect(path).toBe("/sub-route(?:/([^/]+?))/sub-sub-route(?:/([^/]+?))(?:/([^/]+?))/endpoint2");
        expect(pathParams).toStrictEqual([
            { in: "path", name: "test1", required: true },
            { in: "path", name: "test2", required: true },
            { in: "path", name: "test3", required: true },
        ]);
        expect(method).toBe("post");

        ({ method, path, pathParams } = parsed[2] as RouteMetaData);

        expect(path).toBe("/sub-route2/?:/([^/]+?))/qualifier/:name/endpoint2/:id");
        expect(pathParams).toStrictEqual([
            { in: "path", name: "test", required: true },
            { in: "path", name: "name", required: true },
            { in: "path", name: "id", required: true },
        ]);
        expect(method).toBe("put");
    });

    it("single slash nested routes", () => {
        expect.assertions(1);

        app.use("/", router);
        router.use("/", subrouter);
        subrouter.get("/user", successResponse);

        expect(expressPathParser(app)).toStrictEqual([{ method: "get", path: "/user", pathParams: [] }]);
    });
});
