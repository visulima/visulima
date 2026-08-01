import { describe, expect, it } from "vitest";

import createRequestContext from "../../src/error-inspector/page/create-request-context";

describe("request context on workerd", () => {
    it("should build a context page from a native `Request`", async () => {
        expect.assertions(4);

        // The shape a Worker's `fetch` handler actually receives. Native `Request`/`Headers` methods
        // brand-check their receiver, so any detached method call fails with "Illegal invocation".
        const request = new Request("https://example.com/api/items?page=2", {
            headers: { "content-type": "application/json", "user-agent": "workerd-test" },
            method: "GET",
        });

        const page = await createRequestContext(request, {});

        expect(page).toBeDefined();
        expect(page?.id).toBe("context");
        expect(page?.code.html).toContain("example.com");
        expect(page?.code.html).toContain("workerd-test");
    });

    it("should read the body of a native `Request` without consuming the original", async () => {
        expect.assertions(2);

        const request = new Request("https://example.com/api/items", {
            body: JSON.stringify({ marker: "body-marker" }),
            headers: { "content-type": "application/json" },
            method: "POST",
        });

        const page = await createRequestContext(request, {});

        expect(page?.code.html).toContain("body-marker");
        // The context page clones before reading, so the caller's request is still usable.
        expect(request.bodyUsed).toBe(false);
    });

    it("should mask sensitive headers coming from a native `Headers` object", async () => {
        expect.assertions(2);

        const request = new Request("https://example.com/", {
            headers: { authorization: "Bearer super-secret-token", "x-safe": "visible" },
        });

        const page = await createRequestContext(request, { maskValue: "[masked]" });

        expect(page?.code.html).not.toContain("super-secret-token");
        expect(page?.code.html).toContain("visible");
    });

    it("should read cookies through the native `Headers` getter", async () => {
        expect.assertions(1);

        const request = new Request("https://example.com/", { headers: { cookie: "session=abc; theme=dark" } });

        const page = await createRequestContext(request, {});

        expect(page?.code.html).toContain("theme");
    });

    it("should still accept a plain header record", async () => {
        expect.assertions(2);

        const page = await createRequestContext({ headers: { "content-type": "application/json" }, method: "GET", url: "https://example.com/plain" }, {});

        expect(page?.id).toBe("context");
        expect(page?.code.html).toContain("example.com/plain");
    });

    it("should escape markup in a request URL without a DOM sanitizer", async () => {
        expect.assertions(1);

        const page = await createRequestContext({ headers: {}, method: "GET", url: "https://example.com/<script>alert(1)</script>" }, {});

        expect(page?.code.html).not.toContain("<script>alert(1)</script>");
    });
});
