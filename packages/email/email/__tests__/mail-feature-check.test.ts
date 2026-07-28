import { describe, expect, it, vi } from "vitest";

import { createMail } from "../src/mail";
import type { Provider } from "../src/providers/provider";
import type { EmailOptions, FeatureFlags } from "../src/types";

const okResult = {
    data: { messageId: "id-1", provider: "test", sent: true, timestamp: new Date(0) },
    success: true as const,
};

const createProvider = (features: FeatureFlags, name = "test"): Provider => {
    return {
        features,

        async initialize(): Promise<void> {},
        // eslint-disable-next-line @typescript-eslint/require-await
        async isAvailable(): Promise<boolean> {
            return true;
        },
        name,
        sendEmail: vi.fn(() => okResult),
    };
};

const taggedMessage: EmailOptions = {
    from: { email: "sender@example.com" },
    subject: "Hi",
    tags: ["promo"],
    text: "Body",
    to: { email: "user@example.com" },
};

describe("mail capability guard", () => {
    it("rejects a message that uses an explicitly unsupported capability by default", async () => {
        expect.assertions(4);

        const provider = createProvider({ tagging: false });
        const mail = createMail(provider);

        const result = await mail.send(taggedMessage);

        expect(result.success).toBe(false);
        expect((result.error as Error).message).toContain("tags");
        expect((result.error as { code?: string }).code).toBe("UNSUPPORTED_FEATURES");
        expect(provider.sendEmail).not.toHaveBeenCalled();
    });

    it("sends anyway in warn mode", async () => {
        expect.assertions(2);

        const provider = createProvider({ tagging: false });
        const mail = createMail(provider, { featureCheck: "warn" });

        const result = await mail.send(taggedMessage);

        expect(result.success).toBe(true);
        expect(provider.sendEmail).toHaveBeenCalledTimes(1);
    });

    it("skips the check entirely in off mode", async () => {
        expect.assertions(2);

        const provider = createProvider({ tagging: false });
        const mail = createMail(provider, { featureCheck: "off" });

        const result = await mail.send(taggedMessage);

        expect(result.success).toBe(true);
        expect(provider.sendEmail).toHaveBeenCalledTimes(1);
    });

    it("allows a message when the capability is supported", async () => {
        expect.assertions(2);

        const provider = createProvider({ tagging: true });
        const mail = createMail(provider);

        const result = await mail.send(taggedMessage);

        expect(result.success).toBe(true);
        expect(provider.sendEmail).toHaveBeenCalledTimes(1);
    });

    it("checks the mounted stream provider's capabilities, not the default provider's", async () => {
        expect.assertions(3);

        // Default provider cannot tag; the mounted one can. A tagged message routed
        // to the mounted stream must be allowed and dispatched to the mounted provider.
        const base = createProvider({ tagging: false }, "default");
        const broadcast = createProvider({ tagging: true }, "broadcast");
        const mail = createMail(base).mount("broadcast", broadcast);

        const result = await mail.send({ ...taggedMessage, stream: "broadcast" });

        expect(result.success).toBe(true);
        expect(broadcast.sendEmail).toHaveBeenCalledTimes(1);
        expect(base.sendEmail).not.toHaveBeenCalled();
    });

    it("rejects a message routed to a mounted provider that lacks the capability", async () => {
        expect.assertions(3);

        // Default provider supports tagging; the mounted one does not. The guard must
        // reject based on the mounted provider that actually handles the message.
        const base = createProvider({ tagging: true }, "default");
        const broadcast = createProvider({ tagging: false }, "broadcast");
        const mail = createMail(base).mount("broadcast", broadcast);

        const result = await mail.send({ ...taggedMessage, stream: "broadcast" });

        expect(result.success).toBe(false);
        expect((result.error as Error).message).toContain("tags");
        expect(broadcast.sendEmail).not.toHaveBeenCalled();
    });
});
