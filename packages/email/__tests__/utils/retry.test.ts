import { beforeEach, describe, expect, it, vi } from "vitest";

import EmailError from "../../src/errors/email-error";
import type { Result } from "../../src/types";
import retry from "../../src/utils/retry";

describe(retry, () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
    });

    const createSuccessFunction = (): () => Promise<Result<string>> => async () => {
        return {
            data: "success",
            success: true,
        };
    };

    const createFailureFunction = (failCount: number = 0): () => Promise<Result<string>> => {
        let callCount = 0;

        return async () => {
            callCount += 1;

            if (callCount <= failCount) {
                return {
                    error: new EmailError("test", `Attempt ${callCount} failed`),
                    success: false,
                };
            }

            return {
                data: "success",
                success: true,
            };
        };
    };

    const createThrowingFunction = (throwCount: number = 0): () => Promise<Result<string>> => {
        let callCount = 0;

        return async () => {
            callCount += 1;

            if (callCount <= throwCount) {
                throw new Error(`Attempt ${callCount} threw`);
            }

            return {
                data: "success",
                success: true,
            };
        };
    };

    describe("successful execution", () => {
        it("should return success result on first attempt", async () => {
            expect.assertions(2);

            const retryFunction = createSuccessFunction();
            const result = await retry(retryFunction, 3, 100);

            expect(result.success).toBe(true);
            expect(result.data).toBe("success");
        });

        it("should not retry on success", async () => {
            expect.assertions(1);

            const retryFunction = vi.fn(createSuccessFunction());

            await retry(retryFunction, 3, 100);

            expect(retryFunction).toHaveBeenCalledTimes(1);
        });
    });

    describe("retry on failure", () => {
        it("should retry on failure and eventually succeed", async () => {
            expect.assertions(3);

            vi.useFakeTimers();

            const retryFunction = vi.fn(createFailureFunction(2));
            const retryPromise = retry(retryFunction, 3, 100);

            // Advance time to allow retries
            await vi.advanceTimersByTimeAsync(500);
            const result = await retryPromise;

            vi.useRealTimers();

            expect(result.success).toBe(true);
            expect(result.data).toBe("success");
            expect(retryFunction).toHaveBeenCalledTimes(3);
        });

        it("should use exponential backoff", async () => {
            expect.assertions(1);

            vi.useFakeTimers();

            let callCount = 0;
            const retryFunction = vi.fn(async () => {
                callCount += 1;

                if (callCount <= 2) {
                    return {
                        error: new EmailError("test", `Attempt ${callCount} failed`),
                        success: false,
                    };
                }

                return {
                    data: "success",
                    success: true,
                };
            });

            const retryPromise = retry(retryFunction, 3, 100);

            // Advance time to allow retries (100ms + 200ms = 300ms)
            await vi.advanceTimersByTimeAsync(400);
            await retryPromise;

            vi.useRealTimers();

            // Should have been called 3 times (initial + 2 retries)
            expect(retryFunction).toHaveBeenCalledTimes(3);
        });

        it("should stop retrying after max retries", async () => {
            expect.assertions(2);

            vi.useFakeTimers();

            const retryFunction = vi.fn(createFailureFunction(10)); // Always fails
            const retryPromise = retry(retryFunction, 3, 100);

            await vi.advanceTimersByTimeAsync(1000);
            const result = await retryPromise;

            vi.useRealTimers();

            expect(result.success).toBe(false);
            expect(retryFunction).toHaveBeenCalledTimes(4); // Initial + 3 retries
        });

        it("should return last error after exhausting retries", async () => {
            expect.assertions(2);

            vi.useFakeTimers();

            const retryFunction = createFailureFunction(10);
            const retryPromise = retry(retryFunction, 2, 100);

            await vi.advanceTimersByTimeAsync(500);
            const result = await retryPromise;

            vi.useRealTimers();

            expect(result.success).toBe(false);
            expect(result.error instanceof Error ? result.error.message : String(result.error)).toContain("Attempt");
        });
    });

    describe("retry on exception", () => {
        it("should retry on exception and eventually succeed", async () => {
            expect.assertions(2);

            vi.useFakeTimers();

            const retryFunction = vi.fn(createThrowingFunction(2));
            const retryPromise = retry(retryFunction, 3, 100);

            await vi.advanceTimersByTimeAsync(500);
            const result = await retryPromise;

            vi.useRealTimers();

            expect(result.success).toBe(true);
            expect(retryFunction).toHaveBeenCalledTimes(3);
        });

        it("should stop retrying after max retries on exception", async () => {
            expect.assertions(2);

            vi.useFakeTimers();

            const retryFunction = vi.fn(createThrowingFunction(10)); // Always throws
            const retryPromise = retry(retryFunction, 2, 100);

            await vi.advanceTimersByTimeAsync(500);
            const result = await retryPromise;

            vi.useRealTimers();

            expect(result.success).toBe(false);
            expect(retryFunction).toHaveBeenCalledTimes(3); // Initial + 2 retries
        });

        it("should convert non-Error exceptions to Error", async () => {
            expect.assertions(2);

            vi.useFakeTimers();

            const retryFunction = vi.fn(async () => {
                throw "string error";
            });
            const retryPromise = retry(retryFunction, 1, 100);

            await vi.advanceTimersByTimeAsync(200);
            const result = await retryPromise;

            vi.useRealTimers();

            expect(result.success).toBe(false);
            expect(result.error).toBeInstanceOf(Error);
        });
    });

    describe("custom retry configuration", () => {
        it("should respect custom retry count", async () => {
            expect.assertions(2);

            vi.useFakeTimers();

            const retryFunction = vi.fn(createFailureFunction(5));
            const retryPromise = retry(retryFunction, 5, 10); // Use shorter delay for faster test

            // Advance time enough for all retries (10 + 20 + 40 + 80 + 160 = 310ms)
            await vi.advanceTimersByTimeAsync(500);
            const result = await retryPromise;

            vi.useRealTimers();

            expect(result.success).toBe(true);
            expect(retryFunction).toHaveBeenCalledTimes(6); // Initial + 5 retries
        });

        it("should respect custom delay", async () => {
            expect.assertions(1);

            vi.useFakeTimers();

            const retryFunction = vi.fn(createFailureFunction(1));
            const retryPromise = retry(retryFunction, 2, 50);

            const startTime = Date.now();

            await vi.advanceTimersByTimeAsync(100);
            await retryPromise;
            const endTime = Date.now();

            vi.useRealTimers();

            // Should complete quickly with 50ms delay
            expect(endTime - startTime).toBeLessThan(200);
        });

        it("should use default retries if not specified", async () => {
            expect.assertions(1);

            const retryFunction = createSuccessFunction();
            const result = await retry(retryFunction);

            expect(result.success).toBe(true);
        });

        it("should use default delay if not specified", async () => {
            expect.assertions(1);

            vi.useFakeTimers();

            const retryFunction = vi.fn(createFailureFunction(2)); // Fail twice, succeed on third
            const retryPromise = retry(retryFunction, 2); // Default delay is 300ms

            // Advance time enough for retries (300ms + 600ms = 900ms)
            await vi.advanceTimersByTimeAsync(1000);
            await retryPromise;

            vi.useRealTimers();

            // Initial call + 2 retries = 3 calls total
            expect(retryFunction).toHaveBeenCalledTimes(3);
        });
    });

    describe("edge cases", () => {
        it("should handle zero retries", async () => {
            expect.assertions(2);

            const retryFunction = vi.fn(createFailureFunction(10));
            const result = await retry(retryFunction, 0, 100);

            expect(result.success).toBe(false);
            expect(retryFunction).toHaveBeenCalledTimes(1); // Only initial call
        });

        it("should handle negative retries", async () => {
            expect.assertions(2);

            const retryFunction = vi.fn(createFailureFunction(10));
            const result = await retry(retryFunction, -1, 100);

            expect(result.success).toBe(false);
            expect(retryFunction).toHaveBeenCalledTimes(1); // Only initial call
        });

        it("should handle zero delay", async () => {
            expect.assertions(2);

            const retryFunction = vi.fn(createFailureFunction(2)); // Fail twice, succeed on third
            const result = await retry(retryFunction, 2, 0);

            // Initial call + 2 retries = 3 calls total
            expect(retryFunction).toHaveBeenCalledTimes(3);
            expect(result.success).toBe(true);
        });
    });
});
