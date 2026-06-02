import { describe, expect, it, vi } from "vitest";

import { createMail } from "../../src/mail";
import {
    circuitBreakerMiddleware,
    composeMiddleware,
    dedupeMiddleware,
    rateLimitMiddleware,
    retryMiddleware,
} from "../../src/middleware";
import type { Provider } from "../../src/providers/provider";
import type { EmailOptions, EmailResult, Result } from "../../src/types";

const okResult = (messageId = "m1"): Result<EmailResult> => ({
    data: { messageId, provider: "stub", sent: true, timestamp: new Date(0) },
    success: true,
});

const failResult = (): Result<EmailResult> => ({ error: new Error("boom"), success: false });

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
            expect(sleep).toHaveBeenCalled();
        });
    });

    describe("Mail.use integration", () => {
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
