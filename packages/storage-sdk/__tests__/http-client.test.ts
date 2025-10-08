import { describe, expect, it, vi } from "vitest";
import { HttpClient } from "../src/http-client";

// Mock fetch globally
const fetchMock = vi.fn();
global.fetch = fetchMock;

describe("HttpClient", () => {
    let client: HttpClient;

    beforeEach(() => {
        vi.clearAllMocks();
        client = new HttpClient({
            baseUrl: "https://api.example.com",
        });
    });

    describe("constructor", () => {
        it("should create instance with default config", () => {
            const httpClient = new HttpClient({ baseUrl: "https://test.com" });

            expect(httpClient).toBeInstanceOf(HttpClient);
        });

        it("should merge custom config with defaults", () => {
            const httpClient = new HttpClient({
                baseUrl: "https://test.com",
                timeout: 5000,
                retries: 5,
                headers: { "X-Custom": "value" },
            });

            expect(httpClient).toBeInstanceOf(HttpClient);
        });
    });

    describe("request method", () => {
        it("should make successful GET request", async () => {
            const mockResponse = {
                status: 200,
                statusText: "OK",
                headers: new Headers({ "content-type": "application/json" }),
                body: new ReadableStream({
                    start(controller) {
                        controller.enqueue(new TextEncoder().encode('{"success": true}'));
                        controller.close();
                    },
                }),
                url: "https://api.example.com/test",
            };

            fetchMock.mockResolvedValue(mockResponse);

            const response = await client.request("/test");

            expect(fetchMock).toHaveBeenCalledWith("https://api.example.com/test", expect.any(Object));
            expect(response.status).toBe(200);
            expect(response.statusText).toBe("OK");
        });

        it("should handle full URLs", async () => {
            const mockResponse = {
                status: 200,
                statusText: "OK",
                headers: new Headers(),
                body: null,
                url: "https://external-api.com/test",
            };

            fetchMock.mockResolvedValue(mockResponse);

            const response = await client.request("https://external-api.com/test");

            expect(fetchMock).toHaveBeenCalledWith("https://external-api.com/test", expect.any(Object));
        });

        it("should include custom headers", async () => {
            const mockResponse = {
                status: 200,
                statusText: "OK",
                headers: new Headers(),
                body: null,
                url: "https://api.example.com/test",
            };

            fetchMock.mockResolvedValue(mockResponse);

            await client.request("/test", {
                headers: { "X-Custom": "value" },
            });

            const callArgs = fetchMock.mock.calls[0][1];
            expect(callArgs.headers).toEqual(
                expect.objectContaining({
                    "X-Custom": "value",
                })
            );
        });

        it("should retry on failure", async () => {
            fetchMock
                .mockRejectedValueOnce(new Error("Network error"))
                .mockResolvedValueOnce({
                    status: 200,
                    statusText: "OK",
                    headers: new Headers(),
                    body: null,
                    url: "https://api.example.com/test",
                });

            const response = await client.request("/test");

            expect(fetchMock).toHaveBeenCalledTimes(2);
            expect(response.status).toBe(200);
        });

        it("should throw after max retries", async () => {
            fetchMock.mockRejectedValue(new Error("Network error"));

            await expect(client.request("/test")).rejects.toThrow("Network error");
            expect(fetchMock).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
        }, 10000);

        it("should not retry on AbortError", async () => {
            const abortError = new Error("The operation was aborted");
            (abortError as any).name = "AbortError";
            fetchMock.mockRejectedValue(abortError);

            await expect(client.request("/test")).rejects.toThrow("The operation was aborted");
            expect(fetchMock).toHaveBeenCalledTimes(1); // Only 1 call, no retries
        }, 10000);
    });

    describe("convenience methods", () => {
        beforeEach(() => {
            const mockResponse = {
                status: 200,
                statusText: "OK",
                headers: new Headers(),
                body: null,
                url: "https://api.example.com/test",
            };

            fetchMock.mockResolvedValue(mockResponse);
        });

        it("should make GET request", async () => {
            await client.get("/test");

            expect(fetchMock).toHaveBeenCalledWith("https://api.example.com/test", expect.objectContaining({
                method: "GET",
            }));
        });

        it("should make POST request", async () => {
            await client.post("/test", { body: "data" });

            expect(fetchMock).toHaveBeenCalledWith("https://api.example.com/test", expect.objectContaining({
                method: "POST",
                body: "data",
            }));
        });

        it("should make PUT request", async () => {
            await client.put("/test", { body: "data" });

            expect(fetchMock).toHaveBeenCalledWith("https://api.example.com/test", expect.objectContaining({
                method: "PUT",
                body: "data",
            }));
        });

        it("should make DELETE request", async () => {
            await client.delete("/test");

            expect(fetchMock).toHaveBeenCalledWith("https://api.example.com/test", expect.objectContaining({
                method: "DELETE",
            }));
        });
    });

    describe("response readers", () => {
        it("should read response as text", async () => {
            const mockResponse = {
                status: 200,
                statusText: "OK",
                headers: new Headers(),
                body: new ReadableStream({
                    start(controller) {
                        controller.enqueue(new TextEncoder().encode("Hello World"));
                        controller.close();
                    },
                }),
                url: "https://api.example.com/test",
            };

            fetchMock.mockResolvedValue(mockResponse);

            const response = await client.request("/test");
            const text = await client.readAsText(response);

            expect(text).toBe("Hello World");
        });

        it("should read response as JSON", async () => {
            const mockResponse = {
                status: 200,
                statusText: "OK",
                headers: new Headers(),
                body: new ReadableStream({
                    start(controller) {
                        controller.enqueue(new TextEncoder().encode('{"message": "success"}'));
                        controller.close();
                    },
                }),
                url: "https://api.example.com/test",
            };

            fetchMock.mockResolvedValue(mockResponse);

            const response = await client.request("/test");
            const json = await client.readAsJson(response);

            expect(json).toEqual({ message: "success" });
        });

        it("should read response as ArrayBuffer", async () => {
            const testData = new Uint8Array([1, 2, 3, 4, 5]);
            const mockResponse = {
                status: 200,
                statusText: "OK",
                headers: new Headers(),
                body: new ReadableStream({
                    start(controller) {
                        controller.enqueue(testData);
                        controller.close();
                    },
                }),
                url: "https://api.example.com/test",
            };

            fetchMock.mockResolvedValue(mockResponse);

            const response = await client.request("/test");
            const buffer = await client.readAsArrayBuffer(response);

            expect(buffer).toBeInstanceOf(ArrayBuffer);
            expect(new Uint8Array(buffer)).toEqual(testData);
        });
    });
});
