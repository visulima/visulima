/**
 * `firstSeen` policy — blocks any locked package whose resolved version
 * was published less than `security.policies.firstSeen.minutes` ago.
 *
 * This is the lockfile-side counterpart to pnpm's `minimumReleaseAge`.
 * `min-release-age.ts` only *writes* the cooldown into the PM-native
 * config (so pnpm enforces it on its own install path); this module
 * re-verifies it against the *resolved closure* so a poisoned/tampered
 * lockfile pinning a freshly published malicious version is caught even
 * on npm / yarn / bun (which have no equivalent native gate) and even
 * when nothing is being added.
 *
 * Network-bound: reads the registry packument `time[version]` map
 * through the shared on-disk cache. The engine emits an offline-skip
 * decision before this ever runs when `--offline` is set
 * (`offlineSupported: false`).
 */

import type { VisConfig } from "../../config/types";
import { DEFAULT_MARSHALL_CONCURRENCY, mapWithConcurrency } from "../marshalls/concurrency";
import { getPackument } from "../marshalls/packument";
import { findAcceptedRisk } from "../socket-security";
import type { PolicyDecision, PolicyInput } from "./index";

const MS_PER_MINUTE = 60_000;

/**
 * Matches a package against a firstSeen exclude pattern. Supports an
 * exact `name`, an exact `name@version`, and a trailing `*` glob on the
 * name (`@scope/*`, `eslint-*`) — same grammar the other policy modules
 * and `findAcceptedRisk` use so config is consistent across policies.
 */
const isExcluded = (name: string, version: string, exclude: string[]): boolean => {
    for (const pattern of exclude) {
        if (pattern === name || pattern === `${name}@${version}`) {
            return true;
        }

        if (pattern.endsWith("*") && name.startsWith(pattern.slice(0, -1))) {
            return true;
        }
    }

    return false;
};

export const evaluateFirstSeenPolicy = async (input: PolicyInput, config: VisConfig): Promise<PolicyDecision[]> => {
    const firstSeen = config.security?.policies?.firstSeen;

    if (firstSeen?.minutes === undefined || firstSeen.minutes <= 0) {
        return [];
    }

    const minutes = firstSeen.minutes;
    const exclude = firstSeen.exclude ?? [];
    const acceptedRisks = config.security?.acceptedRisks;
    const thresholdMs = minutes * MS_PER_MINUTE;
    const now = Date.now();

    const perPackage = await mapWithConcurrency(
        input.packages,
        DEFAULT_MARSHALL_CONCURRENCY,
        async (pkg): Promise<PolicyDecision | undefined> => {
            if (isExcluded(pkg.name, pkg.version, exclude)) {
                return undefined;
            }

            const packument = await getPackument(pkg.name, { workspaceRoot: input.workspaceRoot });

            if (packument === undefined) {
                return undefined;
            }

            const publishedAt = packument.time?.[pkg.version];

            if (publishedAt === undefined) {
                return undefined;
            }

            const publishedMs = Date.parse(publishedAt);

            if (Number.isNaN(publishedMs)) {
                return undefined;
            }

            const ageMs = now - publishedMs;

            if (ageMs >= thresholdMs) {
                return undefined;
            }

            const ageMinutes = Math.max(0, Math.floor(ageMs / MS_PER_MINUTE));

            return {
                acceptedRisk: findAcceptedRisk(pkg.name, pkg.version, acceptedRisks, "firstSeen"),
                data: {
                    ageMinutes,
                    minimumMinutes: minutes,
                    publishedAt,
                },
                packageName: pkg.name,
                policy: "firstSeen",
                reason: `${pkg.name}@${pkg.version} was published ${String(ageMinutes)} min ago — below the ${String(minutes)} min firstSeen cooldown.`,
                severity: "block",
                version: pkg.version,
            };
        },
    );

    return perPackage.filter((decision): decision is PolicyDecision => decision !== undefined);
};
