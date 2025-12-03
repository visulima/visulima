import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RequestOptions } from "../../src/utils/make-request";
import { makeRequest } from "../../src/utils/make-request";

// Mock fetch globally
const mockFetch = vi.fn();

globalThis.fetch = mockFetch;

describe(makeRequest, () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFetch.mockClear();
    });

    describe("successful requests", () => {
        it("should make a GET request without body", async () => {
            expect.assertions(3);

            mockFetch.mockResolvedValueOnce({
                headers: new Headers(),
                json: async () => {
                    return { success: true };
                },
                ok: true,
                status: 200,
                statusText: "OK",
                text: async () => JSON.stringify({ success: true }),
            });

            const result = await makeRequest("https://api.example.com/test");

            expect(result.success).toBe(true);
            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(mockFetch).toHaveBeenCalledWith(
                "https://api.example.com/test",
                expect.objectContaining({
                    method: "GET",
                }),
            );
        });

        it("should make a POST request with string body", async () => {
            expect.assertions(3);

            mockFetch.mockResolvedValueOnce({
                headers: new Headers(),
                json: async () => {
                    return { success: true };
                },
                ok: true,
                status: 200,
                statusText: "OK",
                text: async () => JSON.stringify({ success: true }),
            });

            const result = await makeRequest("https://api.example.com/test", { method: "POST" }, JSON.stringify({ data: "test" }));

            expect(result.success).toBe(true);
            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(mockFetch).toHaveBeenCalledWith(
                "https://api.example.com/test",
                expect.objectContaining({
                    body: JSON.stringify({ data: "test" }),
                    method: "POST",
                }),
            );
        });

        it("should include custom headers", async () => {
            expect.assertions(2);

            mockFetch.mockResolvedValueOnce({
                headers: new Headers(),
                json: async () => {
                    return { success: true };
                },
                ok: true,
                status: 200,
                statusText: "OK",
                text: async () => JSON.stringify({ success: true }),
            });

            const options: RequestOptions = {
                headers: {
                    Authorization: "Bearer token",
                    "Content-Type": "application/json",
                },
            };

            await makeRequest("https://api.example.com/test", options);

            const callArgs = mockFetch.mock.calls[0];
            const headers = callArgs[1].headers as Headers;

            expect(headers.get("Authorization")).toBe("Bearer token");
            expect(headers.get("Content-Type")).toBe("application/json");
        });

        it("should handle Buffer body", async () => {
            expect.assertions(2);

            mockFetch.mockResolvedValueOnce({
                headers: new Headers(),
                json: async () => {
                    return { success: true };
                },
                ok: true,
                status: 200,
                statusText: "OK",
                text: async () => JSON.stringify({ success: true }),
            });

            const buffer = Buffer.from("test data", "utf8");

            await makeRequest("https://api.example.com/test", { method: "POST" }, buffer);

            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(mockFetch.mock.calls[0][1].body).toBeInstanceOf(Uint8Array);
        });

        it("should handle Uint8Array body", async () => {
            expect.assertions(2);

            mockFetch.mockResolvedValueOnce({
                headers: new Headers(),
                json: async () => {
                    return { success: true };
                },
                ok: true,
                status: 200,
                statusText: "OK",
                text: async () => JSON.stringify({ success: true }),
            });

            const uint8Array = new Uint8Array([1, 2, 3, 4]);

            await makeRequest("https://api.example.com/test", { method: "POST" }, uint8Array);

            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(mockFetch.mock.calls[0][1].body).toBeInstanceOf(Uint8Array);
        });

        it("should parse JSON response", async () => {
            expect.assertions(2);

            const responseData = { messageId: "123", status: "sent" };

            const headers = new Headers();

            headers.set("content-type", "application/json");

            mockFetch.mockResolvedValueOnce({
                headers,
                json: async () => responseData,
                ok: true,
                status: 200,
                statusText: "OK",
                text: async () => JSON.stringify(responseData),
            });

            const result = await makeRequest("https://api.example.com/test");

            expect(result.success).toBe(true);

            // JSON is parsed, so body should be an object
            const body = (result.data as { body?: unknown })?.body;

            expect(body).toStrictEqual(responseData);
        });

        it("should parse text response when JSON parsing fails", async () => {
            expect.assertions(2);

            mockFetch.mockResolvedValueOnce({
                headers: new Headers(),
                json: async () => {
                    throw new Error("Invalid JSON");
                },
                ok: true,
                status: 200,
                statusText: "OK",
                text: async () => "plain text response",
            });

            const result = await makeRequest("https://api.example.com/test");

            expect(result.success).toBe(true);
            expect((result.data as { body?: unknown })?.body).toBe("plain text response");
        });

        it("should include status code in response", async () => {
            expect.assertions(2);

            mockFetch.mockResolvedValueOnce({
                headers: new Headers(),
                json: async () => {
                    return { success: true };
                },
                ok: true,
                status: 201,
                statusText: "Created",
                text: async () => JSON.stringify({ success: true }),
            });

            const result = await makeRequest("https://api.example.com/test");

            expect(result.success).toBe(true);
            expect((result.data as { statusCode?: number })?.statusCode).toBe(201);
        });
    });

    describe("timeout handling", () => {
        it("should timeout after specified duration", async () => {
            expect.assertions(2);

            vi.useFakeTimers();

            let abortSignal: AbortSignal | undefined;
            let rejectOnAbort: ((error: Error) => void) | undefined;

            mockFetch.mockImplementationOnce((url, options) => {
                abortSignal = options?.signal as AbortSignal;

                // Listen for abort signal
                if (abortSignal) {
                    abortSignal.addEventListener("abort", () => {
                        const abortError = new Error("AbortError");

                        abortError.name = "AbortError";

                        if (rejectOnAbort) {
                            rejectOnAbort(abortError);
                        }
                    });
                }

                return new Promise((resolve, reject) => {
                    rejectOnAbort = reject;
                    // Never resolve - will timeout
                });
            });

            const requestPromise = makeRequest("https://api.example.com/test", { timeout: 1000 });

            // Advance time to trigger timeout
            await vi.advanceTimersByTimeAsync(1100);

            const result = await requestPromise;

            vi.useRealTimers();

            expect(result.success).toBe(false);
            expect(result.error?.message).toContain("timed out");
        });

        it("should abort request on timeout", async () => {
            expect.assertions(1);

            vi.useFakeTimers();

            let abortSignal: AbortSignal | undefined;

            mockFetch.mockImplementationOnce((url, options) => {
                abortSignal = options?.signal as AbortSignal;

                return new Promise(() => {
                    // Never resolve
                });
            });

            makeRequest("https://api.example.com/test", { timeout: 1000 });

            await vi.advanceTimersByTimeAsync(1000);

            vi.useRealTimers();

            expect(abortSignal?.aborted).toBe(true);
        });
    });

    describe("error handling", () => {
        it("should handle network errors", async () => {
            expect.assertions(2);

            mockFetch.mockRejectedValueOnce(new Error("Network error"));

            const result = await makeRequest("https://api.example.com/test");

            expect(result.success).toBe(false);
            expect(result.error?.message).toContain("Network error");
        });

        it("should handle non-OK responses", async () => {
            expect.assertions(2);

            mockFetch.mockResolvedValueOnce({
                headers: new Headers(),
                json: async () => {
                    return { error: "Server error" };
                },
                ok: false,
                status: 500,
                statusText: "Internal Server Error",
                text: async () => JSON.stringify({ error: "Server error" }),
            });

            const result = await makeRequest("https://api.example.com/test");

            expect(result.success).toBe(false);
            expect((result.data as { statusCode?: number })?.statusCode).toBe(500);
        });

        it("should handle 4xx responses", async () => {
            expect.assertions(2);

            mockFetch.mockResolvedValueOnce({
                headers: new Headers(),
                json: async () => {
                    return { error: "Unauthorized" };
                },
                ok: false,
                status: 401,
                statusText: "Unauthorized",
                text: async () => JSON.stringify({ error: "Unauthorized" }),
            });

            const result = await makeRequest("https://api.example.com/test");

            expect(result.success).toBe(false);
            expect((result.data as { statusCode?: number })?.statusCode).toBe(401);
        });
    });

    describe("uRL handling", () => {
        it("should accept string URL", async () => {
            expect.assertions(1);

            mockFetch.mockResolvedValueOnce({
                headers: new Headers(),
                json: async () => {
                    return {};
                },
                ok: true,
                status: 200,
                statusText: "OK",
                text: async () => "{}",
            });

            await makeRequest("https://api.example.com/test");

            expect(mockFetch).toHaveBeenCalledWith("https://api.example.com/test", expect.any(Object));
        });

        it("should accept URL object", async () => {
            expect.assertions(1);

            mockFetch.mockResolvedValueOnce({
                headers: new Headers(),
                json: async () => {
                    return {};
                },
                ok: true,
                status: 200,
                statusText: "OK",
                text: async () => "{}",
            });

            const url = new URL("https://api.example.com/test");

            await makeRequest(url);

            expect(mockFetch).toHaveBeenCalledWith(url.toString(), expect.any(Object));
        });
    });

    describe("method detection", () => {
        it("should default to GET when no body provided", async () => {
            expect.assertions(1);

            mockFetch.mockResolvedValueOnce({
                headers: new Headers(),
                json: async () => {
                    return {};
                },
                ok: true,
                status: 200,
                statusText: "OK",
                text: async () => "{}",
            });

            await makeRequest("https://api.example.com/test");

            expect(mockFetch.mock.calls[0][1].method).toBe("GET");
        });

        it("should default to POST when body provided", async () => {
            expect.assertions(1);

            mockFetch.mockResolvedValueOnce({
                headers: new Headers(),
                json: async () => {
                    return {};
                },
                ok: true,
                status: 200,
                statusText: "OK",
                text: async () => "{}",
            });

            await makeRequest("https://api.example.com/test", {}, "body");

            expect(mockFetch.mock.calls[0][1].method).toBe("POST");
        });

        it("should use explicit method when provided", async () => {
            expect.assertions(1);

            mockFetch.mockResolvedValueOnce({
                headers: new Headers(),
                json: async () => {
                    return {};
                },
                ok: true,
                status: 200,
                statusText: "OK",
                text: async () => "{}",
            });

            await makeRequest("https://api.example.com/test", { method: "PUT" });

            expect(mockFetch.mock.calls[0][1].method).toBe("PUT");
        });
    });
});
