import { describe, expect, it, vi } from "vitest";

import { defineInboundHandler, parseInbound } from "../../src/inbound/handler";

describe("inbound handler", () => {
    describe(parseInbound, () => {
        it("dispatches to the matching provider parser", () => {
            expect.assertions(2);

            const postmark = parseInbound("postmark", { FromFull: { Email: "a@x.com" }, Subject: "Hi", ToFull: [{ Email: "b@x.com" }] });

            expect(postmark.provider).toBe("postmark");

            const mailgun = parseInbound("mailgun", { from: "Sender <a@x.com>", recipient: "b@x.com", subject: "Hi" });

            expect(mailgun.provider).toBe("mailgun");
        });
    });

    describe(defineInboundHandler, () => {
        it("parses, strips the reply quote, and dispatches to onMessage", async () => {
            expect.assertions(2);

            const onMessage = vi.fn();
            const handler = defineInboundHandler({ onMessage, stripReply: true });

            const email = await handler.handle("sendgrid", {
                from: "Sender <a@x.com>",
                subject: "Re: Hi",
                text: "My reply.\n\nOn Mon, Jan 1, 2024, Bob <b@x.com> wrote:\n> original",
                to: "b@x.com",
            });

            expect(email?.text).toBe("My reply.");
            expect(onMessage).toHaveBeenCalledTimes(1);
        });

        it("routes errors to onError instead of throwing", async () => {
            expect.assertions(2);

            const onError = vi.fn();
            const handler = defineInboundHandler({
                onError,
                onMessage: () => {
                    throw new Error("boom");
                },
            });

            const result = await handler.handle("postmark", { FromFull: { Email: "a@x.com" }, Subject: "Hi", ToFull: [{ Email: "b@x.com" }] });

            expect(result).toBeUndefined();
            expect(onError).toHaveBeenCalledTimes(1);
        });
    });
});
