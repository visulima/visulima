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

const makeStorageWith = (extra: Partial<typeof storageOptions>): TestStorage => new TestStorage({ ...storageOptions, ...extra });

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

        it("constructs a fresh timeout signal for each retry attempt", async () => {
            expect.assertions(4);

            const storage = makeStorage();
            const seen: (AbortSignal | undefined)[] = [];
            const function_ = vi
                .fn<(signal: AbortSignal | undefined) => Promise<string>>()
                .mockImplementationOnce(async (signal) => {
                    seen.push(signal);

                    throw econnreset();
                })
                .mockImplementationOnce(async (signal) => {
                    seen.push(signal);

                    throw econnreset();
                })
                .mockImplementationOnce(async (signal) => {
                    seen.push(signal);

                    return "ok";
                });

            await expect(storage.run({ retries: { initialDelay: 0, maxRetries: 3 }, timeout: 10_000 }, function_)).resolves.toBe("ok");

            expect(seen).toHaveLength(3);
            expect(new Set(seen).size).toBe(3);
            expect(seen.every((signal) => signal instanceof AbortSignal)).toBe(true);
        });

        it("gives each attempt the full timeout budget instead of a shared deadline", async () => {
            expect.assertions(2);

            const storage = makeStorage();

            const sleepThenCheck = async (signal: AbortSignal | undefined, ms: number): Promise<void> => {
                await new Promise((resolve) => {
                    setTimeout(resolve, ms);
                });

                if (signal?.aborted) {
                    throw signal.reason;
                }
            };

            // Each attempt runs 30ms under a 50ms per-attempt timeout. The
            // cumulative wall time (~60ms + backoff) exceeds 50ms, so the
            // pre-fix shared `AbortSignal.timeout(50)` would abort attempt 2.
            const function_ = vi
                .fn<(signal: AbortSignal | undefined) => Promise<string>>()
                .mockImplementationOnce(async (signal) => {
                    await sleepThenCheck(signal, 30);

                    throw econnreset();
                })
                .mockImplementationOnce(async (signal) => {
                    await sleepThenCheck(signal, 30);

                    return "ok";
                });

            await expect(storage.run({ retries: { initialDelay: 0, maxRetries: 3 }, timeout: 50 }, function_)).resolves.toBe("ok");

            expect(function_).toHaveBeenCalledTimes(2);
        });
    });

    describe("instance-level defaults", () => {
        it("applies the instance default timeout when the call omits one", async () => {
            expect.assertions(1);

            const storage = makeStorageWith({ defaultTimeout: 5 });

            await expect(
                storage.run(undefined, async (signal) => {
                    await new Promise((resolve) => {
                        setTimeout(resolve, 50);
                    });

                    if (signal?.aborted) {
                        throw signal.reason;
                    }
                }),
            ).rejects.toThrow();
        });

        it("lets a per-call timeout override the instance default", async () => {
            expect.assertions(1);

            const storage = makeStorageWith({ defaultTimeout: 5 });

            await expect(
                storage.run({ timeout: 10_000 }, async (signal) => {
                    await new Promise((resolve) => {
                        setTimeout(resolve, 20);
                    });

                    if (signal?.aborted) {
                        throw signal.reason;
                    }

                    return "ok";
                }),
            ).resolves.toBe("ok");
        });

        it("lets a per-call timeout of 0 disable the instance default", async () => {
            expect.assertions(1);

            const storage = makeStorageWith({ defaultTimeout: 5 });

            await expect(
                storage.run({ timeout: 0 }, async (signal) => {
                    await new Promise((resolve) => {
                        setTimeout(resolve, 20);
                    });

                    if (signal?.aborted) {
                        throw signal.reason;
                    }

                    return "ok";
                }),
            ).resolves.toBe("ok");
        });

        it("merges the instance default signal so it can abort the operation", async () => {
            expect.assertions(2);

            const controller = new AbortController();

            controller.abort();

            const storage = makeStorageWith({ defaultSignal: controller.signal });
            const function_ = vi.fn(async () => "ok");

            try {
                await storage.run(undefined, function_);

                expect.fail("should have thrown");
            } catch (error) {
                expect((error as Error).name).toBe("AbortError");
            }

            expect(function_).not.toHaveBeenCalled();
        });

        it("combines the instance default signal with a per-call signal — either aborts", async () => {
            expect.assertions(2);

            const instanceController = new AbortController();
            const storage = makeStorageWith({ defaultSignal: instanceController.signal });

            storage.setRetryConfig({ initialDelay: 0, maxRetries: 5, shouldRetry: () => true });

            const callController = new AbortController();
            const function_ = vi.fn(async () => {
                if (function_.mock.calls.length === 1) {
                    callController.abort();
                }

                throw econnreset();
            });

            await expect(storage.run({ signal: callController.signal }, function_)).rejects.toThrow();

            expect(function_).toHaveBeenCalledTimes(1);
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
