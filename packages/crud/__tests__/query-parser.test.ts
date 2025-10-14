import { describe, expect, it } from "vitest";

import type { ParsedQueryParameters } from "../src";
import parseQuery from "../src/query-parser";

describe("parse select", () => {
    it("should parse simple select", () => {
        expect.assertions(1);

        const url = "http://localhost/?select=user,post";

        const { originalQuery, ...result } = parseQuery(url);

        expect(result).toStrictEqual<ParsedQueryParameters>({
            select: {
                post: true,
                user: true,
            },
        });
    });

    it("should parse nested select 2", () => {
        expect.assertions(1);

        const url = "http://localhost/?select=user,post.user,post.title";
        const { originalQuery, ...result } = parseQuery(url);

        expect(result).toStrictEqual<ParsedQueryParameters>({
            select: {
                post: {
                    title: true,
                    user: true,
                },
                user: true,
            },
        });
    });

    // eslint-disable-next-line vitest/no-identical-title
    it("should parse nested select 2", () => {
        expect.assertions(1);

        const url = "http://localhost/?select=user,post.user,post.user.post";
        const { originalQuery, ...result } = parseQuery(url);

        expect(result).toStrictEqual<ParsedQueryParameters>({
            select: {
                post: {
                    user: {
                        post: true,
                    },
                },
                user: true,
            },
        });
    });
});

describe("parse include", () => {
    it("should parse simple include", () => {
        expect.assertions(1);

        const url = "http://localhost/?include=user,post";
        const { originalQuery, ...result } = parseQuery(url);

        expect(result).toStrictEqual<ParsedQueryParameters>({
            include: {
                post: true,
                user: true,
            },
        });
    });

    it("should parse nested include 1", () => {
        expect.assertions(1);

        const url = "http://localhost/?include=user,post.user,post.title";
        const { originalQuery, ...result } = parseQuery(url);

        expect(result).toStrictEqual<ParsedQueryParameters>({
            include: {
                post: {
                    title: true,
                    user: true,
                },
                user: true,
            },
        });
    });

    it("should parse nested include 12", () => {
        expect.assertions(1);

        const url = "http://localhost/?include=user,post.user,post.user.post";
        const { originalQuery, ...result } = parseQuery(url);

        expect(result).toStrictEqual<ParsedQueryParameters>({
            include: {
                post: {
                    user: {
                        post: true,
                    },
                },
                user: true,
            },
        });
    });
});

describe("parse where", () => {
    it("should parse a simple where condition", () => {
        expect.assertions(1);

        const url = "http://localhost/?where={\"username\": \"foo\"}";
        const { originalQuery, ...result } = parseQuery(url);

        expect(result).toStrictEqual<ParsedQueryParameters>({
            where: {
                username: "foo",
            },
        });
    });

    it("should parse where condition with operators", () => {
        expect.assertions(1);

        const url = "http://localhost/?where={\"age\": {\"$gt\": 18}}";
        const { originalQuery, ...result } = parseQuery(url);

        expect(result).toStrictEqual<ParsedQueryParameters>({
            where: {
                age: { $gt: 18 },
            },
        });
    });

    it("should parse where nested field", () => {
        expect.assertions(1);

        const url = "http://localhost/?where={\"user.age\": {\"$gt\": 18}}";
        const { originalQuery, ...result } = parseQuery(url);

        expect(result).toStrictEqual<ParsedQueryParameters>({
            where: {
                user: {
                    age: {
                        $gt: 18,
                    },
                },
            },
        });
    });
});

describe("parse orderBy", () => {
    it("should parse a correct orderBy", () => {
        expect.assertions(1);

        const url = "http://localhost/?orderBy={\"username\": \"$asc\"}";
        const { originalQuery, ...result } = parseQuery(url);

        expect(result).toStrictEqual<ParsedQueryParameters>({
            orderBy: {
                username: "$asc",
            },
        });
    });

    it("should throw an error with invalid property", () => {
        expect.assertions(1);

        const url = "http://localhost/?orderBy={\"id\": \"foo\"}";

        expect(() => parseQuery(url)).toThrow("a");
    });

    it("should throw an error with an empty object value", () => {
        expect.assertions(1);

        const url = "http://localhost/?orderBy={}";

        expect(() => parseQuery(url)).toThrow("a");
    });
});

describe("parse limit", () => {
    it("should parse valid number", () => {
        expect.assertions(1);

        const url = "http://localhost/?limit=2";
        const { originalQuery, ...result } = parseQuery(url);

        expect(result).toStrictEqual<ParsedQueryParameters>({
            limit: 2,
        });
    });

    it("should parse invalid number", () => {
        expect.assertions(1);

        const url = "http://localhost/?limit=foobar";
        const { originalQuery, ...result } = parseQuery(url);

        expect(result).toStrictEqual<ParsedQueryParameters>({
            limit: undefined,
        });
    });
});

describe("parse skip", () => {
    it("should parse valid number", () => {
        expect.assertions(1);

        const url = "http://localhost/?skip=2";
        const { originalQuery, ...result } = parseQuery(url);

        expect(result).toStrictEqual<ParsedQueryParameters>({
            skip: 2,
        });
    });

    it("should parse invalid number", () => {
        expect.assertions(1);

        const url = "http://localhost/?skip=foobar";
        const { originalQuery, ...result } = parseQuery(url);

        expect(result).toStrictEqual<ParsedQueryParameters>({
            skip: undefined,
        });
    });
});

describe("parse distinct", () => {
    it("should parse distinct", () => {
        expect.assertions(1);

        const url = "http://localhost/?distinct=id";
        const { originalQuery, ...result } = parseQuery(url);

        expect(result).toStrictEqual<ParsedQueryParameters>({
            distinct: "id",
        });
    });
});
