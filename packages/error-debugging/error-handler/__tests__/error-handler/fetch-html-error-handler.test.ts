import httpErrors from "http-errors";
import { describe, expect, it } from "vitest";

import { fetchHtmlErrorHandler } from "../../src/error-handler/fetch-html-error-handler";
import type { HtmlErrorHandlerOptions } from "../../src/error-handler/html-error-handler";

const TEXT_HTML_REGEX = /text\/html/;

const exerciseEveryMockMethod = (options: HtmlErrorHandlerOptions = {}): ReturnType<typeof fetchHtmlErrorHandler> => fetchHtmlErrorHandler({
    ...options,
    errorPage: ({ response }) => {
        // Cast to any so we can poke the full ServerResponse stub surface.
        const r = response as unknown as Record<string, (...args: unknown[]) => unknown>;

        // setHeader / getHeader / getHeaders / getHeaderNames / hasHeader / removeHeader / writeHead
        r.setHeader("x-test", "value");
        r.setHeader("x-array", ["a", "b"] as unknown);
        r.getHeader("x-test");
        r.getHeaders();
        r.getHeaderNames();
        r.hasHeader("x-test");
        r.removeHeader("x-test");

        // writeHead overloads — object headers
        r.writeHead(200, { "x-via-writehead": "1" });
        // writeHead — string status message
        r.writeHead(201, "OK");
        // writeHead — string status message + headers
        r.writeHead(202, "Accepted", { "x-three": "y" });

        // write/end
        r.write("some-chunk");

        // Stub event-emitter methods (arrow fns return this)
        r.addListener();
        r.on();
        r.once();
        r.removeListener();
        r.off();
        r.removeAllListeners();
        r.setMaxListeners();
        r.getMaxListeners();
        r.listeners();
        r.rawListeners();
        r.emit();
        r.eventNames();
        r.listenerCount();
        r.prependListener();
        r.prependOnceListener();

        // Misc stubs
        r.cork();
        r.uncork();
        r.destroy();
        r.read();
        r.setEncoding();
        r.pause();
        r.resume();
        r.isPaused();
        r.destroySoon();
        r.pipe();
        r.unpipe();
        r.unshift();
        r.wrap();
        r.setTimeout();
        r.assignSocket();
        r.detachSocket();
        r.writeContinue();
        r.writeEarlyHints();
        r.flushHeaders();

        return "<custom>OK</custom>";
    },
});

describe(fetchHtmlErrorHandler, () => {
    it("should return a Response with default HTML page", async () => {
        expect.assertions(4);

        const handler = fetchHtmlErrorHandler();
        const request = new Request("https://example.com/");
        const response = await handler(new Error("boom"), request);

        expect(response).toBeInstanceOf(Response);
        expect(response.status).toBe(500);
        expect(response.headers.get("content-type")).toMatch(TEXT_HTML_REGEX);

        const text = await response.text();

        expect(text).toContain("Internal Server Error");
    });

    it("should use http-error status code when error is an HttpError", async () => {
        expect.assertions(3);

        const handler = fetchHtmlErrorHandler();
        const request = new Request("https://example.com/", { method: "POST" });
        const response = await handler(new httpErrors.Forbidden(), request);

        expect(response.status).toBe(403);

        const text = await response.text();

        expect(text).toContain("Forbidden");
        expect(text).toContain("403");
    });

    it("should pass request headers through to the node handler via mock request", async () => {
        expect.assertions(2);

        const handler = fetchHtmlErrorHandler();
        const request = new Request("https://example.com/foo", {
            headers: { "x-custom": "value" },
        });

        const response = await handler(new httpErrors.BadRequest(), request);

        expect(response.status).toBe(400);

        const text = await response.text();

        expect(text).toContain("Bad Request");
    });

    it("should render a static custom errorPage", async () => {
        expect.assertions(2);

        const handler = fetchHtmlErrorHandler({
            errorPage: "<h1>Custom static page</h1>",
        });

        const response = await handler(new httpErrors.NotFound(), new Request("https://example.com/missing"));

        expect(response.status).toBe(404);

        const text = await response.text();

        expect(text).toBe("<h1>Custom static page</h1>");
    });

    it("should render a function-based errorPage with passed parameters", async () => {
        expect.assertions(4);

        const handler = fetchHtmlErrorHandler({
            errorPage: ({ error, reasonPhrase, statusCode }) => `<p>${String(statusCode)} ${reasonPhrase}: ${error.message}</p>`,
        });

        const response = await handler(new httpErrors.BadGateway("upstream offline"), new Request("https://example.com/"));

        expect(response.status).toBe(502);

        const text = await response.text();

        expect(text).toContain("502");
        expect(text).toContain("Bad Gateway");
        expect(text).toContain("upstream offline");
    });

    it("should support an async function errorPage", async () => {
        expect.assertions(2);

        const handler = fetchHtmlErrorHandler({
            // eslint-disable-next-line @typescript-eslint/require-await -- this test deliberately verifies async errorPage support
            errorPage: async ({ statusCode }) => `<p>async page ${String(statusCode)}</p>`,
        });

        const response = await handler(new httpErrors.ImATeapot(), new Request("https://example.com/"));

        expect(response.status).toBe(418);

        const text = await response.text();

        expect(text).toBe("<p>async page 418</p>");
    });

    it("should fall back to default page when errorPage function returns empty string", async () => {
        expect.assertions(2);

        const handler = fetchHtmlErrorHandler({
            errorPage: () => "",
        });

        const response = await handler(new httpErrors.NotFound(), new Request("https://example.com/"));

        expect(response.status).toBe(404);

        const text = await response.text();

        // Default page falls through and includes status code
        expect(text).toContain("Not Found");
    });

    it("should include CSP nonce attribute on style tags when cspNonce is set", async () => {
        expect.assertions(2);

        const handler = fetchHtmlErrorHandler({ cspNonce: "abc123" });
        const response = await handler(new httpErrors.InternalServerError(), new Request("https://example.com/"));
        const text = await response.text();

        expect(response.status).toBe(500);
        expect(text).toContain("nonce=\"abc123\"");
    });

    it("should default the content-type to text/html when handler doesn't set it", async () => {
        expect.assertions(1);

        // The mock writes content-type during the node handler; just verify it's html-ish.
        const handler = fetchHtmlErrorHandler();
        const response = await handler(new Error("oops"), new Request("https://example.com/"));

        expect(response.headers.get("content-type")).toMatch(TEXT_HTML_REGEX);
    });

    it("should expose all stubbed ServerResponse methods via the mock response", async () => {
        expect.assertions(2);

        const handler = exerciseEveryMockMethod();
        const response = await handler(new httpErrors.NotImplemented(), new Request("https://example.com/"));
        const text = await response.text();

        // writeHead(202) was called explicitly in the custom errorPage, overwriting the http error status.
        expect(response.status).toBe(202);
        // The custom errorPage body should be returned despite the many mock-method calls.
        expect(text).toContain("<custom>OK</custom>");
    });
});
