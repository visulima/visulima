import { describe, expect, it } from "vitest";

import memoryUsageCheck from "../../src/checks/memory-usage-check";

describe(memoryUsageCheck, () => {
    it("returns healthy under default thresholds", async () => {
        expect.assertions(2);

        const result = await memoryUsageCheck()();

        expect(result.health.healthy).toBe(true);
        expect(result.meta).toMatchObject({ rss: expect.any(Number), rssLimit: expect.any(Number) });
    });

    it("returns unhealthy when heap limit is exceeded", async () => {
        expect.assertions(2);

        const result = await memoryUsageCheck({ maxHeapUsedBytes: 1 })();

        expect(result.health.healthy).toBe(false);
        expect(result.health.message).toContain("Heap used");
    });

    it("returns unhealthy when rss limit is exceeded", async () => {
        expect.assertions(2);

        const result = await memoryUsageCheck({ maxRssBytes: 1 })();

        expect(result.health.healthy).toBe(false);
        expect(result.health.message).toContain("RSS");
    });
});
