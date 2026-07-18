import { describe, expect, it, vi } from "vitest";

import type { Middleware } from "../src/middleware/types";
import { createNotification } from "../src/notification";
import { mockProvider } from "../src/providers/mock";
import type { Provider } from "../src/providers/provider";

describe(createNotification, () => {
    it("dispatches a multi-channel message to the matching providers", async () => {
        expect.assertions(4);

        const sms = mockProvider({ channel: "sms", id: "sms-mock" });
        const chat = mockProvider({ channel: "chat", id: "chat-mock" });

        const notify = createNotification({ chat, sms });

        const receipts = await notify.send({
            chat: { text: "deploy finished", to: "C123" },
            sms: { text: "your code is 123", to: "+15555550100" },
        });

        expect(receipts).toHaveLength(2);
        expect(receipts.every((r) => r.successful)).toBe(true);
        expect(sms.getInstance?.().sent).toHaveLength(1);
        expect(chat.getInstance?.().sent).toHaveLength(1);
    });

    it("returns a failed receipt when no provider is registered for a channel", async () => {
        expect.assertions(2);

        const notify = createNotification({ sms: mockProvider({ channel: "sms" }) });

        const receipt = await notify.sendToChannel("push", { body: "hi", to: "tok" });

        expect(receipt.successful).toBe(false);
        expect(receipt.successful ? [] : receipt.errorMessages[0]).toContain("No provider registered");
    });

    it("runs middleware in registration order (outermost first)", async () => {
        expect.assertions(2);

        const order: string[] = [];

        const first: Middleware = async (context, next) => {
            order.push("first:in");

            const result = await next(context);

            order.push("first:out");

            return result;
        };

        const second: Middleware = async (context, next) => {
            order.push("second:in");

            const result = await next(context);

            order.push("second:out");

            return result;
        };

        const notify = createNotification({ sms: mockProvider({ channel: "sms" }) })
            .use(first)
            .use(second);

        await notify.sendToChannel("sms", { text: "x", to: "+15555550100" });

        expect(order).toStrictEqual(["first:in", "second:in", "second:out", "first:out"]);
        expect(order[0]).toBe("first:in");
    });

    it("turns a throwing provider into a failed receipt while sibling channels still deliver", async () => {
        expect.assertions(4);

        const sms = mockProvider({ channel: "sms", id: "sms-mock" });
        const throwing: Provider = {
            channel: "webhook",
            id: "boom-webhook",
            initialize: () => {},
            isAvailable: () => true,
            send: () => {
                throw new Error("provider exploded");
            },
        };

        const notify = createNotification({ sms, webhook: throwing });

        const receipts = await notify.send({
            sms: { text: "your code is 123", to: "+15555550100" },
            webhook: { body: {} },
        });

        expect(receipts).toHaveLength(2);
        expect(receipts.find((r) => r.channel === "sms")?.successful).toBe(true);

        const webhookReceipt = receipts.find((r) => r.channel === "webhook");

        expect(webhookReceipt?.successful).toBe(false);
        expect(webhookReceipt?.successful ? [] : webhookReceipt?.errorMessages[0]).toContain("provider exploded");
    });

    it("initializes a provider once under concurrent first sends", async () => {
        expect.assertions(1);

        const provider = mockProvider({ channel: "sms" });
        const initSpy = vi.spyOn(provider, "initialize");

        const notify = createNotification({ sms: provider });

        await Promise.all([
            notify.sendToChannel("sms", { text: "a", to: "+1" }),
            notify.sendToChannel("sms", { text: "b", to: "+1" }),
            notify.sendToChannel("sms", { text: "c", to: "+1" }),
        ]);

        expect(initSpy).toHaveBeenCalledTimes(1);
    });

    it("only initializes a provider once across sends", async () => {
        expect.assertions(1);

        const provider = mockProvider({ channel: "sms" });
        const initSpy = vi.spyOn(provider, "initialize");

        const notify = createNotification({ sms: provider });

        await notify.sendToChannel("sms", { text: "a", to: "+1" });
        await notify.sendToChannel("sms", { text: "b", to: "+1" });

        expect(initSpy).toHaveBeenCalledTimes(1);
    });

    it("sendMany yields receipts for every message", async () => {
        expect.assertions(2);

        const notify = createNotification({ sms: mockProvider({ channel: "sms" }) });

        const messages = [{ sms: { text: "1", to: "+1" } }, { sms: { text: "2", to: "+2" } }, { sms: { text: "3", to: "+3" } }];

        const collected = [];

        for await (const receipts of notify.sendMany(messages, { concurrency: 2 })) {
            collected.push(...receipts);
        }

        expect(collected).toHaveLength(3);
        expect(collected.every((r) => r.successful)).toBe(true);
    });
});
