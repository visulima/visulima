import { afterEach, describe, expect, it, vi } from "vitest";

import cloudflareEmailProvider from "../../src/providers/cloudflare-email/provider";
import loopsProvider from "../../src/providers/loops/provider";
import mailchannelsProvider from "../../src/providers/mailchannels/provider";
import type { EmailOptions } from "../../src/types";

const message: EmailOptions = {
    from: { email: "from@example.com", name: "Sender" },
    html: "<p>Hi</p>",
    subject: "Hello",
    text: "Hi",
    to: { email: "to@example.com" },
};

const jsonResponse = (body: unknown, status = 200): Response => Response.json(body, { status });

describe("new providers", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe(mailchannelsProvider, () => {
        it("posts a SendGrid-shaped payload and returns the message id", async () => {
            expect.assertions(4);

            const fetchMock = vi.fn(() => Promise.resolve(jsonResponse({ message_id: "mc-1" }, 202)));

            vi.stubGlobal("fetch", fetchMock);

            const result = await mailchannelsProvider({ apiKey: "k", retries: 0 }).sendEmail(message);

            expect(result.success).toBe(true);
            expect(result.data?.messageId).toBe("mc-1");

            const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
            const payload = JSON.parse(init.body as string) as { content: unknown[]; personalizations: { to: unknown[] }[] };

            expect(url).toContain("mailchannels.net");
            expect(payload.personalizations[0]?.to).toStrictEqual([{ email: "to@example.com" }]);
        });
    });

    describe(loopsProvider, () => {
        it("requires a transactionalId", async () => {
            expect.assertions(1);

            const result = await loopsProvider({ apiKey: "k", retries: 0 }).sendEmail(message);

            expect((result.error as Error).message).toContain("transactionalId");
        });

        it("sends a transactional payload with dataVariables", async () => {
            expect.assertions(2);

            const fetchMock = vi.fn(() => Promise.resolve(jsonResponse({ success: true })));

            vi.stubGlobal("fetch", fetchMock);

            const result = await loopsProvider({ apiKey: "k", retries: 0 }).sendEmail({
                ...message,
                dataVariables: { name: "Ada" },
                transactionalId: "tmpl-1",
            });

            expect(result.success).toBe(true);

            const payload = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string) as Record<string, unknown>;

            expect(payload).toMatchObject({ dataVariables: { name: "Ada" }, email: "to@example.com", transactionalId: "tmpl-1" });
        });
    });

    describe(cloudflareEmailProvider, () => {
        it("builds a raw MIME message and calls the injected send binding", async () => {
            expect.assertions(3);

            const send = vi.fn(() => Promise.resolve());
            const result = await cloudflareEmailProvider({ send }).sendEmail(message);

            expect(result.success).toBe(true);

            const [from, to, raw] = send.mock.calls[0] as [string, string, string];

            expect([from, to]).toStrictEqual(["from@example.com", "to@example.com"]);
            expect(raw).toContain("Subject:");
        });
    });
});
