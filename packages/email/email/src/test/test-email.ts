import type { Mail } from "../mail";
import { createMail } from "../mail";
import mockProvider from "../providers/mock/provider";
import type { MockEmailEntry } from "../providers/mock/types";

/**
 * Polls an inbox until an entry matches the predicate or the timeout elapses.
 * @param inbox The live capture array.
 * @param predicate The match condition.
 * @param timeout Maximum time to wait, in milliseconds.
 * @param interval Poll interval, in milliseconds.
 * @returns The first matching entry.
 */
const pollForMatch = (
    inbox: ReadonlyArray<MockEmailEntry>,
    predicate: (message: MockEmailEntry) => boolean,
    timeout: number,
    interval: number,
): Promise<MockEmailEntry> => {
    const deadline = Date.now() + timeout;

    return new Promise<MockEmailEntry>((resolve, reject) => {
        const check = (): void => {
            const match = inbox.find((entry) => predicate(entry));

            if (match) {
                resolve(match);

                return;
            }

            if (Date.now() >= deadline) {
                reject(new Error("waitFor timed out before a matching message was captured"));

                return;
            }

            setTimeout(check, interval);
        };

        check();
    });
};

/**
 * A test harness around the in-memory mock provider: a ready-to-use {@link Mail} instance plus
 * helpers to inspect, wait on, and reset the captured outbox.
 */
export interface TestEmail {
    /**
     * The {@link Mail} instance wired to the mock provider. Use it exactly like a real one.
     */
    mail: Mail;

    /**
     * Removes all captured messages.
     */
    reset: () => void;

    /**
     * Returns the captured messages, oldest first.
     */
    sent: () => ReadonlyArray<MockEmailEntry>;

    /**
     * Resolves with the first captured message matching `predicate`, polling until `timeout`.
     * @param predicate The match condition.
     * @param options Optional `timeout` (ms, default 1000) and `interval` (ms, default 10).
     * @param options.interval Poll interval in milliseconds.
     * @param options.timeout Maximum time to wait in milliseconds.
     */
    waitFor: (predicate: (message: MockEmailEntry) => boolean, options?: { interval?: number; timeout?: number }) => Promise<MockEmailEntry>;
}

/**
 * Creates a {@link TestEmail} harness backed by the in-memory mock provider.
 *
 * Nothing is sent over the network; every message is captured for assertion via the
 * {@link https://vitest.dev/ Vitest} matchers exported from `@visulima/email/test`.
 * @returns The test harness. See {@link TestEmail}.
 * @example
 * ```ts
 * const email = createTestEmail();
 * await email.mail.send({ from: { email: "a@x.com" }, to: { email: "b@x.com" }, subject: "Hi", text: "yo" });
 * expect(email).toHaveSentTo("b@x.com");
 * ```
 */
export const createTestEmail = (): TestEmail => {
    const provider = mockProvider();
    const mail = createMail(provider);

    // The mock provider exposes its live capture array through the standard `getInstance()` hook.
    const inbox = provider.getInstance?.() ?? [];

    return {
        mail,
        reset: () => {
            inbox.length = 0;
        },
        sent: () => inbox,
        waitFor: (predicate, options = {}) => pollForMatch(inbox, predicate, options.timeout ?? 1000, options.interval ?? 10),
    };
};
