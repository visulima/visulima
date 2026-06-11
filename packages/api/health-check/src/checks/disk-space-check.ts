import { statfs } from "node:fs/promises";

import type { Checker } from "../types";

const DISPLAY_NAME = "Disk space check for";

interface DiskSpaceCheckOptions {
    /**
     * Minimum free space, in bytes, before the check reports unhealthy. When
     * omitted the available space is checked against
     * {@link DiskSpaceCheckOptions.minFreeRatio}.
     */
    minFreeBytes?: number;

    /**
     * Minimum free space as a fraction (0-1) of total space before the check
     * reports unhealthy. Defaults to `0.1` (10%). Ignored when `minFreeBytes`
     * is set.
     */
    minFreeRatio?: number;
}

/**
 * Register a checker that reports unhealthy when the free disk space at `path`
 * drops below the configured threshold. By default it flags when less than 10%
 * of the filesystem is free.
 *
 * Uses {@link statfs} (available on all supported Node versions).
 * @param path A path on the filesystem to inspect (e.g. `"/"` or `process.cwd()`).
 */
const diskSpaceCheck
    = (path: string, options: DiskSpaceCheckOptions = {}): Checker =>
        async () => {
            const { minFreeBytes, minFreeRatio = 0.1 } = options;

            try {
                const stats = await statfs(path);

                const total = stats.blocks * stats.bsize;
                const free = stats.bavail * stats.bsize;

                const limit = minFreeBytes ?? Math.floor(total * minFreeRatio);
                const healthy = free >= limit;

                return {
                    displayName: `${DISPLAY_NAME} ${path}`,
                    health: {
                        healthy,
                        message: healthy
                            ? `${DISPLAY_NAME} ${path} passed.`
                            : `Free space ${free} bytes is below limit ${limit} bytes`,
                        timestamp: new Date().toISOString(),
                    },
                    meta: {
                        free,
                        limit,
                        path,
                        total,
                    },
                };
            } catch (error) {
                return {
                    displayName: `${DISPLAY_NAME} ${path}`,
                    health: {
                        healthy: false,
                        message: (error as Error).message,
                        timestamp: new Date().toISOString(),
                    },
                    meta: {
                        path,
                    },
                };
            }
        };

export type { DiskSpaceCheckOptions };

export default diskSpaceCheck;
