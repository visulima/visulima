/* eslint-disable max-classes-per-file */
import { beforeEach, describe, expect, it, vi } from "vitest";

import PrismaAdapter from "../../../src/adapter/prisma";
import type { FakePrismaClient } from "../../../src/types";

// Stand-ins for Prisma's internal error classes (handleError uses constructor.name).
class PrismaClientKnownRequestError extends Error {}
class PrismaClientValidationError extends Error {}

interface ModelDelegate {
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findOne?: ReturnType<typeof vi.fn>;
    findUnique?: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
}

const makeDelegate = (overrides: Partial<ModelDelegate> = {}): ModelDelegate => {
    return {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({}),
        delete: vi.fn().mockResolvedValue({}),
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
        ...overrides,
    };
};

interface TestClient extends FakePrismaClient {
    user: ModelDelegate;
}

const makeClient = (overrides: Partial<TestClient> = {}): TestClient => {
    const client = {
        $connect: vi.fn(),
        $disconnect: vi.fn().mockResolvedValue(undefined),

        _dmmf: { mappingsMap: { User: { plural: "users" } } },
        user: makeDelegate(),
        ...overrides,
    };

    return client;
};

describe(PrismaAdapter, () => {
    let prismaClient: TestClient;
    let adapter: PrismaAdapter<unknown, "User", TestClient>;

    beforeEach(() => {
        prismaClient = makeClient();
        adapter = new PrismaAdapter({
            models: ["User"],
            prismaClient,
        });
    });

    describe("connect/disconnect", () => {
        it("should delegate $connect", async () => {
            expect.assertions(1);

            await adapter.connect();

            expect(prismaClient.$connect).toHaveBeenCalledTimes(1);
        });

        it("should delegate $disconnect", async () => {
            expect.assertions(1);

            await adapter.disconnect();

            expect(prismaClient.$disconnect).toHaveBeenCalledTimes(1);
        });
    });

    describe("init", () => {
        it("should populate models from constructor argument when valid", async () => {
            expect.assertions(1);

            await adapter.init();

            expect(adapter.getModels()).toStrictEqual(["User"]);
        });

        it("should throw when configured model is not in dmmf", async () => {
            expect.assertions(1);

            const badAdapter = new PrismaAdapter({
                models: ["Ghost"],
                prismaClient,
            });

            await expect(badAdapter.init()).rejects.toThrow("Model name Ghost is invalid.");
        });

        it("should fall back to dmmf model keys when no models are configured", async () => {
            expect.assertions(1);

            const noModelsAdapter = new PrismaAdapter({
                prismaClient,
            });

            await noModelsAdapter.init();

            expect(noModelsAdapter.getModels()).toStrictEqual(["User"]);
        });

        it("should support clients exposing _getDmmf instead of _dmmf", async () => {
            expect.assertions(1);

            const client = makeClient() as Record<string, unknown> & TestClient;

            delete client["_dmmf"];
            vi.spyOn(client, "_getDmmf").mockImplementation().mockResolvedValue({ mappingsMap: { User: { plural: "users" } } });

            const a = new PrismaAdapter({
                models: ["User"],
                prismaClient: client,
            });

            await a.init();

            expect(a.getModels()).toStrictEqual(["User"]);
        });

        it("should resolve models from the Prisma 5/6 dmmf option (datamodel.models)", async () => {
            expect.assertions(1);

            const client = makeClient() as Record<string, unknown> & TestClient;

            // Prisma 5/6 removed the private _dmmf/_getDmmf internals.
            delete client["_dmmf"];

            const a = new PrismaAdapter({
                dmmf: { datamodel: { models: [{ name: "User" }] } },
                models: ["User"],
                prismaClient: client,
            });

            await a.init();

            expect(a.getModels()).toStrictEqual(["User"]);
        });

        it("should resolve models from the client's _runtimeDataModel fallback", async () => {
            expect.assertions(1);

            const client = makeClient() as Record<string, unknown> & TestClient;

            delete client["_dmmf"];
            client["_runtimeDataModel"] = { models: { User: {} } };

            const a = new PrismaAdapter({
                models: ["User"],
                prismaClient: client,
            });

            await a.init();

            expect(a.getModels()).toStrictEqual(["User"]);
        });

        it("should throw when client exposes neither _dmmf nor _getDmmf", async () => {
            expect.assertions(1);

            const client = makeClient() as Record<string, unknown> & TestClient;

            delete client["_dmmf"];

            const a = new PrismaAdapter({
                prismaClient: client,
            });

            await expect(a.init()).rejects.toThrow("Couldn't get prisma client models");
        });
    });

    describe("cRUD methods", () => {
        it("should call delegate.findMany for getAll", async () => {
            expect.assertions(2);

            const users = [{ id: 1 }];

            prismaClient.user.findMany.mockResolvedValue(users);

            const result = await adapter.getAll("User", { take: 5, where: { id: 1 } });

            expect(prismaClient.user.findMany).toHaveBeenCalledWith({
                cursor: undefined,
                distinct: undefined,
                include: undefined,
                orderBy: undefined,
                select: undefined,
                skip: undefined,
                take: 5,
                where: { id: 1 },
            });
            expect(result).toBe(users);
        });

        it("should call delegate.create for create", async () => {
            expect.assertions(2);

            const created = { id: 1, name: "Ada" };

            prismaClient.user.create.mockResolvedValue(created);

            const result = await adapter.create("User", { name: "Ada" }, {});

            expect(prismaClient.user.create).toHaveBeenCalledWith({
                data: { name: "Ada" },
                include: undefined,
                select: undefined,
            });
            expect(result).toBe(created);
        });

        it("should call delegate.update for update", async () => {
            expect.assertions(2);

            const updated = { id: 2, name: "Updated" };

            prismaClient.user.update.mockResolvedValue(updated);

            const result = await adapter.update("User", 2, { name: "Updated" }, {});

            expect(prismaClient.user.update).toHaveBeenCalledWith({
                data: { name: "Updated" },
                include: undefined,
                select: undefined,
                where: { id: 2 },
            });
            expect(result).toBe(updated);
        });

        it("should call delegate.delete for delete", async () => {
            expect.assertions(2);

            const deleted = { id: 3 };

            prismaClient.user.delete.mockResolvedValue(deleted);

            const result = await adapter.delete("User", 3, {});

            expect(prismaClient.user.delete).toHaveBeenCalledWith({
                include: undefined,
                select: undefined,
                where: { id: 3 },
            });
            expect(result).toBe(deleted);
        });

        it("should prefer findUnique over findOne when available", async () => {
            expect.assertions(2);

            const fetched = { id: 1 };

            vi.spyOn(prismaClient.user, "findUnique").mockImplementation().mockResolvedValue(fetched);
            vi.spyOn(prismaClient.user, "findOne").mockImplementation();

            const result = await adapter.getOne("User", 1, {});

            expect(prismaClient.user.findUnique).toHaveBeenCalledTimes(1);
            expect(result).toBe(fetched);
        });

        it("should fall back to findOne when findUnique is missing", async () => {
            expect.assertions(1);

            prismaClient.user.findUnique = undefined;
            vi.spyOn(prismaClient.user, "findOne").mockImplementation().mockResolvedValue({ id: 1 });

            await adapter.getOne("User", 1, {});

            expect(prismaClient.user.findOne).toHaveBeenCalledTimes(1);
        });
    });

    describe("getPaginationData", () => {
        it("should return paginated metadata derived from count + skip/take", async () => {
            expect.assertions(1);

            prismaClient.user.count.mockResolvedValue(20);

            const result = await adapter.getPaginationData("User", { skip: 10, take: 5 });

            expect(result).toStrictEqual({ page: 3, pageCount: 4, total: 20 });
        });
    });

    describe("handleError", () => {
        // handleError calls console.error by design; silence to keep test output clean
        beforeEach(() => {
            vi.spyOn(console, "error").mockImplementation(() => {});
        });

        it("should rethrow PrismaClientKnownRequestError as 400", () => {
            expect.assertions(1);

            const error = new PrismaClientKnownRequestError("bad request");

            expect(() => adapter.handleError(error)).toThrow(expect.objectContaining({ statusCode: 400 }));
        });

        it("should rethrow PrismaClientValidationError as 400", () => {
            expect.assertions(1);

            const error = new PrismaClientValidationError("validation");

            expect(() => adapter.handleError(error)).toThrow(expect.objectContaining({ statusCode: 400 }));
        });

        it("should rethrow other errors as 500", () => {
            expect.assertions(1);

            const error = new Error("kaboom");

            expect(() => adapter.handleError(error)).toThrow(expect.objectContaining({ statusCode: 500 }));
        });
    });

    describe("parseQuery", () => {
        it("should pass through all supported query fields", () => {
            expect.assertions(1);

            const parsed = adapter.parseQuery("User", {
                distinct: "id",
                include: { posts: true },
                limit: 10,
                orderBy: { id: "$asc" },
                originalQuery: {
                    cursor: JSON.stringify({ id: 1 }),
                    where: JSON.stringify({ id: 5 }),
                },
                select: { id: true },
                skip: 5,
                where: { id: 5 },
            });

            expect(parsed).toStrictEqual({
                cursor: { id: 1 },
                distinct: "id",
                include: { posts: true },
                orderBy: { id: "asc" },
                select: { id: true },
                skip: 5,
                take: 10,
                where: { id: 5 },
            });
        });

        it("should return empty object when no query fields are set", () => {
            expect.assertions(1);

            expect(adapter.parseQuery("User", {})).toStrictEqual({});
        });
    });

    describe("mapModelsToRouteNames", () => {
        it("should produce route map from dmmf plural names", async () => {
            expect.assertions(1);

            await adapter.init();
            const map = await adapter.mapModelsToRouteNames();

            expect(map).toStrictEqual({ User: "users" });
        });
    });

    describe("client getter", () => {
        it("should expose the underlying prisma client", () => {
            expect.assertions(1);

            expect(adapter.client).toBe(prismaClient);
        });
    });
});
