import { describe, expect, it, vi } from "vitest";

import type { Adapter } from "../src";
import { RouteType } from "../src";
import baseHandler from "../src/base-crud-handler";

const buildAdapter = (overrides: Partial<Adapter<any, any>> = {}): Adapter<any, any> => {
    return {
        connect: vi.fn<() => Promise<void>>().mockResolvedValue(),
        create: vi.fn<Adapter<any, any>["create"]>().mockResolvedValue({}),
        delete: vi.fn<Adapter<any, any>["delete"]>().mockResolvedValue({}),
        disconnect: vi.fn<() => Promise<void>>().mockResolvedValue(),
        getAll: vi.fn<Adapter<any, any>["getAll"]>().mockResolvedValue([]),
        getModels: () => ["users"],
        getOne: vi.fn<Adapter<any, any>["getOne"]>().mockResolvedValue({ id: 1 }),
        getPaginationData: vi.fn<Adapter<any, any>["getPaginationData"]>().mockResolvedValue({ page: 1, pageCount: 1, total: 0 }),
        init: vi.fn<() => Promise<void>>().mockResolvedValue(),
        // Echo the parsed query so we can assert how the policy mutated it.
        parseQuery: vi.fn<Adapter<any, any>["parseQuery"]>().mockImplementation((_resourceName, q) => q),
        update: vi.fn<Adapter<any, any>["update"]>().mockResolvedValue({}),
        ...overrides,
    };
};

const buildRequest = (init?: { body?: unknown; host?: string; method?: string; url?: string }): any => {
    const { body, host, method = "GET", url = "/users" } = init ?? {};

    return {
        body,
        headers: { host: host ?? "example.com" },
        method,
        url,
    };
};

describe("base-crud-handler access policy", () => {
    it("should strip non-writable fields from a create body (mass-assignment guard)", async () => {
        expect.assertions(1);

        const adapter = buildAdapter();
        const handler = await baseHandler(vi.fn().mockResolvedValue(undefined), vi.fn().mockResolvedValue(undefined), adapter, {
            models: { users: { writableFields: ["name"] } },
        });

        await handler(buildRequest({ body: { isAdmin: true, name: "Ada", role: "superuser" }, method: "POST", url: "/api/users" }), {});

        expect(adapter.create).toHaveBeenCalledWith("users", { name: "Ada" }, expect.any(Object));
    });

    it("should strip non-writable fields from an update body", async () => {
        expect.assertions(1);

        const adapter = buildAdapter();
        const handler = await baseHandler(vi.fn().mockResolvedValue(undefined), vi.fn().mockResolvedValue(undefined), adapter, {
            models: { users: { writableFields: ["name"] } },
        });

        await handler(buildRequest({ body: { name: "Ada", role: "superuser" }, method: "PATCH", url: "/api/users/1" }), {});

        expect(adapter.update).toHaveBeenCalledWith("users", 1, { name: "Ada" }, expect.any(Object));
    });

    it("should reject selecting a field outside selectableFields", async () => {
        expect.assertions(1);

        const adapter = buildAdapter();
        const handler = await baseHandler(vi.fn().mockResolvedValue(undefined), vi.fn().mockResolvedValue(undefined), adapter, {
            models: { users: { selectableFields: ["id", "name"] } },
        });

        await handler(buildRequest({ method: "GET", url: "/api/users?select=id,passwordHash" }), {});

        // passwordHash is dropped from the select map handed to the adapter.
        expect(adapter.parseQuery).toHaveBeenCalledWith("users", expect.objectContaining({ select: { id: true } }));
    });

    it("should hide readableFields from an explicit select", async () => {
        expect.assertions(1);

        const adapter = buildAdapter();
        const handler = await baseHandler(vi.fn().mockResolvedValue(undefined), vi.fn().mockResolvedValue(undefined), adapter, {
            models: { users: { readableFields: ["passwordHash"] } },
        });

        await handler(buildRequest({ method: "GET", url: "/api/users?select=id,passwordHash" }), {});

        expect(adapter.parseQuery).toHaveBeenCalledWith("users", expect.objectContaining({ select: { id: true } }));
    });

    it("should reject filtering on a field outside filterableFields", async () => {
        expect.assertions(1);

        const adapter = buildAdapter();
        const handler = await baseHandler(vi.fn(), vi.fn().mockResolvedValue(undefined), adapter, {
            models: { users: { filterableFields: ["id"] } },
        });

        const where = encodeURIComponent(JSON.stringify({ passwordHash: { $cont: "a" } }));

        await expect(handler(buildRequest({ method: "GET", url: `/api/users?where=${where}` }), {})).rejects.toMatchObject({
            statusCode: 400,
        });
    });

    it("should reject including a relation outside includableRelations", async () => {
        expect.assertions(1);

        const adapter = buildAdapter();
        const handler = await baseHandler(vi.fn(), vi.fn().mockResolvedValue(undefined), adapter, {
            models: { users: { includableRelations: ["posts"] } },
        });

        await expect(handler(buildRequest({ method: "GET", url: "/api/users?include=secrets" }), {})).rejects.toMatchObject({
            statusCode: 400,
        });
    });

    it("should clamp limit to maxPerPage", async () => {
        expect.assertions(1);

        const adapter = buildAdapter();
        const handler = await baseHandler(vi.fn().mockResolvedValue(undefined), vi.fn().mockResolvedValue(undefined), adapter, {
            maxPerPage: 50,
        });

        await handler(buildRequest({ method: "GET", url: "/api/users?limit=100000000" }), {});

        expect(adapter.parseQuery).toHaveBeenCalledWith("users", expect.objectContaining({ limit: 50 }));
    });

    it("should let a per-model maxPerPage override the handler-level cap", async () => {
        expect.assertions(1);

        const adapter = buildAdapter();
        const handler = await baseHandler(vi.fn().mockResolvedValue(undefined), vi.fn().mockResolvedValue(undefined), adapter, {
            maxPerPage: 50,
            models: { users: { maxPerPage: 10 } },
        });

        await handler(buildRequest({ method: "GET", url: "/api/users?limit=9999" }), {});

        expect(adapter.parseQuery).toHaveBeenCalledWith("users", expect.objectContaining({ limit: 10 }));
    });

    it("should run a createSchema and forward its transformed output", async () => {
        expect.assertions(1);

        const adapter = buildAdapter();
        const handler = await baseHandler(vi.fn().mockResolvedValue(undefined), vi.fn().mockResolvedValue(undefined), adapter, {
            models: {
                users: {
                    createSchema: {
                        parse: (data) => {
                            return { ...(data as object), validated: true };
                        },
                    },
                },
            },
        });

        await handler(buildRequest({ body: { name: "Ada" }, method: "POST", url: "/api/users" }), {});

        expect(adapter.create).toHaveBeenCalledWith("users", { name: "Ada", validated: true }, expect.any(Object));
    });

    it("should reject when createSchema throws", async () => {
        expect.assertions(1);

        const adapter = buildAdapter();
        const handler = await baseHandler(vi.fn(), vi.fn().mockResolvedValue(undefined), adapter, {
            models: {
                users: {
                    createSchema: {
                        parse: () => {
                            throw new Error("invalid body");
                        },
                    },
                },
            },
        });

        await expect(handler(buildRequest({ body: {}, method: "POST", url: "/api/users" }), {})).rejects.toThrow("invalid body");
    });

    it("should invoke onRequest with the resolved route context and reject when it throws", async () => {
        expect.assertions(2);

        const onRequest = vi.fn();
        const adapter = buildAdapter();
        const handler = await baseHandler(vi.fn().mockResolvedValue(undefined), vi.fn().mockResolvedValue(undefined), adapter, {
            onRequest,
        });

        await handler(buildRequest({ method: "GET", url: "/api/users/5" }), {});

        expect(onRequest).toHaveBeenCalledWith(expect.objectContaining({ method: "GET", resourceId: 5, resourceName: "users", routeType: RouteType.READ_ONE }));

        const denying = await baseHandler(vi.fn(), vi.fn().mockResolvedValue(undefined), buildAdapter(), {
            onRequest: () => {
                throw new Error("forbidden");
            },
        });

        await expect(denying(buildRequest({ method: "GET", url: "/api/users" }), {})).rejects.toThrow("forbidden");
    });
});
