/**
 * Package-age marshall.
 *
 * Two signals derived from the packument `time` map — distinct from the
 * author marshall's per-*version* recency check:
 *
 * 1. **new-package** — the package itself was *first published*
 *    (`time.created`) less than `newPackageDays` ago. A brand-new package
 *    name is the canonical typosquat / dependency-confusion signature; it
 *    is a much stronger signal than a new *version* of a long-lived
 *    package, so this is an **error** (blocks install pending opt-out).
 * 2. **unmaintained** — the package's most recent publish is older than
 *    `unmaintainedDays`. Surfaced as a **warning** only.
 *
 * Deviation from npq's `age.marshall`: the "old package" tier there keys
 * off the *resolved version's* release date, which false-warns whenever a
 * user intentionally pins an old version of an actively-maintained
 * package. We instead key off the *newest publish across all versions*
 * (`time.modified`, falling back to the max version timestamp) so the
 * signal tracks project abandonment rather than the caller's pin.
 *
 * Boundaries are strict-less-than so an exactly-`N`-day-old package does
 * not cross the tier (mirrors the author marshall's boundary convention).
 */

import { DEFAULT_MARSHALL_CONCURRENCY, mapWithConcurrency } from "./concurrency";
import type { Packument } from "./packument";
import { getPackument } from "./packument";
import { isMarshallDisabled } from "./registry";

export interface PackageAgeFinding {
    /** Whole days since the relevant timestamp (floored). */
    days: number;
    kind: "new-package" | "unmaintained";
    packageName: string;
    severity: "error" | "warning";
}

export interface PackageAgeThresholds {
    /** Package created fewer than this many days ago → error. Default 22. */
    newPackageDays?: number;
    /** No publish within this many days → warning. Default 365. */
    unmaintainedDays?: number;
}

export interface RunPackageAgeMarshallOptions {
    /** Package names to skip. */
    allowlist?: string[];
    /** Max packages inspected in parallel. Defaults to {@link DEFAULT_MARSHALL_CONCURRENCY}. */
    concurrency?: number;
    /** Override "now" for tests so day-math is deterministic. */
    now?: () => number;
    thresholds?: PackageAgeThresholds;
    workspaceRoot?: string;
}

const DEFAULT_THRESHOLDS: Required<PackageAgeThresholds> = {
    newPackageDays: 22,
    unmaintainedDays: 365,
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const parseTime = (value: string | undefined): number | undefined => {
    if (value === undefined) {
        return undefined;
    }

    const ms = Date.parse(value);

    return Number.isNaN(ms) ? undefined : ms;
};

const versionStamps = (packument: Packument): number[] => {
    const time = packument.time ?? {};

    return Object.entries(time)
        .filter(([key]) => key !== "created" && key !== "modified")
        .map(([, value]) => parseTime(value))
        .filter((ms): ms is number => ms !== undefined);
};

/** Earliest publish timestamp for the package (`time.created`, else min version time). */
const firstPublishMs = (packument: Packument): number | undefined => {
    const created = parseTime(packument.time?.created);

    if (created !== undefined) {
        return created;
    }

    const stamps = versionStamps(packument);

    return stamps.length > 0 ? Math.min(...stamps) : undefined;
};

/** Most recent publish timestamp (`time.modified`, else max version time). */
const lastPublishMs = (packument: Packument): number | undefined => {
    const modified = parseTime(packument.time?.modified);

    if (modified !== undefined) {
        return modified;
    }

    const stamps = versionStamps(packument);

    return stamps.length > 0 ? Math.max(...stamps) : undefined;
};

export const runPackageAgeMarshall = async (
    packages: { name: string; version: string }[],
    options: RunPackageAgeMarshallOptions = {},
): Promise<PackageAgeFinding[]> => {
    if (isMarshallDisabled("packageAge")) {
        return [];
    }

    const allowlist = new Set(options.allowlist);
    const concurrency = options.concurrency ?? DEFAULT_MARSHALL_CONCURRENCY;
    const nowMs = (options.now ?? Date.now)();
    const newPackageDays = options.thresholds?.newPackageDays ?? DEFAULT_THRESHOLDS.newPackageDays;
    const unmaintainedDays = options.thresholds?.unmaintainedDays ?? DEFAULT_THRESHOLDS.unmaintainedDays;

    const perPackage = await mapWithConcurrency(packages, concurrency, async ({ name }): Promise<PackageAgeFinding | undefined> => {
        if (allowlist.has(name)) {
            return undefined;
        }

        const packument = await getPackument(name, { workspaceRoot: options.workspaceRoot });

        if (packument === undefined) {
            return undefined;
        }

        const createdMs = firstPublishMs(packument);

        if (createdMs !== undefined) {
            const ageDays = (nowMs - createdMs) / MS_PER_DAY;

            if (ageDays < newPackageDays) {
                return { days: Math.max(0, Math.floor(ageDays)), kind: "new-package", packageName: name, severity: "error" };
            }
        }

        const modifiedMs = lastPublishMs(packument);

        if (modifiedMs !== undefined) {
            const idleDays = (nowMs - modifiedMs) / MS_PER_DAY;

            if (idleDays > unmaintainedDays) {
                return { days: Math.floor(idleDays), kind: "unmaintained", packageName: name, severity: "warning" };
            }
        }

        return undefined;
    });

    return perPackage.filter((entry): entry is PackageAgeFinding => entry !== undefined);
};
