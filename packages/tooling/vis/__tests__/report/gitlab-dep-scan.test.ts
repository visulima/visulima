import { describe, expect, it } from "vitest";

import { emitGitlabDepScan } from "../../src/report/gitlab-dep-scan";
import type { SecurityVulnerability } from "../../src/security/advisories";
import type { PolicyDecision } from "../../src/security/policies";
import { formatErrors, gitlabDepScanValidator } from "../fixtures/schemas/load";

const vuln = (overrides: Partial<SecurityVulnerability> = {}): SecurityVulnerability => {
    return {
        aliases: ["CVE-2022-12345"],
        cvssScore: 7.5,
        fixedVersions: ["4.17.21"],
        id: "GHSA-xxxx-yyyy-zzzz",
        severity: "HIGH",
        summary: "Prototype pollution in lodash",
        ...overrides,
    };
};

const tool = { informationUri: "https://example.com", name: "vis-audit", version: "alpha" };
const fixedNow = new Date("2026-05-27T12:00:00.000Z");

describe(emitGitlabDepScan, () => {
    it("emits a v15.2.1 dependency-scanning document with an empty vulnerabilities array when nothing matches", () => {
        expect.assertions(4);

        const report = emitGitlabDepScan({ findings: [], now: fixedNow, tool, workspaceRoot: "/repo" });

        expect(report.version).toBe("15.2.1");
        expect(report.schema).toContain("dependency-scanning-report-format.json");
        expect(report.scan.type).toBe("dependency_scanning");
        expect(report.vulnerabilities).toStrictEqual([]);
    });

    it("maps OSV severity to GitLab Title-Case severity", () => {
        expect.assertions(4);

        const findings = [
            { acknowledged: false, packageName: "a", packageVersion: "1.0.0", vulnerability: vuln({ id: "GHSA-1", severity: "CRITICAL" }) },
            { acknowledged: false, packageName: "b", packageVersion: "1.0.0", vulnerability: vuln({ id: "GHSA-2", severity: "MODERATE" }) },
            { acknowledged: false, packageName: "c", packageVersion: "1.0.0", vulnerability: vuln({ id: "GHSA-3", severity: "LOW" }) },
            { acknowledged: false, packageName: "d", packageVersion: "1.0.0", vulnerability: vuln({ id: "GHSA-4", severity: "UNKNOWN" }) },
        ];

        const report = emitGitlabDepScan({ findings, now: fixedNow, tool, workspaceRoot: "/repo" });
        const severities = report.vulnerabilities.map((v) => v.severity);

        expect(severities[0]).toBe("Critical");
        expect(severities[1]).toBe("Medium");
        expect(severities[2]).toBe("Low");
        expect(severities[3]).toBe("Unknown");
    });

    it("emits stable, deterministic UUIDs across runs", () => {
        expect.assertions(2);

        const finding = { acknowledged: false, packageName: "lodash", packageVersion: "4.17.20", vulnerability: vuln() };
        const a = emitGitlabDepScan({ findings: [finding], now: fixedNow, tool, workspaceRoot: "/repo" });
        const b = emitGitlabDepScan({ findings: [finding], now: fixedNow, tool, workspaceRoot: "/repo" });

        expect(a.vulnerabilities[0]!.id).toBe(b.vulnerabilities[0]!.id);
        expect(a.vulnerabilities[0]!.id).toMatch(/^[\da-f]{8}-[\da-f]{4}-5[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/);
    });

    it("attaches GHSA + CVE identifiers and an advisory link", () => {
        expect.assertions(4);

        const finding = { acknowledged: false, packageName: "lodash", packageVersion: "4.17.20", vulnerability: vuln() };
        const report = emitGitlabDepScan({ findings: [finding], now: fixedNow, tool, workspaceRoot: "/repo" });
        const entry = report.vulnerabilities[0]!;
        const types = entry.identifiers.map((i) => i.type);

        expect(types).toContain("ghsa");
        expect(types).toContain("cve");
        expect(entry.identifiers[0]!.url).toContain("github.com/advisories");
        expect(entry.links?.[0]?.url).toContain("github.com/advisories");
    });

    it("sets location.dependency.package.name and version correctly", () => {
        expect.assertions(3);

        const finding = { acknowledged: false, packageName: "lodash", packageVersion: "4.17.20", vulnerability: vuln() };
        const report = emitGitlabDepScan({ findings: [finding], now: fixedNow, tool, workspaceRoot: "/repo" });
        const location = report.vulnerabilities[0]!.location;

        expect(location.dependency.package.name).toBe("lodash");
        expect(location.dependency.version).toBe("4.17.20");
        expect(location.file).toBe("package.json");
    });

    it("emits a solution string when fixedVersions is non-empty", () => {
        expect.assertions(2);

        const finding = { acknowledged: false, packageName: "lodash", packageVersion: "4.17.20", vulnerability: vuln({ fixedVersions: ["4.17.21", "5.0.0"] }) };
        const report = emitGitlabDepScan({ findings: [finding], now: fixedNow, tool, workspaceRoot: "/repo" });

        expect(report.vulnerabilities[0]!.solution).toContain("4.17.21");
        expect(report.vulnerabilities[0]!.solution).toContain("5.0.0");
    });

    it("flags acknowledged findings as likely-false-positive", () => {
        expect.assertions(2);

        const finding = { acknowledged: true, packageName: "lodash", packageVersion: "4.17.20", vulnerability: vuln() };
        const report = emitGitlabDepScan({ findings: [finding], now: fixedNow, tool, workspaceRoot: "/repo" });
        const flags = report.vulnerabilities[0]!.flags ?? [];

        expect(flags).toHaveLength(1);
        expect(flags[0]!.type).toBe("flagged-as-likely-false-positive");
    });

    it("includes non-vulnerability policy decisions as vulnerabilities[] rows", () => {
        expect.assertions(3);

        const decisions: PolicyDecision[] = [
            { packageName: "evil-pkg", policy: "malware", reason: "Detected malware signature", severity: "block", version: "1.0.0" },
            { packageName: "lodash", policy: "vulnerability", reason: "covered separately", severity: "warn", version: "4.17.20" },
        ];
        const report = emitGitlabDepScan({ findings: [], now: fixedNow, policyDecisions: decisions, tool, workspaceRoot: "/repo" });

        expect(report.vulnerabilities).toHaveLength(1);
        expect(report.vulnerabilities[0]!.identifiers[0]!.type).toBe("vis_policy");
        expect(report.vulnerabilities[0]!.severity).toBe("High");
    });

    it("falls back to an OSV identifier for non-GHSA/non-CVE advisory ids", () => {
        expect.assertions(2);

        const finding = {
            acknowledged: false,
            packageName: "evil-pkg",
            packageVersion: "1.0.0",
            vulnerability: vuln({ aliases: [], id: "MAL-2024-001" }),
        };
        const report = emitGitlabDepScan({ findings: [finding], now: fixedNow, tool, workspaceRoot: "/repo" });
        const identifier = report.vulnerabilities[0]!.identifiers[0]!;

        expect(identifier.type).toBe("osv");
        expect(identifier.value).toBe("MAL-2024-001");
    });

    it("honours the artifactUri override for location.file", () => {
        expect.assertions(1);

        const finding = { acknowledged: false, packageName: "lodash", packageVersion: "4.17.20", vulnerability: vuln() };
        const report = emitGitlabDepScan({
            artifactUri: "pnpm-lock.yaml",
            findings: [finding],
            now: fixedNow,
            tool,
            workspaceRoot: "/repo",
        });

        expect(report.vulnerabilities[0]!.location.file).toBe("pnpm-lock.yaml");
    });

    it("produces output that validates against the upstream GitLab dependency-scanning v15.2.1 schema", () => {
        expect.assertions(1);

        const findings = [
            { acknowledged: false, packageName: "lodash", packageVersion: "4.17.20", vulnerability: vuln({ id: "GHSA-1", severity: "CRITICAL" }) },
            { acknowledged: true, packageName: "axios", packageVersion: "0.21.0", vulnerability: vuln({ aliases: [], id: "CVE-2021-12345", severity: "HIGH" }) },
            { acknowledged: false, packageName: "evil-pkg", packageVersion: "1.0.0", vulnerability: vuln({ aliases: [], fixedVersions: [], id: "MAL-2024-001", severity: "UNKNOWN", summary: "" }) },
        ];
        const decisions: PolicyDecision[] = [
            { packageName: "evil-pkg", policy: "malware", reason: "Detected malware signature", severity: "block", version: "1.0.0" },
        ];
        const report = emitGitlabDepScan({ findings, now: fixedNow, policyDecisions: decisions, tool, workspaceRoot: "/repo" });
        const validate = gitlabDepScanValidator();
        const valid = validate(report);

        expect(valid, formatErrors(validate)).toBe(true);
    });
});
