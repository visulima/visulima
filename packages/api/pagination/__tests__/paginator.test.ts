import { describe, expect, it } from "vitest";

import { paginate, Paginator, snakeCaseNamingStrategy } from "../src";

describe("paginator", () => {
    it("should return the correct values for all public variables", () => {
        expect.assertions(8);

        const paginator = new Paginator(
            100,
            10,
            1,
            Array.from({ length: 10 }, (_, index) => index),
        );

        expect(paginator.total).toBe(100);
        expect(paginator.perPage).toBe(10);
        expect(paginator.currentPage).toBe(1);
        expect(paginator.lastPage).toBe(10);
        expect(paginator.firstPage).toBe(1);
        expect(paginator.isEmpty).toBe(false);
        expect(paginator.hasPages).toBe(true);
        expect(paginator.hasTotal).toBe(true);
    });

    it("should return the correct values for all method", () => {
        expect.assertions(1);

        const paginator = new Paginator(
            100,
            10,
            1,
            Array.from({ length: 10 }, (_, index) => index),
        );

        expect(paginator.all()).toStrictEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });

    it("should return the correct values inside the meta object", () => {
        expect.assertions(1);

        const paginator = new Paginator(
            100,
            10,
            1,
            Array.from({ length: 10 }, (_, index) => index),
        );

        expect(paginator.getMeta()).toStrictEqual({
            firstPage: 1,
            firstPageUrl: "/?page=1",
            lastPage: 10,
            lastPageUrl: "/?page=10",
            nextPageUrl: "/?page=2",
            page: 1,
            perPage: 10,
            previousPageUrl: null,
            total: 100,
        });
    });

    it("should return the correct values inside the meta object when using the baseUrl method", () => {
        expect.assertions(1);

        const paginator = new Paginator(
            100,
            10,
            1,
            Array.from({ length: 10 }, (_, index) => index),
        );

        expect(paginator.baseUrl("/api/v1").getMeta()).toStrictEqual({
            firstPage: 1,
            firstPageUrl: "/api/v1?page=1",
            lastPage: 10,
            lastPageUrl: "/api/v1?page=10",
            nextPageUrl: "/api/v1?page=2",

            page: 1,
            perPage: 10,
            previousPageUrl: null,
            total: 100,
        });
    });

    it("should return the correct values inside the meta object when using the queryString method", () => {
        expect.assertions(1);

        const paginator = new Paginator(
            100,
            10,
            1,
            Array.from({ length: 10 }, (_, index) => index),
        );

        expect(paginator.queryString({ foo: "bar" }).getMeta()).toStrictEqual({
            firstPage: 1,
            firstPageUrl: "/?foo=bar&page=1",
            lastPage: 10,
            lastPageUrl: "/?foo=bar&page=10",
            nextPageUrl: "/?foo=bar&page=2",
            page: 1,
            perPage: 10,
            previousPageUrl: null,
            total: 100,
        });
    });

    it("should return the correct values inside the meta object when using the baseUrl and queryString method", () => {
        expect.assertions(1);

        const paginator = new Paginator(
            100,
            10,
            1,
            Array.from({ length: 10 }, (_, index) => index),
        );

        expect(paginator.baseUrl("/api/v1").queryString({ foo: "bar" }).getMeta()).toStrictEqual({
            firstPage: 1,
            firstPageUrl: "/api/v1?foo=bar&page=1",
            lastPage: 10,
            lastPageUrl: "/api/v1?foo=bar&page=10",
            nextPageUrl: "/api/v1?foo=bar&page=2",
            page: 1,
            perPage: 10,
            previousPageUrl: null,
            total: 100,
        });
    });

    it("should return the correct values for the toJSON method", () => {
        expect.assertions(1);

        const paginator = new Paginator(
            100,
            10,
            1,
            Array.from({ length: 10 }, (_, index) => index),
        );

        expect(paginator.toJSON()).toStrictEqual({
            data: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
            meta: {
                firstPage: 1,
                firstPageUrl: "/?page=1",
                lastPage: 10,
                lastPageUrl: "/?page=10",
                nextPageUrl: "/?page=2",
                page: 1,
                perPage: 10,
                previousPageUrl: null,
                total: 100,
            },
        });
    });

    it("should return a link for the given page when using the baseUrl method", () => {
        expect.assertions(3);

        const paginator = new Paginator(
            100,
            10,
            1,
            Array.from({ length: 10 }, (_, index) => index),
        );

        expect(paginator.getUrl(0)).toBe("/?page=1");
        expect(paginator.getUrl(-1)).toBe("/?page=1");
        expect(paginator.getUrl(5)).toBe("/?page=5");
    });

    it("should return a link for the given page when using the getUrlsForRange method", () => {
        expect.assertions(1);

        const paginator = new Paginator(
            100,
            10,
            1,
            Array.from({ length: 10 }, (_, index) => index),
        );

        expect(paginator.getUrlsForRange(0, 5)).toStrictEqual([
            { isActive: false, page: 0, url: "/?page=1" },
            { isActive: true, page: 1, url: "/?page=1" },
            { isActive: false, page: 2, url: "/?page=2" },
            { isActive: false, page: 3, url: "/?page=3" },
            { isActive: false, page: 4, url: "/?page=4" },
            { isActive: false, page: 5, url: "/?page=5" },
        ]);
    });

    it("should return a link for the given page when using the baseUrl and queryString method", () => {
        expect.assertions(3);

        const paginator = new Paginator(
            100,
            10,
            1,
            Array.from({ length: 10 }, (_, index) => index),
        );

        expect(paginator.baseUrl("/api/v1").getUrl(0)).toBe("/api/v1?page=1");
        expect(paginator.baseUrl("/api/v1").getUrl(-1)).toBe("/api/v1?page=1");
        expect(paginator.baseUrl("/api/v1").getUrl(5)).toBe("/api/v1?page=5");
    });

    it("should return a previous link", () => {
        expect.assertions(2);

        const paginator = new Paginator(
            100,
            10,
            0,
            Array.from({ length: 10 }, (_, index) => index),
        );

        expect(paginator.getPreviousPageUrl()).toBeNull();

        paginator.currentPage = 2;

        expect(paginator.getPreviousPageUrl()).toBe("/?page=1");
    });

    it("should return a next link", () => {
        expect.assertions(4);

        const paginator = new Paginator(
            11,
            10,
            1,
            Array.from({ length: 10 }, (_, index) => index),
        );

        expect(paginator.hasMorePages).toBe(true);
        expect(paginator.getNextPageUrl()).toBe("/?page=2");

        paginator.currentPage = 2;

        expect(paginator.getNextPageUrl()).toBeNull();
        expect(paginator.hasMorePages).toBe(false);
    });

    it("should return a paginator instance if paginate method is used", () => {
        expect.assertions(8);

        const paginator = paginate(
            1,
            10,
            100,
            Array.from({ length: 10 }).map((_, index) => index),
        );

        expect(paginator.total).toBe(100);
        expect(paginator.perPage).toBe(10);
        expect(paginator.currentPage).toBe(1);
        expect(paginator.lastPage).toBe(10);
        expect(paginator.firstPage).toBe(1);
        expect(paginator.isEmpty).toBe(false);
        expect(paginator.hasPages).toBe(true);
        expect(paginator.hasTotal).toBe(true);
    });

    it("should clamp invalid page/perPage/total to sane values", () => {
        expect.assertions(4);

        const paginator = paginate(0, -5, Number.NaN, [1, 2, 3]);

        expect(paginator.currentPage).toBe(1);
        expect(paginator.perPage).toBe(1);
        expect(paginator.total).toBe(0);
        expect(paginator.lastPage).toBe(1);
    });

    it("should not stack-overflow constructing a very large page via paginate", () => {
        expect.assertions(2);

        const rows = Array.from({ length: 200_000 }, (_, index) => index);

        const paginator = paginate(1, 200_000, 200_000, rows);

        expect(paginator).toHaveLength(200_000);
        expect(paginator.all()).toHaveLength(200_000);
    });

    it("should not stack-overflow constructing a very large page via the constructor", () => {
        expect.assertions(3);

        // The old variadic `...rows` constructor (`new Paginator(t, p, c, ...rows)`)
        // threw `RangeError: Maximum call stack size exceeded` around ~100k rows
        // on V8. The array parameter avoids spreading rows as call arguments.
        const rows = Array.from({ length: 200_000 }, (_, index) => index);

        const paginator = new Paginator(200_000, 200_000, 1, rows);

        expect(paginator).toHaveLength(200_000);
        expect(paginator.all()).toHaveLength(200_000);
        expect(paginator.isEmpty).toBe(false);
    });

    it("should return a defensive copy from all()", () => {
        expect.assertions(2);

        const paginator = paginate(3, 3, 3, [1, 2, 3]);
        const rows = paginator.all();

        rows.push(99);

        expect(paginator.all()).toStrictEqual([1, 2, 3]);
        expect(Array.isArray(rows)).toBe(true);
    });

    it("should transform meta keys with a naming strategy", () => {
        expect.assertions(1);

        const paginator = new Paginator(
            100,
            10,
            1,
            Array.from({ length: 10 }, (_, index) => index),
        );

        expect(paginator.getMeta(snakeCaseNamingStrategy)).toStrictEqual({
            first_page: 1,
            first_page_url: "/?page=1",
            last_page: 10,
            last_page_url: "/?page=10",
            next_page_url: "/?page=2",
            page: 1,
            per_page: 10,
            previous_page_url: null,
            total: 100,
        });
    });

    it("should build a windowed url range with ellipsis markers", () => {
        expect.assertions(2);

        const paginator = paginate(10, 10, 200, []);

        const window = paginator.getUrlsForWindow({ eachSide: 1 });

        expect(window).toStrictEqual([
            { isActive: false, page: 1, url: "/?page=1" },
            { isActive: false, page: null, url: null },
            { isActive: false, page: 9, url: "/?page=9" },
            { isActive: true, page: 10, url: "/?page=10" },
            { isActive: false, page: 11, url: "/?page=11" },
            { isActive: false, page: null, url: null },
            { isActive: false, page: 20, url: "/?page=20" },
        ]);
        // No ellipsis when total pages fit inside the window.
        expect(paginate(1, 10, 30, []).getUrlsForWindow({ eachSide: 2 })).toStrictEqual([
            { isActive: true, page: 1, url: "/?page=1" },
            { isActive: false, page: 2, url: "/?page=2" },
            { isActive: false, page: 3, url: "/?page=3" },
        ]);
    });

    it("should percent-encode query string values in urls", () => {
        expect.assertions(1);

        const paginator = paginate(1, 10, 100, []).queryString({ q: "a b&c" });

        expect(paginator.getUrl(2)).toBe("/?q=a+b%26c&page=2");
    });

    it("should append array query string values as repeated keys", () => {
        expect.assertions(1);

        const paginator = paginate(1, 10, 100, []).queryString({ tag: ["a", "b"] });

        expect(paginator.getUrl(2)).toBe("/?tag=a&tag=b&page=2");
    });

    it("should build a coherent window when currentPage exceeds lastPage", () => {
        expect.assertions(1);

        const paginator = paginate(50, 10, 100, []);

        expect(paginator.getUrlsForWindow({ eachSide: 2 })).toStrictEqual([
            { isActive: false, page: 1, url: "/?page=1" },
            { isActive: false, page: null, url: null },
            { isActive: false, page: 8, url: "/?page=8" },
            { isActive: false, page: 9, url: "/?page=9" },
            { isActive: false, page: 10, url: "/?page=10" },
        ]);
    });

    it("should build a coherent window when currentPage equals lastPage", () => {
        expect.assertions(1);

        const paginator = paginate(10, 10, 100, []);

        expect(paginator.getUrlsForWindow({ eachSide: 2 })).toStrictEqual([
            { isActive: false, page: 1, url: "/?page=1" },
            { isActive: false, page: null, url: null },
            { isActive: false, page: 8, url: "/?page=8" },
            { isActive: false, page: 9, url: "/?page=9" },
            { isActive: true, page: 10, url: "/?page=10" },
        ]);
    });
});
