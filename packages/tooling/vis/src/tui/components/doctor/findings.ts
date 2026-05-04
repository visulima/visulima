import type { DoctorResults, SectionId } from "../../../commands/doctor/sections";
import type { RuntimeDiagnostic } from "../../../runtime/runtime-diagnostics";
import type { DuplicatePackage } from "../../../security/dependency-scan";
import type { OutdatedEntry } from "../../../util/catalog";
import type { OptimizeEntry } from "../optimize/OptimizeStore";

/**
 * Severity drives the color/icon used in the list pane and the
 * sort order inside each section. `error` floats to the top, `warn`
 * sinks. Doctor never produces a `success` finding — clean checks
 * simply emit no row.
 */
export type FindingSeverity = "error" | "warn";

interface BaseFinding {
    /** Stable id for React keys + scroll restoration. */
    readonly id: string;
    /** Section the finding rolls up under. */
    readonly section: SectionId;
    /** Severity classification — drives color + ordering. */
    readonly severity: FindingSeverity;
    /** Optional second-line summary rendered dim under the title. */
    readonly subtitle?: string;
    /** First-line label rendered in the list pane. */
    readonly title: string;
}

export type DoctorFinding =
    | (BaseFinding & { entry: OutdatedEntry; kind: "outdated" })
    | (BaseFinding & { kind: "duplicate"; pkg: DuplicatePackage })
    | (BaseFinding & { entry: OutdatedEntry; kind: "vulnerability"; packageName: string })
    | (BaseFinding & { entry: OutdatedEntry; kind: "socket"; packageName: string })
    | (BaseFinding & { entry: OptimizeEntry; kind: "optimization" })
    | (BaseFinding & { diagnostic: RuntimeDiagnostic; kind: "runtime" });

const SEVERITY_RANK: Record<FindingSeverity, number> = { error: 0, warn: 1 };

const isAcknowledged = (entry: OutdatedEntry): boolean => Boolean(entry.acceptedRisk);

/**
 * Flatten a `DoctorResults` snapshot into a sorted array of findings.
 *
 * Ordering: section declaration order (Dependencies → Security →
 * Optimization → Runtime), then severity (error → warn → info), then
 * the natural order returned by each scan.
 */
export const flattenFindings = (results: DoctorResults): DoctorFinding[] => {
    const findings: DoctorFinding[] = [];

    // Dependencies
    if (results.sections.has("dependencies")) {
        for (const entry of results.outdated) {
            findings.push({
                entry,
                id: `outdated:${entry.packageName}`,
                kind: "outdated",
                section: "dependencies",
                severity: "warn",
                subtitle: `${entry.currentRange} → ${entry.newRange} (${entry.updateType})`,
                title: entry.packageName,
            });
        }

        for (const pkg of results.duplicates) {
            findings.push({
                id: `duplicate:${pkg.name}`,
                kind: "duplicate",
                pkg,
                section: "dependencies",
                severity: "warn",
                subtitle: `${String(pkg.versions.length)} versions installed`,
                title: pkg.name,
            });
        }
    }

    // Security: vulnerabilities + socket alerts. Each outdated entry
    // can carry both, so we emit one finding per channel that has a hit.
    if (results.sections.has("security")) {
        for (const entry of results.outdated) {
            if (entry.vulnerabilities && entry.vulnerabilities.length > 0) {
                const top = entry.vulnerabilities[0]!;
                const sev: FindingSeverity = isAcknowledged(entry) ? "warn" : "error";
                const count = entry.vulnerabilities.length;

                findings.push({
                    entry,
                    id: `vuln:${entry.packageName}`,
                    kind: "vulnerability",
                    packageName: entry.packageName,
                    section: "security",
                    severity: sev,
                    subtitle: count === 1 ? `${top.severity} · ${top.id}` : `${String(count)} advisories · top: ${top.severity} ${top.id}`,
                    title: entry.packageName,
                });
            }

            if (entry.socketReport && entry.socketReport.alerts.length > 0) {
                const score = Math.round(entry.socketReport.score.overall * 100);

                findings.push({
                    entry,
                    id: `socket:${entry.packageName}`,
                    kind: "socket",
                    packageName: entry.packageName,
                    section: "security",
                    severity: "warn",
                    subtitle: `${String(entry.socketReport.alerts.length)} alert${entry.socketReport.alerts.length === 1 ? "" : "s"} · score ${String(score)}%`,
                    title: entry.packageName,
                });
            }
        }
    }

    // Optimization
    if (results.sections.has("optimization")) {
        for (const entry of results.optimizations) {
            findings.push({
                entry,
                id: `opt:${entry.packageName}`,
                kind: "optimization",
                section: "optimization",
                severity: "warn",
                subtitle: `${entry.category} → ${entry.replacement}`,
                title: entry.packageName,
            });
        }
    }

    // Runtime — only surface `warn` diagnostics. `ok` and `skip` rows
    // are confirmations / non-applicable on this platform; the
    // dashboard already prints them.
    if (results.sections.has("runtime")) {
        for (const diagnostic of results.runtime) {
            if (diagnostic.status !== "warn") {
                continue;
            }

            findings.push({
                diagnostic,
                id: `runtime:${diagnostic.id}`,
                kind: "runtime",
                section: "runtime",
                severity: "warn",
                title: diagnostic.message,
            });
        }
    }

    findings.sort((a, b) => {
        if (a.section !== b.section) {
            const order: SectionId[] = ["dependencies", "security", "optimization", "runtime"];

            return order.indexOf(a.section) - order.indexOf(b.section);
        }

        return SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    });

    return findings;
};

export const SECTION_LABELS: Record<SectionId, string> = {
    dependencies: "Dependencies",
    optimization: "Optimization",
    runtime: "Runtime",
    security: "Security",
};
