import { describe, expect, it } from "vitest";

import type { WhereField } from "../../../../src";
import type { PrismaWhereField } from "../../../../src/adapter/prisma/types";
import parsePrismaWhere from "../../../../src/adapter/prisma/utils/parse-where";

describe("prisma parse where", () => {
    it("should mirror basic primitives", () => {
        expect.assertions(1);

        const baseQuery = {
            id: 1,
            username: "foobar",
        };

        expect(parsePrismaWhere(baseQuery, [])).toStrictEqual<PrismaWhereField>(baseQuery);
    });

    it("should handle a date value", () => {
        expect.assertions(1);

        const now = new Date().toISOString();
        const baseQuery = {
            createdAt: now,
        };

        expect(parsePrismaWhere(baseQuery, [])).toStrictEqual<PrismaWhereField>({
            createdAt: new Date(now),
        });
    });

    it("should handle operators", () => {
        expect.assertions(1);

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
        expect.assertions(1);

        const baseQuery: WhereField = {
            username: "$isnull",
        };

        expect(parsePrismaWhere(baseQuery, [])).toStrictEqual<PrismaWhereField>({
            username: null,
        });
    });

    it("should parse $and", () => {
        expect.assertions(2);

        let baseQuery: WhereField = {
            $and: {
                id: 1,
                username: {
                    $cont: "foo",
                },
            },
        };

        expect(parsePrismaWhere(baseQuery, [])).toStrictEqual<PrismaWhereField>({
            AND: {
                id: 1,
                username: {
                    contains: "foo",
                },
            },
        });

        baseQuery = {
            $and: {
                "posts.author.id": 1,
                username: {
                    $cont: "foo",
                },
            },
        };

        expect(parsePrismaWhere(baseQuery, ["posts.author"])).toStrictEqual<PrismaWhereField>({
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
        });
    });

    it("should parse $or", () => {
        expect.assertions(2);

        let baseQuery: WhereField = {
            $or: {
                id: 1,
                username: {
                    $cont: "foo",
                },
            },
        };

        expect(parsePrismaWhere(baseQuery, [])).toStrictEqual<PrismaWhereField>({
            OR: {
                id: 1,
                username: {
                    contains: "foo",
                },
            },
        });

        baseQuery = {
            $or: {
                "posts.author.id": 1,
                username: {
                    $cont: "foo",
                },
            },
        };

        expect(parsePrismaWhere(baseQuery, ["posts.author"])).toStrictEqual<PrismaWhereField>({
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
        });
    });

    it("should parse $not", () => {
        expect.assertions(2);

        let baseQuery: WhereField = {
            $not: {
                id: 1,
                username: {
                    $cont: "foo",
                },
            },
        };

        expect(parsePrismaWhere(baseQuery, [])).toStrictEqual<PrismaWhereField>({
            NOT: {
                id: 1,
                username: {
                    contains: "foo",
                },
            },
        });

        baseQuery = {
            $not: {
                "posts.author.id": 1,
                username: {
                    $cont: "foo",
                },
            },
        };

        expect(parsePrismaWhere(baseQuery, ["posts.author"])).toStrictEqual<PrismaWhereField>({
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
        });
    });

    it("should handle simple relations", () => {
        expect.assertions(1);

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
        expect.assertions(1);

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
