import { describe, expect, it } from "vitest";

import { paginate, Paginator } from "../src";

describe("paginator", () => {
    it("should return the correct values for all public variables", () => {
        expect.assertions(8);

        const paginator = new Paginator(100, 10, 1, ...Array.from({ length: 10 }).map((_, index) => index));

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

        const paginator = new Paginator(100, 10, 1, ...Array.from({ length: 10 }).map((_, index) => index));

        expect(paginator.all()).toStrictEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });

    it("should return the correct values inside the meta object", () => {
        expect.assertions(1);

        const paginator = new Paginator(100, 10, 1, ...Array.from({ length: 10 }).map((_, index) => index));

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

        const paginator = new Paginator(100, 10, 1, ...Array.from({ length: 10 }).map((_, index) => index));

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

        const paginator = new Paginator(100, 10, 1, ...Array.from({ length: 10 }).map((_, index) => index));

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

        const paginator = new Paginator(100, 10, 1, ...Array.from({ length: 10 }).map((_, index) => index));

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

        const paginator = new Paginator(100, 10, 1, ...Array.from({ length: 10 }).map((_, index) => index));

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

        const paginator = new Paginator(100, 10, 1, ...Array.from({ length: 10 }).map((_, index) => index));

        expect(paginator.getUrl(0)).toBe("/?page=1");
        expect(paginator.getUrl(-1)).toBe("/?page=1");
        expect(paginator.getUrl(5)).toBe("/?page=5");
    });

    it("should return a link for the given page when using the getUrlsForRange method", () => {
        expect.assertions(1);

        const paginator = new Paginator(100, 10, 1, ...Array.from({ length: 10 }).map((_, index) => index));

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

        const paginator = new Paginator(100, 10, 1, ...Array.from({ length: 10 }).map((_, index) => index));

        expect(paginator.baseUrl("/api/v1").getUrl(0)).toBe("/api/v1?page=1");
        expect(paginator.baseUrl("/api/v1").getUrl(-1)).toBe("/api/v1?page=1");
        expect(paginator.baseUrl("/api/v1").getUrl(5)).toBe("/api/v1?page=5");
    });

    it("should return a previous link", () => {
        expect.assertions(2);

        const paginator = new Paginator(100, 10, 0, ...Array.from({ length: 10 }).map((_, index) => index));

        expect(paginator.getPreviousPageUrl()).toBeNull();

        paginator.currentPage = 2;

        expect(paginator.getPreviousPageUrl()).toBe("/?page=1");
    });

    it("should return a next link", () => {
        expect.assertions(4);

        const paginator = new Paginator(11, 10, 1, ...Array.from({ length: 10 }).map((_, index) => index));

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
});
