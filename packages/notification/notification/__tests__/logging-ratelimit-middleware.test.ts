import { afterEach, describe, expect, it, vi } from "vitest";

import { loggingMiddleware } from "../src/middleware/logging";
import { rateLimitMiddleware } from "../src/middleware/rate-limit";
import { createNotification } from "../src/notification";
import { mockProvider } from "../src/providers/mock";

describe(loggingMiddleware, () => {
    it("logs the attempt and the success outcome", async () => {
        expect.assertions(3);

        const logger = { debug: vi.fn(), warn: vi.fn() } as unknown as Console;
        const provider = mockProvider({ channel: "sms" });
        const notify = createNotification({ sms: provider }).use(loggingMiddleware({ logger }));

        const receipt = await notify.sendToChannel("sms", { text: "x", to: "+1" });

        expect(receipt.successful).toBe(true);
        expect(logger.debug).toHaveBeenCalledTimes(2);
        expect(logger.warn).not.toHaveBeenCalled();
    });

    it("logs a warning on failure and returns the inner result unchanged", async () => {
        expect.assertions(3);

        const logger = { debug: vi.fn(), warn: vi.fn() } as unknown as Console;
        const provider = mockProvider({ channel: "sms", failWith: "down" });
        const notify = createNotification({ sms: provider }).use(loggingMiddleware({ logger }));

        const receipt = await notify.sendToChannel("sms", { text: "x", to: "+1" });

        expect(receipt.successful).toBe(false);
        expect(logger.warn).toHaveBeenCalledTimes(1);
        expect((logger.warn as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain("down");
    });
});

describe(rateLimitMiddleware, () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it("passes sends within the rate through immediately", async () => {
        expect.assertions(1);

        const provider = mockProvider({ channel: "sms" });
        const notify = createNotification({ sms: provider }).use(rateLimitMiddleware({ interval: 1000, rate: 3 }));

        await notify.sendToChannel("sms", { text: "1", to: "+1" });
        await notify.sendToChannel("sms", { text: "2", to: "+2" });
        await notify.sendToChannel("sms", { text: "3", to: "+3" });

        expect(provider.getInstance?.().sent).toHaveLength(3);
    });

    it("delays a send that exceeds the bucket capacity until tokens refill", async () => {
        expect.assertions(3);

        vi.useFakeTimers();

        const provider = mockProvider({ channel: "sms" });
        const notify = createNotification({ sms: provider }).use(rateLimitMiddleware({ interval: 1000, rate: 1 }));

        await notify.sendToChannel("sms", { text: "1", to: "+1" });

        expect(provider.getInstance?.().sent).toHaveLength(1);

        const pending = notify.sendToChannel("sms", { text: "2", to: "+2" });

        // The second send is blocked waiting for a token to refill.
        await Promise.resolve();

        expect(provider.getInstance?.().sent).toHaveLength(1);

        await vi.advanceTimersByTimeAsync(1000);
        await pending;

        expect(provider.getInstance?.().sent).toHaveLength(2);
    });
});
