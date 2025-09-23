import { describe, expect, it } from "vitest";

import { inspect } from "../../src";

describe("proxy", () => {
    it("should inspect proxy as a regular object by default", () => {
        expect.assertions(1);

        const proxy = new Proxy({ a: 1 }, {});

        expect(inspect(proxy)).toBe("{ a: 1 }");
    });

    it("should inspect proxy as a regular object when showProxy is false", () => {
        expect.assertions(1);

        const proxy = new Proxy({ a: 1 }, {});

        expect(inspect(proxy, { showProxy: false })).toBe("{ a: 1 }");
    });

    it("should inspect proxy with a Proxy wrapper when showProxy is true", () => {
        expect.assertions(1);

        const proxy = new Proxy({ a: 1 }, {});

        expect(inspect(proxy, { showProxy: true })).toBe("Proxy [ { a: 1 } ]");
    });

    it("should inspect proxy with a Proxy wrapper when showProxy is true for an array", () => {
        expect.assertions(1);

        const proxy = new Proxy([1, 2], {});

        expect(inspect(proxy, { showProxy: true })).toBe("Proxy [ [ 1, 2 ] ]");
    });

    it("should handle circular references in proxies", () => {
        expect.assertions(1);

        const target: { a?: unknown } = {};
        const proxy = new Proxy(target, {});

        target.a = proxy;

        expect(inspect(proxy, { showProxy: true })).toBe("Proxy [ { a: [Circular] } ]");
    });
});
