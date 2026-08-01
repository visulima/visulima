/**
 * Cursor paginator specs executed inside `workerd`. Keyset pagination is the
 * shape most edge handlers reach for, so the cursor derivation, boundary
 * handling and URL building all need to hold on the Workers runtime.
 */
import { describe, expect, it } from "vitest";

import { CursorPaginator } from "../../src";

describe("workerd cursor paginator basics", () => {
    it("derives the next cursor from the last row", () => {
        expect.assertions(3);

        const paginator = CursorPaginator.fromArray(3, [{ id: 1 }, { id: 2 }, { id: 3 }], { hasMore: true });

        expect(paginator.getNextCursor()).toBe("3");
        expect(paginator.hasMorePages).toBe(true);
        expect(paginator.getPreviousCursor()).toBeNull();
    });

    it("derives the previous cursor from the first row when a cursor was supplied", () => {
        expect.assertions(2);

        const paginator = CursorPaginator.fromArray(2, [{ id: 5 }, { id: 6 }], { currentCursor: "4" });

        expect(paginator.getPreviousCursor()).toBe("5");
        expect(paginator.getNextCursor()).toBeNull();
    });

    it("falls back to String(row) when the row has no id", () => {
        expect.assertions(2);

        expect(CursorPaginator.fromArray(2, ["a", "b"], { hasMore: true }).getNextCursor()).toBe("b");
        expect(CursorPaginator.fromArray(2, [1, 2], { hasMore: true }).getNextCursor()).toBe("2");
    });

    it("supports a custom cursor resolver", () => {
        expect.assertions(1);

        const paginator = CursorPaginator.fromArray(2, [{ slug: "a" }, { slug: "b" }], {
            getCursor: (row) => row.slug,
            hasMore: true,
        });

        expect(paginator.getNextCursor()).toBe("b");
    });

    it("keeps Array behaviour with a plain-Array species", () => {
        expect.assertions(3);

        const paginator = CursorPaginator.fromArray(3, [1, 2, 3]);

        expect(paginator).toHaveLength(3);
        expect(paginator.all()).toStrictEqual([1, 2, 3]);
        expect(Array.isArray(paginator.map((value) => value))).toBe(true);
    });
});

describe("workerd cursor paginator boundary conditions", () => {
    it("clamps perPage of 0, negative and non-finite values up to 1", () => {
        expect.assertions(4);

        expect(CursorPaginator.fromArray(0, []).perPage).toBe(1);
        expect(CursorPaginator.fromArray(-3, []).perPage).toBe(1);
        expect(CursorPaginator.fromArray(Number.NaN, []).perPage).toBe(1);
        expect(CursorPaginator.fromArray(Number.POSITIVE_INFINITY, []).perPage).toBe(1);
    });

    it("truncates a fractional perPage", () => {
        expect.assertions(1);

        expect(CursorPaginator.fromArray(2.9, []).perPage).toBe(2);
    });

    it("returns null cursors for an empty page even when hasMore is set", () => {
        expect.assertions(3);

        const paginator = CursorPaginator.fromArray(10, [], { currentCursor: "abc", hasMore: true });

        expect(paginator.isEmpty).toBe(true);
        expect(paginator.getNextCursor()).toBeNull();
        expect(paginator.getPreviousCursor()).toBeNull();
    });

    it("returns a null next cursor when there are no more pages", () => {
        expect.assertions(2);

        const paginator = CursorPaginator.fromArray(3, [{ id: 1 }], { hasMore: false });

        expect(paginator.getNextCursor()).toBeNull();
        expect(paginator.hasMorePages).toBe(false);
    });

    it("returns a null url for a null cursor", () => {
        expect.assertions(2);

        const paginator = CursorPaginator.fromArray(3, [{ id: 1 }]);

        expect(paginator.getUrl(null)).toBeNull();
        expect(paginator.getUrl("abc")).toBe("/?cursor=abc");
    });
});

describe("workerd cursor paginator links", () => {
    it("builds cursor urls on top of the base url and query string", () => {
        expect.assertions(1);

        const paginator = CursorPaginator.fromArray(2, [{ id: 5 }, { id: 6 }], { currentCursor: "4", hasMore: true })
            .baseUrl("/api/items")
            .queryString({ sort: "asc" });

        expect(paginator.getMeta()).toStrictEqual({
            nextCursor: "6",
            nextPageUrl: "/api/items?sort=asc&cursor=6",
            perPage: 2,
            previousCursor: "5",
            previousPageUrl: "/api/items?sort=asc&cursor=5",
        });
    });

    it("percent-encodes opaque cursors", () => {
        expect.assertions(1);

        const paginator = CursorPaginator.fromArray(1, [{ id: "a b/c" }], { hasMore: true }).baseUrl("/api/items");

        expect(paginator.getMeta().nextPageUrl).toBe("/api/items?cursor=a%20b%2Fc");
    });

    it("appends array query values as repeated keys", () => {
        expect.assertions(1);

        const paginator = CursorPaginator.fromArray(2, [{ id: 5 }, { id: 6 }], { hasMore: true })
            .baseUrl("/api/items")
            .queryString({ tag: ["a", "b"] });

        expect(paginator.getMeta().nextPageUrl).toBe("/api/items?tag=a&tag=b&cursor=6");
    });
});

describe("workerd cursor paginator serialisation", () => {
    it("serialises data and meta through toJSON", () => {
        expect.assertions(1);

        const paginator = CursorPaginator.fromArray(1, [{ id: 9 }], { hasMore: false });

        expect(paginator.toJSON()).toStrictEqual({
            data: [{ id: 9 }],
            meta: {
                nextCursor: null,
                nextPageUrl: null,
                perPage: 1,
                previousCursor: null,
                previousPageUrl: null,
            },
        });
    });

    it("survives a JSON.stringify round-trip in an edge response body", () => {
        expect.assertions(1);

        const paginator = CursorPaginator.fromArray(2, [{ id: 1 }, { id: 2 }], { hasMore: true }).baseUrl("/api/items");
        const body = JSON.stringify(paginator.toJSON());

        expect(JSON.parse(body)).toStrictEqual(paginator.toJSON());
    });
});
