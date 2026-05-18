/**
 * Author marshall.
 *
 * Three checks gated by configurable day thresholds:
 *
 * 1. **recent-version** — the installed version was published very recently.
 *    Five-day-old packages are the typical npm typosquat or supply-chain
 *    dropper's freshness signature.
 * 2. **new-publisher** — `_npmUser` for the installed version is publishing
 *    on this package for the first time within a short window of a much
 *    longer-running package. Catches account takeovers / first-time
 *    co-maintainer publishes.
 * 3. **dormant-maintainer** — the publisher's *previous* releases happened
 *    long ago. A "ghost" maintainer who returns after months is a classic
 *    compromised-credentials signal.
 *
 * Boundaries are **strict-less-than** (`&lt;`, `&lt;=`) so exact-day inputs do
 * not cross to the next tier — matching the test plan's "exactly 183/274/
 * 21/7/30 days does not cross" requirement.
 */

/* eslint-disable no-underscore-dangle -- `_npmUser` is the npm registry field name. */

import { lt as semverLt, valid as semverValid } from "semver";

import { DEFAULT_MARSHALL_CONCURRENCY, mapWithConcurrency } from "./concurrency";
import type { Packument } from "./packument";
import { getPackument } from "./packument";
import { isMarshallDisabled } from "./registry";

export interface AuthorFinding {
    kind: "dormant-maintainer" | "new-publisher" | "recent-version";
    message: string;
    packageName: string;
    severity: "error" | "warning";
    version: string;
}

export interface RunAuthorMarshallOptions {
    allowlist?: string[];
    cacheTtlMs?: number;
    /** Max packages inspected in parallel. Defaults to {@link DEFAULT_MARSHALL_CONCURRENCY}. */
    concurrency?: number;
    /** Override "now" for tests so day-math is deterministic. */
    now?: () => number;
    signal?: AbortSignal;
    thresholds?: AuthorThresholds;
    workspaceRoot?: string;
}

export interface AuthorThresholds {
    dormantErrorDays?: number;
    dormantWarnDays?: number;
    newPublisherWindowDays?: number;
    recentVersionErrorDays?: number;
    recentVersionWarnDays?: number;
}

const DEFAULT_THRESHOLDS: Required<AuthorThresholds> = {
    dormantErrorDays: 274,
    dormantWarnDays: 183,
    newPublisherWindowDays: 21,
    recentVersionErrorDays: 7,
    recentVersionWarnDays: 30,
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const daysBetween = (laterMs: number, earlierMs: number): number => (laterMs - earlierMs) / MS_PER_DAY;

const userIdentity = (user: { email?: string; name?: string } | undefined): string | undefined => {
    if (user === undefined) {
        return undefined;
    }

    // Prefer email since npm accounts can have duplicate display names.
    return user.email ?? user.name;
};

const checkRecentVersion = (
    packument: Packument,
    packageName: string,
    version: string,
    nowMs: number,
    thresholds: Required<AuthorThresholds>,
): AuthorFinding | undefined => {
    const publishedAt = packument.time?.[version];

    if (publishedAt === undefined) {
        return undefined;
    }

    const publishedMs = new Date(publishedAt).getTime();

    if (!Number.isFinite(publishedMs)) {
        return undefined;
    }

    const ageDays = daysBetween(nowMs, publishedMs);

    if (ageDays < thresholds.recentVersionErrorDays) {
        return {
            kind: "recent-version",
            message: `published ${ageDays.toFixed(1)} days ago (error threshold: ${String(thresholds.recentVersionErrorDays)})`,
            packageName,
            severity: "error",
            version,
        };
    }

    if (ageDays < thresholds.recentVersionWarnDays) {
        return {
            kind: "recent-version",
            message: `published ${ageDays.toFixed(1)} days ago (warn threshold: ${String(thresholds.recentVersionWarnDays)})`,
            packageName,
            severity: "warning",
            version,
        };
    }

    return undefined;
};

const checkNewPublisher = (
    packument: Packument,
    packageName: string,
    version: string,
    nowMs: number,
    thresholds: Required<AuthorThresholds>,
): AuthorFinding | undefined => {
    const currentEntry = packument.versions[version];
    const currentUser = userIdentity(currentEntry?._npmUser);

    if (currentUser === undefined) {
        return undefined;
    }

    const allVersions = Object.keys(packument.versions).filter((entry) => semverValid(entry) !== null);
    const priors = allVersions.filter((entry) => semverLt(entry, version));

    if (priors.length === 0) {
        // Brand new package — nothing to compare against.
        return undefined;
    }

    const previousByThisUser = priors.some((entry) => userIdentity(packument.versions[entry]?._npmUser) === currentUser);

    if (previousByThisUser) {
        return undefined;
    }

    // First publish by this user. Only fire if the package itself is "established".
    const firstReleaseAt = packument.time?.[priors[0] ?? ""];

    if (firstReleaseAt === undefined) {
        return undefined;
    }

    const firstReleaseMs = new Date(firstReleaseAt).getTime();

    if (!Number.isFinite(firstReleaseMs)) {
        return undefined;
    }

    const packageAgeDays = daysBetween(nowMs, firstReleaseMs);

    if (packageAgeDays <= thresholds.newPublisherWindowDays) {
        // Young package — first-time publisher is unremarkable.
        return undefined;
    }

    return {
        kind: "new-publisher",
        message: `first publish by ${currentUser} on a ${packageAgeDays.toFixed(0)}-day-old package`,
        packageName,
        severity: "error",
        version,
    };
};

const checkDormantMaintainer = (
    packument: Packument,
    packageName: string,
    version: string,
    nowMs: number,
    thresholds: Required<AuthorThresholds>,
): AuthorFinding | undefined => {
    const currentEntry = packument.versions[version];
    const currentUser = userIdentity(currentEntry?._npmUser);

    if (currentUser === undefined) {
        return undefined;
    }

    const otherReleaseTimes: number[] = [];

    for (const [versionId, entry] of Object.entries(packument.versions)) {
        if (versionId === version) {
            continue;
        }

        if (userIdentity(entry._npmUser) !== currentUser) {
            continue;
        }

        const releasedAt = packument.time?.[versionId];

        if (releasedAt === undefined) {
            continue;
        }

        const releasedMs = new Date(releasedAt).getTime();

        if (Number.isFinite(releasedMs)) {
            otherReleaseTimes.push(releasedMs);
        }
    }

    if (otherReleaseTimes.length === 0) {
        // Treated as new-publisher elsewhere or filtered as "single-publisher baseline".
        return undefined;
    }

    const mostRecentPriorMs = Math.max(...otherReleaseTimes);
    const gapDays = daysBetween(nowMs, mostRecentPriorMs);

    if (gapDays >= thresholds.dormantErrorDays) {
        return {
            kind: "dormant-maintainer",
            message: `previous release by ${currentUser} was ${gapDays.toFixed(0)} days ago (error threshold: ${String(thresholds.dormantErrorDays)})`,
            packageName,
            severity: "error",
            version,
        };
    }

    if (gapDays >= thresholds.dormantWarnDays) {
        return {
            kind: "dormant-maintainer",
            message: `previous release by ${currentUser} was ${gapDays.toFixed(0)} days ago (warn threshold: ${String(thresholds.dormantWarnDays)})`,
            packageName,
            severity: "warning",
            version,
        };
    }

    return undefined;
};

export const runAuthorMarshall = async (packages: { name: string; version: string }[], options: RunAuthorMarshallOptions = {}): Promise<AuthorFinding[]> => {
    if (isMarshallDisabled("author")) {
        return [];
    }

    const allowlist = new Set(options.allowlist);
    const thresholds: Required<AuthorThresholds> = { ...DEFAULT_THRESHOLDS, ...options.thresholds };
    const now = options.now ?? (() => Date.now());
    const concurrency = options.concurrency ?? DEFAULT_MARSHALL_CONCURRENCY;

    const perPackage = await mapWithConcurrency(packages, concurrency, async ({ name, version }) => {
        if (allowlist.has(name)) {
            return [];
        }

        const packument = await getPackument(name, {
            cacheTtlMs: options.cacheTtlMs,
            signal: options.signal,
            workspaceRoot: options.workspaceRoot,
        });

        if (packument === undefined) {
            return [];
        }

        const nowMs = now();
        const localFindings: AuthorFinding[] = [];

        const recent = checkRecentVersion(packument, name, version, nowMs, thresholds);

        if (recent !== undefined) {
            localFindings.push(recent);
        }

        const newPublisher = checkNewPublisher(packument, name, version, nowMs, thresholds);

        if (newPublisher !== undefined) {
            localFindings.push(newPublisher);
        }

        const dormant = checkDormantMaintainer(packument, name, version, nowMs, thresholds);

        if (dormant !== undefined) {
            localFindings.push(dormant);
        }

        return localFindings;
    });

    return perPackage.flat();
};
