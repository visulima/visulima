import httpErrors from "http-errors";
import { describe, expect, it } from "vitest";

import createFetchNegotiatedErrorHandler from "../../src/error-handler/fetch-create-negotiated-error-handler";

const JSON_ACCEPT_REGEX = /json/;
const YAML_ACCEPT_REGEX = /application\/yaml/u;
const EMPTY_ACCEPT_REGEX = /^$/u;

const makeRequest = (accept?: string): Request => new Request("https://example.test/boom", accept === undefined ? undefined : { headers: { accept } });

describe(createFetchNegotiatedErrorHandler, () => {
    it("should dispatch application/json to the JSON handler", async () => {
        expect.assertions(3);

        const handler = createFetchNegotiatedErrorHandler([], false);
        const result = await handler(new Error("boom"), makeRequest("application/json"));

        expect(result).toBeInstanceOf(Response);
        expect(result.headers.get("content-type")).toBe("application/json; charset=utf-8");
        await expect(result.json()).resolves.toHaveProperty("statusCode", 500);
    });

    it("should dispatch application/problem+json to the problem handler", async () => {
        expect.assertions(1);

        const handler = createFetchNegotiatedErrorHandler([], false);
        const result = await handler(new Error("boom"), makeRequest("application/problem+json"));

        expect(result.headers.get("content-type")).toBe("application/problem+json");
    });

    it("should dispatch application/vnd.api+json to the JSON:API handler", async () => {
        expect.assertions(2);

        const handler = createFetchNegotiatedErrorHandler([], false);
        const result = await handler(new Error("boom"), makeRequest("application/vnd.api+json"));

        expect(result).toBeInstanceOf(Response);
        expect(result.status).toBe(500);
    });

    it("should dispatch application/xml to the XML handler", async () => {
        expect.assertions(1);

        const handler = createFetchNegotiatedErrorHandler([], false);
        const result = await handler(new Error("boom"), makeRequest("application/xml"));

        expect(result.headers.get("content-type")).toBe("application/xml; charset=utf-8");
    });

    it("should dispatch text/plain to the text handler", async () => {
        expect.assertions(1);

        const handler = createFetchNegotiatedErrorHandler([], false);
        const result = await handler(new Error("boom"), makeRequest("text/plain"));

        expect(result.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    });

    it("should dispatch application/javascript to the JSONP handler", async () => {
        expect.assertions(1);

        const handler = createFetchNegotiatedErrorHandler([], false);
        const result = await handler(new Error("boom"), makeRequest("application/javascript"));

        expect(result.headers.get("content-type")).toBe("application/javascript; charset=utf-8");
    });

    it("should fall back to the problem handler when no accept header is present", async () => {
        expect.assertions(1);

        const handler = createFetchNegotiatedErrorHandler([], false);
        const result = await handler(new Error("boom"), makeRequest());

        expect(result.headers.get("content-type")).toBe("application/problem+json");
    });

    it("should use the provided default HTML handler for text/html requests", async () => {
        expect.assertions(2);

        const htmlResponse = new Response("<html>boom</html>", { headers: { "content-type": "text/html" }, status: 500 });
        const handler = createFetchNegotiatedErrorHandler([], false, () => Promise.resolve(htmlResponse));
        const result = await handler(new Error("boom"), makeRequest("text/html"));

        expect(result.headers.get("content-type")).toBe("text/html");
        await expect(result.text()).resolves.toContain("<html>");
    });

    it("should prefer a consumer regex override over the negotiated handler", async () => {
        expect.assertions(2);

        const handler = createFetchNegotiatedErrorHandler(
            [{ handler: () => Promise.resolve(new Response("overridden", { status: 418 })), regex: JSON_ACCEPT_REGEX }],
            false,
        );
        const result = await handler(new Error("boom"), makeRequest("application/json"));

        expect(result.status).toBe(418);
        await expect(result.text()).resolves.toBe("overridden");
    });

    it("should expose the stack in the body when showTrace is true without leaking error.expose", async () => {
        expect.assertions(2);

        const error = new Error("boom");
        const handler = createFetchNegotiatedErrorHandler([], true);
        const result = await handler(error, makeRequest("application/json"));

        await expect(result.json()).resolves.toHaveProperty("stack");
        // The negotiator must not permanently mutate the caller's error object;
        // the temporary `expose` flag is removed once the handler resolves.
        expect(Object.hasOwn(error, "expose")).toBe(false);
    });

    it("should omit the stack from the body when showTrace is false", async () => {
        expect.assertions(1);

        const handler = createFetchNegotiatedErrorHandler([], false);
        const result = await handler(new Error("boom"), makeRequest("application/json"));

        await expect(result.json()).resolves.not.toHaveProperty("stack");
    });

    it("should join array-valued error headers when converting to a fetch Response", async () => {
        expect.assertions(1);

        const error = new httpErrors.BadRequest("boom");

        // An array-valued header is copied onto the mock response, then joined with ", ".
        error.headers = { "x-multi": ["a", "b"] };

        const handler = createFetchNegotiatedErrorHandler([], false);
        const result = await handler(error, makeRequest("application/json"));

        expect(result.headers.get("x-multi")).toBe("a, b");
    });

    it("should skip a regex override whose pattern does not match the Accept header", async () => {
        expect.assertions(2);

        let overrideCalled = false;

        const handler = createFetchNegotiatedErrorHandler(
            [
                {
                    handler: () => {
                        overrideCalled = true;

                        return Promise.resolve(new Response("nope", { status: 418 }));
                    },
                    regex: YAML_ACCEPT_REGEX, // Does not match "application/json".
                },
            ],
            false,
        );
        const result = await handler(new Error("boom"), makeRequest("application/json"));

        // The non-matching override is skipped; the negotiated JSON handler runs.
        expect(overrideCalled).toBe(false);
        expect(result.headers.get("content-type")).toBe("application/json; charset=utf-8");
    });

    it("should honour client q-values when picking the response type", async () => {
        expect.assertions(1);

        const handler = createFetchNegotiatedErrorHandler([], false);
        // text/html is the server's first preference but the client weighted it
        // far below application/json, so JSON must win.
        const result = await handler(new Error("boom"), makeRequest("text/html;q=0.1, application/json;q=0.9"));

        expect(result.headers.get("content-type")).toBe("application/json; charset=utf-8");
    });

    it("should fall back to server preference order when q-values tie", async () => {
        expect.assertions(1);

        const htmlResponse = new Response("<html>boom</html>", { headers: { "content-type": "text/html" }, status: 500 });
        const handler = createFetchNegotiatedErrorHandler([], false, () => Promise.resolve(htmlResponse));
        // Equal quality -> the server's first preference (text/html) wins.
        const result = await handler(new Error("boom"), makeRequest("application/json, text/html"));

        expect(result.headers.get("content-type")).toBe("text/html");
    });

    it("should ignore types the client rejected with q=0", async () => {
        expect.assertions(1);

        const handler = createFetchNegotiatedErrorHandler([], false);
        // text/html is rejected outright; the next acceptable type is plain text.
        const result = await handler(new Error("boom"), makeRequest("text/html;q=0, text/plain"));

        expect(result.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    });

    it("should match a regex override against an empty string when no Accept header is present", async () => {
        expect.assertions(2);

        const handler = createFetchNegotiatedErrorHandler(
            [
                {
                    handler: () => Promise.resolve(new Response("matched-empty", { status: 400 })),
                    regex: EMPTY_ACCEPT_REGEX, // Matches the "" fallback for a missing Accept header.
                },
            ],
            false,
        );
        const result = await handler(new Error("boom"), makeRequest());

        expect(result.status).toBe(400);
        await expect(result.text()).resolves.toBe("matched-empty");
    });
});
