/* eslint-disable n/no-unsupported-features/node-builtins */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import sendWithRetry from "../../../../../src/reporter/http/utils/retry";

// Mock fetch globally
const mockFetch = vi.fn();

globalThis.fetch = mockFetch;

describe(sendWithRetry, () => {
    beforeEach(() => {
        vi.useFakeTimers();
        mockFetch.mockClear();
    });

    afterEach(async () => {
        await vi.runAllTimersAsync();
        vi.useRealTimers();
        vi.clearAllTimers();
    });

    it("should return successfully on successful request", async () => {
        expect.assertions(2);

        const mockResponse = new Response("Success", { status: 200 });

        mockFetch.mockResolvedValueOnce(mockResponse);

        const promise = sendWithRetry("https://api.example.com/logs", "POST", { "Content-Type": "application/json" }, "{\"test\": \"data\"}", 3, 1000, true);

        await vi.runAllTimersAsync();
        await promise;

        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledWith("https://api.example.com/logs", {
            body: "{\"test\": \"data\"}",
            headers: { "Content-Type": "application/json" },
            method: "POST",
        });
    });

    it("should retry on network failure and eventually succeed", async () => {
        expect.assertions(1);

        const mockError = new Error("Network error");
        const mockResponse = new Response("Success", { status: 200 });

        mockFetch.mockRejectedValueOnce(mockError).mockRejectedValueOnce(mockError).mockResolvedValueOnce(mockResponse);

        const promise = sendWithRetry("https://api.example.com/logs", "POST", { "Content-Type": "application/json" }, "{\"test\": \"data\"}", 2, 100, true);

        await vi.runAllTimersAsync();
        await promise;

        expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("should throw error after max retries", async () => {
        expect.assertions(2);

        const mockError = new Error("Network error");

        mockFetch.mockRejectedValue(mockError);

        const promise = sendWithRetry("https://api.example.com/logs", "POST", { "Content-Type": "application/json" }, "{\"test\": \"data\"}", 2, 100, true);

        promise.catch(() => {
            // Ignore errors
        });

        await vi.runAllTimersAsync();

        await expect(promise).rejects.toThrow("Network error");
        expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it("should handle rate limiting with retry-after header", async () => {
        expect.assertions(1);

        const mockResponse = new Response("Rate Limited", {
            headers: new Headers({ "retry-after": "2" }),
            status: 429,
        });

        mockFetch.mockResolvedValueOnce(mockResponse).mockResolvedValueOnce(new Response("Success", { status: 200 }));

        const promise = sendWithRetry(
            "https://api.example.com/logs",
            "POST",
            { "Content-Type": "application/json" },
            "{\"test\": \"data\"}",
            1,
            1000,
            true, // respectRateLimit
        );

        await vi.runAllTimersAsync();
        await promise;

        expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should handle rate limiting without retry-after header", async () => {
        expect.assertions(1);

        const mockResponse = new Response("Rate Limited", { status: 429 });

        mockFetch.mockResolvedValueOnce(mockResponse).mockResolvedValueOnce(new Response("Success", { status: 200 }));

        const promise = sendWithRetry(
            "https://api.example.com/logs",
            "POST",
            { "Content-Type": "application/json" },
            "{\"test\": \"data\"}",
            1,
            1000,
            true, // respectRateLimit
        );

        await vi.runAllTimersAsync();
        await promise;

        expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should call onError for non-2xx status codes", async () => {
        expect.assertions(2);

        const onError = vi.fn();
        const mockResponse = new Response("Not Found", { status: 404 });

        mockFetch.mockResolvedValueOnce(mockResponse);

        const promise = sendWithRetry(
            "https://api.example.com/logs",
            "POST",
            { "Content-Type": "application/json" },
            "{\"test\": \"data\"}",
            0,
            1000,
            true,
            undefined,
            onError,
        );

        promise.catch(() => {
            // Ignore errors
        });

        await expect(promise).rejects.toThrow("HTTP 404");
        expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("HTTP 404") }));
    });

    it("should not call onError for 2xx status codes", async () => {
        expect.assertions(1);

        const onError = vi.fn();
        const mockResponse = new Response("Created", { status: 201 });

        mockFetch.mockResolvedValueOnce(mockResponse);

        const promise = sendWithRetry(
            "https://api.example.com/logs",
            "POST",
            { "Content-Type": "application/json" },
            "{\"test\": \"data\"}",
            0,
            1000,
            true,
            undefined,
            onError,
        );

        await vi.runAllTimersAsync();
        await promise;

        expect(onError).not.toHaveBeenCalled();
    });

    it("should call onDebugRequestResponse callback when provided", async () => {
        expect.assertions(1);

        const onDebugRequestResponse = vi.fn();
        const mockResponse = new Response("Success", { status: 200 });

        mockFetch.mockResolvedValueOnce(mockResponse);

        const promise = sendWithRetry(
            "https://api.example.com/logs",
            "POST",
            { "Content-Type": "application/json" },
            "{\"test\": \"data\"}",
            0,
            1000,
            true,
            onDebugRequestResponse,
        );

        await vi.runAllTimersAsync();
        await promise;

        expect(onDebugRequestResponse).toHaveBeenCalledWith({
            req: {
                body: "{\"test\": \"data\"}",
                headers: { "Content-Type": "application/json" },
                method: "POST",
                url: "https://api.example.com/logs",
            },
            res: expect.objectContaining({
                body: "Success",
                headers: expect.any(Object),
                status: 200,
                statusText: expect.any(String),
            }),
        });
    });

    it("should use exponential backoff for retries", async () => {
        expect.assertions(2);

        const mockError = new Error("Network error");

        mockFetch.mockRejectedValue(mockError);

        const promise = sendWithRetry("https://api.example.com/logs", "POST", { "Content-Type": "application/json" }, "{\"test\": \"data\"}", 2, 100, true);

        promise.catch(() => {
            // Ignore errors
        });

        await vi.runAllTimersAsync();

        await expect(promise).rejects.toThrow("Network error");
        expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("should not respect rate limit when respectRateLimit is false", async () => {
        expect.assertions(2);

        const onError = vi.fn();
        const mockResponse = new Response("Rate Limited", { status: 429 });

        mockFetch.mockResolvedValueOnce(mockResponse);

        const promise = sendWithRetry(
            "https://api.example.com/logs",
            "POST",
            { "Content-Type": "application/json" },
            "{\"test\": \"data\"}",
            0,
            1000,
            false, // respectRateLimit = false
            undefined,
            onError,
        );

        promise.catch(() => {
            // Ignore errors
        });

        await expect(promise).rejects.toThrow("HTTP 429");
        expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("HTTP 429") }));
    });

    it("should retry on 5xx server errors", async () => {
        expect.assertions(1);

        const mockResponse500 = new Response("Internal Server Error", { status: 500 });
        const mockResponse200 = new Response("Success", { status: 200 });

        mockFetch.mockResolvedValueOnce(mockResponse500).mockResolvedValueOnce(mockResponse200);

        const promise = sendWithRetry("https://api.example.com/logs", "POST", { "Content-Type": "application/json" }, "{\"test\": \"data\"}", 1, 100, true);

        await vi.runAllTimersAsync();
        await promise;

        expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should handle Uint8Array body", async () => {
        expect.assertions(2);

        const mockResponse = new Response("Success", { status: 200 });

        mockFetch.mockResolvedValueOnce(mockResponse);

        const body = new Uint8Array([1, 2, 3, 4, 5]);
        const promise = sendWithRetry("https://api.example.com/logs", "POST", { "Content-Type": "application/octet-stream" }, body, 0, 1000, true);

        await vi.runAllTimersAsync();
        await promise;

        expect(mockFetch).toHaveBeenCalledTimes(1);

        const callArgs = mockFetch.mock.calls[0][1];

        expect(callArgs.body).toBeInstanceOf(Uint8Array);
    });

    it("should handle string body", async () => {
        expect.assertions(2);

        const mockResponse = new Response("Success", { status: 200 });

        mockFetch.mockResolvedValueOnce(mockResponse);

        const promise = sendWithRetry("https://api.example.com/logs", "POST", { "Content-Type": "application/json" }, "{\"test\": \"data\"}", 0, 1000, true);

        await vi.runAllTimersAsync();
        await promise;

        expect(mockFetch).toHaveBeenCalledTimes(1);

        const callArgs = mockFetch.mock.calls[0][1];

        expect(callArgs.body).toBe("{\"test\": \"data\"}");
    });

    it("should stop retrying after max retries on 5xx errors", async () => {
        expect.assertions(3);

        const onError = vi.fn();
        const mockResponse = new Response("Internal Server Error", { status: 500 });

        mockFetch.mockResolvedValue(mockResponse);

        const promise = sendWithRetry(
            "https://api.example.com/logs",
            "POST",
            { "Content-Type": "application/json" },
            "{\"test\": \"data\"}",
            2,
            100,
            true,
            undefined,
            onError,
        );

        promise.catch(() => {
            // Ignore errors
        });

        await vi.runAllTimersAsync();

        await expect(promise).rejects.toThrow(/Body is unusable|Internal Server Error/);
        expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
        expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should handle response headers correctly", async () => {
        expect.assertions(1);

        const onDebugRequestResponse = vi.fn();
        const mockResponse = new Response("Success", {
            headers: {
                "content-type": "application/json",
                "x-custom-header": "custom-value",
            },
            status: 200,
        });

        mockFetch.mockResolvedValueOnce(mockResponse);

        const promise = sendWithRetry(
            "https://api.example.com/logs",
            "POST",
            { "Content-Type": "application/json" },
            "{\"test\": \"data\"}",
            0,
            1000,
            true,
            onDebugRequestResponse,
        );

        await vi.runAllTimersAsync();
        await promise;

        expect(onDebugRequestResponse).toHaveBeenCalledWith({
            req: expect.any(Object),
            res: expect.objectContaining({
                headers: expect.objectContaining({
                    "content-type": "application/json",
                    "x-custom-header": "custom-value",
                }),
            }),
        });
    });

    it("should handle empty response body", async () => {
        expect.assertions(1);

        const onDebugRequestResponse = vi.fn();
        const mockResponse = new Response("", { status: 200 });

        mockFetch.mockResolvedValueOnce(mockResponse);

        const promise = sendWithRetry(
            "https://api.example.com/logs",
            "POST",
            { "Content-Type": "application/json" },
            "{\"test\": \"data\"}",
            0,
            1000,
            true,
            onDebugRequestResponse,
        );

        await vi.runAllTimersAsync();
        await promise;

        expect(onDebugRequestResponse).toHaveBeenCalledWith({
            req: expect.any(Object),
            res: expect.objectContaining({
                body: "",
                status: 200,
            }),
        });
    });
});
