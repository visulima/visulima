import { describe, expect, it } from "vitest";

import { createMail } from "../src/mail";
import type { Provider } from "../src/providers/provider";
import type { EmailOptions, EmailResult, Result } from "../src/types";

const delay = (ms: number): Promise<void> =>
    new Promise((resolve) => {
        setTimeout(resolve, ms);
    });

/**
 * Provider that tracks the maximum number of concurrent in-flight sends and
 * delays each send so overlap is observable.
 */
const createTrackingProvider = (sendDelay: number): { maxInFlight: () => number; provider: Provider } => {
    let inFlight = 0;
    let maxInFlight = 0;

    const provider: Provider = {
        features: {},
        async initialize(): Promise<void> {
            // noop
        },
        async isAvailable(): Promise<boolean> {
            await Promise.resolve();

            return true;
        },
        name: "tracking",
        options: {},
        async sendEmail(options: EmailOptions): Promise<Result<EmailResult>> {
            inFlight += 1;
            maxInFlight = Math.max(maxInFlight, inFlight);

            await delay(sendDelay);

            inFlight -= 1;

            return {
                data: {
                    messageId: `id-${(Array.isArray(options.to) ? options.to[0]?.email : options.to.email) ?? "?"}`,
                    provider: "tracking",
                    sent: true,
                    timestamp: new Date(),
                },
                success: true,
            };
        },
    };

    return { maxInFlight: () => maxInFlight, provider };
};

const makeMessages = (count: number): EmailOptions[] =>
    Array.from({ length: count }, (_, index) => {
        return {
            from: { email: "a@example.com" },
            subject: "x",
            text: "hi",
            to: { email: `r${String(index)}@example.com` },
        };
    });

describe("sendMany concurrency", () => {
    it("should send serially by default (max 1 in flight)", async () => {
        expect.assertions(2);

        const { maxInFlight, provider } = createTrackingProvider(5);
        const mail = createMail(provider);

        const receipts = [];

        for await (const receipt of mail.sendMany(makeMessages(4))) {
            receipts.push(receipt);
        }

        expect(receipts).toHaveLength(4);
        expect(maxInFlight()).toBe(1);
    });

    it("should run up to `concurrency` sends in parallel", async () => {
        expect.assertions(2);

        const { maxInFlight, provider } = createTrackingProvider(10);
        const mail = createMail(provider);

        const receipts = [];

        for await (const receipt of mail.sendMany(makeMessages(6), { concurrency: 3 })) {
            receipts.push(receipt);
        }

        expect(receipts).toHaveLength(6);
        expect(maxInFlight()).toBeGreaterThan(1);
    });

    it("should yield all receipts even out of input order with concurrency", async () => {
        expect.assertions(1);

        const { provider } = createTrackingProvider(2);
        const mail = createMail(provider);

        const successful = [];

        for await (const receipt of mail.sendMany(makeMessages(5), { concurrency: 5 })) {
            if (receipt.successful) {
                successful.push(receipt.messageId);
            }
        }

        expect(successful).toHaveLength(5);
    });
});
