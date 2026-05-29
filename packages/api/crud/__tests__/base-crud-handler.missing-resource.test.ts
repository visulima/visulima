import { afterEach, describe, expect, it, vi } from "vitest";

import type { Adapter, ParsedQueryParameters } from "../src";
import baseHandler from "../src/base-crud-handler";

type TestAdapter = Adapter<Record<string, unknown>, ParsedQueryParameters>;

interface TestRequest {
    headers: { host?: string };
    method: string;
    url: string;
}

const buildAdapter = (overrides: Partial<TestAdapter> = {}): TestAdapter => {
    return {
        connect: vi.fn<() => Promise<void>>().mockResolvedValue(),
        create: vi.fn<TestAdapter["create"]>().mockResolvedValue({}),
        delete: vi.fn<TestAdapter["delete"]>().mockResolvedValue({}),
        disconnect: vi.fn<() => Promise<void>>().mockResolvedValue(),
        getAll: vi.fn<TestAdapter["getAll"]>().mockResolvedValue([]),
        getModels: () => ["users"],
        getOne: vi.fn<TestAdapter["getOne"]>().mockResolvedValue({}),
        getPaginationData: vi.fn<TestAdapter["getPaginationData"]>().mockResolvedValue({ page: 1, pageCount: 1, total: 0 }),
        init: vi.fn<() => Promise<void>>().mockResolvedValue(),
        parseQuery: vi.fn<TestAdapter["parseQuery"]>().mockImplementation((_resourceName, query) => query),
        update: vi.fn<TestAdapter["update"]>().mockResolvedValue({}),
        ...overrides,
    };
};

const buildRequest = (init: { host?: string; method: string; url: string }): TestRequest => {
    return {
        headers: { host: init.host ?? "example.com" },
        method: init.method,
        url: init.url,
    };
};

describe("baseHandler missing resource name", () => {
    const originalNodeEnv = process.env.NODE_ENV;

    afterEach(() => {
        process.env.NODE_ENV = originalNodeEnv;
    });

    it("should throw a plain 404 when the resolved resource name is empty", async () => {
        expect.assertions(1);

        process.env.NODE_ENV = "test";

        const adapter = buildAdapter();
        const responseExecutor = vi.fn<(context: unknown, config: { data: unknown; status: number }) => Promise<unknown>>();
        const finalExecutor = vi.fn<(context: unknown) => Promise<void>>();

        // An empty route name makes the resource-name regex match every path while the
        // resolved resourceName stays falsy, which is the only way to reach the
        // missing-resource branch in baseHandler.
        const handler = await baseHandler<TestRequest, unknown, Record<string, unknown>>(responseExecutor, finalExecutor, adapter, {
            models: { users: { name: "" } },
        });

        await expect(handler(buildRequest({ method: "GET", url: "/anything" }), {})).rejects.toMatchObject({
            message: "Resource not found: /anything",
            statusCode: 404,
        });
    });

    it("should list the possible models in the 404 message in development mode", async () => {
        expect.assertions(1);

        process.env.NODE_ENV = "development";

        const adapter = buildAdapter({
            mapModelsToRouteNames: vi.fn<TestAdapter["mapModelsToRouteNames"]>().mockResolvedValue({ users: "users" }),
        });
        const responseExecutor = vi.fn<(context: unknown, config: { data: unknown; status: number }) => Promise<unknown>>();
        const finalExecutor = vi.fn<(context: unknown) => Promise<void>>();

        const handler = await baseHandler<TestRequest, unknown, Record<string, unknown>>(responseExecutor, finalExecutor, adapter, {
            models: { users: { name: "" } },
        });

        await expect(handler(buildRequest({ method: "GET", url: "/anything" }), {})).rejects.toMatchObject({
            message: "Resource not found, possible models: users",
            statusCode: 404,
        });
    });
});

describe("baseHandler unmatched route type", () => {
    it("should throw a 404 when getRouteType yields no matching route", async () => {
        expect.assertions(1);

        const adapter = buildAdapter();
        const responseExecutor = vi.fn<(context: unknown, config: { data: unknown; status: number }) => Promise<unknown>>();
        const finalExecutor = vi.fn<(context: unknown) => Promise<void>>();

        const handler = await baseHandler<TestRequest, unknown, Record<string, unknown>>(responseExecutor, finalExecutor, adapter);

        // PUT against a collection (no id) resolves to a null routeType.
        await expect(handler(buildRequest({ method: "PUT", url: "/api/users" }), {})).rejects.toMatchObject({
            message: "Route not found: /api/users",
            statusCode: 404,
        });
    });
});
