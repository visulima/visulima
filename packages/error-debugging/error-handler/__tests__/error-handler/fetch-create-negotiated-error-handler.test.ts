import { describe, expect, it } from "vitest";

import createFetchNegotiatedErrorHandler from "../../src/error-handler/fetch-create-negotiated-error-handler";

const JSON_ACCEPT_REGEX = /json/;

const makeRequest = (accept?: string): Request =>
    new Request("https://example.test/boom", accept === undefined ? undefined : { headers: { accept } });

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

    it("should expose the stack in the body and set error.expose when showTrace is true", async () => {
        expect.assertions(2);

        const error = new Error("boom");
        const handler = createFetchNegotiatedErrorHandler([], true);
        const result = await handler(error, makeRequest("application/json"));

        await expect(result.json()).resolves.toHaveProperty("stack");
        expect((error as Error & { expose?: boolean }).expose).toBe(true);
    });

    it("should omit the stack from the body when showTrace is false", async () => {
        expect.assertions(1);

        const handler = createFetchNegotiatedErrorHandler([], false);
        const result = await handler(new Error("boom"), makeRequest("application/json"));

        await expect(result.json()).resolves.not.toHaveProperty("stack");
    });
});
