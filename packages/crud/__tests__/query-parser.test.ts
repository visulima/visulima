import { describe, expect, it } from "vitest";

import type { ParsedQueryParameters } from "../src";
import parseQuery from "../src/query-parser";

describe("Parse select", () => {
    it("should parse simple select", () => {
        const url = "http://localhost/?select=user,post";
        const { originalQuery, ...result } = parseQuery(url);

        expect(result).toEqual<ParsedQueryParameters>({
            select: {
                user: true,
                post: true,
            },
        });
    });

    it("should parse nested select 2", () => {
        const url = "http://localhost/?select=user,post.user,post.title";
        const { originalQuery, ...result } = parseQuery(url);

        expect(result).toEqual<ParsedQueryParameters>({
            select: {
                user: true,
                post: {
                    user: true,
                    title: true,
                },
            },
        });
    });

    it("should parse nested select 2", () => {
        const url = "http://localhost/?select=user,post.user,post.user.post";
        const { originalQuery, ...result } = parseQuery(url);

        expect(result).toEqual<ParsedQueryParameters>({
            select: {
                user: true,
                post: {
                    user: {
                        post: true,
                    },
                },
            },
        });
    });
});

describe("Parse include", () => {
    it("should parse simple include", () => {
        const url = "http://localhost/?include=user,post";
        const { originalQuery, ...result } = parseQuery(url);

        expect(result).toEqual<ParsedQueryParameters>({
            include: {
                user: true,
                post: true,
            },
        });
    });

    it("should parse nested include 1", () => {
        const url = "http://localhost/?include=user,post.user,post.title";
        const { originalQuery, ...result } = parseQuery(url);

        expect(result).toEqual<ParsedQueryParameters>({
            include: {
                user: true,
                post: {
                    user: true,
                    title: true,
                },
            },
        });
    });

    it("should parse nested include 12", () => {
        const url = "http://localhost/?include=user,post.user,post.user.post";
        const { originalQuery, ...result } = parseQuery(url);

        expect(result).toEqual<ParsedQueryParameters>({
            include: {
                user: true,
                post: {
                    user: {
                        post: true,
                    },
                },
            },
        });
    });
});

describe("Parse where", () => {
    it("should parse a simple where condition", () => {
        const url = 'http://localhost/?where={"username": "foo"}';
        const { originalQuery, ...result } = parseQuery(url);

        expect(result).toEqual<ParsedQueryParameters>({
            where: {
                username: "foo",
            },
        });
    });

    it("should parse where condition with operators", () => {
        const url = 'http://localhost/?where={"age": {"$gt": 18}}';
        const { originalQuery, ...result } = parseQuery(url);

        expect(result).toEqual<ParsedQueryParameters>({
            where: {
                age: { $gt: 18 },
            },
        });
    });

    it("should parse where nested field", () => {
        const url = 'http://localhost/?where={"user.age": {"$gt": 18}}';
        const { originalQuery, ...result } = parseQuery(url);

        expect(result).toEqual<ParsedQueryParameters>({
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

describe("Parse orderBy", () => {
    it("should parse a correct orderBy", () => {
        const url = 'http://localhost/?orderBy={"username": "$asc"}';
        const { originalQuery, ...result } = parseQuery(url);

        expect(result).toEqual<ParsedQueryParameters>({
            orderBy: {
                username: "$asc",
            },
        });
    });

    it("should throw an error with invalid property", () => {
        const url = 'http://localhost/?orderBy={"id": "foo"}';

        expect(() => parseQuery(url)).toThrow();
    });

    it("should throw an error with an empty object value", () => {
        const url = "http://localhost/?orderBy={}";

        expect(() => parseQuery(url)).toThrow();
    });
});

describe("Parse limit", () => {
    it("should parse valid number", () => {
        const url = "http://localhost/?limit=2";
        const { originalQuery, ...result } = parseQuery(url);

        expect(result).toEqual<ParsedQueryParameters>({
            limit: 2,
        });
    });

    it("should parse invalid number", () => {
        const url = "http://localhost/?limit=foobar";
        const { originalQuery, ...result } = parseQuery(url);

        expect(result).toEqual<ParsedQueryParameters>({
            limit: undefined,
        });
    });
});

describe("Parse skip", () => {
    it("should parse valid number", () => {
        const url = "http://localhost/?skip=2";
        const { originalQuery, ...result } = parseQuery(url);

        expect(result).toEqual<ParsedQueryParameters>({
            skip: 2,
        });
    });

    it("should parse invalid number", () => {
        const url = "http://localhost/?skip=foobar";
        const { originalQuery, ...result } = parseQuery(url);

        expect(result).toEqual<ParsedQueryParameters>({
            skip: undefined,
        });
    });
});

describe("Parse distinct", () => {
    it("should parse distinct", () => {
        const url = "http://localhost/?distinct=id";
        const { originalQuery, ...result } = parseQuery(url);

        expect(result).toEqual<ParsedQueryParameters>({
            distinct: "id",
        });
    });
});
