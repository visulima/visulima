import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import RequiredOptionError from "../src/errors/required-option-error";
import { webhookProvider } from "../src/providers/webhook";

const jsonResponse = (body: unknown, status = 200): Response => Response.json(body, { headers: { "Content-Type": "application/json" }, status });

describe(webhookProvider, () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
        vi.stubGlobal("fetch", fetchMock);
        fetchMock.mockReset();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("posts to config.url with a generated messageId and the response body", async () => {
        expect.assertions(5);

        fetchMock.mockResolvedValue(jsonResponse({ ok: true }, 200));

        const provider = webhookProvider({ url: "https://example.com/hook" });
        const result = await provider.send({ body: { hello: "world" } });

        expect(result.success).toBe(true);
        expect(result.data?.messageId).toBeDefined();
        expect(result.data?.response).toStrictEqual({ ok: true });

        const [url, init] = fetchMock.mock.calls[0];

        expect(String(url)).toBe("https://example.com/hook");
        expect(init.method).toBe("POST");
    });

    it("lets the per-payload url override the config url", async () => {
        expect.assertions(2);

        fetchMock.mockResolvedValue(jsonResponse({}, 200));

        const provider = webhookProvider({ url: "https://config.example/hook" });
        const result = await provider.send({ body: {}, url: "https://payload.example/hook" });

        expect(result.success).toBe(true);
        expect(String(fetchMock.mock.calls[0][0])).toBe("https://payload.example/hook");
    });

    it("merges config headers with per-payload headers (payload wins)", async () => {
        expect.assertions(3);

        fetchMock.mockResolvedValue(jsonResponse({}, 200));

        const provider = webhookProvider({ headers: { "X-Config": "c", "X-Shared": "from-config" }, url: "https://example.com/hook" });

        await provider.send({ body: {}, headers: { "X-Payload": "p", "X-Shared": "from-payload" } });

        const [, init] = fetchMock.mock.calls[0];

        expect(init.headers["X-Config"]).toBe("c");
        expect(init.headers["X-Payload"]).toBe("p");
        expect(init.headers["X-Shared"]).toBe("from-payload");
    });

    it("uses the per-payload method override over the config method", async () => {
        expect.assertions(1);

        fetchMock.mockResolvedValue(jsonResponse({}, 200));

        const provider = webhookProvider({ method: "PUT", url: "https://example.com/hook" });

        await provider.send({ body: {}, method: "PATCH" });

        expect(fetchMock.mock.calls[0][1].method).toBe("PATCH");
    });

    it("jSON-stringifies an object body", async () => {
        expect.assertions(1);

        fetchMock.mockResolvedValue(jsonResponse({}, 200));

        const provider = webhookProvider({ url: "https://example.com/hook" });

        await provider.send({ body: { a: 1, b: "two" } });

        expect(fetchMock.mock.calls[0][1].body).toBe(JSON.stringify({ a: 1, b: "two" }));
    });

    it("passes a string body through unchanged", async () => {
        expect.assertions(1);

        fetchMock.mockResolvedValue(jsonResponse({}, 200));

        const provider = webhookProvider({ url: "https://example.com/hook" });

        await provider.send({ body: "raw-string-body" });

        expect(fetchMock.mock.calls[0][1].body).toBe("raw-string-body");
    });

    it("treats a >=400 status as a failed result", async () => {
        expect.assertions(2);

        fetchMock.mockResolvedValue(jsonResponse({ error: "nope" }, 500));

        const provider = webhookProvider({ retries: 0, url: "https://example.com/hook" });
        const result = await provider.send({ body: {} });

        expect(result.success).toBe(false);
        expect((result.error as Error).message).toContain("500");
    });

    it("throws RequiredOptionError when no url is configured", async () => {
        expect.assertions(1);

        const provider = webhookProvider();

        await expect(provider.send({ body: {} })).rejects.toBeInstanceOf(RequiredOptionError);
    });
});
