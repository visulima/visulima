import { describe, expect, it } from "vitest";

import type { PrismaRecursive } from "../../../../src/adapter/prisma/types";
import parsePrismaRecursiveField from "../../../../src/adapter/prisma/utils/parse-recursive";

describe("prisma parse recursive", () => {
    it("should parse select to prisma select", () => {
        expect.assertions(1);

        expect(
            parsePrismaRecursiveField(
                {
                    post: true,
                    session: {
                        user: {
                            post: true,
                        },
                    },
                    user: {
                        post: true,
                    },
                },
                "select",
            ),
        ).toStrictEqual<PrismaRecursive<"select">>({
            post: true,
            session: {
                select: {
                    user: {
                        select: {
                            post: true,
                        },
                    },
                },
            },
            user: {
                select: {
                    post: true,
                },
            },
        });
    });

    it("should parse include to prisma include", () => {
        expect.assertions(1);

        expect(
            parsePrismaRecursiveField(
                {
                    post: true,
                    session: {
                        user: {
                            post: true,
                        },
                    },
                    user: {
                        post: true,
                    },
                },
                "include",
            ),
        ).toStrictEqual<PrismaRecursive<"include">>({
            post: true,
            session: {
                include: {
                    user: {
                        include: {
                            post: true,
                        },
                    },
                },
            },
            user: {
                include: {
                    post: true,
                },
            },
        });
    });
});
