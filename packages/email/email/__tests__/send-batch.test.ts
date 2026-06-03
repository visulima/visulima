import { describe, expect, it } from "vitest";

import { createMail } from "../src/mail";
import mockProvider from "../src/providers/mock/provider";
import type { MockEmailEntry } from "../src/providers/mock/types";
import type { Receipt } from "../src/types";

const collect = async (iterable: AsyncIterable<Receipt>): Promise<Receipt[]> => {
    const out: Receipt[] = [];

    for await (const receipt of iterable) {
        out.push(receipt);
    }

    return out;
};

describe("mail.sendBatch", () => {
    it("sends one message per personalization, overriding recipients", async () => {
        expect.assertions(3);

        const provider = mockProvider();
        const inbox = provider.getInstance?.() as MockEmailEntry[];
        const mail = createMail(provider);

        const receipts = await collect(
            mail.sendBatch({ from: { email: "a@x.com" }, subject: "Hello", text: "hi" }, [
                { to: { email: "b@x.com" } },
                { subject: "Custom", to: { email: "c@x.com" } },
            ]),
        );

        const firstRecipient = (entry: MockEmailEntry): string | undefined => {
            const { to } = entry.options;

            if (Array.isArray(to)) {
                return to[0]?.email;
            }

            return to.email;
        };
        const recipients = inbox.map((entry) => firstRecipient(entry));

        expect(receipts.every((receipt) => receipt.successful)).toBe(true);
        expect(recipients).toStrictEqual(["b@x.com", "c@x.com"]);
        expect(inbox[1]?.options.subject).toBe("Custom");
    });

    it("renders subject/html/text per recipient via the renderer", async () => {
        expect.assertions(2);

        const provider = mockProvider();
        const inbox = provider.getInstance?.() as MockEmailEntry[];
        const mail = createMail(provider);

        const render = (template: string, data: Record<string, unknown>): string => template.replaceAll("{{name}}", String(data.name));

        await collect(
            mail.sendBatch(
                { from: { email: "a@x.com" }, html: "<p>Hi {{name}}</p>", subject: "Hi {{name}}", text: "Hi {{name}}" },
                [{ data: { name: "Bob" }, to: { email: "bob@x.com" } }],
                { render },
            ),
        );

        expect(inbox[0]?.options.subject).toBe("Hi Bob");
        expect(inbox[0]?.options.html).toBe("<p>Hi Bob</p>");
    });

    it("stops early when the abort signal is already aborted", async () => {
        expect.assertions(1);

        const provider = mockProvider();
        const mail = createMail(provider);
        const controller = new AbortController();

        controller.abort();

        const receipts = await collect(
            mail.sendBatch({ from: { email: "a@x.com" }, subject: "Hi", text: "hi" }, [{ to: { email: "b@x.com" } }], { signal: controller.signal }),
        );

        expect(receipts[0]?.successful).toBe(false);
    });
});
