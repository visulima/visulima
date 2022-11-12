import { describe, expect, it } from "vitest";

import parsePrismaRecursiveField from "../../../../src/adapter/prisma/utils/parse-recursive";
import type { PrismaRecursive } from "../../../../src/adapter/prisma/types";

describe("Prisma parse recursive", () => {
    it("should parse select to prisma select", () => {
        expect(
            parsePrismaRecursiveField(
                {
                    post: true,
                    user: {
                        post: true,
                    },
                    session: {
                        user: {
                            post: true,
                        },
                    },
                },
                "select",
            ),
        ).toEqual<PrismaRecursive<"select">>({
            post: true,
            user: {
                select: {
                    post: true,
                },
            },
            session: {
                select: {
                    user: {
                        select: {
                            post: true,
                        },
                    },
                },
            },
        });
    });

    it("should parse include to prisma include", () => {
        expect(
            parsePrismaRecursiveField(
                {
                    post: true,
                    user: {
                        post: true,
                    },
                    session: {
                        user: {
                            post: true,
                        },
                    },
                },
                "include",
            ),
        ).toEqual<PrismaRecursive<"include">>({
            post: true,
            user: {
                include: {
                    post: true,
                },
            },
            session: {
                include: {
                    user: {
                        include: {
                            post: true,
                        },
                    },
                },
            },
        });
    });
});
