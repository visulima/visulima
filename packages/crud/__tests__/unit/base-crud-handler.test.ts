// @ts-expect-error IDE cant read the new extended key of tsconfig
import createHttpError from "http-errors";
import { ApiError } from "next/dist/server/api-utils";
import type { ServerResponse } from "node:http";
import type { RequestOptions } from "node-mocks-http";
import { createMocks as createHttpMocks } from "node-mocks-http";
import { describe, expect, it, vi } from "vitest";

import type { Adapter, ParsedQueryParameters } from "../../src/types";
import { RouteType } from "../../src/types";
import CrudHandler from "../utils/crud-handler";
import InvalidAdapter from "../utils/invalid-adapter";
import NoopAdapter from "../utils/noop-adapter";

const createMocks = (
    options: RequestOptions,
): {
    req: RequestOptions["req"];
    res: ServerResponse & { end: (data?: any) => void };
} => {
    const { req, res } = createHttpMocks(options);

    return {
        req,
        res: {
            ...res,
            end: vi.spyOn(res, "end"),
        } as unknown as ServerResponse,
    };
};

const generateNoopAdapter = (
    methods: {
        [name in keyof Adapter<unknown, unknown>]?: (...arguments_: any[]) => any;
    },
    models: string[] = [],
): Adapter<any, any, any> => {
    class NoopAdapterExtension extends NoopAdapter implements Adapter<unknown, ParsedQueryParameters> {}

    const instance = new NoopAdapterExtension(models);

    Object.keys(methods).forEach((key) => {
        // @ts-expect-error
        instance[key as keyof typeof methods] = methods[key as keyof typeof methods];
    });

    return instance;
};

describe("handler", () => {
    it("should run the handler correctly", async () => {
        const handler = await CrudHandler(new NoopAdapter(["foo"]));
        const { req, res } = createMocks({
            method: "GET",
            url: "/foo",
        });

        await handler(req, res);

        expect(res.end).toHaveBeenCalledWith();
    });

    it("should throw an error with an invalid adapter", async () => {
        await expect(
            async () =>
                await CrudHandler({
                    // @ts-expect-error
                    adapter: new InvalidAdapter(),
                }),
        ).rejects.toBeInstanceOf(Error);
    });

    it("should return a 404 error when no path matches", async () => {
        const handler = await CrudHandler(new NoopAdapter());
        const { req, res } = createMocks({
            method: "GET",
            url: "/bar",
        });

        await expect(async () => await handler(req, res)).rejects.toThrowErrorMatchingInlineSnapshot('"Couldn\'t find model name for url /bar"');
    });

    it("should run onRequest", async () => {
        const onRequest = vi.fn();

        const handler = await CrudHandler(new NoopAdapter(["foo"]), {
            callbacks: {
                onRequest,
            },
        });
        const { req, res } = createMocks({
            method: "GET",
            url: "/foo/bar",
        });

        await handler(req, res);

        expect(onRequest).toHaveBeenCalledWith(req, res, {
            resourceName: "foo",
            routeType: RouteType.READ_ALL,
        });
    });

    it("should run onSuccess", async () => {
        const onSuccess = vi.fn();

        const handler = await CrudHandler(new NoopAdapter(["foo"]), {
            callbacks: {
                onSuccess,
            },
        });
        const { req, res } = createMocks({
            method: "GET",
            url: "/foo/bar",
        });

        await handler(req, res);

        expect(onSuccess).toHaveBeenCalledWith({
            data: [],
            status: 200,
        });
    });

    it("should trigger a simple Error", async () => {
        const error = new Error("error");
        const onRequest = vi.fn(() => {
            throw error;
        });

        const onError = vi.fn();

        const handler = await CrudHandler(new NoopAdapter(["foo"]), {
            callbacks: {
                onError,
                onRequest,
            },
        });
        const { req, res } = createMocks({
            method: "GET",
            url: "/api/foo/bar",
        });

        await expect(async () => await handler(req, res)).rejects.toThrowErrorMatchingInlineSnapshot('"error"');

        expect(onError).toHaveBeenCalledWith(req, res, error);
    });

    it("should trigger an 400 HttpError", async () => {
        const error = createHttpError(400, "Error");
        const onRequest = vi.fn(() => {
            throw error;
        });

        const onError = vi.fn();

        const handler = await CrudHandler(new NoopAdapter(["foo"]), {
            callbacks: {
                onError,
                onRequest,
            },
        });
        const { req, res } = createMocks({
            method: "GET",
            url: "/api/foo/bar",
        });

        await expect(async () => await handler(req, res)).rejects.toThrowErrorMatchingInlineSnapshot('"Error"');

        expect(onError).toHaveBeenCalledWith(req, res, error);
    });

    it("should trigger an 400 HttpError using the default NextJS ApiError", async () => {
        const error = new ApiError(400, "Error");
        const onRequest = vi.fn(() => {
            throw error;
        });

        const onError = vi.fn();

        const handler = await CrudHandler(new NoopAdapter(["foo"]), {
            callbacks: {
                onError,
                onRequest,
            },
        });
        const { req, res } = createMocks({
            method: "GET",
            url: "/api/foo/bar",
        });

        await expect(async () => await handler(req, res)).rejects.toThrowErrorMatchingInlineSnapshot('"Error"');

        expect(onError).toHaveBeenCalledWith(req, res, error);
    });

    it("should run adapter handleError upon Error", async () => {
        const error = new Error("test");
        const getOne = vi.fn(() => {
            throw error;
        });
        const handleError = vi.fn();
        const adapter = generateNoopAdapter(
            {
                getOne,
                handleError,
            },
            ["foo"],
        );

        const handler = await CrudHandler(adapter);
        const { req, res } = createMocks({
            method: "GET",
            url: "/api/foo/bar",
        });

        await expect(async () => await handler(req, res)).rejects.toThrowErrorMatchingInlineSnapshot('"test"');

        expect(adapter.handleError).toHaveBeenCalledWith(error);
    });

    it("should trigger a 404 if we fetch a route not registered in the only option", async () => {
        const handler = await CrudHandler(new NoopAdapter(["foo"]), {
            models: {
                foo: {
                    only: [RouteType.READ_ALL],
                },
            },
        });
        const { req, res } = createMocks({
            method: "GET",
            url: "/api/foo/bar",
        });

        await expect(async () => await handler(req, res)).rejects.toThrowErrorMatchingInlineSnapshot('"Route not found: /api/foo/bar"');
    });

    it("should trigger a 404 if we fetch a route that is in the exclude option", async () => {
        const handler = await CrudHandler(new NoopAdapter(["foo"]), {
            models: {
                foo: {
                    exclude: [RouteType.READ_ONE],
                },
            },
        });
        const { req, res } = createMocks({
            method: "GET",
            url: "/api/foo/bar",
        });

        await expect(async () => await handler(req, res)).rejects.toThrowErrorMatchingInlineSnapshot('"Route not found: /api/foo/bar"');
    });

    it("should trigger the formatResourceId option if provided", async () => {
        const formatResourceId = vi.fn();

        const handler = await CrudHandler(new NoopAdapter(["foo"]), {
            formatResourceId,
        });
        const { req, res } = createMocks({
            method: "GET",
            url: "/api/foo/bar",
        });

        await handler(req, res);
        expect(formatResourceId).toHaveBeenCalledWith("bar");
    });

    it("should trigger the formatResourceId option from path config if provided", async () => {
        const formatResourceId = vi.fn();

        const handler = await CrudHandler(new NoopAdapter(["foo"]), {
            models: {
                foo: {
                    formatResourceId,
                },
            },
        });
        const { req, res } = createMocks({
            method: "GET",
            url: "/api/foo/bar",
        });

        await handler(req, res);
        expect(formatResourceId).toHaveBeenCalledWith("bar");
    });

    it("should run the adapter parseQuery function", async () => {
        const parseQuery = vi.fn();
        const adapter = generateNoopAdapter({ parseQuery }, ["foo"]);

        const marshal = vi.fn();
        const unmarshal = vi.fn();

        const handler = await CrudHandler(adapter, {
            serialization: {
                marshal,
                unmarshal,
            },
        });

        const { req, res } = createMocks({
            method: "GET",
            url: "/api/foo/bar?foo=bar",
        });

        await handler(req, res);

        expect(parseQuery).toHaveBeenCalledWith(
            "foo",
            {
                originalQuery: { foo: "bar" },
            },
            {
                marshal,
                unmarshal,
            },
        );
    });

    it("should run the adapter connect and disconnect functions", async () => {
        const connect = vi.fn();
        const disconnect = vi.fn();
        const adapter = generateNoopAdapter({ connect, disconnect }, ["foo"]);

        const handler = await CrudHandler(adapter);

        const { req, res } = createMocks({
            method: "GET",
            url: "/api/foo/bar?foo=bar",
        });

        await handler(req, res);
        expect(connect).toHaveBeenCalledWith();
        expect(disconnect).toHaveBeenCalledWith();
    });

    describe("read one", () => {
        it("should read one resource correctly", async () => {
            const data = { foo: "bar" };
            const getOne = vi.fn(() => data);
            const adapter = generateNoopAdapter({ getOne }, ["foo"]);
            const handler = await CrudHandler(adapter);

            const { req, res } = createMocks({
                method: "GET",
                url: "/api/foo/bar",
            });

            await handler(req, res);

            expect(res.end).toHaveBeenCalledWith(data);
        });

        it("should throw a 404 for a non existing resource", async () => {
            const getOne = vi.fn(() => null);
            const adapter = generateNoopAdapter({ getOne }, ["foo"]);
            const handler = await CrudHandler(adapter);

            const { req, res } = createMocks({
                method: "GET",
                url: "/api/foo/bar",
            });

            await expect(async () => await handler(req, res)).rejects.toThrowErrorMatchingInlineSnapshot('"foo bar not found"');
        });
    });

    describe("read all", () => {
        it("should read a collection of resources", async () => {
            const collection = [{ id: 1 }, { id: 2 }];
            const getAll = vi.fn(() => collection);
            const adapter = generateNoopAdapter({ getAll }, ["foo"]);
            const handler = await CrudHandler(adapter);

            const { req, res } = createMocks({
                method: "GET",
                url: "/api/foo",
            });
            await handler(req, res);
            expect(res.end).toHaveBeenCalledWith(collection);
        });
    });

    describe("create one", () => {
        it("should return a 201 status code upon a resource creation", async () => {
            const data = { foo: "bar" };
            const create = vi.fn(() => data);
            const adapter = generateNoopAdapter({ create }, ["foo"]);
            const handler = await CrudHandler(adapter);

            const { req, res } = createMocks({
                method: "POST",
                url: "/api/foo",
            });

            await handler(req, res);

            expect(res.end).toHaveBeenCalledWith(data);
            expect(res.statusCode).toBe(201);
        });
    });

    describe("update one", () => {
        it("should update an existing resource", async () => {
            const data = { id: 1 };
            const body = { foo: "bar" };
            const parseQuery = vi.fn(() => {
                return {};
            });
            const getOne = vi.fn(() => data);
            const update = vi.fn(() => {
                return { ...data, ...body };
            });
            const adapter = generateNoopAdapter({ getOne, parseQuery, update }, ["foo"]);
            const handler = await CrudHandler(adapter);

            const { req, res } = createMocks({
                body,
                method: "PUT",
                url: "/api/foo/bar",
            });

            await handler(req, res);

            expect(res.end).toHaveBeenCalledWith({ ...data, ...body });
            expect(update).toHaveBeenCalledWith("foo", "bar", body, {});
        });

        it("should throw a 404 when updating a non existing resource", async () => {
            const getOne = vi.fn(() => null);
            const update = vi.fn(() => null);
            const adapter = generateNoopAdapter({ getOne, update }, ["foo"]);
            const handler = await CrudHandler(adapter);

            const { req, res } = createMocks({
                method: "PUT",
                url: "/api/foo/bar",
            });

            await expect(async () => await handler(req, res)).rejects.toThrowErrorMatchingInlineSnapshot('"foo bar not found"');

            expect(update).not.toHaveBeenCalled();
        });
    });

    describe("delete one", () => {
        it("should correctly delete a resource", async () => {
            const data = { id: 1 };
            const getOne = vi.fn(() => data);
            const parseQuery = vi.fn(() => {
                return {};
            });
            const deleteFunction = vi.fn(() => data);
            const adapter = generateNoopAdapter({ delete: deleteFunction, getOne, parseQuery }, ["foo"]);
            const handler = await CrudHandler(adapter);

            const { req, res } = createMocks({
                method: "DELETE",
                url: "/api/foo/bar",
            });

            await handler(req, res);

            expect(res.end).toHaveBeenCalledWith(data);
            expect(deleteFunction).toHaveBeenCalledWith("foo", "bar", {});
        });

        it("should throw a 404 when deleting a non existing resource", async () => {
            const getOne = vi.fn(() => null);
            const deleteFunction = vi.fn(() => null);
            const adapter = generateNoopAdapter({ delete: deleteFunction, getOne }, ["foo"]);
            const handler = await CrudHandler(adapter);

            const { req, res } = createMocks({
                method: "DELETE",
                url: "/api/foo/bar",
            });

            await expect(async () => await handler(req, res)).rejects.toThrowErrorMatchingInlineSnapshot('"foo bar not found"');

            expect(deleteFunction).not.toHaveBeenCalledWith();
        });
    });

    describe("unknown method", () => {
        it("should return 404 upon unknown method", async () => {
            const handler = await CrudHandler(new NoopAdapter(["foo"]));

            const { req, res } = createMocks({
                method: "OPTIONS",
                url: "/api/foo",
            });

            await expect(async () => await handler(req, res)).rejects.toThrowErrorMatchingInlineSnapshot('"Route not found: /api/foo"');
        });

        it("should return 404 upon unknwon method even if accessibleRoutes allows it", async () => {
            const handler = await CrudHandler(new NoopAdapter(), {
                models: {
                    foo: {
                        only: [null],
                    },
                },
            });

            const { req, res } = createMocks({
                method: "OPTIONS",
                url: "/api/foo",
            });

            await expect(async () => await handler(req, res)).rejects.toThrowErrorMatchingInlineSnapshot('"Couldn\'t find model name for url /api/foo"');
        });

        it("should return 404 upon unknwon method even if its the only one not excluded", async () => {
            const handler = await CrudHandler(new NoopAdapter(), {
                models: {
                    foo: {
                        exclude: [RouteType.CREATE, RouteType.DELETE, RouteType.READ_ALL, RouteType.READ_ONE, RouteType.UPDATE],
                    },
                },
            });

            const { req, res } = createMocks({
                method: "OPTIONS",
                url: "/api/foo",
            });

            await expect(async () => await handler(req, res)).rejects.toThrowErrorMatchingInlineSnapshot('"Couldn\'t find model name for url /api/foo"');
        });
    });

    describe("pagination", () => {
        it("should get page based pagination data", async () => {
            const mockResources = [{ id: 1 }];
            const getAll = vi.fn(() => mockResources);
            const getPaginationData = vi.fn(() => {
                return {
                    pageCount: 1,
                    total: mockResources.length,
                };
            });
            const adapter = generateNoopAdapter({ getAll, getPaginationData }, ["foo"]);

            const handler = await CrudHandler(adapter);

            const { req, res } = createMocks({
                method: "GET",
                url: "/api/foo?page=1",
            });

            await handler(req, res);

            expect(res.end).toHaveBeenCalledWith({
                data: mockResources,
                meta: {
                    firstPage: 1,
                    firstPageUrl: "/?page=1",
                    lastPage: 1,
                    lastPageUrl: "/?page=1",
                    nextPageUrl: null,
                    page: Number.NaN,
                    perPage: 20,
                    previousPageUrl: null,
                    total: 1,
                },
            });
        });
    });
});
