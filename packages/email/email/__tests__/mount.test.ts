import { describe, expect, it, vi } from "vitest";

import { createMail } from "../src/mail";
import type { Provider } from "../src/providers/provider";
import type { EmailOptions, EmailResult, Result } from "../src/types";

const message: EmailOptions = {
    from: { email: "from@x.com" },
    subject: "Hi",
    text: "body",
    to: { email: "to@x.com" },
};

const stubProvider = (name: string): { provider: Provider; sendEmail: ReturnType<typeof vi.fn> } => {
    const sendEmail = vi.fn(
        (): Promise<Result<EmailResult>> => Promise.resolve({ data: { messageId: name, provider: name, sent: true, timestamp: new Date(0) }, success: true }),
    );

    return { provider: { initialize: () => undefined, isAvailable: () => true, name, sendEmail }, sendEmail };
};

describe("mail.mount", () => {
    it("routes a message to the provider mounted for its stream", async () => {
        expect.assertions(3);

        const base = stubProvider("default");
        const broadcast = stubProvider("broadcast");
        const mail = createMail(base.provider).mount("broadcast", broadcast.provider);

        const defaultResult = await mail.send(message);
        const cast = await mail.send({ ...message, stream: "broadcast" });

        expect(defaultResult.data?.provider).toBe("default");
        expect(cast.data?.provider).toBe("broadcast");
        expect(base.sendEmail).toHaveBeenCalledTimes(1);
    });

    it("falls back to the default provider for an unknown stream", async () => {
        expect.assertions(1);

        const base = stubProvider("default");
        const mail = createMail(base.provider);

        const result = await mail.send({ ...message, stream: "missing" });

        expect(result.data?.provider).toBe("default");
    });
});
