import { describe, expect, it, vi } from "vitest";

import { composeMiddleware, loggingMiddleware } from "../../src/middleware";
import type { EmailOptions, EmailResult, Result } from "../../src/types";

const okResult = (messageId = "m1"): Result<EmailResult> => {
    return {
        data: { messageId, provider: "stub", sent: true, timestamp: new Date(0) },
        success: true,
    };
};

const failResult = (): Result<EmailResult> => {
    return { error: new Error("smtp blew up"), success: false };
};

const message: EmailOptions = {
    from: { email: "from@x.com" },
    subject: "Quarterly invoice 1234",
    text: "body",
    to: { email: "jane@example.com" },
};

const makeLogger = (): { error: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> } => {
    return { error: vi.fn(), info: vi.fn() };
};

describe(loggingMiddleware, () => {
    it("logs a sending then a sent entry on success", async () => {
        expect.assertions(3);

        const logger = makeLogger();
        const composed = composeMiddleware([loggingMiddleware({ logger })], () => Promise.resolve(okResult("sent-id")));

        const result = await composed(message);

        expect(result.success).toBe(true);
        expect(logger.info).toHaveBeenNthCalledWith(1, "[@visulima/email] sending", expect.objectContaining({ to: ["j•••@example.com"] }));
        expect(logger.info).toHaveBeenNthCalledWith(2, "[@visulima/email] sent", expect.objectContaining({ messageId: "sent-id", to: ["j•••@example.com"] }));
    });

    it("redacts recipients and the subject by default", async () => {
        expect.assertions(2);

        const logger = makeLogger();
        const composed = composeMiddleware([loggingMiddleware({ logger })], () => Promise.resolve(okResult()));

        await composed(message);

        const sendingPayload = logger.info.mock.calls[0]?.[1] as { subject?: string; to: string[] };

        // Subject is gated behind the redact flag → undefined by default.
        expect(sendingPayload.subject).toBeUndefined();
        expect(sendingPayload.to).toStrictEqual(["j•••@example.com"]);
    });

    it("logs the unredacted subject and address when redact is disabled", async () => {
        expect.assertions(2);

        const logger = makeLogger();
        const composed = composeMiddleware([loggingMiddleware({ logger, redact: false })], () => Promise.resolve(okResult()));

        await composed(message);

        const sendingPayload = logger.info.mock.calls[0]?.[1] as { subject?: string; to: string[] };

        expect(sendingPayload.subject).toBe("Quarterly invoice 1234");
        expect(sendingPayload.to).toStrictEqual(["jane@example.com"]);
    });

    it("logs a sanitized error on a failed result without swallowing the failure", async () => {
        expect.assertions(3);

        const logger = makeLogger();
        const composed = composeMiddleware([loggingMiddleware({ logger })], () => Promise.resolve(failResult()));

        const result = await composed(message);

        // The middleware must surface the failed result unchanged, not turn it into a success.
        expect(result.success).toBe(false);
        expect(logger.error).toHaveBeenCalledTimes(1);
        expect(logger.error).toHaveBeenCalledWith(
            "[@visulima/email] send failed",
            expect.objectContaining({ error: "smtp blew up", to: ["j•••@example.com"] }),
        );
    });
});
