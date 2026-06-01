import { describe, expect, it, vi } from "vitest";

import type { Adapter } from "../src";
import baseHandler from "../src/base-crud-handler";

const CREATE_ERROR_REGEX = /create/u;
const RESOURCE_NOT_FOUND_REGEX = /Resource not found|Couldn't find model name/u;

const buildAdapter = (overrides: Partial<Adapter<any, any>> = {}): Adapter<any, any> => {
    return {
        connect: vi.fn<() => Promise<void>>().mockResolvedValue(),
        create: vi.fn<Adapter<any, any>["create"]>().mockResolvedValue({}),
        delete: vi.fn<Adapter<any, any>["delete"]>().mockResolvedValue({}),
        disconnect: vi.fn<() => Promise<void>>().mockResolvedValue(),
        getAll: vi.fn<Adapter<any, any>["getAll"]>().mockResolvedValue([]),
        getModels: () => ["users"],
        getOne: vi.fn<Adapter<any, any>["getOne"]>().mockResolvedValue({}),
        getPaginationData: vi.fn<Adapter<any, any>["getPaginationData"]>().mockResolvedValue({ page: 1, pageCount: 1, total: 0 }),
        init: vi.fn<() => Promise<void>>().mockResolvedValue(),
        parseQuery: vi.fn<Adapter<any, any>["parseQuery"]>().mockImplementation((_resourceName, q) => q),
        update: vi.fn<Adapter<any, any>["update"]>().mockResolvedValue({}),
        ...overrides,
    };
};

const buildRequest = (init?: { body?: unknown; host?: string; method: string; url: string }): any => {
    const resolved = init ?? { method: "GET", url: "/users" };

    return {
        body: resolved.body,
        headers: { host: resolved.host ?? "example.com" },
        method: resolved.method,
        url: resolved.url,
    };
};

describe(baseHandler, () => {
    it("should validate adapter methods and throw when one is missing", async () => {
        expect.assertions(1);

        const adapter = buildAdapter();

        // @ts-expect-error -- intentionally remove a required method
        delete adapter.create;

        const responseExecutor = vi.fn();
        const finalExecutor = vi.fn();

        await expect(baseHandler(responseExecutor, finalExecutor, adapter)).rejects.toThrow(CREATE_ERROR_REGEX);
    });

    it("should call adapter.init during setup", async () => {
        expect.assertions(1);

        const adapter = buildAdapter();
        const responseExecutor = vi.fn().mockResolvedValue(undefined);
        const finalExecutor = vi.fn().mockResolvedValue(undefined);

        await baseHandler(responseExecutor, finalExecutor, adapter);

        expect(adapter.init).toHaveBeenCalledTimes(1);
    });

    it("should dispatch GET list to adapter.getAll and call response/final executors", async () => {
        expect.assertions(4);

        const adapter = buildAdapter({
            getAll: vi.fn<Adapter<any, any>["getAll"]>().mockResolvedValue([{ id: 1 }]),
        });
        const responseExecutor = vi.fn().mockResolvedValue(undefined);
        const finalExecutor = vi.fn().mockResolvedValue(undefined);

        const handler = await baseHandler(responseExecutor, finalExecutor, adapter);

        await handler(buildRequest({ method: "GET", url: "/users" }), {});

        expect(adapter.getAll).toHaveBeenCalledTimes(1);
        expect(adapter.connect).toHaveBeenCalledTimes(1);
        expect(adapter.disconnect).toHaveBeenCalledTimes(1);
        expect(responseExecutor).toHaveBeenCalledWith({}, { data: [{ id: 1 }], status: 200 });
    });

    it("should dispatch GET one to adapter.getOne with formatted resource id", async () => {
        expect.assertions(2);

        const adapter = buildAdapter({
            getOne: vi.fn<Adapter<any, any>["getOne"]>().mockResolvedValue({ id: 1 }),
        });
        const responseExecutor = vi.fn().mockResolvedValue(undefined);
        const finalExecutor = vi.fn().mockResolvedValue(undefined);

        const handler = await baseHandler(responseExecutor, finalExecutor, adapter);

        await handler(buildRequest({ method: "GET", url: "/api/users/1" }), {});

        // formatResourceId converts "1" -> 1
        expect(adapter.getOne).toHaveBeenCalledWith("users", 1, expect.any(Object));
        expect(responseExecutor).toHaveBeenCalledWith({}, { data: { id: 1 }, status: 200 });
    });

    it("should dispatch POST to adapter.create with request body", async () => {
        expect.assertions(2);

        const created = { id: 42, name: "Ada" };
        const adapter = buildAdapter({
            create: vi.fn<Adapter<any, any>["create"]>().mockResolvedValue(created),
        });
        const responseExecutor = vi.fn().mockResolvedValue(undefined);
        const finalExecutor = vi.fn().mockResolvedValue(undefined);

        const handler = await baseHandler(responseExecutor, finalExecutor, adapter);

        await handler(buildRequest({ body: { name: "Ada" }, method: "POST", url: "/api/users" }), {});

        expect(adapter.create).toHaveBeenCalledWith("users", { name: "Ada" }, expect.any(Object));
        expect(responseExecutor).toHaveBeenCalledWith({}, { data: created, status: 201 });
    });

    it("should dispatch PUT/PATCH to adapter.update with body and resource id", async () => {
        expect.assertions(2);

        const adapter = buildAdapter({
            getOne: vi.fn<Adapter<any, any>["getOne"]>().mockResolvedValue({ id: 5 }),
            update: vi.fn<Adapter<any, any>["update"]>().mockResolvedValue({ id: 5, name: "Updated" }),
        });
        const responseExecutor = vi.fn().mockResolvedValue(undefined);
        const finalExecutor = vi.fn().mockResolvedValue(undefined);

        const handler = await baseHandler(responseExecutor, finalExecutor, adapter);

        await handler(buildRequest({ body: { name: "Updated" }, method: "PATCH", url: "/api/users/5" }), {});

        expect(adapter.update).toHaveBeenCalledWith("users", 5, { name: "Updated" }, expect.any(Object));
        expect(responseExecutor).toHaveBeenCalledWith({}, { data: { id: 5, name: "Updated" }, status: 201 });
    });

    it("should dispatch DELETE to adapter.delete", async () => {
        expect.assertions(2);

        const adapter = buildAdapter({
            delete: vi.fn<Adapter<any, any>["delete"]>().mockResolvedValue({ id: 7 }),
            getOne: vi.fn<Adapter<any, any>["getOne"]>().mockResolvedValue({ id: 7 }),
        });
        const responseExecutor = vi.fn().mockResolvedValue(undefined);
        const finalExecutor = vi.fn().mockResolvedValue(undefined);

        const handler = await baseHandler(responseExecutor, finalExecutor, adapter);

        await handler(buildRequest({ method: "DELETE", url: "/api/users/7" }), {});

        expect(adapter.delete).toHaveBeenCalledWith("users", 7, expect.any(Object));
        expect(responseExecutor).toHaveBeenCalledWith({}, { data: { id: 7 }, status: 200 });
    });

    it("should throw 404 for unknown resource", async () => {
        expect.assertions(1);

        const adapter = buildAdapter();
        const responseExecutor = vi.fn();
        const finalExecutor = vi.fn();

        const handler = await baseHandler(responseExecutor, finalExecutor, adapter);

        await expect(handler(buildRequest({ method: "GET", url: "/unknown" }), {})).rejects.toThrow(RESOURCE_NOT_FOUND_REGEX);
    });

    it("should throw 404 for routes excluded via models.only", async () => {
        expect.assertions(2);

        const { RouteType } = await import("../src");
        const adapter = buildAdapter();
        const responseExecutor = vi.fn();
        const finalExecutor = vi.fn();

        const handler = await baseHandler(responseExecutor, finalExecutor, adapter, {
            models: {
                users: { only: [RouteType.READ_ALL] },
            },
        });

        // DELETE is not in the only list
        await expect(handler(buildRequest({ method: "DELETE", url: "/api/users/1" }), {})).rejects.toMatchObject({
            message: expect.stringContaining("Route not found"),
            statusCode: 404,
        });

        expect(adapter.delete).not.toHaveBeenCalled();
    });

    it("should map models to custom route names via options.models", async () => {
        expect.assertions(2);

        const adapter = buildAdapter();
        const responseExecutor = vi.fn().mockResolvedValue(undefined);
        const finalExecutor = vi.fn().mockResolvedValue(undefined);

        const handler = await baseHandler(responseExecutor, finalExecutor, adapter, {
            models: { users: { name: "people" } },
        });

        await handler(buildRequest({ method: "GET", url: "/people" }), {});

        expect(adapter.getAll).toHaveBeenCalledTimes(1);
        expect(responseExecutor).toHaveBeenCalledTimes(1);
    });

    it("should respect adapter.mapModelsToRouteNames when no options model name is set", async () => {
        expect.assertions(1);

        const adapter = buildAdapter({
            mapModelsToRouteNames: vi.fn().mockResolvedValue({ users: "accounts" }),
        });
        const responseExecutor = vi.fn().mockResolvedValue(undefined);
        const finalExecutor = vi.fn().mockResolvedValue(undefined);

        const handler = await baseHandler(responseExecutor, finalExecutor, adapter);

        await handler(buildRequest({ method: "GET", url: "/accounts" }), {});

        expect(adapter.getAll).toHaveBeenCalledTimes(1);
    });

    it("should call handleError for adapter exceptions when handleError is provided", async () => {
        expect.assertions(2);

        const failure = new Error("db down");
        const handleError = vi.fn();
        const adapter = buildAdapter({
            getAll: vi.fn<Adapter<any, any>["getAll"]>().mockRejectedValue(failure),
            handleError,
        });
        const responseExecutor = vi.fn();
        const finalExecutor = vi.fn().mockResolvedValue(undefined);

        const handler = await baseHandler(responseExecutor, finalExecutor, adapter);

        await handler(buildRequest({ method: "GET", url: "/users" }), {});

        expect(handleError).toHaveBeenCalledWith(failure);
        // finalExecutor still runs in the finally block
        expect(finalExecutor).toHaveBeenCalledTimes(1);
    });

    it("should rethrow if no handleError is set", async () => {
        expect.assertions(1);

        const failure = new Error("oops");
        const adapter = buildAdapter({
            getAll: vi.fn<Adapter<any, any>["getAll"]>().mockRejectedValue(failure),
        });

        // remove handleError

        delete adapter.handleError;

        const responseExecutor = vi.fn();
        const finalExecutor = vi.fn().mockResolvedValue(undefined);

        const handler = await baseHandler(responseExecutor, finalExecutor, adapter);

        await expect(handler(buildRequest({ method: "GET", url: "/users" }), {})).rejects.toBe(failure);
    });

    it("should use a custom handler from options.handlers.list", async () => {
        expect.assertions(2);

        const customList = vi.fn().mockResolvedValue({ data: ["custom"], status: 200 });
        const adapter = buildAdapter();
        const responseExecutor = vi.fn().mockResolvedValue(undefined);
        const finalExecutor = vi.fn().mockResolvedValue(undefined);

        const handler = await baseHandler(responseExecutor, finalExecutor, adapter, {
            handlers: { list: customList },
        });

        await handler(buildRequest({ method: "GET", url: "/users" }), {});

        expect(customList).toHaveBeenCalledTimes(1);
        expect(responseExecutor).toHaveBeenCalledWith({}, { data: ["custom"], status: 200 });
    });
});
