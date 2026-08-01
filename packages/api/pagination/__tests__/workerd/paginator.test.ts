/**
 * Offset paginator specs executed inside `workerd` (the Cloudflare Workers
 * runtime) via `@cloudflare/vitest-pool-workers`.
 *
 * Pagination is exactly the kind of logic that runs in an edge API handler, so
 * this suite locks in that the package stays free of Node-only surface: it
 * leans on `URLSearchParams` (Web standard) and on `Array` subclassing with a
 * `Symbol.species` override, both of which have to behave identically on the
 * workerd isolate.
 */
import { describe, expect, it } from "vitest";

import { paginate, Paginator, snakeCaseNamingStrategy } from "../../src";

describe("workerd runtime", () => {
    it("runs inside workerd and not on the host platform", () => {
        expect.assertions(1);

        const workerNavigator = Reflect.get(globalThis, "navigator") as { userAgent?: string } | undefined;

        expect(workerNavigator?.userAgent).toBe("Cloudflare-Workers");
    });

    it("has the Web-standard URLSearchParams the query builder relies on", () => {
        expect.assertions(1);

        expect(URLSearchParams).toBeTypeOf("function");
    });
});

describe("workerd paginator basics", () => {
    it("exposes the computed page state", () => {
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

    it("keeps Array behaviour with a plain-Array species", () => {
        expect.assertions(4);

        const paginator = paginate(1, 10, 3, [1, 2, 3]);

        expect(paginator).toHaveLength(3);
        expect(paginator.all()).toStrictEqual([1, 2, 3]);
        expect(paginator.map((value) => value * 2)).toStrictEqual([2, 4, 6]);
        expect(Array.isArray(paginator.filter((value) => value > 1))).toBe(true);
    });

    it("returns a defensive copy from all()", () => {
        expect.assertions(2);

        const paginator = paginate(1, 10, 3, [1, 2, 3]);
        const rows = paginator.all();

        rows.push(4);

        expect(paginator).toHaveLength(3);
        expect(rows).toStrictEqual([1, 2, 3, 4]);
    });
});

describe("workerd paginator boundary conditions", () => {
    it("clamps page 0 and negative pages up to the first page", () => {
        expect.assertions(2);

        expect(new Paginator(100, 10, 0, []).currentPage).toBe(1);
        expect(new Paginator(100, 10, -7, []).currentPage).toBe(1);
    });

    it("clamps a perPage of 0 or negative up to 1", () => {
        expect.assertions(4);

        expect(new Paginator(10, 0, 1, []).perPage).toBe(1);
        expect(new Paginator(10, -5, 1, []).perPage).toBe(1);
        expect(new Paginator(10, 0, 1, []).lastPage).toBe(10);
        expect(new Paginator(10, 2.9, 1, []).perPage).toBe(2);
    });

    it("clamps a negative or non-finite total to 0", () => {
        expect.assertions(4);

        expect(new Paginator(-5, 10, 1, []).total).toBe(0);
        expect(new Paginator(Number.NaN, 10, 1, []).total).toBe(0);
        expect(new Paginator(Number.POSITIVE_INFINITY, 10, 1, []).total).toBe(0);
        expect(new Paginator(Number.NaN, Number.NaN, Number.NaN, []).perPage).toBe(1);
    });

    it("reports a single last page for a total of 0", () => {
        expect.assertions(6);

        const paginator = new Paginator(0, 10, 1, []);

        expect(paginator.total).toBe(0);
        expect(paginator.lastPage).toBe(1);
        expect(paginator.hasPages).toBe(false);
        expect(paginator.hasTotal).toBe(false);
        expect(paginator.isEmpty).toBe(true);
        expect(paginator.hasMorePages).toBe(false);
    });

    it("keeps a page beyond the last page addressable without a next link", () => {
        expect.assertions(4);

        const paginator = new Paginator(30, 10, 99, []);

        expect(paginator.currentPage).toBe(99);
        expect(paginator.lastPage).toBe(3);
        expect(paginator.hasMorePages).toBe(false);
        expect(paginator.getNextPageUrl()).toBeNull();
    });

    it("clamps getUrl() to at least page 1", () => {
        expect.assertions(3);

        const paginator = new Paginator(100, 10, 1, []);

        expect(paginator.getUrl(0)).toBe("/?page=1");
        expect(paginator.getUrl(-4)).toBe("/?page=1");
        expect(paginator.getUrl(3)).toBe("/?page=3");
    });
});

describe("workerd paginator links", () => {
    it("builds first/last/next/previous urls", () => {
        expect.assertions(4);

        const paginator = new Paginator(100, 10, 5, []).baseUrl("/api/users");

        expect(paginator.getUrl(1)).toBe("/api/users?page=1");
        expect(paginator.getNextPageUrl()).toBe("/api/users?page=6");
        expect(paginator.getPreviousPageUrl()).toBe("/api/users?page=4");
        expect(paginator.getUrl(paginator.lastPage)).toBe("/api/users?page=10");
    });

    it("returns null neighbours at the boundaries", () => {
        expect.assertions(2);

        expect(new Paginator(100, 10, 1, []).getPreviousPageUrl()).toBeNull();
        expect(new Paginator(100, 10, 10, []).getNextPageUrl()).toBeNull();
    });

    it("appends a serialized query string before the page parameter", () => {
        expect.assertions(1);

        const paginator = new Paginator(100, 10, 2, []).baseUrl("/api/users").queryString({ sort: "asc" });

        expect(paginator.getUrl(2)).toBe("/api/users?sort=asc&page=2");
    });

    it("serializes array values as repeated keys and skips null/undefined", () => {
        expect.assertions(1);

        const paginator = new Paginator(100, 10, 1, [])
            .baseUrl("/api/users")
            .queryString({ empty: null, missing: undefined, tag: ["a", "b"] });

        expect(paginator.getUrl(1)).toBe("/api/users?tag=a&tag=b&page=1");
    });

    it("url-encodes query values through URLSearchParams", () => {
        expect.assertions(1);

        const paginator = new Paginator(100, 10, 1, []).baseUrl("/api/users").queryString({ q: "a b&c" });

        expect(paginator.getUrl(1)).toBe("/api/users?q=a+b%26c&page=1");
    });

    it("builds an inclusive range of urls", () => {
        expect.assertions(1);

        const paginator = new Paginator(100, 10, 2, []).baseUrl("/api/users");

        expect(paginator.getUrlsForRange(1, 3)).toStrictEqual([
            { isActive: false, page: 1, url: "/api/users?page=1" },
            { isActive: true, page: 2, url: "/api/users?page=2" },
            { isActive: false, page: 3, url: "/api/users?page=3" },
        ]);
    });
});

describe("workerd paginator windowed links", () => {
    it("returns every page when the range is small enough", () => {
        expect.assertions(1);

        const paginator = new Paginator(50, 10, 2, []).baseUrl("/p");

        expect(paginator.getUrlsForWindow()).toStrictEqual([
            { isActive: false, page: 1, url: "/p?page=1" },
            { isActive: true, page: 2, url: "/p?page=2" },
            { isActive: false, page: 3, url: "/p?page=3" },
            { isActive: false, page: 4, url: "/p?page=4" },
            { isActive: false, page: 5, url: "/p?page=5" },
        ]);
    });

    it("emits a trailing ellipsis marker near the start of a long range", () => {
        expect.assertions(1);

        const paginator = new Paginator(100, 10, 1, []).baseUrl("/p");

        expect(paginator.getUrlsForWindow()).toStrictEqual([
            { isActive: true, page: 1, url: "/p?page=1" },
            { isActive: false, page: 2, url: "/p?page=2" },
            { isActive: false, page: 3, url: "/p?page=3" },
            { isActive: false, page: null, url: null },
            { isActive: false, page: 10, url: "/p?page=10" },
        ]);
    });

    it("emits ellipsis markers on both sides of a centred window", () => {
        expect.assertions(1);

        const paginator = new Paginator(200, 10, 10, []).baseUrl("/p");

        expect(paginator.getUrlsForWindow({ eachSide: 1 })).toStrictEqual([
            { isActive: false, page: 1, url: "/p?page=1" },
            { isActive: false, page: null, url: null },
            { isActive: false, page: 9, url: "/p?page=9" },
            { isActive: true, page: 10, url: "/p?page=10" },
            { isActive: false, page: 11, url: "/p?page=11" },
            { isActive: false, page: null, url: null },
            { isActive: false, page: 20, url: "/p?page=20" },
        ]);
    });

    it("clamps an out-of-range current page onto the last page window", () => {
        expect.assertions(1);

        const paginator = new Paginator(200, 10, 99, []).baseUrl("/p");

        expect(paginator.getUrlsForWindow()).toStrictEqual([
            { isActive: false, page: 1, url: "/p?page=1" },
            { isActive: false, page: null, url: null },
            { isActive: false, page: 18, url: "/p?page=18" },
            { isActive: false, page: 19, url: "/p?page=19" },
            { isActive: false, page: 20, url: "/p?page=20" },
        ]);
    });

    it("falls back to the default window for a negative eachSide", () => {
        expect.assertions(2);

        const paginator = new Paginator(100, 10, 1, []).baseUrl("/p");

        expect(paginator.getUrlsForWindow({ eachSide: -1 })).toStrictEqual(paginator.getUrlsForWindow());
        expect(paginator.getUrlsForWindow({ eachSide: Number.NaN })).toStrictEqual(paginator.getUrlsForWindow());
    });
});

describe("workerd paginator serialisation", () => {
    it("emits camelCase meta by default", () => {
        expect.assertions(1);

        const paginator = new Paginator(100, 10, 2, []).baseUrl("/api/users");

        expect(paginator.getMeta()).toStrictEqual({
            firstPage: 1,
            firstPageUrl: "/api/users?page=1",
            lastPage: 10,
            lastPageUrl: "/api/users?page=10",
            nextPageUrl: "/api/users?page=3",
            page: 2,
            perPage: 10,
            previousPageUrl: "/api/users?page=1",
            total: 100,
        });
    });

    it("emits snake_case meta with the built-in naming strategy", () => {
        expect.assertions(1);

        const paginator = new Paginator(100, 10, 1, []).baseUrl("/api/users");

        expect(paginator.getMeta(snakeCaseNamingStrategy)).toStrictEqual({
            first_page: 1,
            first_page_url: "/api/users?page=1",
            last_page: 10,
            last_page_url: "/api/users?page=10",
            next_page_url: "/api/users?page=2",
            page: 1,
            per_page: 10,
            previous_page_url: null,
            total: 100,
        });
    });

    it("supports a custom naming strategy", () => {
        expect.assertions(1);

        const paginator = new Paginator(10, 10, 1, []).baseUrl("/p");

        expect(Object.keys(paginator.getMeta((key) => key.toUpperCase()))).toStrictEqual([
            "FIRSTPAGE",
            "FIRSTPAGEURL",
            "LASTPAGE",
            "LASTPAGEURL",
            "NEXTPAGEURL",
            "PAGE",
            "PERPAGE",
            "PREVIOUSPAGEURL",
            "TOTAL",
        ]);
    });

    it("serialises data and meta through toJSON", () => {
        expect.assertions(1);

        const paginator = paginate(1, 2, 3, [{ id: 1 }, { id: 2 }]).baseUrl("/api/items");

        expect(paginator.toJSON()).toStrictEqual({
            data: [{ id: 1 }, { id: 2 }],
            meta: {
                firstPage: 1,
                firstPageUrl: "/api/items?page=1",
                lastPage: 2,
                lastPageUrl: "/api/items?page=2",
                nextPageUrl: "/api/items?page=2",
                page: 1,
                perPage: 2,
                previousPageUrl: null,
                total: 3,
            },
        });
    });

    it("survives a JSON.stringify round-trip in an edge response body", () => {
        expect.assertions(1);

        const paginator = paginate(1, 2, 3, [{ id: 1 }, { id: 2 }]).baseUrl("/api/items");
        const body = JSON.stringify(paginator.toJSON());

        expect(JSON.parse(body)).toStrictEqual(paginator.toJSON());
    });
});
