import { describe, expect, it } from "vitest";

import type { WhereField } from "../../../../../src";
import type { PrismaWhereField } from "../../../../../src/adapter/prisma/types";
import parsePrismaWhere from "../../../../../src/adapter/prisma/utils/parse-where";

describe("prisma parse where", () => {
    it("should mirror basic primitives", () => {
        const baseQuery = {
            id: 1,
            username: "foobar",
        };

        expect(parsePrismaWhere(baseQuery, [])).toStrictEqual<PrismaWhereField>(baseQuery);
    });

    it("should handle a date value", () => {
        const now = new Date().toISOString();
        const baseQuery = {
            createdAt: now,
        };

        expect(parsePrismaWhere(baseQuery, [])).toStrictEqual<PrismaWhereField>({
            createdAt: new Date(now),
        });
    });

    it("should handle operators", () => {
        const baseQuery: WhereField = {
            id: {
                $neq: 1,
            },
            username: {
                $cont: "foo",
            },
        };

        expect(parsePrismaWhere(baseQuery, [])).toStrictEqual<PrismaWhereField>({
            id: {
                not: 1,
            },
            username: {
                contains: "foo",
            },
        });
    });

    it("should mirror $isnull value to null", () => {
        const baseQuery: WhereField = {
            username: "$isnull",
        };

        expect(parsePrismaWhere(baseQuery, [])).toStrictEqual<PrismaWhereField>({
            username: null,
        });
    });

    it("should parse $and", () => {
        let baseQuery: WhereField = {
            $and: {
                id: 1,
                username: {
                    $cont: "foo",
                },
            },
        };

        expect(parsePrismaWhere(baseQuery, [])).toStrictEqual<PrismaWhereField>(
            // @ts-expect-error
            {
                AND: {
                    id: 1,
                    username: {
                        contains: "foo",
                    },
                },
            },
        );

        baseQuery = {
            $and: {
                "posts.author.id": 1,
                username: {
                    $cont: "foo",
                },
            },
        };

        expect(parsePrismaWhere(baseQuery, ["posts.author"])).toStrictEqual<PrismaWhereField>(
            // @ts-expect-error
            {
                AND: {
                    posts: {
                        some: {
                            author: {
                                some: {
                                    id: 1,
                                },
                            },
                        },
                    },
                    username: {
                        contains: "foo",
                    },
                },
            },
        );
    });

    it("should parse $or", () => {
        let baseQuery: WhereField = {
            $or: {
                id: 1,
                username: {
                    $cont: "foo",
                },
            },
        };

        expect(parsePrismaWhere(baseQuery, [])).toStrictEqual<PrismaWhereField>(
            // @ts-expect-error
            {
                OR: {
                    id: 1,
                    username: {
                        contains: "foo",
                    },
                },
            },
        );

        baseQuery = {
            $or: {
                "posts.author.id": 1,
                username: {
                    $cont: "foo",
                },
            },
        };

        expect(parsePrismaWhere(baseQuery, ["posts.author"])).toStrictEqual<PrismaWhereField>(
            // @ts-expect-error
            {
                OR: {
                    posts: {
                        some: {
                            author: {
                                some: {
                                    id: 1,
                                },
                            },
                        },
                    },
                    username: {
                        contains: "foo",
                    },
                },
            },
        );
    });

    it("should parse $not", () => {
        let baseQuery: WhereField = {
            $not: {
                id: 1,
                username: {
                    $cont: "foo",
                },
            },
        };

        expect(parsePrismaWhere(baseQuery, [])).toStrictEqual<PrismaWhereField>(
            // @ts-expect-error
            {
                NOT: {
                    id: 1,
                    username: {
                        contains: "foo",
                    },
                },
            },
        );

        baseQuery = {
            $not: {
                "posts.author.id": 1,
                username: {
                    $cont: "foo",
                },
            },
        };

        expect(parsePrismaWhere(baseQuery, ["posts.author"])).toStrictEqual<PrismaWhereField>(
            // @ts-expect-error
            {
                NOT: {
                    posts: {
                        some: {
                            author: {
                                some: {
                                    id: 1,
                                },
                            },
                        },
                    },
                    username: {
                        contains: "foo",
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

        expect(parsePrismaWhere(baseQuery, ["posts"])).toStrictEqual<PrismaWhereField>({
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
            "posts.author.id": 1,
            "posts.content": {
                $cont: "Hello",
            },
            "posts.id": 1,
        };

        expect(parsePrismaWhere(baseQuery, ["posts", "posts.author"])).toStrictEqual<PrismaWhereField>({
            posts: {
                some: {
                    author: {
                        some: {
                            id: 1,
                        },
                    },
                    content: {
                        contains: "Hello",
                    },
                    id: 1,
                },
            },
        });
    });
});
