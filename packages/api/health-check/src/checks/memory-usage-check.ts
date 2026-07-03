import { totalmem } from "node:os";

import type { Checker } from "../types";

const DISPLAY_NAME = "Memory usage check";

interface MemoryUsageCheckOptions {
    /**
     * Maximum heap usage, in bytes, before the check reports unhealthy. When
     * omitted the heap is not checked.
     */
    maxHeapUsedBytes?: number;

    /**
     * Maximum resident set size (RSS), in bytes, before the check reports
     * unhealthy. When omitted RSS is checked against a fraction of total system
     * memory via {@link MemoryUsageCheckOptions.maxRssRatio}.
     */
    maxRssBytes?: number;

    /**
     * Maximum RSS as a fraction (0-1) of total system memory before the check
     * reports unhealthy. Defaults to `0.9`. Ignored when `maxRssBytes` is set.
     */
    maxRssRatio?: number;
}

/**
 * Register a checker that reports unhealthy when the process memory usage
 * exceeds the configured thresholds. By default it flags when RSS exceeds 90%
 * of total system memory.
 */
const memoryUsageCheck
    = (options: MemoryUsageCheckOptions = {}): Checker =>
        async () => {
            const usage = process.memoryUsage();
            const { maxHeapUsedBytes, maxRssBytes, maxRssRatio = 0.9 } = options;

            const rssLimit = maxRssBytes ?? Math.floor(totalmem() * maxRssRatio);

            const failures: string[] = [];

            if (usage.rss > rssLimit) {
                failures.push(`RSS ${usage.rss} bytes exceeds limit ${rssLimit} bytes`);
            }

            if (maxHeapUsedBytes !== undefined && usage.heapUsed > maxHeapUsedBytes) {
                failures.push(`Heap used ${usage.heapUsed} bytes exceeds limit ${maxHeapUsedBytes} bytes`);
            }

            const healthy = failures.length === 0;

            return {
                displayName: DISPLAY_NAME,
                health: {
                    healthy,
                    message: healthy ? `${DISPLAY_NAME} passed.` : failures.join("; "),
                    timestamp: new Date().toISOString(),
                },
                meta: {
                    external: usage.external,
                    heapTotal: usage.heapTotal,
                    heapUsed: usage.heapUsed,
                    rss: usage.rss,
                    rssLimit,
                },
            };
        };

export type { MemoryUsageCheckOptions };

export default memoryUsageCheck;
