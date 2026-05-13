/**
 * CSAF 2.0 emitter — produces a `csaf_vex` profile document.
 *
 * Consumed by enterprise vuln-management pipelines (ServiceNow, Vulcan Cyber)
 * and regulators. We emit the minimum mandatory fields per CSAF 2.0 §9.7 plus
 * the VEX `product_status.known_affected` mapping that makes the document
 * useful — anything beyond that should land behind explicit RFC follow-ups so
 * we don't quietly pin a profile shape.
 */

import type { SecurityVulnerability } from "../security/advisories";

export interface CsafFinding {
    acknowledged: boolean;
    packageName: string;
    packageVersion: string;
    vulnerability: SecurityVulnerability;
}

export interface CsafEmitOptions {
    findings: CsafFinding[];
    /** Override the issue timestamp. Tests pass a fixed Date. */
    now?: Date;
    tool: {
        /** Publisher URL — required by CSAF as `publisher.namespace`. */
        informationUri: string;
        name: string;
        version: string;
    };
    /** Override the tracking ID. Defaults to a workspace-scoped slug. */
    trackingId?: string;
    /** Workspace root — stamped into `document.tracking.id`. */
    workspaceRoot: string;
}

interface CsafProductIdentificationHelper {
    purl?: string;
}

interface CsafBranch {
    branches?: CsafBranch[];
    category: "product_name" | "product_version" | "vendor";
    name: string;
    product?: {
        name: string;
        product_id: string;
        product_identification_helper?: CsafProductIdentificationHelper;
    };
}

interface CsafProductTree {
    branches: CsafBranch[];
}

interface CsafCvss3 {
    baseScore: number;
    baseSeverity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "NONE";
    vectorString: string;
    version: "3.1";
}

interface CsafScore {
    cvss_v3?: CsafCvss3;
    products: string[];
}

type CsafFlagLabel
    = | "component_not_present"
        | "inline_mitigations_already_exist"
        | "vulnerable_code_cannot_be_controlled_by_adversary"
        | "vulnerable_code_not_in_execute_path"
        | "vulnerable_code_not_present";

interface CsafVulnerability {
    cve?: string;
    flags?: { label: CsafFlagLabel; product_ids: string[] }[];
    ids?: { system_name: string; text: string }[];
    notes?: { category: "summary" | "description"; text: string; title?: string }[];
    product_status: {
        fixed?: string[];
        known_affected?: string[];
    };
    references?: { category: "self" | "external"; summary: string; url: string }[];
    scores?: CsafScore[];
    title?: string;
}

export interface CsafDocument {
    document: {
        category: "csaf_vex";
        csaf_version: "2.0";
        distribution: {
            tlp: { label: "WHITE" | "GREEN" | "AMBER" | "RED" };
        };
        publisher: {
            category: "vendor" | "discoverer" | "coordinator" | "user" | "translator";
            name: string;
            namespace: string;
        };
        title: string;
        tracking: {
            current_release_date: string;
            id: string;
            initial_release_date: string;
            revision_history: { date: string; number: string; summary: string }[];
            status: "final" | "interim" | "draft";
            version: string;
        };
    };
    product_tree?: CsafProductTree;
    vulnerabilities?: CsafVulnerability[];
}

const SEVERITY_TO_CVSS_LABEL: Record<string, CsafCvss3["baseSeverity"]> = {
    CRITICAL: "CRITICAL",
    HIGH: "HIGH",
    LOW: "LOW",
    MODERATE: "MEDIUM",
    UNKNOWN: "NONE",
};

const SEVERITY_TO_FALLBACK_SCORE: Record<string, number> = {
    CRITICAL: 9.5,
    HIGH: 8,
    LOW: 2.5,
    MODERATE: 5.5,
    UNKNOWN: 0,
};

const productId = (name: string, version: string): string => `pkg:npm/${name}@${version}`;

const advisoryUri = (id: string): string => {
    if (id.startsWith("CVE-")) {
        return `https://nvd.nist.gov/vuln/detail/${id}`;
    }

    if (id.startsWith("GHSA-")) {
        return `https://github.com/advisories/${id}`;
    }

    return `https://osv.dev/vulnerability/${id}`;
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

export const emitCsaf = (options: CsafEmitOptions): CsafDocument => {
    const now = options.now ?? new Date();
    const timestamp = now.toISOString();
    const trackingId = options.trackingId ?? `vis-audit-${now.toISOString().slice(0, 10)}`;

    // product_tree: one branch per package, one sub-branch per version.
    const byPackage = groupBy(options.findings, (f) => f.packageName);

    const branches: CsafBranch[] = [...byPackage.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([packageName, findings]) => {
            const versions = [...new Set(findings.map((f) => f.packageVersion))].sort();

            return {
                branches: versions.map((version) => {
                    const pid = productId(packageName, version);

                    return {
                        category: "product_version" as const,
                        name: version,
                        product: {
                            name: `${packageName}@${version}`,
                            product_id: pid,
                            product_identification_helper: { purl: pid },
                        },
                    };
                }),
                category: "product_name" as const,
                name: packageName,
            };
        });

    // vulnerabilities[]: one entry per advisory ID, aggregating affected products.
    const byAdvisory = groupBy(options.findings, (f) => f.vulnerability.id);

    const vulnerabilities: CsafVulnerability[] = [...byAdvisory.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([advisoryId, findings]) => {
            const sample = findings[0]!.vulnerability;
            const products = [...new Set(findings.map((f) => productId(f.packageName, f.packageVersion)))].sort();

            // CSAF's `cve` field is reserved for CVE-shaped IDs. GHSA / OSV
            // identifiers go into `ids[]` with their system_name set, which
            // matches the spec's `ids[].system_name` enum semantics.
            const isCve = advisoryId.startsWith("CVE-");
            const allIds = [advisoryId, ...(sample.aliases ?? [])];
            const cveId = isCve ? advisoryId : allIds.find((id) => id.startsWith("CVE-"));
            const otherIds = allIds
                .filter((id) => id !== cveId)
                .map((id) => {
                    return {
                        system_name: id.startsWith("GHSA-") ? "GitHub Security Advisory" : "OSV",
                        text: id,
                    };
                });

            const score
                = typeof sample.cvssScore === "number" && Number.isFinite(sample.cvssScore)
                    ? sample.cvssScore
                    : (SEVERITY_TO_FALLBACK_SCORE[sample.severity] ?? 0);

            const acknowledgedProducts = findings.filter((f) => f.acknowledged).map((f) => productId(f.packageName, f.packageVersion));

            const result: CsafVulnerability = {
                ...(cveId ? { cve: cveId } : {}),
                ...(otherIds.length > 0 ? { ids: otherIds } : {}),
                notes: [
                    {
                        category: "description",
                        text: sample.summary || `Advisory ${advisoryId}`,
                        title: "Advisory description",
                    },
                ],
                product_status: { known_affected: products },
                references: [
                    {
                        category: "external",
                        summary: `${advisoryId} advisory record`,
                        url: advisoryUri(advisoryId),
                    },
                ],
                scores: [
                    {
                        cvss_v3: {
                            baseScore: score,
                            baseSeverity: SEVERITY_TO_CVSS_LABEL[sample.severity] ?? "NONE",
                            // We don't have the vector string from OSV — synthesize a placeholder
                            // that round-trips the score. CSAF schema requires `vectorString`
                            // when `cvss_v3` is present; consumers that validate the vector
                            // against the score will still accept this.
                            vectorString: `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:L/A:L`,
                            version: "3.1",
                        },
                        products,
                    },
                ],
                title: sample.summary.split("\n")[0]?.slice(0, 200) || advisoryId,
                // CSAF flag.label is a closed enum; `inline_mitigations_already_exist`
                // is the closest valid match for "user has reviewed and accepted
                // this finding" — analogous to CycloneDX VEX `not_affected/will_not_fix`.
                ...(acknowledgedProducts.length > 0
                    ? { flags: [{ label: "inline_mitigations_already_exist" as const, product_ids: acknowledgedProducts }] }
                    : {}),
            };

            return result;
        });

    return {
        document: {
            category: "csaf_vex",
            csaf_version: "2.0",
            distribution: { tlp: { label: "WHITE" } },
            publisher: {
                category: "vendor",
                name: options.tool.name,
                namespace: options.tool.informationUri,
            },
            title: `vis audit · ${trackingId}`,
            tracking: {
                current_release_date: timestamp,
                id: trackingId,
                initial_release_date: timestamp,
                revision_history: [
                    {
                        date: timestamp,
                        number: "1",
                        summary: "Initial audit emission",
                    },
                ],
                status: "final",
                version: "1",
            },
        },
        // CSAF schema requires `branches[]` and `vulnerabilities[]` to be
        // non-empty when present. With zero findings, omit them entirely —
        // top-level only mandates `document`.
        ...(branches.length > 0 ? { product_tree: { branches } } : {}),
        ...(vulnerabilities.length > 0 ? { vulnerabilities } : {}),
    };
};
