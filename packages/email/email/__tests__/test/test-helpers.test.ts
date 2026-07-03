import { beforeAll, describe, expect, it } from "vitest";

import { createTestEmail, emailMatchers, registerEmailMatchers } from "../../src/test";
import type { EmailOptions } from "../../src/types";

declare module "vitest" {
    interface Assertion<T = unknown> {
        toHaveSentMatching: (matcher: Partial<EmailOptions> | ((options: EmailOptions) => boolean)) => T;
        toHaveSentTo: (address: string) => T;
        toHaveSentWithAttachment: (filename?: string) => T;
        toHaveSentWithSubject: (expected: RegExp | string) => T;
    }
}

const INVOICE_SUBJECT_PATTERN = /invoice/i;

const sampleMessage = (overrides: Record<string, unknown> = {}) => {
    return {
        from: { email: "sender@example.com" },
        subject: "Welcome",
        text: "Hello there",
        to: { email: "user@example.com" },
        ...overrides,
    };
};

describe("test helpers", () => {
    beforeAll(() => {
        registerEmailMatchers(expect);
    });

    it("captures sent messages without hitting the network", async () => {
        expect.assertions(2);

        const email = createTestEmail();

        await email.mail.send(sampleMessage());

        expect(email.sent()).toHaveLength(1);
        expect(email.sent()[0]?.options.subject).toBe("Welcome");
    });

    it("resets the captured outbox", async () => {
        expect.assertions(1);

        const email = createTestEmail();

        await email.mail.send(sampleMessage());
        email.reset();

        expect(email.sent()).toHaveLength(0);
    });

    it("waitFor resolves with a matching message", async () => {
        expect.assertions(1);

        const email = createTestEmail();

        await email.mail.send(sampleMessage({ subject: "Receipt" }));

        const match = await email.waitFor((entry) => entry.options.subject === "Receipt");

        expect(match.options.subject).toBe("Receipt");
    });

    describe("matchers", () => {
        it("toHaveSentTo / WithSubject / WithAttachment / Matching", async () => {
            expect.assertions(4);

            const email = createTestEmail();

            await email.mail.send(
                sampleMessage({
                    attachments: [{ content: "x", filename: "invoice.pdf" }],
                    subject: "Your invoice",
                }),
            );

            expect(email).toHaveSentTo("user@example.com");
            expect(email).toHaveSentWithSubject(INVOICE_SUBJECT_PATTERN);
            expect(email).toHaveSentWithAttachment("invoice.pdf");
            expect(email).toHaveSentMatching((options) => options.from.email === "sender@example.com");
        });

        it("returns a failing result for a non-match", () => {
            expect.assertions(1);

            const result = emailMatchers.toHaveSentTo([], "nobody@example.com");

            expect(result.pass).toBe(false);
        });
    });
});
