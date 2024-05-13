import type { NextApiHandler, NextApiRequest, NextApiResponse } from "next";

import type { RequestOptions } from "node-mocks-http";
// eslint-disable-next-line import/no-extraneous-dependencies
import { createMocks as createHttpMocks } from "node-mocks-http";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
// eslint-disable-next-line n/no-unpublished-import
import { Prisma } from "./prisma-client";
// eslint-disable-next-line n/no-unpublished-import
import type { Post, PrismaClient, User } from "./prisma-client";

// eslint-disable-next-line n/no-unpublished-import
import CrudHandler from "../../../utils/crud-handler";
import prisma from "./client";
import { createSeedData } from "./seed";
// eslint-disable-next-line n/no-unpublished-import
import PrismaAdapter from "../../../../src/adapter/prisma";
// eslint-disable-next-line n/no-unpublished-import
import type { Adapter } from "../../../../src/types";

const createMocks = (
    options: RequestOptions,
): {
    req: NextApiRequest;
    res: NextApiResponse;
} => {
    const { req, res } = createHttpMocks(options);

    return {
        req: req as unknown as NextApiRequest,
        res: {
            ...res,
            end: vi.spyOn(res, "end"),
        } as unknown as NextApiResponse,
    };
};

describe("prisma interraction", () => {
    beforeAll(async () => {
        await createSeedData();
    });

    let adapter: PrismaAdapter<Post | User, Prisma.ModelName, PrismaClient>;
    let handler: NextApiHandler;

    beforeEach(async () => {
        adapter = new PrismaAdapter<Post | User, Prisma.ModelName, PrismaClient>({
            manyRelations: {
                [Prisma.ModelName.User]: ["post.author", "comment.post", "comment.author"],
            },
            prismaClient: prisma,
        });
        handler = await CrudHandler(adapter as Adapter<any, any>, {
            models: {
                [Prisma.ModelName.User]: {
                    name: "users",
                },
            },
        });
    });

    afterAll(async () => {
        await prisma.comment.deleteMany();
        await prisma.post.deleteMany();
        await prisma.user.deleteMany();
        await prisma.$disconnect();
    });

    it("should get the list of users", async () => {
        const { req, res } = createMocks({
            method: "GET",
            url: "/api/users",
        });

        const expectedResult = await prisma.user.findMany();

        await handler(req, res);

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(res.end).toHaveBeenCalledWith(expectedResult);
    });

    it("should get a page based paginated users list", async () => {
        const { req, res } = createMocks({
            method: "GET",
            url: "/api/users?page=2&limit=2",
        });

        const expectedResult = await prisma.user.findMany({
            skip: 2,
            take: 2,
        });

        await handler(req, res);

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(res.end).toHaveBeenCalledWith({
            data: expectedResult,
            meta: {
                firstPage: 1,
                firstPageUrl: "/?page=1",
                lastPage: 2,
                lastPageUrl: "/?page=2",
                nextPageUrl: null,
                page: 2,
                perPage: 2,
                previousPageUrl: "/?page=1",
                total: 4,
            },
        });
    });

    it("should get the user with first id", async () => {
        const user = await prisma.user.findFirst();

        const { req, res } = createMocks({
            method: "GET",
            url: `/api/users/${user?.id}`,
        });

        await handler(req, res);

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(res.end).toHaveBeenCalledWith(user);
    });

    it("should get the list of users with only their email", async () => {
        const { req, res } = createMocks({
            method: "GET",
            url: "/api/users?select=email",
        });

        const expectedResult = await prisma.user.findMany({
            select: {
                email: true,
            },
        });

        await handler(req, res);

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(res.end).toHaveBeenCalledWith(expectedResult);
    });

    it("should get the list of users with only their email and posts", async () => {
        const { req, res } = createMocks({
            method: "GET",
            url: "/api/users?select=email,posts",
        });

        const expectedResult = await prisma.user.findMany({
            select: {
                email: true,
                posts: true,
            },
        });

        await handler(req, res);

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(res.end).toHaveBeenCalledWith(expectedResult);
    });

    it("should get the list of users with only their email and posts ids", async () => {
        const { req, res } = createMocks({
            method: "GET",
            url: "/api/users?select=email,posts,posts.id",
        });

        const expectedResult = await prisma.user.findMany({
            select: {
                email: true,
                posts: {
                    select: {
                        id: true,
                    },
                },
            },
        });

        await handler(req, res);

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(res.end).toHaveBeenCalledWith(expectedResult);
    });

    it("should get the list of users with only their email, posts ids, comments and comments users", async () => {
        const { req, res } = createMocks({
            method: "GET",
            url: "/api/users?select=email,posts,posts.id,posts.comment,posts.comment.author",
        });

        const expectedResult = await prisma.user.findMany({
            select: {
                email: true,
                posts: {
                    select: {
                        comment: {
                            select: {
                                author: true,
                            },
                        },
                        id: true,
                    },
                },
            },
        });

        await handler(req, res);

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(res.end).toHaveBeenCalledWith(expectedResult);
    });

    it("should return the first 2 users", async () => {
        const { req, res } = createMocks({
            method: "GET",
            url: "/api/users?limit=2",
        });

        const expectedResult = await prisma.user.findMany({
            take: 2,
        });

        await handler(req, res);

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(res.end).toHaveBeenCalledWith(expectedResult);
    });

    it("should return 2 users after the first 2 ones", async () => {
        const { req, res } = createMocks({
            method: "GET",
            url: "/api/users?skip=2&limit=2",
        });

        const expectedResult = await prisma.user.findMany({
            skip: 2,
            take: 2,
        });

        await handler(req, res);

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(res.end).toHaveBeenCalledWith(expectedResult);
    });

    it("should return 2 users based on a cursor", async () => {
        const firstUser = await prisma.user.findFirst();

        const { req, res } = createMocks({
            method: "GET",
            url: `/api/users?limit=2&cursor={"id":${firstUser?.id}}`,
        });

        const expectedResult = await prisma.user.findMany({
            cursor: {
                id: firstUser?.id,
            },
            take: 2,
        });

        await handler(req, res);

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(res.end).toHaveBeenCalledWith(expectedResult);
    });

    it("should filter user by its email", async () => {
        const { req, res } = createMocks({
            method: "GET",
            url: '/api/users?where={"email":{"$eq":"johndoe1@gmail.com"}}',
        });

        const expectedResult = await prisma.user.findMany({
            where: {
                email: {
                    equals: "johndoe1@gmail.com",
                },
            },
        });

        await handler(req, res);

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(res.end).toHaveBeenCalledWith(expectedResult);
    });

    it("should filter users where email does not match", async () => {
        const { req, res } = createMocks({
            method: "GET",
            url: '/api/users?where={"email":{"$neq":"johndoe1@gmail.com"}}',
        });

        const expectedResult = await prisma.user.findMany({
            where: {
                email: {
                    not: "johndoe1@gmail.com",
                },
            },
        });

        await handler(req, res);

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(res.end).toHaveBeenCalledWith(expectedResult);
    });

    it("should filter users where email starts with john and ends with .com", async () => {
        const { req, res } = createMocks({
            method: "GET",
            url: '/api/users?where={"email":{"$and":{"$starts":"john", "$ends":".com"}}}',
        });

        const expectedResult = await prisma.user.findMany({
            where: {
                AND: [{ email: { startsWith: "john" } }, { email: { endsWith: ".com" } }],
            },
        });

        await handler(req, res);

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(res.end).toHaveBeenCalledWith(expectedResult);
    });

    it("should create a user", async () => {
        const { req, res } = createMocks({
            body: {
                email: "createdjohn@gmail.com",
            },

            method: "POST",
            url: "/api/users",
        });

        await handler(req, res);

        const expectedResult = await prisma.user.findFirst({
            where: {
                email: "createdjohn@gmail.com",
            },
        });

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(res.end).toHaveBeenCalledWith(expectedResult);
    });

    it("should update a user", async () => {
        const user = await prisma.user.findFirst({
            where: {
                email: "createdjohn@gmail.com",
            },
        });
        const { req, res } = createMocks({
            body: {
                email: "updated@gmail.com",
            },

            method: "PATCH",
            url: `/api/users/${user?.id}`,
        });

        await handler(req, res);

        const expectedResult = await prisma.user.findFirst({
            where: {
                email: "updated@gmail.com",
            },
        });

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(res.end).toHaveBeenCalledWith(expectedResult);
    });

    it("should update a user and respond with only its email", async () => {
        const user = await prisma.user.findFirst({
            where: {
                email: "updated@gmail.com",
            },
        });
        const { req, res } = createMocks({
            body: {
                email: "updated1@gmail.com",
            },

            method: "PATCH",
            url: `/api/users/${user?.id}?select=email`,
        });

        await handler(req, res);

        const expectedResult = await prisma.user.findFirst({
            select: {
                email: true,
            },
            where: {
                email: "updated1@gmail.com",
            },
        });

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(res.end).toHaveBeenCalledWith(expectedResult);
    });

    it("should delete the previously created user", async () => {
        const user = await prisma.user.findFirst({
            where: {
                email: "updated1@gmail.com",
            },
        });
        const { req, res } = createMocks({
            method: "DELETE",
            url: `/api/users/${user?.id}`,
        });

        await handler(req, res);

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(res.end).toHaveBeenCalledWith(user);
    });
});
