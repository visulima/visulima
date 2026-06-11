import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteRequest, fetchJson, parseApiError, resolveHeaders, UploadError } from "../../src/core/query-client";

const mockFetch = vi.fn();

describe("query-client typed errors and request options", () => {
    beforeEach(() => {
        globalThis.fetch = mockFetch;
        vi.clearAllMocks();
    });

    describe(parseApiError, () => {
        it("should return an UploadError carrying status and code", async () => {
            expect.assertions(4);

            const response = Response.json({ error: { code: "PAYLOAD_TOO_LARGE", message: "Too big" } }, { status: 413, statusText: "Payload Too Large" });

            const error = await parseApiError(response);

            expect(error).toBeInstanceOf(UploadError);
            expect(error.status).toBe(413);
            expect(error.code).toBe("PAYLOAD_TOO_LARGE");
            expect(error.message).toBe("Too big");
        });

        it("should preserve status for a non-JSON error body", async () => {
            expect.assertions(2);

            const response = new Response("nope", { status: 404, statusText: "Not Found" });
            const error = await parseApiError(response);

            expect(error.status).toBe(404);
            expect(error.code).toBeUndefined();
        });
    });

    describe(resolveHeaders, () => {
        it("should resolve a static object", async () => {
            expect.assertions(1);

            await expect(resolveHeaders({ Authorization: "Bearer x" })).resolves.toStrictEqual({ Authorization: "Bearer x" });
        });

        it("should resolve a sync factory", async () => {
            expect.assertions(1);

            await expect(
                resolveHeaders(() => {
                    return { Authorization: "Bearer y" };
                }),
            ).resolves.toStrictEqual({ Authorization: "Bearer y" });
        });

        it("should resolve an async factory", async () => {
            expect.assertions(1);

            await expect(
                resolveHeaders(async () => {
                    return { Authorization: "Bearer z" };
                }),
            ).resolves.toStrictEqual({ Authorization: "Bearer z" });
        });

        it("should default to an empty object", async () => {
            expect.assertions(1);

            await expect(resolveHeaders()).resolves.toStrictEqual({});
        });
    });

    describe("request options forwarding", () => {
        it("should forward signal and headers to fetchJson", async () => {
            expect.assertions(2);

            mockFetch.mockResolvedValueOnce({
                json: async () => {
                    return { ok: 1 };
                },
                ok: true,
            });

            const controller = new AbortController();

            await fetchJson("https://api.example.com/x", { headers: { Authorization: "Bearer t" }, signal: controller.signal });

            const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];

            expect(init.signal).toBe(controller.signal);
            expect(init.headers).toStrictEqual({ Authorization: "Bearer t" });
        });

        it("should forward an async header factory to deleteRequest", async () => {
            expect.assertions(1);

            mockFetch.mockResolvedValueOnce({ ok: true });

            await deleteRequest("https://api.example.com/x", {
                headers: async () => {
                    return { Authorization: "Bearer async" };
                },
            });

            const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];

            expect(init.headers).toStrictEqual({ Authorization: "Bearer async" });
        });
    });
});
