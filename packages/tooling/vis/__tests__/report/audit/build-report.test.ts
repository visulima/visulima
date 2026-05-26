import { describe, expect, it } from "vitest";

import { explainKey } from "../../../src/ai/audit-explain";
import { AUDIT_REPORT_SCHEMA_VERSION, buildAuditReport } from "../../../src/report/audit/build-report";
import type { SecurityVulnerability } from "../../../src/security/advisories";
import type { PolicyDecision } from "../../../src/security/policies";

const vuln = (overrides: Partial<SecurityVulnerability> = {}): SecurityVulnerability => {
    return {
        aliases: [],
        cvssScore: 7.5,
        fixedVersions: ["4.17.21"],
        id: "GHSA-xxxx-yyyy-zzzz",
        severity: "HIGH",
        summary: "Prototype pollution in lodash",
        ...overrides,
    };
};

const baseInput = {
    bloomHits: [],
    duplicates: [],
    explanations: new Map<string, string>(),
    filtered: [],
    now: new Date("2026-05-11T12:00:00Z"),
    packagesScanned: 100,
    policyDecisions: [],
    tool: { informationUri: "https://example.com", name: "vis-audit", version: "alpha" },
    unknownPolicyTokens: [],
    workspaceRoot: "/repo",
} as const;

describe(buildAuditReport, () => {
    it("should stamp the schema version and ISO timestamp", () => {
        expect.assertions(2);

        const report = buildAuditReport(baseInput);

        expect(report.schemaVersion).toBe(AUDIT_REPORT_SCHEMA_VERSION);
        expect(report.generatedAt).toBe("2026-05-11T12:00:00.000Z");
    });

    it("should produce zero summary counts for an empty input", () => {
        expect.assertions(1);

        const report = buildAuditReport(baseInput);

        expect(report.summary).toStrictEqual({
            accepted: 0,
            duplicatePackages: 0,
            issues: 0,
            policyBlocks: 0,
            policyDecisions: 0,
            total: 0,
        });
    });

    it("should attach an explanation when one is in the lookup map", () => {
        expect.assertions(2);

        const vulnerability = vuln();
        const explanations = new Map<string, string>([
            [explainKey({ packageName: "lodash", packageVersion: "4.17.20", vulnerability }), "RISK: high impact\nVECTOR: prototype pollution"],
        ]);

        const report = buildAuditReport({
            ...baseInput,
            explanations,
            filtered: [{ name: "lodash", version: "4.17.20", vulnerabilities: [vulnerability] }],
        });

        expect(report.results[0]?.vulnerabilities[0]?.explanation).toContain("RISK: high impact");
        expect(report.summary.issues).toBe(1);
    });

    it("should count accepted-risk results separately from issues", () => {
        expect.assertions(2);

        const acceptedRisk = { acceptedAt: "2026-01-01T00:00:00Z", reason: "Tracked elsewhere" };

        const report = buildAuditReport({
            ...baseInput,
            filtered: [
                { acceptedRisk, name: "alpha", version: "1.0.0", vulnerabilities: [vuln()] },
                { name: "beta", version: "1.0.0", vulnerabilities: [vuln({ id: "GHSA-2" })] },
            ],
        });

        expect(report.summary.accepted).toBe(1);
        expect(report.summary.issues).toBe(1);
    });

    it("should treat policy blocks with an acceptedRisk as non-gating", () => {
        expect.assertions(1);

        const policyDecisions: PolicyDecision[] = [
            { packageName: "alpha", policy: "license", reason: "GPL-3.0 disallowed", severity: "block", version: "1.0.0" },
            {
                acceptedRisk: { acceptedAt: "2026-01-01T00:00:00Z", reason: "Tracked elsewhere" },
                packageName: "beta",
                policy: "license",
                reason: "GPL-3.0 disallowed",
                severity: "block",
                version: "1.0.0",
            },
        ];

        const report = buildAuditReport({ ...baseInput, policyDecisions });

        // Two block-level decisions, but only the non-accepted one counts toward gating.
        expect(report.summary.policyBlocks).toBe(1);
    });

    it("should emit a warning entry per unknown policy token", () => {
        expect.assertions(2);

        const report = buildAuditReport({ ...baseInput, unknownPolicyTokens: ["fake-policy", "another"] });

        expect(report.warnings).toHaveLength(2);
        expect(report.warnings[0]).toStrictEqual({ kind: "unknown-policy", token: "fake-policy" });
    });

    it("should project dependencyPaths into the result entry (name+version only)", () => {
        expect.assertions(2);

        const report = buildAuditReport({
            ...baseInput,
            filtered: [
                {
                    dependencyPaths: [
                        [
                            { name: "root", version: "1.0.0" },
                            { name: "lodash", version: "4.17.20" },
                        ],
                    ],
                    name: "lodash",
                    version: "4.17.20",
                    vulnerabilities: [vuln()],
                },
            ],
        });

        expect(report.results[0]?.dependencyPaths).toHaveLength(1);
        expect(report.results[0]?.dependencyPaths[0]).toStrictEqual([
            { name: "root", version: "1.0.0" },
            { name: "lodash", version: "4.17.20" },
        ]);
    });

    it("should default dependencyPaths to an empty array when none are supplied", () => {
        expect.assertions(1);

        const report = buildAuditReport({
            ...baseInput,
            filtered: [{ name: "lodash", version: "4.17.20", vulnerabilities: [vuln()] }],
        });

        expect(report.results[0]?.dependencyPaths).toStrictEqual([]);
    });

    it("should produce a JSON-serialisable object (no Maps, no functions, no undefined)", () => {
        expect.assertions(1);

        const report = buildAuditReport({
            ...baseInput,
            filtered: [{ name: "lodash", version: "4.17.20", vulnerabilities: [vuln()] }],
        });

        const round = JSON.parse(JSON.stringify(report)) as unknown;

        expect(round).toStrictEqual(report);
    });
});
