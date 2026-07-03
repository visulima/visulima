import { describe, expect, it } from "vitest";

import { CursorPaginator } from "../src";

describe("cursorPaginator", () => {
    it("should derive next cursor from the last row's id when more pages exist", () => {
        expect.assertions(3);

        const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
        const paginator = CursorPaginator.fromArray(3, rows, { hasMore: true });

        expect(paginator.getNextCursor()).toBe("3");
        expect(paginator.hasMorePages).toBe(true);
        expect(paginator.getPreviousCursor()).toBeNull();
    });

    it("should return null next cursor when there are no more pages", () => {
        expect.assertions(2);

        const paginator = CursorPaginator.fromArray(3, [{ id: 1 }], { hasMore: false });

        expect(paginator.getNextCursor()).toBeNull();
        expect(paginator.hasMorePages).toBe(false);
    });

    it("should derive previous cursor when a current cursor is provided", () => {
        expect.assertions(1);

        const paginator = CursorPaginator.fromArray(2, [{ id: 5 }, { id: 6 }], { currentCursor: "4" });

        expect(paginator.getPreviousCursor()).toBe("5");
    });

    it("should build meta with cursor urls", () => {
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

    it("should support a custom getCursor function", () => {
        expect.assertions(1);

        const paginator = CursorPaginator.fromArray(2, [{ slug: "a" }, { slug: "b" }], {
            getCursor: (row) => row.slug,
            hasMore: true,
        });

        expect(paginator.getNextCursor()).toBe("b");
    });

    it("should serialize to JSON", () => {
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

    it("should report isEmpty correctly", () => {
        expect.assertions(2);

        expect(CursorPaginator.fromArray(10, []).isEmpty).toBe(true);
        expect(CursorPaginator.fromArray(10, [1]).isEmpty).toBe(false);
    });
});
