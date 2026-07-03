/**
 * Security provider interface.
 *
 * Each provider wraps an upstream service (Socket.dev, deps.dev, …) and
 * normalises its output to the shared `PackageReportData` shape. The registry
 * (`./registry.ts`) runs every enabled provider in parallel and merges
 * results so downstream code (`audit`, `add`, `update`, doctor, …) stays
 * provider-agnostic.
 */

import type { PackageReportData } from "./socket-security";

/** Reference to an npm package by name and version. */
export interface PackageRef {
    name: string;
    version: string;
}

/** Disk-cache stats for a single provider. */
export interface SecurityProviderCacheStats {
    entries: number;
    newestEntry: number | undefined;
    oldestEntry: number | undefined;
    totalSizeBytes: number;
}

/**
 * A security data provider. Implementations close over their own
 * configuration (tokens, endpoints, cache TTLs) at construction time and
 * expose a uniform `fetchReports` surface.
 */
export interface SecurityProvider {
    /** Clear the provider's disk cache. Returns the number of removed entries. */
    clearCache: () => number;

    /** Human label for progress / log messages (e.g. "Socket.dev"). */
    readonly displayName: string;

    /** Fetch reports for the given packages. Returns a Map keyed by `"name@version"`. */
    fetchReports: (packages: PackageRef[]) => Promise<Map<string, PackageReportData>>;

    /** Inspect the provider's disk cache. */
    getCacheStats: () => SecurityProviderCacheStats;

    /** Stable identifier — used in config (`primaryProvider`) and marshall disable flags. */
    readonly id: string;
}

/**
 * Merge multiple provider report maps into one.
 *
 * Conflict resolution when two providers report the same `name@version`:
 *  - `score` and identity fields (`id`, `type`, `name`, `version`, `namespace`)
 *    come from the **first** provider in iteration order. Callers should
 *    pass the primary provider first.
 *  - `alerts` from later providers are appended, deduped by `key`.
 *  - `license`, `author`, `size` fall back to a later provider only when the
 *    primary's value is empty.
 */
export const mergeReports = (maps: Iterable<Map<string, PackageReportData>>): Map<string, PackageReportData> => {
    const merged = new Map<string, PackageReportData>();

    for (const map of maps) {
        for (const [key, report] of map) {
            const existing = merged.get(key);

            if (!existing) {
                merged.set(key, { ...report, alerts: [...report.alerts] });

                continue;
            }

            const seenAlertKeys = new Set(existing.alerts.map((a) => a.key));
            const extraAlerts = report.alerts.filter((a) => !seenAlertKeys.has(a.key));

            merged.set(key, {
                ...existing,
                alerts: [...existing.alerts, ...extraAlerts],
                author: existing.author.length > 0 ? existing.author : report.author,
                license: existing.license || report.license,
                size: existing.size || report.size,
            });
        }
    }

    return merged;
};

export { type PackageAlert, type PackageReportData } from "./socket-security";
