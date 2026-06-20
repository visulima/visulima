import { describe, expect, it, vi } from "vitest";

import { suppressionMiddleware } from "../src/middleware/suppression";
import type { SendContext } from "../src/middleware/types";

const context = (to: unknown): SendContext => {
    return { channel: "sms", payload: { to } as never, provider: "mock" };
};

describe(suppressionMiddleware, () => {
    it("short-circuits a suppressed recipient with a synthetic success", async () => {
        expect.assertions(3);

        const next = vi.fn();
        const middleware = suppressionMiddleware({ isSuppressed: () => true });

        const result = await middleware(context("+1"), next);

        expect(next).not.toHaveBeenCalled();
        expect(result.success).toBe(true);
        expect(result.data?.messageId).toBe("suppressed:+1");
    });

    it("passes through a non-suppressed recipient", async () => {
        expect.assertions(2);

        const next = vi.fn().mockResolvedValue({ data: { messageId: "ok" }, success: true });
        const middleware = suppressionMiddleware({ isSuppressed: () => false });

        const result = await middleware(context("+1"), next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(result.data?.messageId).toBe("ok");
    });

    it("awaits an async suppression check and receives the channel", async () => {
        expect.assertions(2);

        const isSuppressed = vi.fn().mockResolvedValue(true);
        const next = vi.fn();
        const middleware = suppressionMiddleware({ isSuppressed });

        await middleware(context("+1"), next);

        expect(isSuppressed).toHaveBeenCalledWith("+1", "sms");
        expect(next).not.toHaveBeenCalled();
    });

    it("passes through when no recipient can be resolved", async () => {
        expect.assertions(2);

        const isSuppressed = vi.fn();
        const next = vi.fn().mockResolvedValue({ success: true });
        const middleware = suppressionMiddleware({ isSuppressed });

        await middleware(context(undefined), next);

        expect(isSuppressed).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalledTimes(1);
    });

    it("uses a custom resolveRecipient", async () => {
        expect.assertions(1);

        const next = vi.fn();
        const middleware = suppressionMiddleware({
            isSuppressed: () => true,
            resolveRecipient: () => "custom@example.com",
        });

        const result = await middleware(context("ignored"), next);

        expect(result.data?.messageId).toBe("suppressed:custom@example.com");
    });

    it("joins array recipients for the default resolver", async () => {
        expect.assertions(1);

        const middleware = suppressionMiddleware({ isSuppressed: () => true });

        const result = await middleware(context(["+1", "+2"]), vi.fn());

        expect(result.data?.messageId).toBe("suppressed:+1,+2");
    });
});
