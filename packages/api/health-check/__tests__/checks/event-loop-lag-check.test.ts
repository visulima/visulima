import { describe, expect, it } from "vitest";

import eventLoopLagCheck from "../../src/checks/event-loop-lag-check";

describe(eventLoopLagCheck, () => {
    it("returns healthy when lag is within the threshold", async () => {
        expect.assertions(2);

        const result = await eventLoopLagCheck({ sampleDelayMs: 10 })();

        expect(result.health.healthy).toBe(true);
        expect(result.meta).toMatchObject({ lag: expect.any(Number), maxLagMs: 70 });
    });

    it("returns unhealthy when the configured max lag is impossibly small", async () => {
        expect.assertions(2);

        const result = await eventLoopLagCheck({ maxLagMs: -1, sampleDelayMs: 10 })();

        expect(result.health.healthy).toBe(false);
        expect(result.health.message).toContain("exceeds limit");
    });
});
