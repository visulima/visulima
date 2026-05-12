/**
 * CycloneDX 1.7 VEX emitter — takes a BOM produced by `buildCycloneDxBom`
 * and stamps `vulnerabilities[]` onto it.
 *
 * Output is a single document that is BOTH an SBOM AND a VEX statement —
 * the shape Dependabot's CycloneDX consumer and most attestation tools
 * accept. Vulnerable components are matched by `purl` so the VEX
 * `affects[].ref` points at the same `bom-ref` the SBOM already declares.
 */

import { toNpmPurl } from "../sbom/purl";
import type { CycloneDxBom, CycloneDxSeverity, CycloneDxVulnerability } from "../sbom/types";
import type { SecurityVulnerability } from "../security/advisories";

export interface CycloneDxVexFinding {
    acknowledged: boolean;
    packageName: string;
    packageVersion: string;
    vulnerability: SecurityVulnerability;
}

export interface CycloneDxVexOptions {
    bom: CycloneDxBom;
    findings: CycloneDxVexFinding[];
    now?: Date;
}

const SEVERITY_MAP: Record<string, CycloneDxSeverity> = {
    CRITICAL: "critical",
    HIGH: "high",
    LOW: "low",
    MODERATE: "medium",
    UNKNOWN: "unknown",
};

const SEVERITY_FALLBACK_SCORE: Record<string, number> = {
    CRITICAL: 9.5,
    HIGH: 8,
    LOW: 2.5,
    MODERATE: 5.5,
    UNKNOWN: 0,
};

const advisoryUri = (id: string): string => {
    if (id.startsWith("CVE-")) {
        return `https://nvd.nist.gov/vuln/detail/${id}`;
    }

    if (id.startsWith("GHSA-")) {
        return `https://github.com/advisories/${id}`;
    }

    return `https://osv.dev/vulnerability/${id}`;
};

const advisorySourceName = (id: string): string => {
    if (id.startsWith("CVE-")) {
        return "NVD";
    }

    if (id.startsWith("GHSA-")) {
        return "GitHub Advisory Database";
    }

    return "OSV";
};

const groupBy = <T, K extends string | number>(items: T[], key: (item: T) => K): Map<K, T[]> => {
    const map = new Map<K, T[]>();

    for (const item of items) {
        const k = key(item);
        const existing = map.get(k);

        if (existing) {
            existing.push(item);
        } else {
            map.set(k, [item]);
        }
    }

    return map;
};

/**
 * Build a `CycloneDxVulnerability` for every distinct advisory, with `affects[]`
 * pointing at the matching components' `bom-ref` (the purl by our convention).
 */
export const buildCycloneDxVulnerabilities = (findings: CycloneDxVexFinding[], now: Date = new Date()): CycloneDxVulnerability[] => {
    const byAdvisory = groupBy(findings, (f) => f.vulnerability.id);
    const timestamp = now.toISOString();

    return [...byAdvisory.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([advisoryId, group]): CycloneDxVulnerability => {
            const sample = group[0]!.vulnerability;
            const severity = SEVERITY_MAP[sample.severity] ?? "unknown";
            const score
                = typeof sample.cvssScore === "number" && Number.isFinite(sample.cvssScore) ? sample.cvssScore : (SEVERITY_FALLBACK_SCORE[sample.severity] ?? 0);

            const affectsByPkg = groupBy(group, (f) => f.packageName);

            const affects = [...affectsByPkg.entries()]
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([packageName, items]) => {
                    const versions = [...new Set(items.map((f) => f.packageVersion))].sort();
                    // The bom-ref convention in `cyclonedx.ts` is the purl itself —
                    // match that so VEX references resolve against existing components.
                    const headRef = toNpmPurl(packageName, versions[0]!);

                    return {
                        ref: headRef,
                        versions: versions.map((version) => { return { status: "affected" as const, version }; }),
                    };
                });

            // Aliases get serialized as `references[]` so consumers can resolve
            // GHSA↔CVE without re-querying OSV.
            const references = (sample.aliases ?? [])
                .filter((alias) => alias !== advisoryId)
                .map((alias) => {
                    return {
                        id: alias,
                        source: { name: advisorySourceName(alias), url: advisoryUri(alias) },
                    };
                });

            // VEX semantics: an acknowledged finding is one the user has triaged
            // and decided not to act on. `not_affected` + `code_not_reachable` is
            // the closest canonical state — without per-finding analysis notes we
            // can't distinguish further, and acknowledged-as-accepted-risk maps to
            // "we know, we are not patching."
            const anyAcknowledged = group.some((f) => f.acknowledged);
            const allAcknowledged = group.every((f) => f.acknowledged);
            const analysis: CycloneDxVulnerability["analysis"] = allAcknowledged
                ? { justification: "code_not_reachable", response: ["will_not_fix"], state: "not_affected" }
                : anyAcknowledged
                    ? { state: "in_triage" }
                    : undefined;

            const fixed = sample.fixedVersions ?? [];

            return {
                "bom-ref": `vuln:${advisoryId}`,
                id: advisoryId,
                source: { name: advisorySourceName(advisoryId), url: advisoryUri(advisoryId) },
                ...(references.length > 0 ? { references } : {}),
                description: sample.summary || `Advisory ${advisoryId}`,
                ratings: [
                    {
                        method: "CVSSv31",
                        score,
                        severity,
                        source: { name: advisorySourceName(advisoryId), url: advisoryUri(advisoryId) },
                    },
                ],
                ...(fixed.length > 0 ? { recommendation: `Upgrade to one of: ${fixed.join(", ")}` } : {}),
                affects,
                created: timestamp,
                published: timestamp,
                ...(analysis ? { analysis } : {}),
            };
        });
};

/**
 * Attach vulnerabilities to an existing CycloneDX BOM in-place semantics:
 * returns a *new* BOM object so callers can keep the original immutable.
 */
export const emitCycloneDxVex = (options: CycloneDxVexOptions): CycloneDxBom => {
    const vulnerabilities = buildCycloneDxVulnerabilities(options.findings, options.now);

    return {
        ...options.bom,
        vulnerabilities,
    };
};
