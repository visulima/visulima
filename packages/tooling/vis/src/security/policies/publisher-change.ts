/**
 * `publisherChange` policy (`mode: "no-downgrade"`) — blocks a locked
 * package whose resolved version *lost* its provenance attestation
 * relative to the newest prior published version that had one.
 *
 * This is the lockfile-side counterpart to pnpm's `trustPolicy`. The
 * `no-downgrade` shape mirrors the provenance-regression marshall
 * (`marshalls/provenance.ts`) but runs over the *resolved closure*
 * rather than just packages being added, so a tampered lockfile that
 * pins a trust-downgraded transitive version is caught.
 *
 * Network-bound (reads the shared packument cache); the engine
 * offline-skips it when `--offline` is set.
 */

import type { VisConfig } from "../../config/types";
import { DEFAULT_MARSHALL_CONCURRENCY, mapWithConcurrency } from "../marshalls/concurrency";
import { getPackument } from "../marshalls/packument";
import { findNewestPriorWithAttestations } from "../marshalls/provenance";
import { findAcceptedRisk } from "../socket-security";
import type { PolicyDecision, PolicyInput } from "./index";

const MS_PER_MINUTE = 60_000;

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

export const evaluatePublisherChangePolicy = async (input: PolicyInput, config: VisConfig): Promise<PolicyDecision[]> => {
    const publisherChange = config.security?.policies?.publisherChange;

    if (publisherChange?.mode !== "no-downgrade") {
        return [];
    }

    const exclude = publisherChange.exclude ?? [];
    const ignoreAfterMs = typeof publisherChange.ignoreAfter === "number" ? publisherChange.ignoreAfter * MS_PER_MINUTE : undefined;
    const acceptedRisks = config.security?.acceptedRisks;
    const now = Date.now();

    const perPackage = await mapWithConcurrency(input.packages, DEFAULT_MARSHALL_CONCURRENCY, async (pkg): Promise<PolicyDecision | undefined> => {
        if (isExcluded(pkg.name, pkg.version, exclude)) {
            return undefined;
        }

        const packument = await getPackument(pkg.name, { workspaceRoot: input.workspaceRoot });

        if (packument === undefined) {
            return undefined;
        }

        if (ignoreAfterMs !== undefined) {
            const publishedAt = packument.time?.[pkg.version];
            const publishedMs = publishedAt === undefined ? Number.NaN : Date.parse(publishedAt);

            if (!Number.isNaN(publishedMs) && now - publishedMs > ignoreAfterMs) {
                return undefined;
            }
        }

        const entry = packument.versions[pkg.version];

        if (entry?.dist?.attestations?.provenance !== undefined) {
            return undefined;
        }

        const priorWithProvenance = findNewestPriorWithAttestations(packument, pkg.version);

        if (priorWithProvenance === undefined) {
            return undefined;
        }

        return {
            acceptedRisk: findAcceptedRisk(pkg.name, pkg.version, acceptedRisks, "publisherChange"),
            data: {
                priorVersionWithProvenance: priorWithProvenance,
            },
            packageName: pkg.name,
            policy: "publisherChange",
            reason: `${pkg.name}@${pkg.version} dropped the provenance attestation that ${pkg.name}@${priorWithProvenance} carried — publisher trust downgrade.`,
            severity: "block",
            version: pkg.version,
        };
    });

    return perPackage.filter((decision): decision is PolicyDecision => decision !== undefined);
};
