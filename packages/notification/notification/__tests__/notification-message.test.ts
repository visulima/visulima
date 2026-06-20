import { describe, expect, it } from "vitest";

import { createNotification } from "../src/notification";
import { createNotificationMessage, NotificationMessageBuilder } from "../src/notification-message";
import { mockProvider } from "../src/providers/mock";

describe("notificationMessageBuilder", () => {
    it("builds a multi-channel message with the expected shape", () => {
        expect.assertions(4);

        const message = createNotificationMessage()
            .sms({ text: "your code is 123", to: "+15555550100" })
            .push({ body: "deploy finished", title: "CI", to: "device-token" })
            .chat({ text: "deploy finished", to: "C123" })
            .inApp({ body: "welcome", to: "user-1" })
            .build();

        expect(message.sms).toStrictEqual({ text: "your code is 123", to: "+15555550100" });
        expect(message.push).toStrictEqual({ body: "deploy finished", title: "CI", to: "device-token" });
        expect(message.chat).toStrictEqual({ text: "deploy finished", to: "C123" });
        expect(message.inapp).toStrictEqual({ body: "welcome", to: "user-1" });
    });

    it("returns a NotificationMessageBuilder from the factory", () => {
        expect.assertions(1);

        expect(createNotificationMessage()).toBeInstanceOf(NotificationMessageBuilder);
    });

    it("applies builder-level metadata and idempotencyKey without overriding payload values", () => {
        expect.assertions(3);

        const message = createNotificationMessage()
            .sms({ idempotencyKey: "own-key", text: "hi", to: "+15555550100" })
            .push({ body: "hi", to: "tok" })
            .metadata({ campaign: "launch" })
            .idempotencyKey("builder-key")
            .build();

        expect(message.sms?.metadata).toStrictEqual({ campaign: "launch" });
        expect(message.sms?.idempotencyKey).toBe("own-key");
        expect(message.push?.idempotencyKey).toBe("builder-key");
    });

    it("round-trips through createNotification().send()", async () => {
        expect.assertions(3);

        const sms = mockProvider({ channel: "sms", id: "sms-mock" });
        const chat = mockProvider({ channel: "chat", id: "chat-mock" });

        const builder = createNotificationMessage().sms({ text: "your code is 123", to: "+15555550100" }).chat({ text: "deploy finished", to: "C123" });

        const receipts = await createNotification({ chat, sms }).send(builder.build());

        expect(receipts).toHaveLength(2);
        expect(receipts.every((receipt) => receipt.successful)).toBe(true);
        expect(sms.getInstance?.().sent).toHaveLength(1);
    });
});
