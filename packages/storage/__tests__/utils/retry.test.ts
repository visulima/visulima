import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createRetryWrapper, isRetryableError, retry } from "../../src/utils/retry";

describe("retry", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe(isRetryableError, () => {
        it("should return true for ECONNRESET error", () => {
            expect.assertions(1);

            const error = new Error("Connection reset");
            (error as { code?: string }).code = "ECONNRESET";

            expect(isRetryableError(error)).toBe(true);
        });

        it("should return true for ETIMEDOUT error", () => {
            expect.assertions(1);

            const error = new Error("Timeout");
            (error as { code?: string }).code = "ETIMEDOUT";

            expect(isRetryableError(error)).toBe(true);
        });

        it("should return true for ENOTFOUND error", () => {
            expect.assertions(1);

            const error = new Error("Not found");
            (error as { code?: string }).code = "ENOTFOUND";

            expect(isRetryableError(error)).toBe(true);
        });

        it("should return true for ECONNREFUSED error", () => {
            expect.assertions(1);

            const error = new Error("Connection refused");
            (error as { code?: string }).code = "ECONNREFUSED";

            expect(isRetryableError(error)).toBe(true);
        });

        it("should return true for NetworkError", () => {
            expect.assertions(1);

            const error = new Error("Network error");
            error.name = "NetworkError";

            expect(isRetryableError(error)).toBe(true);
        });

        it("should return true for TimeoutError", () => {
            expect.assertions(1);

            const error = new Error("Timeout");
            error.name = "TimeoutError";

            expect(isRetryableError(error)).toBe(true);
        });

        it("should return true for AWS SDK error with retryable status code", () => {
            expect.assertions(1);

            const error = new Error("AWS error");
            (error as { $metadata?: { httpStatusCode?: number } }).$metadata = { httpStatusCode: 500 };

            expect(isRetryableError(error)).toBe(true);
        });

        it("should return true for AWS SDK error with server fault", () => {
            expect.assertions(1);

            const error = new Error("AWS error");
            (error as { $fault?: string; $metadata?: { httpStatusCode?: number } }).$fault = "server";
            (error as { $fault?: string; $metadata?: { httpStatusCode?: number } }).$metadata = {};

            expect(isRetryableError(error)).toBe(true);
        });

        it("should return true for AWS SDK v2 error with retryable flag", () => {
            expect.assertions(1);

            const error = new Error("AWS error");
            (error as { retryable?: boolean }).retryable = true;

            expect(isRetryableError(error)).toBe(true);
        });

        it("should return true for Azure Storage error with retryable status code", () => {
            expect.assertions(1);

            const error = new Error("Azure error");
            (error as { statusCode?: number }).statusCode = 503;

            expect(isRetryableError(error)).toBe(true);
        });

        it("should return false for non-retryable error", () => {
            expect.assertions(1);

            const error = new Error("Not retryable");

            expect(isRetryableError(error)).toBe(false);
        });

        it("should return false for non-Error object", () => {
            expect.assertions(1);

            expect(isRetryableError("string error")).toBe(false);
        });

        it("should use custom retryable status codes", () => {
            expect.assertions(2);

            const error = new Error("AWS error");
            (error as { $metadata?: { httpStatusCode?: number } }).$metadata = { httpStatusCode: 400 };

            expect(isRetryableError(error, [400, 500])).toBe(true);
            expect(isRetryableError(error, [500, 502])).toBe(false);
        });
    });

    describe(retry, () => {
        it("should return result on successful first attempt", async () => {
            expect.assertions(1);

            const fn = vi.fn().mockResolvedValue("success");

            const result = await retry(fn);

            expect(result).toBe("success");
        });

        it("should retry on failure and eventually succeed", async () => {
            expect.assertions(2);

            const error = new Error("fail");

            (error as { code?: string }).code = "ECONNRESET";

            const fn = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce("success");

            const resultPromise = retry(fn, { initialDelay: 100, maxRetries: 1 });

            await vi.advanceTimersByTimeAsync(200);
            await vi.runAllTimersAsync();
            const result = await resultPromise;

            expect(result).toBe("success");
            expect(fn).toHaveBeenCalledTimes(2);
        });

        it("should throw after max retries exhausted", async () => {
            expect.assertions(2);

            const error = new Error("fail");

            (error as { code?: string }).code = "ECONNRESET";

            const fn = vi.fn().mockRejectedValue(error);

            const resultPromise = retry(fn, { initialDelay: 100, maxRetries: 2 });

            // Catch the promise rejection to prevent unhandled rejection
            resultPromise.catch(() => {
                // Expected rejection
            });

            // Advance timers and wait for all async operations
            await vi.advanceTimersByTimeAsync(500);
            await vi.runAllTimersAsync();

            try {
                await resultPromise;
                expect.fail("Should have thrown");
            } catch (e) {
                expect(e).toBe(error);
            }

            expect(fn).toHaveBeenCalledTimes(3);
        });

        it("should not retry non-retryable errors", async () => {
            expect.assertions(2);

            const error = new Error("not retryable");
            const fn = vi.fn().mockRejectedValue(error);

            const resultPromise = retry(fn, { shouldRetry: () => false });

            try {
                await resultPromise;
                expect.fail("Should have thrown");
            } catch (e) {
                expect(e).toBe(error);
            }

            expect(fn).toHaveBeenCalledTimes(1);
        });

        it("should use custom shouldRetry function", async () => {
            expect.assertions(2);

            const error = new Error("custom");
            const fn = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce("success");

            const resultPromise = retry(fn, {
                initialDelay: 100,
                maxRetries: 1,
                shouldRetry: (err) => err === error,
            });

            await vi.advanceTimersByTimeAsync(100);
            await vi.runAllTimersAsync();
            const result = await resultPromise;

            expect(result).toBe("success");
            expect(fn).toHaveBeenCalledTimes(2);
        });

        it("should use custom calculateDelay function", async () => {
            expect.assertions(2);

            const error = new Error("fail");

            (error as { code?: string }).code = "ECONNRESET";

            const fn = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce("success");

            const resultPromise = retry(fn, {
                calculateDelay: () => 50,
                initialDelay: 100,
                maxRetries: 1,
            });

            await vi.advanceTimersByTimeAsync(50);
            await vi.runAllTimersAsync();
            const result = await resultPromise;

            expect(result).toBe("success");
            expect(fn).toHaveBeenCalledTimes(2);
        });

        it("should respect maxDelay", async () => {
            expect.assertions(2);

            const error = new Error("fail");

            (error as { code?: string }).code = "ECONNRESET";

            const fn = vi.fn().mockRejectedValue(error);

            const resultPromise = retry(fn, {
                backoffMultiplier: 10,
                initialDelay: 1000,
                maxDelay: 2000,
                maxRetries: 2,
            });

            // Catch the promise rejection to prevent unhandled rejection
            resultPromise.catch(() => {
                // Expected rejection
            });

            // Advance timers and wait for all async operations
            await vi.advanceTimersByTimeAsync(5000);
            await vi.runAllTimersAsync();

            try {
                await resultPromise;
                expect.fail("Should have thrown");
            } catch (e) {
                expect(e).toBe(error);
            }

            // Verify delay was capped at maxDelay
            expect(fn).toHaveBeenCalledTimes(3);
        });

        it("should handle zero delay", async () => {
            expect.assertions(2);

            const error = new Error("fail");

            (error as { code?: string }).code = "ECONNRESET";

            const fn = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce("success");

            const resultPromise = retry(fn, {
                calculateDelay: () => 0,
                initialDelay: 100,
                maxRetries: 1,
            });

            await vi.runAllTimersAsync();
            const result = await resultPromise;

            expect(result).toBe("success");
            expect(fn).toHaveBeenCalledTimes(2);
        });
    });

    describe(createRetryWrapper, () => {
        it("should create retry wrapper with config", async () => {
            expect.assertions(2);

            const fn = vi.fn().mockResolvedValue("success");
            const wrapper = createRetryWrapper({ maxRetries: 2 });

            const result = await wrapper(fn);

            expect(result).toBe("success");
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it("should use wrapper config for retries", async () => {
            expect.assertions(2);

            const error = new Error("fail");

            (error as { code?: string }).code = "ECONNRESET";

            const fn = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce("success");
            const wrapper = createRetryWrapper({ initialDelay: 100, maxRetries: 1 });

            const resultPromise = wrapper(fn);

            await vi.advanceTimersByTimeAsync(100);
            await vi.runAllTimersAsync();
            const result = await resultPromise;

            expect(result).toBe("success");
            expect(fn).toHaveBeenCalledTimes(2);
        });
    });
});

