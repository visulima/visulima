import type { RuntimeDiagnostic } from "../../runtime/runtime-diagnostics";
import type { DuplicatePackage } from "../../security/dependency-scan";
import type { OptimizeEntry } from "../../tui/components/optimize/OptimizeStore";
import type { OutdatedEntry } from "../../util/catalog";

export const SECTION_IDS = ["dependencies", "security", "optimization", "runtime"] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export type SectionStatus = "error" | "ok" | "skip" | "warn";

export interface OptimizationCounts {
    micro: number;
    native: number;
    preferred: number;
    socket: number;
    total: number;
}

/**
 * Static snapshot of the workspace's supply-chain hardening posture,
 * derived from `security.*` in vis.config and rendered as a dedicated
 * "Supply Chain" section in the doctor output. Each finding carries
 * its own severity so the section can summarise without re-deriving
 * status from raw values.
 */
export interface SupplyChainPosture {
    findings: SupplyChainFinding[];
    status: SectionStatus;
}

export interface SupplyChainFinding {
    detail?: string;
    label: string;
    severity: "error" | "ok" | "warn";
}

export interface DoctorResults {
    duplicates: DuplicatePackage[];
    elapsedMs: number;
    installedCount: number;
    optimizations: OptimizeEntry[];
    outdated: OutdatedEntry[];
    runtime: RuntimeDiagnostic[];
    sections: Set<SectionId>;
    socketIssues: { alerts: number; lowScore: number };
    supplyChain: SupplyChainPosture;
    vulnCount: number;
    workspaceCount: number;
}

/**
 * Parse a comma-separated `--only` / `--skip` value into a section set.
 * Unknown tokens are silently dropped (callers can fail-fast on size 0).
 */
export const parseSectionList = (raw: string | undefined): Set<SectionId> => {
    const parsed = new Set<SectionId>();

    if (!raw) {
        return parsed;
    }

    for (const token of raw.split(",")) {
        const trimmed = token.trim().toLowerCase();

        if ((SECTION_IDS as ReadonlyArray<string>).includes(trimmed)) {
            parsed.add(trimmed as SectionId);
        }
    }

    return parsed;
};

/**
 * Build the active section set from `--only` / `--skip`.
 * `--only` wins when both are set. An invalid `--only` (no recognised
 * tokens) returns an empty set so the caller can short-circuit with an
 * error instead of silently running everything.
 */
export const resolveSections = (only: string | undefined, skip: string | undefined): Set<SectionId> => {
    if (only !== undefined && only !== "") {
        return parseSectionList(only);
    }

    const skipped = parseSectionList(skip);

    return new Set(SECTION_IDS.filter((s) => !skipped.has(s)));
};

export const summarizeOptimizations = (entries: ReadonlyArray<OptimizeEntry>): OptimizationCounts => {
    const counts: OptimizationCounts = { micro: 0, native: 0, preferred: 0, socket: 0, total: entries.length };

    for (const entry of entries) {
        switch (entry.category) {
            case "micro-utility": {
                counts.micro += 1;
                break;
            }
            case "native": {
                counts.native += 1;
                break;
            }
            case "preferred": {
                counts.preferred += 1;
                break;
            }
            case "socket": {
                counts.socket += 1;
                break;
            }
            default: {
                break;
            }
        }
    }

    return counts;
};

/**
 * Roll the per-scan results up into a single status per dashboard section.
 * `skip` short-circuits when the section was filtered out by `--only` /
 * `--skip` so JSON consumers can distinguish "scanned clean" from "didn't run".
 */
export const sectionStatus = (results: DoctorResults, section: SectionId): SectionStatus => {
    if (!results.sections.has(section)) {
        return "skip";
    }

    switch (section) {
        case "dependencies": {
            if (results.outdated.length > 0 || results.duplicates.length > 0) {
                return "warn";
            }

            return "ok";
        }
        case "optimization": {
            return results.optimizations.length > 0 ? "warn" : "ok";
        }
        case "runtime": {
            return results.runtime.some((d) => d.status === "warn") ? "warn" : "ok";
        }
        case "security": {
            if (results.vulnCount > 0 || results.socketIssues.alerts > 0) {
                return "error";
            }

            if (results.socketIssues.lowScore > 0) {
                return "warn";
            }

            return "ok";
        }
        default: {
            return "ok";
        }
    }
};

/**
 * Build the JSON payload emitted by `vis doctor --json`.
 * Each section carries its own `status` so consumers can branch without
 * re-deriving it from raw counts.
 */
export const buildJsonPayload = (results: DoctorResults, packageManagerName: string): Record<string, unknown> => {
    const counts = summarizeOptimizations(results.optimizations);
    const sectionsObj: Record<SectionId, SectionStatus> = {
        dependencies: sectionStatus(results, "dependencies"),
        optimization: sectionStatus(results, "optimization"),
        runtime: sectionStatus(results, "runtime"),
        security: sectionStatus(results, "security"),
    };

    const statuses = new Set([...Object.values(sectionsObj), results.supplyChain.status]);
    const overall: SectionStatus = statuses.has("error") ? "error" : statuses.has("warn") ? "warn" : "ok";

    return {
        dependencies: {
            duplicates: results.duplicates.length,
            installed: results.installedCount,
            outdated: results.outdated.length,
            status: sectionsObj.dependencies,
        },
        elapsedMs: results.elapsedMs,
        optimizations: {
            microUtilities: counts.micro,
            native: counts.native,
            preferred: counts.preferred,
            socket: counts.socket,
            status: sectionsObj.optimization,
            total: counts.total,
        },
        packageManager: packageManagerName,
        runtime: results.runtime.map((d) => {
            return {
                detail: d.detail,
                id: d.id,
                message: d.message,
                status: d.status,
            };
        }),
        runtimeStatus: sectionsObj.runtime,
        security: {
            alerts: results.socketIssues.alerts,
            lowScorePackages: results.socketIssues.lowScore,
            status: sectionsObj.security,
            vulnerabilities: results.vulnCount,
        },
        status: overall,
        supplyChain: {
            findings: results.supplyChain.findings.map((f) => {
                return { detail: f.detail, label: f.label, severity: f.severity };
            }),
            status: results.supplyChain.status,
        },
        workspaces: results.workspaceCount,
    };
};

/**
 * Exit-code policy. `strict` widens the failure set to non-security
 * findings (outdated, duplicates, runtime warnings).
 */
export const shouldFail = (results: DoctorResults, strict: boolean): boolean => {
    const hasRuntimeWarn = results.runtime.some((d) => d.status === "warn");
    const baseFail = results.vulnCount > 0 || results.socketIssues.alerts > 0;

    if (!strict) {
        return baseFail;
    }

    return baseFail || results.outdated.length > 0 || results.duplicates.length > 0 || hasRuntimeWarn;
};
