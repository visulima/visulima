import { describe, expect, it, vi } from "vitest";

import { createMail } from "../../src/mail";
import { circuitBreakerMiddleware, composeMiddleware, dedupeMiddleware, RATE_LIMIT_PRESETS, rateLimitMiddleware, retryMiddleware } from "../../src/middleware";
import type { Provider } from "../../src/providers/provider";
import type { EmailOptions, EmailResult, Result } from "../../src/types";

const okResult = (messageId = "m1"): Result<EmailResult> => {
    return {
        data: { messageId, provider: "stub", sent: true, timestamp: new Date(0) },
        success: true,
    };
};

const failResult = (): Result<EmailResult> => {
    return { error: new Error("boom"), success: false };
};

const message: EmailOptions = {
    from: { email: "from@x.com" },
    subject: "Hi",
    text: "body",
    to: { email: "to@x.com" },
};

/**
 * Builds a stub provider whose sendEmail returns successive queued results.
 * @param results Results to return in order (last one repeats).
 */
const stubProvider = (results: Result<EmailResult>[]): { provider: Provider; sendEmail: ReturnType<typeof vi.fn> } => {
    // Repeats the final queued result once exhausted (so a one-element queue always returns that result).
    const sendEmail = vi.fn(() => Promise.resolve(results.length > 1 ? (results.shift() as Result<EmailResult>) : results[0] ?? okResult()));

    const provider: Provider = {
        initialize: () => undefined,
        isAvailable: () => true,
        name: "stub",
        sendEmail,
    };

    return { provider, sendEmail };
};

const noSleep = () => Promise.resolve();

describe("middleware", () => {
    describe(composeMiddleware, () => {
        it("runs middlewares outward-in around the terminal", async () => {
            expect.assertions(1);

            const order: string[] = [];
            const composed = composeMiddleware(
                [
                    async (options, next) => {
                        order.push("a:before");
                        const result = await next(options);

                        order.push("a:after");

                        return result;
                    },
                    async (options, next) => {
                        order.push("b:before");
                        const result = await next(options);

                        order.push("b:after");

                        return result;
                    },
                ],
                () => {
                    order.push("terminal");

                    return Promise.resolve(okResult());
                },
            );

            await composed(message);

            expect(order).toStrictEqual(["a:before", "b:before", "terminal", "b:after", "a:after"]);
        });
    });

    describe(retryMiddleware, () => {
        it("retries until success", async () => {
            expect.assertions(2);

            const { sendEmail } = stubProvider([failResult(), failResult(), okResult("retried")]);
            const composed = composeMiddleware([retryMiddleware({ retries: 3, sleep: noSleep })], sendEmail);

            const result = await composed(message);

            expect(result.success).toBe(true);
            expect(sendEmail).toHaveBeenCalledTimes(3);
        });

        it("dead-letters after exhausting retries", async () => {
            expect.assertions(2);

            const onDeadLetter = vi.fn();
            const { sendEmail } = stubProvider([failResult(), failResult()]);
            const composed = composeMiddleware([retryMiddleware({ onDeadLetter, retries: 2, sleep: noSleep })], sendEmail);

            const result = await composed(message);

            expect(result.success).toBe(false);
            expect(onDeadLetter).toHaveBeenCalledTimes(1);
        });

        it("surfaces the final failed result after exhausting every attempt", async () => {
            expect.assertions(2);

            const { sendEmail } = stubProvider([failResult()]); // always fails
            const composed = composeMiddleware([retryMiddleware({ retries: 3, sleep: noSleep })], sendEmail);

            const result = await composed(message);

            expect(result.success).toBe(false);
            expect(sendEmail).toHaveBeenCalledTimes(3);
        });

        it("grows the full-jitter backoff ceiling exponentially per attempt", async () => {
            expect.assertions(3);

            // Pin Math.random to its upper-ish bound so the delay reflects the ceiling baseDelay * 2 ** attempt.
            const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.99);
            const delays: number[] = [];
            const sleep = vi.fn((ms: number) => {
                delays.push(ms);

                return Promise.resolve();
            });
            const { sendEmail } = stubProvider([failResult()]); // always fails → uses all retries
            const composed = composeMiddleware([retryMiddleware({ baseDelay: 100, retries: 3, sleep })], sendEmail);

            await composed(message);

            randomSpy.mockRestore();

            // Two sleeps (between the 3 attempts); ceilings are 100 * 2**0 and 100 * 2**1.
            expect(delays).toHaveLength(2);
            expect(delays[0]).toBeLessThan(100);
            // Second backoff ceiling is double the first, so its jittered delay exceeds the first ceiling.
            expect(delays[1]).toBeGreaterThanOrEqual(100);
        });

        it("does not retry a failure rejected by shouldRetry", async () => {
            expect.assertions(2);

            const { sendEmail } = stubProvider([failResult()]);
            const composed = composeMiddleware([retryMiddleware({ retries: 5, shouldRetry: () => false, sleep: noSleep })], sendEmail);

            const result = await composed(message);

            expect(result.success).toBe(false);
            // shouldRetry → false short-circuits after the first attempt.
            expect(sendEmail).toHaveBeenCalledTimes(1);
        });
    });

    describe(circuitBreakerMiddleware, () => {
        it("opens after the failure threshold and then fails fast", async () => {
            expect.assertions(2);

            const { sendEmail } = stubProvider([failResult()]);
            const composed = composeMiddleware([circuitBreakerMiddleware({ failureThreshold: 2 })], sendEmail);

            await composed(message);
            await composed(message);
            const third = await composed(message);

            // Third call short-circuits without invoking the provider again.
            expect(sendEmail).toHaveBeenCalledTimes(2);
            expect((third.error as Error).message).toContain("Circuit breaker is open");
        });

        it("admits only one concurrent probe while half-open", async () => {
            expect.assertions(3);

            let clock = 0;
            let releaseProbe: (value: Result<EmailResult>) => void = () => undefined;
            const probe = new Promise<Result<EmailResult>>((resolve) => {
                releaseProbe = resolve;
            });

            const sendEmail = vi
                .fn<() => Promise<Result<EmailResult>>>()
                .mockResolvedValueOnce(failResult()) // opens the breaker
                .mockReturnValueOnce(probe) // the single half-open probe (stays pending)
                .mockResolvedValue(okResult());

            const composed = composeMiddleware([circuitBreakerMiddleware({ failureThreshold: 1, now: () => clock, resetTimeout: 1000 })], sendEmail);

            await composed(message); // trips the breaker open
            clock = 2000; // past the reset window → next request becomes the probe

            const probing = composed(message); // becomes the in-flight probe
            const blocked = await composed(message); // must fail fast, not reach the provider

            expect((blocked.error as Error).message).toContain("Circuit breaker is open");
            expect(sendEmail).toHaveBeenCalledTimes(2); // open call + probe only

            // The Promise executor reassigns releaseProbe to the real one-arg resolver.
            // eslint-disable-next-line sonarjs/no-extra-arguments
            releaseProbe(okResult());
            const probed = await probing;

            expect(probed.success).toBe(true);
        });

        it("half-opens after the reset timeout and closes again on a successful probe", async () => {
            expect.assertions(4);

            let clock = 0;
            const states: string[] = [];
            const { sendEmail } = stubProvider([failResult()]);
            const composed = composeMiddleware(
                [
                    circuitBreakerMiddleware({
                        failureThreshold: 1,
                        now: () => clock,
                        onStateChange: (state) => states.push(state),
                        resetTimeout: 1000,
                    }),
                ],
                sendEmail,
            );

            await composed(message); // single failure trips the breaker open

            clock = 500; // still inside the cooldown → fails fast
            const blocked = await composed(message);

            expect((blocked.error as Error).message).toContain("Circuit breaker is open");

            clock = 1500; // cooldown elapsed → half-open probe is admitted
            sendEmail.mockResolvedValue(okResult("recovered"));
            const probed = await composed(message);

            expect(probed.data?.messageId).toBe("recovered");
            // open call + the half-open probe; the blocked call never reached the provider.
            expect(sendEmail).toHaveBeenCalledTimes(2);
            // A successful probe closes the circuit again.
            expect(states).toStrictEqual(["open", "half-open", "closed"]);
        });

        it("re-opens when the half-open probe fails", async () => {
            expect.assertions(2);

            let clock = 0;
            const states: string[] = [];
            const { sendEmail } = stubProvider([failResult()]);
            const composed = composeMiddleware(
                [
                    circuitBreakerMiddleware({
                        failureThreshold: 1,
                        now: () => clock,
                        onStateChange: (state) => states.push(state),
                        resetTimeout: 1000,
                    }),
                ],
                sendEmail,
            );

            await composed(message); // trips open

            clock = 1500; // half-open window
            const probed = await composed(message); // probe also fails → re-open

            expect(probed.success).toBe(false);
            expect(states).toStrictEqual(["open", "half-open", "open"]);
        });
    });

    describe(dedupeMiddleware, () => {
        it("suppresses a duplicate send within the TTL", async () => {
            expect.assertions(2);

            const { sendEmail } = stubProvider([okResult("first")]);
            const composed = composeMiddleware([dedupeMiddleware({ ttl: 10_000 })], sendEmail);

            const first = await composed(message);
            const second = await composed(message);

            expect(sendEmail).toHaveBeenCalledTimes(1);
            expect(second.data?.messageId).toBe(first.data?.messageId);
        });

        it("does not dedupe messages with differing content", async () => {
            expect.assertions(1);

            const { sendEmail } = stubProvider([okResult("a"), okResult("b")]);
            const composed = composeMiddleware([dedupeMiddleware({ ttl: 10_000 })], sendEmail);

            await composed(message);
            await composed({ ...message, subject: "Different subject" });

            expect(sendEmail).toHaveBeenCalledTimes(2);
        });

        it("re-sends once the dedupe TTL has elapsed", async () => {
            expect.assertions(1);

            let clock = 0;
            const { sendEmail } = stubProvider([okResult("a"), okResult("b")]);
            const composed = composeMiddleware([dedupeMiddleware({ now: () => clock, ttl: 1000 })], sendEmail);

            await composed(message);
            clock = 2000; // past the TTL window
            await composed(message);

            expect(sendEmail).toHaveBeenCalledTimes(2);
        });

        it("does not cache a failed send (a retry of the same message is allowed)", async () => {
            expect.assertions(1);

            const { sendEmail } = stubProvider([failResult(), okResult("b")]);
            const composed = composeMiddleware([dedupeMiddleware({ ttl: 10_000 })], sendEmail);

            await composed(message); // fails → not cached
            await composed(message); // identical message is sent again

            expect(sendEmail).toHaveBeenCalledTimes(2);
        });
    });

    describe(rateLimitMiddleware, () => {
        it("waits for a token when the burst is exhausted", async () => {
            expect.assertions(2);

            let clock = 0;
            // The fake sleep advances the injected clock, mirroring how real time refills the bucket.
            const sleep = vi.fn((ms: number) => {
                clock += ms;

                return Promise.resolve();
            });
            const { sendEmail } = stubProvider([okResult(), okResult()]);
            const composed = composeMiddleware([rateLimitMiddleware({ burst: 1, now: () => clock, rate: 1, sleep })], sendEmail);

            await composed(message); // consumes the single burst token
            await composed(message); // must wait for the bucket to refill

            expect(sendEmail).toHaveBeenCalledTimes(2);
            // The bucket needed a full second of refill (rate 1/s) before the second send.
            expect(sleep).toHaveBeenCalledWith(1000);
        });

        it("does not wait once the bucket has refilled (window reset)", async () => {
            expect.assertions(2);

            let clock = 0;
            const sleep = vi.fn(() => Promise.resolve());
            const { sendEmail } = stubProvider([okResult(), okResult()]);
            const composed = composeMiddleware([rateLimitMiddleware({ burst: 1, now: () => clock, rate: 1, sleep })], sendEmail);

            await composed(message); // consumes the burst token
            clock = 2000; // two seconds pass → the bucket has fully refilled
            await composed(message); // a token is available immediately, no sleep

            expect(sendEmail).toHaveBeenCalledTimes(2);
            expect(sleep).not.toHaveBeenCalled();
        });

        it("paces sends end-to-end with a RATE_LIMIT_PRESETS entry", async () => {
            expect.assertions(2);

            let clock = 0;
            const sleep = vi.fn((ms: number) => {
                clock += ms;

                return Promise.resolve();
            });
            const { sendEmail } = stubProvider([okResult(), okResult()]);
            // resend's preset is 10/s with a burst of 1 → the second send waits ~100ms for a token.
            const composed = composeMiddleware([rateLimitMiddleware({ burst: 1, now: () => clock, rate: RATE_LIMIT_PRESETS.resend, sleep })], sendEmail);

            await composed(message);
            await composed(message);

            expect(sendEmail).toHaveBeenCalledTimes(2);
            expect(sleep).toHaveBeenCalledWith(100);
        });
    });

    describe("mail.use integration", () => {
        it("routes sends through registered middleware", async () => {
            expect.assertions(2);

            const { provider, sendEmail } = stubProvider([failResult(), okResult("via-mail")]);
            const mail = createMail(provider).use(retryMiddleware({ retries: 2, sleep: noSleep }));

            const result = await mail.send(message);

            expect(result.data?.messageId).toBe("via-mail");
            expect(sendEmail).toHaveBeenCalledTimes(2);
        });
    });
});
