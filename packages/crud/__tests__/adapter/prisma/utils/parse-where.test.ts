import { describe, expect, it } from "vitest";

import type { WhereField } from "../../../../src";
import type { PrismaWhereField } from "../../../../src/adapter/prisma/types";
import parsePrismaWhere from "../../../../src/adapter/prisma/utils/parse-where";

describe("Prisma parse where", () => {
    it("should mirror basic primitives", () => {
        const baseQuery = {
            username: "foobar",
            id: 1,
        };

        expect(parsePrismaWhere(baseQuery, [])).toEqual<PrismaWhereField>(
            baseQuery,
        );
    });

    it("should handle a date value", () => {
        const now = new Date().toISOString();
        const baseQuery = {
            createdAt: now,
        };

        expect(parsePrismaWhere(baseQuery, [])).toEqual<PrismaWhereField>({
            createdAt: new Date(now),
        });
    });

    it("should handle operators", () => {
        const baseQuery: WhereField = {
            username: {
                $cont: "foo",
            },
            id: {
                $neq: 1,
            },
        };

        expect(parsePrismaWhere(baseQuery, [])).toEqual<PrismaWhereField>({
            username: {
                contains: "foo",
            },
            id: {
                not: 1,
            },
        });
    });

    it("should mirror $isnull value to null", () => {
        const baseQuery: WhereField = {
            username: "$isnull",
        };

        expect(parsePrismaWhere(baseQuery, [])).toEqual<PrismaWhereField>({
            username: null,
        });
    });

    it("should parse $and", () => {
        let baseQuery: WhereField = {
            $and: {
                username: {
                    $cont: "foo",
                },
                id: 1,
            },
        };

        expect(parsePrismaWhere(baseQuery, [])).toEqual<PrismaWhereField>(
            // @ts-ignore
            {
                AND: {
                    username: {
                        contains: "foo",
                    },
                    id: 1,
                },
            },
        );

        baseQuery = {
            $and: {
                username: {
                    $cont: "foo",
                },
                "posts.author.id": 1,
            },
        };

        expect(
            // eslint-disable-next-line radar/no-duplicate-string
            parsePrismaWhere(baseQuery, ["posts.author"]),
        ).toEqual<PrismaWhereField>(
            // @ts-ignore
            {
                AND: {
                    username: {
                        contains: "foo",
                    },
                    posts: {
                        some: {
                            author: {
                                some: {
                                    id: 1,
                                },
                            },
                        },
                    },
                },
            },
        );
    });

    it("should parse $or", () => {
        let baseQuery: WhereField = {
            $or: {
                username: {
                    $cont: "foo",
                },
                id: 1,
            },
        };

        expect(parsePrismaWhere(baseQuery, [])).toEqual<PrismaWhereField>(
            // @ts-ignore
            {
                OR: {
                    username: {
                        contains: "foo",
                    },
                    id: 1,
                },
            },
        );

        baseQuery = {
            $or: {
                username: {
                    $cont: "foo",
                },
                "posts.author.id": 1,
            },
        };

        expect(
            parsePrismaWhere(baseQuery, ["posts.author"]),
        ).toEqual<PrismaWhereField>(
            // @ts-ignore
            {
                OR: {
                    username: {
                        contains: "foo",
                    },
                    posts: {
                        some: {
                            author: {
                                some: {
                                    id: 1,
                                },
                            },
                        },
                    },
                },
            },
        );
    });

    it("should parse $not", () => {
        let baseQuery: WhereField = {
            $not: {
                username: {
                    $cont: "foo",
                },
                id: 1,
            },
        };

        expect(parsePrismaWhere(baseQuery, [])).toEqual<PrismaWhereField>(
            // @ts-ignore
            {
                NOT: {
                    username: {
                        contains: "foo",
                    },
                    id: 1,
                },
            },
        );

        baseQuery = {
            $not: {
                username: {
                    $cont: "foo",
                },
                "posts.author.id": 1,
            },
        };

        expect(
            parsePrismaWhere(baseQuery, ["posts.author"]),
        ).toEqual<PrismaWhereField>(
            // @ts-ignore
            {
                NOT: {
                    username: {
                        contains: "foo",
                    },
                    posts: {
                        some: {
                            author: {
                                some: {
                                    id: 1,
                                },
                            },
                        },
                    },
                },
            },
        );
    });

    it("should handle simple relations", () => {
        const baseQuery: WhereField = {
            "posts.content": {
                $cont: "Hello",
            },
        };

        expect(parsePrismaWhere(baseQuery, ["posts"])).toEqual<PrismaWhereField>({
            posts: {
                some: {
                    content: {
                        contains: "Hello",
                    },
                },
            },
        });
    });

    it("should handle nested relations", () => {
        const baseQuery: WhereField = {
            "posts.content": {
                $cont: "Hello",
            },
            "posts.author.id": 1,
            "posts.id": 1,
        };

        expect(
            parsePrismaWhere(baseQuery, ["posts", "posts.author"]),
        ).toEqual<PrismaWhereField>({
            posts: {
                some: {
                    id: 1,
                    content: {
                        contains: "Hello",
                    },
                    author: {
                        some: {
                            id: 1,
                        },
                    },
                },
            },
        });
    });
});
