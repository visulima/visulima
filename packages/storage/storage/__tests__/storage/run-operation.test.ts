import { describe, expect, it, vi } from "vitest";

import { BaseStorage } from "../../src/storage/storage";
import type { OperationOptions } from "../../src/storage/types";
import type { File } from "../../src/storage/utils/file";
import type { RetryConfig } from "../../src/utils/retry";
import { storageOptions } from "../__helpers__/config";

/**
 * Minimal concrete `BaseStorage` whose only purpose is to exercise the
 * protected `runOperation` plumbing in isolation. The abstract surface is
 * stubbed — none of these tests touch metadata, get/create/write/etc.
 */
class TestStorage extends BaseStorage {
    protected meta = {} as never;

    private retryConfig: RetryConfig | undefined;

    public setRetryConfig(config: RetryConfig | undefined): void {
        this.retryConfig = config;
    }

    public run<T>(
        options: OperationOptions | undefined,
        function_: (signal: AbortSignal | undefined) => Promise<T>,
        operationConfig?: { replayable?: boolean },
    ): Promise<T> {
        return this.runOperation(options, function_, operationConfig);
    }

    protected override getRetryConfig(): RetryConfig | undefined {
        return this.retryConfig;
    }

    // eslint-disable-next-line class-methods-use-this
    public async get(): Promise<never> {
        throw new Error("not implemented");
    }

    // eslint-disable-next-line class-methods-use-this
    public async create(): Promise<File> {
        throw new Error("not implemented");
    }

    // eslint-disable-next-line class-methods-use-this
    public async write(): Promise<File> {
        throw new Error("not implemented");
    }

    // eslint-disable-next-line class-methods-use-this
    public async delete(): Promise<File> {
        throw new Error("not implemented");
    }

    // eslint-disable-next-line class-methods-use-this
    public async copy(): Promise<File> {
        throw new Error("not implemented");
    }

    // eslint-disable-next-line class-methods-use-this
    public async move(): Promise<File> {
        throw new Error("not implemented");
    }
}

const makeStorage = (): TestStorage => new TestStorage(storageOptions);

const econnreset = (): Error => {
    const error = new Error("connection reset");

    (error as { code?: string }).code = "ECONNRESET";

    return error;
};

describe("baseStorage.runOperation", () => {
    describe("signal / timeout merge", () => {
        it("passes no signal through when neither signal nor timeout is given", async () => {
            expect.assertions(1);

            const storage = makeStorage();
            let captured: AbortSignal | undefined = {} as AbortSignal;

            await storage.run(undefined, async (signal) => {
                captured = signal;
            });

            expect(captured).toBeUndefined();
        });

        it("passes the caller signal through unchanged when only a signal is given", async () => {
            expect.assertions(1);

            const storage = makeStorage();
            const controller = new AbortController();
            let captured: AbortSignal | undefined;

            await storage.run({ signal: controller.signal }, async (signal) => {
                captured = signal;
            });

            expect(captured).toBe(controller.signal);
        });

        it("merges signal and timeout into a fresh AbortSignal.any signal", async () => {
            expect.assertions(3);

            const storage = makeStorage();
            const controller = new AbortController();
            let captured: AbortSignal | undefined;

            await storage.run({ signal: controller.signal, timeout: 10_000 }, async (signal) => {
                captured = signal;

                expect(signal).toBeInstanceOf(AbortSignal);
                expect(signal).not.toBe(controller.signal);
            });

            controller.abort();

            expect(captured?.aborted).toBe(true);
        });

        it("aborts the operation when the per-call timeout elapses", async () => {
            expect.assertions(1);

            const storage = makeStorage();

            await expect(
                storage.run({ timeout: 5 }, async (signal) => {
                    await new Promise((resolve) => {
                        setTimeout(resolve, 50);
                    });

                    if (signal?.aborted) {
                        throw signal.reason;
                    }
                }),
            ).rejects.toThrow();
        });
    });

    describe("abort handling", () => {
        it("throws a non-retryable AbortError without invoking the function when already aborted", async () => {
            expect.assertions(2);

            const storage = makeStorage();
            const controller = new AbortController();

            controller.abort();

            const function_ = vi.fn(async () => "ok");

            try {
                await storage.run({ signal: controller.signal }, function_);

                expect.fail("should have thrown");
            } catch (error) {
                expect((error as Error).name).toBe("AbortError");
            }

            expect(function_).not.toHaveBeenCalled();
        });

        it("normalizes a post-abort SDK error to a non-retryable AbortError", async () => {
            expect.assertions(2);

            const storage = makeStorage();

            storage.setRetryConfig({ initialDelay: 0, maxRetries: 5, shouldRetry: () => true });

            const controller = new AbortController();
            const function_ = vi.fn(async () => {
                controller.abort();

                throw econnreset();
            });

            try {
                await storage.run({ signal: controller.signal }, function_);

                expect.fail("should have thrown");
            } catch (error) {
                expect((error as Error).name).toBe("AbortError");
            }

            expect(function_).toHaveBeenCalledTimes(1);
        });

        it("does not retry a retryable error once the signal is aborted", async () => {
            expect.assertions(2);

            const storage = makeStorage();

            storage.setRetryConfig({ initialDelay: 0, maxRetries: 5, shouldRetry: () => true });

            const controller = new AbortController();
            const function_ = vi.fn(async () => {
                if (function_.mock.calls.length === 1) {
                    controller.abort();
                }

                throw econnreset();
            });

            await expect(storage.run({ signal: controller.signal }, function_)).rejects.toThrow();

            expect(function_).toHaveBeenCalledTimes(1);
        });
    });

    describe("retry override layering", () => {
        it("treats a numeric retries override as maxRetries on top of getRetryConfig", async () => {
            expect.assertions(2);

            const storage = makeStorage();

            storage.setRetryConfig({ initialDelay: 0, maxRetries: 5, shouldRetry: () => true });

            const function_ = vi.fn(async () => {
                throw econnreset();
            });

            await expect(storage.run({ retries: 1 }, function_)).rejects.toThrow();

            expect(function_).toHaveBeenCalledTimes(2);
        });

        it("shallow-merges an object retries override over getRetryConfig", async () => {
            expect.assertions(2);

            const storage = makeStorage();

            storage.setRetryConfig({ initialDelay: 0, maxRetries: 5, shouldRetry: () => true });

            const function_ = vi.fn(async () => {
                throw econnreset();
            });

            await expect(storage.run({ retries: { maxRetries: 0 } }, function_)).rejects.toThrow();

            expect(function_).toHaveBeenCalledTimes(1);
        });

        it("retries a retryable error up to the configured maxRetries", async () => {
            expect.assertions(2);

            const storage = makeStorage();
            const function_ = vi
                .fn<() => Promise<string>>()
                .mockRejectedValueOnce(econnreset())
                .mockRejectedValueOnce(econnreset())
                .mockResolvedValueOnce("ok");

            await expect(storage.run({ retries: { initialDelay: 0, maxRetries: 3 } }, function_)).resolves.toBe("ok");

            expect(function_).toHaveBeenCalledTimes(3);
        });
    });

    describe("non-replayable stream guard", () => {
        it("forces maxRetries to zero for a non-replayable body even with a retryable error", async () => {
            expect.assertions(2);

            const storage = makeStorage();

            storage.setRetryConfig({ initialDelay: 0, maxRetries: 5, shouldRetry: () => true });

            const function_ = vi.fn(async () => {
                throw econnreset();
            });

            await expect(storage.run({ retries: 5 }, function_, { replayable: false })).rejects.toThrow();

            expect(function_).toHaveBeenCalledTimes(1);
        });
    });
});
